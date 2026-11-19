import { randomBytes } from 'node:crypto';

import type { User, Workspace, WorkspaceMember } from '@prisma/client';
import {
  addWorkspaceMemberRequestSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceMemberRequestSchema,
  updateWorkspaceRequestSchema,
  workspaceParamsSchema,
} from '@collaborative-workspace/shared';
import { Router } from 'express';
import { z } from 'zod';

import { getAuthentication, requireAuthentication } from '../auth/middleware.js';
import { toPublicUser } from '../auth/session.js';
import { revalidateWorkspaceConnections } from '../collaboration/hub.js';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { requireWorkspaceMembership, requireWorkspaceRole } from '../permissions/workspace.js';

const memberParamsSchema = workspaceParamsSchema.extend({ userId: z.string().uuid() });

function createSlug(name: string): string {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'workspace'}-${randomBytes(4).toString('hex')}`;
}

function toWorkspaceSummary(workspace: Workspace, role: WorkspaceMember['role']) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    ownerId: workspace.ownerId,
    role,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

function toMemberSummary(member: WorkspaceMember & { user: User }) {
  return {
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: toPublicUser(member.user),
  };
}

export function createWorkspaceRouter() {
  const router = Router();
  router.use(requireAuthentication);

  router.post('/', async (request, response) => {
    const authentication = getAuthentication(response);
    const input = createWorkspaceRequestSchema.parse(request.body);

    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        ownerId: authentication.userId,
        slug: createSlug(input.name),
        members: {
          create: {
            role: 'OWNER',
            userId: authentication.userId,
          },
        },
      },
    });

    response.status(201).json({ workspace: toWorkspaceSummary(workspace, 'OWNER') });
  });

  router.get('/', async (_request, response) => {
    const authentication = getAuthentication(response);
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: authentication.userId },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    });

    response.status(200).json({
      workspaces: memberships.map((membership) =>
        toWorkspaceSummary(membership.workspace, membership.role),
      ),
    });
  });

  router.get('/:workspaceId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const membership = await requireWorkspaceMembership(workspaceId, authentication.userId);
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');
    }

    response.status(200).json({ workspace: toWorkspaceSummary(workspace, membership.role) });
  });

  router.patch('/:workspaceId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const input = updateWorkspaceRequestSchema.parse(request.body);
    const membership = await requireWorkspaceRole(workspaceId, authentication.userId, [
      'OWNER',
      'ADMIN',
    ]);

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: input.name },
    });
    response.status(200).json({ workspace: toWorkspaceSummary(workspace, membership.role) });
  });

  router.get('/:workspaceId/members', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await requireWorkspaceMembership(workspaceId, authentication.userId);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    response.status(200).json({ members: members.map(toMemberSummary) });
  });

  router.post('/:workspaceId/members', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const input = addWorkspaceMemberRequestSchema.parse(request.body);
    const actor = await requireWorkspaceRole(workspaceId, authentication.userId, [
      'OWNER',
      'ADMIN',
    ]);

    if (actor.role === 'ADMIN' && input.role === 'ADMIN') {
      throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Only the owner can add administrators.');
    }

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'A registered account was not found.');
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing) {
      throw new AppError(409, 'MEMBER_EXISTS', 'This person is already a workspace member.');
    }

    const member = await prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: input.role },
      include: { user: true },
    });
    response.status(201).json({ member: toMemberSummary(member) });
  });

  router.patch('/:workspaceId/members/:userId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, userId } = memberParamsSchema.parse(request.params);
    const input = updateWorkspaceMemberRequestSchema.parse(request.body);
    const actor = await requireWorkspaceRole(workspaceId, authentication.userId, [
      'OWNER',
      'ADMIN',
    ]);
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { user: true },
    });
    if (!target) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Workspace member not found.');
    }
    if (target.role === 'OWNER') {
      throw new AppError(403, 'OWNER_IMMUTABLE', 'Workspace ownership cannot be changed here.');
    }
    if (actor.role === 'ADMIN' && (target.role === 'ADMIN' || input.role === 'ADMIN')) {
      throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Only the owner can manage administrators.');
    }

    const member = await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role: input.role },
      include: { user: true },
    });
    await revalidateWorkspaceConnections(workspaceId);
    response.status(200).json({ member: toMemberSummary(member) });
  });

  router.delete('/:workspaceId/members/:userId', async (request, response) => {
    const authentication = getAuthentication(response);
    const { workspaceId, userId } = memberParamsSchema.parse(request.params);
    const actor = await requireWorkspaceRole(workspaceId, authentication.userId, [
      'OWNER',
      'ADMIN',
    ]);
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!target) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Workspace member not found.');
    }
    if (target.role === 'OWNER') {
      throw new AppError(403, 'OWNER_IMMUTABLE', 'The workspace owner cannot be removed.');
    }
    if (actor.role === 'ADMIN' && target.role === 'ADMIN') {
      throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Only the owner can remove administrators.');
    }

    const authoredComments = await prisma.comment.count({
      where: { workspaceId, authorId: userId },
    });
    if (authoredComments > 0) {
      throw new AppError(
        409,
        'MEMBER_HAS_CONTENT',
        'This member cannot be removed while they have authored comments.',
      );
    }

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    await prisma.$transaction(async (transaction) => {
      await transaction.pagePermission.updateMany({
        where: { workspaceId, grantedById: userId },
        data: { grantedById: workspace.ownerId },
      });
      await transaction.page.updateMany({
        where: { workspaceId, createdById: userId },
        data: { createdById: workspace.ownerId },
      });
      await transaction.page.updateMany({
        where: { workspaceId, lastEditedById: userId },
        data: { lastEditedById: workspace.ownerId },
      });
      await transaction.documentVersion.updateMany({
        where: { workspaceId, createdById: userId },
        data: { createdById: workspace.ownerId },
      });
      await transaction.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
    });
    await revalidateWorkspaceConnections(workspaceId);
    response.status(204).send();
  });

  return router;
}
