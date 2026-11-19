import argon2 from 'argon2';

const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const dummyPasswordHash = argon2.hash('not-a-real-user-password', passwordHashOptions);

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, passwordHashOptions);
}

export async function verifyPassword(
  passwordHash: string | null,
  password: string,
): Promise<boolean> {
  const hash = passwordHash ?? (await dummyPasswordHash);

  try {
    const matches = await argon2.verify(hash, password);
    return passwordHash !== null && matches;
  } catch {
    return false;
  }
}
