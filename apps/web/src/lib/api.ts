import { healthResponseSchema, type HealthResponse } from '@collaborative-workspace/shared';

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    credentials: 'include',
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw new Error('The API is unavailable.');
  }

  return healthResponseSchema.parse(await response.json());
}
