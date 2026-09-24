import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTokenProvider } from '../../api/client';
import { createRemoteInvestigationStore } from './remoteInvestigationStore';

const authenticatedSession = (token = 'remote-token') => ({
  getUserId: () => 'user-1',
  getAccessToken: async () => token,
});

describe('remote investigation store', () => {
  it('delegates domain operations to transport and returns domain values', async () => {
    const investigation = {
      id: 'inv-1', submittedUrl: 'Example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z', capabilities: [],
      observationTimeline: [], evidence: [], findings: [],
    } as const;
    const calls: string[] = [];
    const store = createRemoteInvestigationStore({
      authSession: authenticatedSession(),
      transport: {
        save: async (value) => { calls.push(`save:${value.id}`); },
        get: async () => investigation,
        list: async () => [investigation],
        claim: async (id) => { calls.push(`claim:${id}`); return investigation; },
      },
    });

    await store.save(investigation);
    await expect(store.get('inv-1')).resolves.toEqual(investigation);
    await expect(store.list()).resolves.toEqual([investigation]);
    await expect(store.claim('inv-1')).resolves.toEqual(investigation);
    expect(calls).toEqual(['save:inv-1', 'claim:inv-1']);
  });

  it('round-trips complete domain state without projecting fields', async () => {
    const full = {
      id: 'inv-full',
      submittedUrl: 'Example.com',
      normalizedUrl: 'https://example.com',
      redirectChain: ['https://redirect.example', 'https://example.com'],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{
        name: 'wordpress',
        status: 'success',
        dependencies: ['homepage'],
        metadata: { required: true },
        result: { namespaces: ['wp/v2'] },
        startedAt: '2026-09-23T12:01:00.000Z',
        completedAt: '2026-09-23T12:02:00.000Z',
      }],
      observationTimeline: [{ id: 'obs-1', capability: 'wordpress', observedAt: '2026-09-23T12:02:00.000Z', value: { status: 200 } }],
      evidence: [{ id: 'evidence-1', kind: 'observed', capability: 'wordpress', value: { source: 'api' }, source: { locator: '/wp-json' } }],
      findings: [{ id: 'finding-1', capability: 'wordpress', summary: 'Public API', evidenceIds: ['evidence-1'], confidence: 'high' }],
    } as const;
    let saved;
    const store = createRemoteInvestigationStore({
      authSession: authenticatedSession(),
      transport: {
        save: async (value) => { saved = value; },
        get: async () => saved,
        list: async () => saved ? [saved] : [],
        claim: async () => saved,
      },
    });

    await store.save(full);

    await expect(store.get('inv-full')).resolves.toEqual(full);
    await expect(store.list()).resolves.toEqual([full]);
  });

    describe('authenticated API transport', () => {
      beforeEach(() => {
      setTokenProvider(null);
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          status: 'success',
          requestId: 'req-1',
          data: {
            recordType: 'investigation',
            investigation: {
              id: 'inv-1',
              ownerId: 'user-1',
              domain: { submitted: 'Example.com', normalized: 'https://example.com' },
            },
            createdAt: '2026-09-23T12:00:00.000Z',
            updatedAt: '2026-09-23T12:00:00.000Z',
            sessionIds: ['session-1'],
            latestSession: {
              id: 'session-1',
              investigationId: 'inv-1',
              status: 'idle',
              startedAt: null,
              completedAt: null,
              selectedCapabilities: [],
              capabilityStates: {},
              overall: { status: 'incomplete' },
              investigationState: {
                id: 'inv-1',
                submittedUrl: 'Example.com',
                normalizedUrl: 'https://example.com',
                redirectChain: [],
                createdAt: '2026-09-23T12:00:00.000Z',
                capabilities: [],
                observationTimeline: [],
                evidence: [],
                findings: [],
              },
            },
          },
        }),
        text: async () => '',
      })));
    });

    afterEach(() => {
      setTokenProvider(null);
      vi.unstubAllGlobals();
    });

    it('preserves authenticated request headers and maps API data to domain', async () => {
      const store = createRemoteInvestigationStore({ authSession: authenticatedSession() });

      await expect(store.get('inv-1')).resolves.toMatchObject({ id: 'inv-1' });
      expect(vi.mocked(fetch).mock.calls[0][1].headers).toBeInstanceOf(Headers);
      expect((vi.mocked(fetch).mock.calls[0][1].headers as Headers).get('authorization'))
        .toBe('Bearer remote-token');
    });

    it('converts invalid API envelopes into contract-invalid errors', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'success', requestId: 'req-1', data: { invalid: true } }),
        text: async () => '',
      })));

       await expect(createRemoteInvestigationStore({ authSession: authenticatedSession() }).get('inv-1'))
         .rejects.toMatchObject({ code: 'contract-invalid' });
    });

    it('refuses operations without an access token before calling transport', async () => {
      const get = vi.fn(async () => null);
      const store = createRemoteInvestigationStore({
        authSession: authenticatedSession(''),
        transport: { save: async () => {}, get, list: async () => [], claim: async () => { throw new Error('must not claim'); } },
      });

      await expect(store.get('inv-1')).rejects.toMatchObject({ code: 'auth-required' });
      expect(get).not.toHaveBeenCalled();
    });
  });
});
