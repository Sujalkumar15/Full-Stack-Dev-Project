import type { RequestHandler } from "express";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";

export const listWorkspaces: RequestHandler = async (request, response) => {
  if (!request.authUser) {
    throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: request.authUser.id,
      isActive: true,
    },
    orderBy: { workspace: { name: "asc" } },
    select: {
      id: true,
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

  response.status(200).json({
    data: {
      workspaces: memberships.map((membership) => ({
        ...membership.workspace,
        membershipId: membership.id,
        role: membership.role,
      })),
    },
  });
};

export const getWorkspace: RequestHandler = (request, response) => {
  if (!request.workspaceAccess) {
    throw new AppError(500, "Workspace authorization was not initialized", "AUTHORIZATION_STATE_MISSING");
  }

  response.status(200).json({
    data: {
      workspace: {
        ...request.workspaceAccess.workspace,
        membershipId: request.workspaceAccess.membershipId,
        role: request.workspaceAccess.role,
      },
    },
  });
};
