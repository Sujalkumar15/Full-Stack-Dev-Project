import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type { PageAccess } from '@prisma/client';
import { z } from 'zod';

const tokenLifetimeSeconds = 5 * 60;

const claimsSchema = z.object({
  v: z.literal(1),
  jti: z.string().uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  pageId: z.string().uuid(),
  access: z.enum(['READ', 'COMMENT', 'EDIT', 'MANAGE']),
});

export type CollaborationTokenClaims = z.infer<typeof claimsSchema>;

function createSignature(encodedPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`collaboration.v1.${encodedPayload}`, 'utf8').digest();
}

export function createCollaborationToken(
  secret: string,
  input: {
    userId: string;
    sessionId: string;
    workspaceId: string;
    pageId: string;
    access: PageAccess;
  },
): { token: string; expiresAt: Date } {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const claims: CollaborationTokenClaims = {
    v: 1,
    jti: randomUUID(),
    iat: issuedAt,
    exp: issuedAt + tokenLifetimeSeconds,
    ...input,
  };
  const encodedPayload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = createSignature(encodedPayload, secret).toString('base64url');
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(claims.exp * 1_000),
  };
}

export function verifyCollaborationToken(
  token: string,
  secret: string,
): CollaborationTokenClaims | null {
  const [encodedPayload, encodedSignature, extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra) return null;

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(encodedSignature, 'base64url');
  } catch {
    return null;
  }
  const expectedSignature = createSignature(encodedPayload, secret);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const claims = claimsSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')),
    );
    const now = Math.floor(Date.now() / 1_000);
    if (
      claims.exp <= now ||
      claims.iat > now + 30 ||
      claims.exp - claims.iat > tokenLifetimeSeconds
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
