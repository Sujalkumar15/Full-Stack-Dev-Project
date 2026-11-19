import { Prisma } from '@prisma/client';
import { loginRequestSchema, registerRequestSchema } from '@collaborative-workspace/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import type { AppConfig } from '../app.js';
import { closeCollaborationSession } from '../collaboration/hub.js';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { getAuthentication, requireAuthentication } from './middleware.js';
import { hashPassword, verifyPassword } from './password.js';
import { createAccountRegistration } from './registration.js';
import { createSession, hashSessionToken, toPublicUser } from './session.js';
import {
  getSessionCookieClearOptions,
  getSessionCookieOptions,
  sessionCookieName,
} from './session-cookie.js';

const invalidCredentialsError = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');

export function createAuthRouter(config: AppConfig) {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: config.nodeEnv === 'test' ? 100 : 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler(request, response) {
      response.status(429).json({
        error: {
          code: 'LOGIN_RATE_LIMITED',
          message: 'Too many login attempts. Please try again later.',
          requestId: request.id,
        },
      });
    },
  });

  router.post('/register', async (request, response) => {
    const input = registerRequestSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);

    try {
      const result = await createAccountRegistration(prisma, input, passwordHash);

      response.cookie(
        sessionCookieName,
        result.session.token,
        getSessionCookieOptions(config.nodeEnv),
      );
      response.status(201).json({ user: toPublicUser(result.user) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'REGISTRATION_FAILED', 'Unable to create this account.');
      }
      throw error;
    }
  });

  router.post('/login', loginLimiter, async (request, response) => {
    const input = loginRequestSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const passwordMatches = await verifyPassword(user?.passwordHash ?? null, input.password);

    if (!user || !passwordMatches) {
      throw invalidCredentialsError();
    }

    const session = await createSession(prisma, user.id);
    response.cookie(sessionCookieName, session.token, getSessionCookieOptions(config.nodeEnv));
    response.status(200).json({ user: toPublicUser(user) });
  });

  router.post('/logout', async (request, response) => {
    const cookieValue = (request.cookies as Record<string, unknown> | undefined)?.[
      sessionCookieName
    ];
    if (typeof cookieValue === 'string' && cookieValue.length > 0) {
      const tokenHash = hashSessionToken(cookieValue);
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        select: { id: true },
      });
      await prisma.session.deleteMany({ where: { tokenHash } });
      if (session) closeCollaborationSession(session.id);
    }

    response.clearCookie(sessionCookieName, getSessionCookieClearOptions(config.nodeEnv));
    response.status(204).send();
  });

  router.get('/me', requireAuthentication, (_request, response) => {
    getAuthentication(response);
    response.status(200).json({ user: toPublicUser(response.locals.user) });
  });

  return router;
}
