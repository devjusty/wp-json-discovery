import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimAnonymousInvestigation,
  fetchInvestigation,
  request,
  saveInvestigationSession,
  startInvestigation,
  setAuthUserProvider,
  setTokenProvider
} from './client.js';

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

  it('attaches the user token to /api/recon-scan requests', async () => {
    setTokenProvider(async () => 'recon-token');

    await request('/api/recon-scan', {
      method: 'POST',
      body: JSON.stringify({ domain: 'example.com' })
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0];
    expect(init.headers.get('authorization')).toBe('Bearer recon-token');
  });

  it('checks response status before consuming the response body', async () => {
    const events = [];
    vi.stubGlobal('fetch', vi.fn(async () => ({
      get ok() {
        events.push('status');
        return true;
      },
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => {
        events.push('body');
        return { ok: true };
      },
      text: async () => JSON.stringify({ ok: true })
    })));

    await request('/api/test');

    expect(events).toEqual(['status', 'body']);
  });

  it('starts an investigation with domain and selected capabilities', async () => {
    const record = validInvestigationRecord();
    vi.stubGlobal('fetch', jsonResponse({ status: 'success', requestId: 'req-1', data: record }, 201));
    setTokenProvider(async () => 'investigation-token');

    await expect(startInvestigation({
      submitted: 'Example.com',
      normalized: 'https://example.com'
    }, [{ id: 'wordpress', dependencies: [] }])).resolves.toEqual(record);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:4100/api/investigations');
    expect(JSON.parse(init.body)).toEqual({
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }]
    });
    expect(init.headers.get('authorization')).toBe('Bearer investigation-token');
  });

  it('uses canonical session URL and validates successful responses', async () => {
    const record = validInvestigationRecord();
    vi.stubGlobal('fetch', jsonResponse({ status: 'success', requestId: 'req-1', data: record }));
    setTokenProvider(async () => 'session-token');
    const session = validSession();

    await expect(saveInvestigationSession('inv-1', session)).resolves.toEqual(record);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:4100/api/investigations/inv-1/sessions/session-1');
    expect(JSON.parse(init.body)).toEqual({ session });
    expect(init.headers.get('authorization')).toBe('Bearer session-token');
  });

  it('fetches investigation records through canonical URL', async () => {
    const record = validInvestigationRecord();
    vi.stubGlobal('fetch', jsonResponse({ status: 'success', requestId: 'req-1', data: record }));

    await expect(fetchInvestigation('inv-1')).resolves.toEqual(record);
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:4100/api/investigations/inv-1');
  });

  it('throws stable errors for non-success or invalid envelopes', async () => {
    vi.stubGlobal('fetch', jsonResponse({ status: 'error', requestId: 'req-1', error: {
      code: 'NOT_FOUND', message: 'Investigation not found', retryable: false
    } }, 404));

    await expect(fetchInvestigation('missing')).rejects.toThrow('Investigation not found');

    vi.stubGlobal('fetch', jsonResponse({ status: 'success', requestId: 'req-1', data: { nope: true } }));
    await expect(fetchInvestigation('invalid')).rejects.toThrow('Invalid investigation response');
  });

  it('claims an anonymous record only through explicit API call', async () => {
    const record = validInvestigationRecord();
    vi.stubGlobal('fetch', jsonResponse({ status: 'success', requestId: 'req-1', data: record }));
    const anonymousRecord = { recordType: 'session', session: validSession(), persistedAt: '2026-09-10T12:00:00.000Z' };

    await expect(claimAnonymousInvestigation({
      submitted: 'Example.com', normalized: 'https://example.com'
    }, anonymousRecord)).resolves.toEqual(record);
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:4100/api/investigations/claim');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      anonymousRecord
    });
  });
});

function jsonResponse(data, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data)
  }));
}

function validSession() {
  return {
    id: 'session-1',
    investigationId: 'inv-1',
    status: 'idle',
    startedAt: null,
    completedAt: null,
    selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
    capabilityStates: { wordpress: { status: 'idle', retry: { status: 'not-retryable' } } },
    overall: { status: 'incomplete' }
  };
}

function validInvestigationRecord() {
  return {
    recordType: 'investigation',
    investigation: {
      id: 'inv-1',
      ownerId: 'user-1',
      domain: { submitted: 'Example.com', normalized: 'https://example.com' }
    },
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
    sessionIds: ['session-1']
  };
}
