import type { CookieOptions } from 'express';

export const sessionCookieName = 'collaborative_workspace_session';

const thirtyDaysInMilliseconds = 30 * 24 * 60 * 60 * 1_000;

export function getSessionCookieOptions(
  nodeEnv: 'development' | 'test' | 'production',
): CookieOptions {
  return {
    httpOnly: true,
    maxAge: thirtyDaysInMilliseconds,
    path: '/',
    sameSite: 'lax',
    secure: nodeEnv === 'production',
  };
}
