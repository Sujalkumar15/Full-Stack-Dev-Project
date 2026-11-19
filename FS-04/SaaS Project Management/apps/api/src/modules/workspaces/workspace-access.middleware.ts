import type { MembershipRole } from "@prisma/client";
import type { RequestHandler } from "express";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";

export const requireWorkspaceMembership: RequestHandler = async (request, _response, next) => {
  if (!request.authUser) {
    next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
    return;
  }

  const workspaceId = request.params.workspaceId;
  if (typeof workspaceId !== "string") {
    next(new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND"));
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: request.authUser.id,
      },
    },
    select: {
      id: true,
      isActive: true,
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!membership?.isActive) {
    next(new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND"));
    return;
  }

  request.workspaceAccess = {
    membershipId: membership.id,
    role: membership.role,
    workspace: membership.workspace,
  };
  next();
};

export function requireWorkspaceRoles(...allowedRoles: MembershipRole[]): RequestHandler {
  return (request, _response, next) => {
    const access = request.workspaceAccess;
    if (!access) {
      next(new AppError(500, "Workspace authorization was not initialized", "AUTHORIZATION_STATE_MISSING"));
      return;
    }

    if (!allowedRoles.includes(access.role)) {
      next(new AppError(403, "You do not have permission to perform this action", "FORBIDDEN"));
      return;
    }

    next();
  };
}
