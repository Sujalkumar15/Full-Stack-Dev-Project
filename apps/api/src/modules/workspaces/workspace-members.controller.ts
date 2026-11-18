import type { RequestHandler } from "express";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";

export const listWorkspaceMembers: RequestHandler = async (request, response) => {
  if (!request.workspaceAccess) {
    throw new AppError(500, "Workspace authorization was not initialized", "AUTHORIZATION_STATE_MISSING");
  }

  const members = await prisma.membership.findMany({
    where: { workspaceId: request.workspaceAccess.workspace.id, isActive: true },
    orderBy: [{ user: { displayName: "asc" } }, { user: { email: "asc" } }],
    select: {
      id: true,
      role: true,
      user: { select: { id: true, displayName: true, email: true } },
    },
  });

  response.status(200).json({
    data: {
      members: members.map((member) => ({
        membershipId: member.id,
        role: member.role,
        userId: member.user.id,
        displayName: member.user.displayName,
        email: member.user.email,
      })),
    },
  });
};
