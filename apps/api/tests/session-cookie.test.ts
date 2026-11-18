import { describe, expect, it } from 'vitest';

import { getSessionCookieOptions } from '../src/auth/session-cookie.js';

describe('session cookie policy', () => {
  it('is HttpOnly and secure in production', () => {
    expect(getSessionCookieOptions('production')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
  });
});
