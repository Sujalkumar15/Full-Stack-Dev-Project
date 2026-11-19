import type { Page, PageAccess, Prisma } from '@prisma/client';
import {
  createPageRequestSchema,
  pageParamsSchema,
  setPagePermissionRequestSchema,
  updatePageRequestSchema,
  workspaceParamsSchema,
} from '@collaborative-workspace/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { AppConfig } from '../app.js';
import { getAuthentication, requireAuthentication } from '../auth/middleware.js';
import { revalidateWorkspaceConnections } from '../collaboration/hub.js';
import { createCollaborationIdentity } from '../collaboration/identity.js';
import { createCollaborationToken } from '../collaboration/token.js';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import {
  accessMeetsRequirement,
  createPageAccessResolver,
  requirePageAccess,
} from '../permissions/page.js';
import { requireWorkspaceMembership } from '../permissions/workspace.js';

const listPagesQuerySchema = z.object({
  includeArchived: z.enum(['true', 'false']).optional().default('false'),
});

const permissionParamsSchema = pageParamsSchema.extend({ userId: z.string().uuid() });

function toPageSummary(page: Page, access: PageAccess) {
  return {
    id: page.id,
    workspaceId: page.workspaceId,
    parentId: page.parentId,
    title: page.title,
    visibility: page.visibility,
    sortOrder: page.sortOrder,
    archivedAt: page.archivedAt?.toISOString() ?? null,
    access,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

async function ensureNoHierarchyCycle(
  workspaceId: string,
  pageId: string,
  proposedParentId: string,
): Promise<void> {
  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === pageId) {
      throw new AppError(400, 'PAGE_HIERARCHY_CYCLE', 'A page cannot contain itself.');
    }
    if (visited.has(currentId)) {
      throw new AppError(400, 'PAGE_HIERARCHY_CYCLE', 'The page hierarchy is invalid.');
    }
    visited.add(currentId);
    const current: { parentId: string | null } | null = await prisma.page.findUnique({
      where: { workspaceId_id: { workspaceId, id: currentId } },
      select: { parentId: true },
    });
    if (!current) {
      throw new AppError(400, 'INVALID_PARENT_PAGE', 'The parent page is invalid.');
    }
    currentId = current.parentId;
  }
}

