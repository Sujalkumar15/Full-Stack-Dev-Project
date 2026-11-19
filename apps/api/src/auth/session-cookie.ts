import type { CookieOptions } from 'express';

export const sessionCookieName = 'collaborative_workspace_session';

export const sessionDurationMilliseconds = 30 * 24 * 60 * 60 * 1_000;

export function getSessionCookieOptions(
  nodeEnv: 'development' | 'test' | 'production',
): CookieOptions {
  return {
    httpOnly: true,
    maxAge: sessionDurationMilliseconds,
    path: '/',
    sameSite: 'lax',
    secure: nodeEnv === 'production',
  };
}

export function getSessionCookieClearOptions(
  nodeEnv: 'development' | 'test' | 'production',
): CookieOptions {
  const { maxAge: _maxAge, ...options } = getSessionCookieOptions(nodeEnv);
  return options;
}
