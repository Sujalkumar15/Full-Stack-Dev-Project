import { createHash, randomBytes } from 'node:crypto';

import type { Prisma, PrismaClient, Session, User } from '@prisma/client';
import type { PublicUser } from '@collaborative-workspace/shared';

import { sessionDurationMilliseconds } from './session-cookie.js';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface CreatedSession {
  expiresAt: Date;
  token: string;
}

export interface PreparedSession extends CreatedSession {
  tokenHash: string;
}

export interface AuthenticatedSession {
  session: Session;
  user: User;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function prepareSession(): PreparedSession {
  const token = randomBytes(32).toString('base64url');
  return {
    expiresAt: new Date(Date.now() + sessionDurationMilliseconds),
    token,
    tokenHash: hashSessionToken(token),
  };
}

export async function createSession(
  database: DatabaseClient,
  userId: string,
): Promise<CreatedSession> {
  const session = prepareSession();

  await database.session.create({
    data: {
      expiresAt: session.expiresAt,
      tokenHash: session.tokenHash,
      userId,
    },
  });

  return { expiresAt: session.expiresAt, token: session.token };
}

export async function findAuthenticatedSession(
  database: PrismaClient,
  token: string,
): Promise<AuthenticatedSession | null> {
  const tokenHash = hashSessionToken(token);
  const session = await database.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await database.session.delete({ where: { id: session.id } });
    return null;
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1_000);
  if (session.lastSeenAt < fiveMinutesAgo) {
    await database.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return { session, user: session.user };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}
