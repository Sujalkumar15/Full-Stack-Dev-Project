import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import { AUTH_COOKIE_NAME } from "../modules/auth/auth.constants.js";
import { verifyAuthToken } from "../modules/auth/auth.token.js";

export const authenticate: RequestHandler = async (request, _response, next) => {
  const token = request.cookies?.[AUTH_COOKIE_NAME];

  if (typeof token !== "string" || token.length === 0) {
    next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
    return;
  }

  try {
    const userId = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("Session user no longer exists");
    }

    request.authUser = user;
    next();
  } catch {
    next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
  }
};
