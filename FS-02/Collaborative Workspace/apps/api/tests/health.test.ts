import { healthResponseSchema } from '@collaborative-workspace/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const app = createApp({
  cookieSecret: 'test-cookie-secret-that-is-long-enough',
  frontendOrigin: 'http://localhost:5175',
  nodeEnv: 'test',
});

describe('GET /api/health', () => {
  it('returns the public health contract and security headers', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(healthResponseSchema.parse(response.body).status).toBe('ok');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });

  it('returns a structured 404 response', async () => {
    const response = await request(app).get('/api/missing').expect(404);

    expect(response.body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
      },
    });
  });
});
