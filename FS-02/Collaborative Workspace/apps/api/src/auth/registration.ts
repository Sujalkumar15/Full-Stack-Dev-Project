import type { PrismaClient, User } from '@prisma/client';
import type { RegisterRequest } from '@collaborative-workspace/shared';

import { prepareSession, type PreparedSession } from './session.js';

export interface CompletedRegistration {
  session: Pick<PreparedSession, 'expiresAt' | 'token'>;
  user: User;
}

export async function createAccountRegistration(
  database: PrismaClient,
  input: Pick<RegisterRequest, 'email' | 'name'>,
  passwordHash: string,
  session = prepareSession(),
): Promise<CompletedRegistration> {
  const user = await database.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      sessions: {
        create: {
          expiresAt: session.expiresAt,
          tokenHash: session.tokenHash,
        },
      },
    },
  });

  return {
    session: { expiresAt: session.expiresAt, token: session.token },
    user,
  };
}
