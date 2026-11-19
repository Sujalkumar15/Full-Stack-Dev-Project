import type { RequestHandler } from "express";
import { AppError } from "../../errors/app-error.js";
import { AUTH_COOKIE_NAME, getAuthCookieOptions, getClearAuthCookieOptions } from "./auth.constants.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import { authenticateUser, registerUser } from "./auth.service.js";
import { signAuthToken } from "./auth.token.js";

export const register: RequestHandler = async (request, response) => {
  const result = await registerUser(request.body as RegisterInput);
  response.cookie(AUTH_COOKIE_NAME, signAuthToken(result.user.id), getAuthCookieOptions());
  response.status(201).json({ data: result });
};

export const login: RequestHandler = async (request, response) => {
  const user = await authenticateUser(request.body as LoginInput);
  response.cookie(AUTH_COOKIE_NAME, signAuthToken(user.id), getAuthCookieOptions());
  response.status(200).json({ data: { user } });
};

export const logout: RequestHandler = (_request, response) => {
  response.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
  response.status(200).json({ data: { message: "Logged out successfully" } });
};

export const getCurrentUser: RequestHandler = (request, response) => {
  if (!request.authUser) {
    throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  }
  response.status(200).json({ data: { user: request.authUser } });
};
