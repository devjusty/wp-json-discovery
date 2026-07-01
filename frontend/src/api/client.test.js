import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { request, setAuthUserProvider, setTokenProvider } from './client.js';

describe('request', () => {
  beforeEach(() => {
    setTokenProvider(null);
    setAuthUserProvider(null);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
      text: async () => JSON.stringify({ ok: true })
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the user token to /api/logs requests', async () => {
    setTokenProvider(async () => 'test-token');
    setAuthUserProvider(async () => ({ email: 'user@example.com', name: 'Test User' }));

    await request('/api/logs', {
      method: 'POST',
      body: JSON.stringify({ type: 'scan.complete', payload: { domain: 'example.com' } })
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0];
    expect(init.headers.get('authorization')).toBe('Bearer test-token');
    expect(init.headers.get('x-user-email')).toBe('user@example.com');
    expect(init.headers.get('x-user-name')).toBe('Test User');
  });
});
