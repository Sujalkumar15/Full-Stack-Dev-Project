import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { JWT_AUDIENCE, JWT_ISSUER } from "./auth.constants.js";

export function signAuthToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN_HOURS * 60 * 60,
  });
}

export function verifyAuthToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new Error("Invalid authentication token");
  }

  return payload.sub;
}