async function getPageSubtreeIds(workspaceId: string, rootPageId: string): Promise<string[]> {
  const pages = await prisma.page.findMany({
    where: { workspaceId },
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.parentId) continue;
    const children = childrenByParent.get(page.parentId) ?? [];
    children.push(page.id);
    childrenByParent.set(page.parentId, children);
  }

  const ids: string[] = [];
  const pending = [rootPageId];
  while (pending.length > 0) {
    const id = pending.pop();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    pending.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

export function createPageRouter(config: Pick<AppConfig, 'cookieSecret'>) {
  const router = Router({ mergeParams: true });
  router.use(requireAuthentication);

  router.post('/', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const input = createPageRequestSchema.parse(request.body);
    const membership = await requireWorkspaceMembership(workspaceId, authentication.userId);

    if (membership.role === 'GUEST' && !input.parentId) {
      throw new AppError(403, 'PAGE_FORBIDDEN', 'Guests cannot create root pages.');
    }
    let creatorAccess: PageAccess = 'MANAGE';
    if (input.parentId) {
      const parentAccess = await requirePageAccess(
        workspaceId,
        input.parentId,
        authentication.userId,
        'EDIT',
      );
      if (membership.role === 'GUEST') creatorAccess = parentAccess;
    }

    const sortOrder =
      input.sortOrder ??
      ((
        await prisma.page.aggregate({
          where: { workspaceId, parentId: input.parentId ?? null, archivedAt: null },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? 0) + 1024;

    const page = await prisma.$transaction(async (transaction) => {
      const created = await transaction.page.create({
        data: {
          workspaceId,
          title: input.title,
          parentId: input.parentId ?? null,
          visibility: input.visibility,
          sortOrder,
          createdById: authentication.userId,
          lastEditedById: authentication.userId,
        },
      });
      await transaction.yjsDocument.create({
        data: {
          pageId: created.id,
          workspaceId,
          snapshot: Buffer.alloc(0),
        },
      });
      await transaction.pagePermission.create({
        data: {
          workspaceId,
          pageId: created.id,
          userId: authentication.userId,
          grantedById: authentication.userId,
          access: creatorAccess,
        },
      });
      return created;
    });

    response.status(201).json({ page: toPageSummary(page, creatorAccess) });
  });

  router.get('/', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const query = listPagesQuerySchema.parse(request.query);
    const resolver = await createPageAccessResolver(workspaceId, authentication.userId);
    if (!resolver) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');
    }

    const pages = await prisma.page.findMany({
      where: {
        workspaceId,
        ...(query.includeArchived === 'true' ? {} : { archivedAt: null }),
      },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const visiblePages = pages.flatMap((page) => {
      const access = resolver.getAccess(page.id);
      return access ? [toPageSummary(page, access)] : [];
    });
    response.status(200).json({ pages: visiblePages });
  });

  router.get('/:pageId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId } = pageParamsSchema.parse(request.params);
    const access = await requirePageAccess(workspaceId, pageId, authentication.userId, 'READ');
    const page = await prisma.page.findUnique({
      where: { workspaceId_id: { workspaceId, id: pageId } },
    });
    if (!page) {
      throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found.');
    }
    response.status(200).json({ page: toPageSummary(page, access) });
  });

  router.post('/:pageId/collaboration-token', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId } = pageParamsSchema.parse(request.params);
    const access = await requirePageAccess(workspaceId, pageId, authentication.userId, 'READ');
    const page = await prisma.page.findUnique({
      where: { workspaceId_id: { workspaceId, id: pageId } },
      select: { archivedAt: true },
    });
    if (!page || page.archivedAt) {
      throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found.');
    }
    const collaboration = createCollaborationToken(config.cookieSecret, {
      userId: authentication.userId,
      sessionId: authentication.sessionId,
      workspaceId,
      pageId,
      access,
    });
    response.status(200).json({
      token: collaboration.token,
      expiresAt: collaboration.expiresAt.toISOString(),
      endpoint: '/api/collaboration',
      access,
      user: createCollaborationIdentity(response.locals.user),
    });
  });

  router.patch('/:pageId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId } = pageParamsSchema.parse(request.params);
    const input = updatePageRequestSchema.parse(request.body);
    const changesStructure =
      Object.prototype.hasOwnProperty.call(input, 'parentId') ||
      input.visibility !== undefined ||
      input.sortOrder !== undefined;
    const requiredAccess: PageAccess = changesStructure ? 'MANAGE' : 'EDIT';
    const access = await requirePageAccess(
      workspaceId,
      pageId,
      authentication.userId,
      requiredAccess,
    );

    if (input.parentId) {
      const parentAccess = await requirePageAccess(
        workspaceId,
        input.parentId,
        authentication.userId,
        'EDIT',
      );
      if (!accessMeetsRequirement(parentAccess, 'EDIT')) {
        throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found.');
      }
      await ensureNoHierarchyCycle(workspaceId, pageId, input.parentId);
    }

    const data: Prisma.PageUncheckedUpdateInput = {
      lastEditedById: authentication.userId,
    };
    if (input.title !== undefined) data.title = input.title;
    if (Object.prototype.hasOwnProperty.call(input, 'parentId')) {
      data.parentId = input.parentId ?? null;
    }
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const page = await prisma.page.update({
      where: { workspaceId_id: { workspaceId, id: pageId } },
      data,
    });
    if (changesStructure) await revalidateWorkspaceConnections(workspaceId);
    response.status(200).json({ page: toPageSummary(page, access) });
  });

  router.post('/:pageId/archive', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId } = pageParamsSchema.parse(request.params);
    const access = await requirePageAccess(workspaceId, pageId, authentication.userId, 'MANAGE');
    const subtreeIds = await getPageSubtreeIds(workspaceId, pageId);
    const archivedAt = new Date();
    await prisma.page.updateMany({
      where: { workspaceId, id: { in: subtreeIds } },
      data: { archivedAt, lastEditedById: authentication.userId },
    });
    const page = await prisma.page.findUniqueOrThrow({
      where: { workspaceId_id: { workspaceId, id: pageId } },
    });
    await revalidateWorkspaceConnections(workspaceId);
    response.status(200).json({ page: toPageSummary(page, access) });
  });

  router.post('/:pageId/restore', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId } = pageParamsSchema.parse(request.params);
    const access = await requirePageAccess(workspaceId, pageId, authentication.userId, 'MANAGE');
    const subtreeIds = await getPageSubtreeIds(workspaceId, pageId);
    await prisma.page.updateMany({
      where: { workspaceId, id: { in: subtreeIds } },
      data: { archivedAt: null, lastEditedById: authentication.userId },
    });
    const page = await prisma.page.findUniqueOrThrow({
      where: { workspaceId_id: { workspaceId, id: pageId } },
    });
    await revalidateWorkspaceConnections(workspaceId);
    response.status(200).json({ page: toPageSummary(page, access) });
  });

  router.delete('/:pageId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId } = pageParamsSchema.parse(request.params);
    await requirePageAccess(workspaceId, pageId, authentication.userId, 'MANAGE');
    const subtreeIds = await getPageSubtreeIds(workspaceId, pageId);
    await prisma.page.deleteMany({ where: { workspaceId, id: { in: subtreeIds } } });
    await revalidateWorkspaceConnections(workspaceId);
    response.status(204).send();
  });

  router.put('/:pageId/permissions/:userId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId, userId } = permissionParamsSchema.parse(request.params);
    const input = setPagePermissionRequestSchema.parse(request.body);
    await requirePageAccess(workspaceId, pageId, authentication.userId, 'MANAGE');
    await requireWorkspaceMembership(workspaceId, userId);

    const permission = await prisma.pagePermission.upsert({
      where: { workspaceId_pageId_userId: { workspaceId, pageId, userId } },
      create: {
        workspaceId,
        pageId,
        userId,
        access: input.access,
        grantedById: authentication.userId,
      },
      update: {
        access: input.access,
        grantedById: authentication.userId,
      },
    });
    await revalidateWorkspaceConnections(workspaceId);
    response.status(200).json({
      permission: {
        userId: permission.userId,
        access: permission.access,
      },
    });
  });

  router.delete('/:pageId/permissions/:userId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, pageId, userId } = permissionParamsSchema.parse(request.params);
    await requirePageAccess(workspaceId, pageId, authentication.userId, 'MANAGE');
    await prisma.pagePermission.deleteMany({ where: { workspaceId, pageId, userId } });
    await revalidateWorkspaceConnections(workspaceId);
    response.status(204).send();
  });

  return router;
}
