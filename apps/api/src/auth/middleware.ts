import type { RequestHandler, Response } from 'express';

import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { findAuthenticatedSession } from './session.js';
import { sessionCookieName } from './session-cookie.js';

export interface AuthenticationContext {
  sessionId: string;
  userId: string;
}

export const requireAuthentication: RequestHandler = async (request, response, next) => {
  const cookieValue = (request.cookies as Record<string, unknown> | undefined)?.[sessionCookieName];

  if (typeof cookieValue !== 'string' || cookieValue.length === 0) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    return;
  }

  const authenticated = await findAuthenticatedSession(prisma, cookieValue);
  if (!authenticated) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    return;
  }

  response.locals.authentication = {
    sessionId: authenticated.session.id,
    userId: authenticated.user.id,
  } satisfies AuthenticationContext;
  response.locals.user = authenticated.user;
  next();
};

export function getAuthentication(response: Response): AuthenticationContext {
  const authentication = response.locals.authentication as AuthenticationContext | undefined;
  if (!authentication) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return authentication;
}
