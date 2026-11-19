import type { PageAccess, PageVisibility, WorkspaceRole } from '@prisma/client';

import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { getWorkspaceMembership } from './workspace.js';

const accessRank: Record<PageAccess, number> = {
  READ: 1,
  COMMENT: 2,
  EDIT: 3,
  MANAGE: 4,
};

interface PageAccessNode {
  id: string;
  parentId: string | null;
  visibility: PageVisibility;
  permissions: Array<{ access: PageAccess }>;
}

export class PageAccessResolver {
  private readonly pagesById: Map<string, PageAccessNode>;

  constructor(
    pages: PageAccessNode[],
    private readonly role: WorkspaceRole,
  ) {
    this.pagesById = new Map(pages.map((page) => [page.id, page]));
  }

  hasPage(pageId: string): boolean {
    return this.pagesById.has(pageId);
  }

  getAccess(pageId: string): PageAccess | null {
    if (this.role === 'OWNER' || this.role === 'ADMIN') {
      return this.pagesById.has(pageId) ? 'MANAGE' : null;
    }

    let current = this.pagesById.get(pageId);
    if (!current) {
      return null;
    }

    let explicitAccess: PageAccess | null = null;
    let hasRestrictedAncestor = false;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.visibility === 'RESTRICTED') {
        hasRestrictedAncestor = true;
      }
      for (const permission of current.permissions) {
        if (!explicitAccess || accessRank[permission.access] > accessRank[explicitAccess]) {
          explicitAccess = permission.access;
        }
      }
      current = current.parentId ? this.pagesById.get(current.parentId) : undefined;
    }

    if (hasRestrictedAncestor) {
      return explicitAccess;
    }
    if (this.role === 'MEMBER') {
      if (explicitAccess && accessRank[explicitAccess] > accessRank.EDIT) {
        return explicitAccess;
      }
      return 'EDIT';
    }
    return explicitAccess;
  }
}

export async function createPageAccessResolver(
  workspaceId: string,
  userId: string,
): Promise<PageAccessResolver | null> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    return null;
  }

  const pages = await prisma.page.findMany({
    where: { workspaceId },
    select: {
      id: true,
      parentId: true,
      visibility: true,
      permissions: {
        where: { userId },
        select: { access: true },
      },
    },
  });
  return new PageAccessResolver(pages, membership.role);
}

export function accessMeetsRequirement(actual: PageAccess | null, required: PageAccess): boolean {
  return actual !== null && accessRank[actual] >= accessRank[required];
}

export async function requirePageAccess(
  workspaceId: string,
  pageId: string,
  userId: string,
  required: PageAccess,
): Promise<PageAccess> {
  const resolver = await createPageAccessResolver(workspaceId, userId);
  const actual = resolver?.getAccess(pageId) ?? null;
  if (actual === null || !accessMeetsRequirement(actual, required)) {
    throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found.');
  }
  return actual;
}
