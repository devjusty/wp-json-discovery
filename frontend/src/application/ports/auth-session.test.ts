import { describe, expect, it } from 'vitest';
import type { AuthSession } from './auth-session';

describe('auth session port', () => {
  it('is usable by application code without Auth0', async () => {
    const session: AuthSession = {
      getUserId: () => 'user-1',
      getAccessToken: async () => 'token-1',
    };

    expect(session.getUserId()).toBe('user-1');
    await expect(session.getAccessToken()).resolves.toBe('token-1');
  });
});
