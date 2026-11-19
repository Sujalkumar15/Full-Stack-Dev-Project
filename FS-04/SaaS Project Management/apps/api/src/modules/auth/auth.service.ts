import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

function createWorkspaceSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "workspace";

  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function registerUser(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(409, "An account with this email already exists", "EMAIL_ALREADY_REGISTERED");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          displayName: input.name,
          email: input.email,
          passwordHash,
        },
        select: publicUserSelect,
      });

      const workspace = await transaction.workspace.create({
        data: {
          name: input.workspaceName,
          slug: createWorkspaceSlug(input.workspaceName),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const membership = await transaction.membership.create({
        data: {
          role: "OWNER",
          userId: user.id,
          workspaceId: workspace.id,
        },
        select: { id: true },
      });

      return {
        user,
        workspace: { ...workspace, membershipId: membership.id, role: "OWNER" as const },
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "An account with this email already exists", "EMAIL_ALREADY_REGISTERED");
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      ...publicUserSelect,
      passwordHash: true,
    },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
