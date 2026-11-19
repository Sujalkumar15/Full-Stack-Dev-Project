import type { WorkspaceMember, WorkspaceRole } from '@prisma/client';

import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';

export async function getWorkspaceMembership(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember | null> {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
  });
}

export async function requireWorkspaceMembership(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember> {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');
  }
  return membership;
}

export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  allowedRoles: readonly WorkspaceRole[],
): Promise<WorkspaceMember> {
  const membership = await requireWorkspaceMembership(workspaceId, userId);
  if (!allowedRoles.includes(membership.role)) {
    throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'You do not have permission to do that.');
  }
  return membership;
}
