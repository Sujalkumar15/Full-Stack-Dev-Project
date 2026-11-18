import type { CookieOptions } from "express";
import { env } from "../../config/env.js";

export const AUTH_COOKIE_NAME = "saas_session";
export const JWT_ISSUER = "saas-project-management-api";
export const JWT_AUDIENCE = "saas-project-management-web";

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export function getAuthCookieOptions(): CookieOptions {
  return {
    ...baseCookieOptions,
    maxAge: env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000,
  };
}

export function getClearAuthCookieOptions(): CookieOptions {
  return { ...baseCookieOptions };
}
