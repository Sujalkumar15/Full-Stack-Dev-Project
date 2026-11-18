import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from '../src/index.js';

describe('healthResponseSchema', () => {
  it('accepts the public health contract', () => {
    const value = healthResponseSchema.parse({
      status: 'ok',
      service: 'collaborative-workspace-api',
      timestamp: new Date().toISOString(),
      requestId: 'test-request',
    });

    expect(value.status).toBe('ok');
  });
});
