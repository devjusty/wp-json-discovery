import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTokenProvider } from '../../api/client';
import { createRemoteInvestigationStore } from './remoteInvestigationStore';

describe('remote investigation store', () => {
  it('delegates domain operations to transport and returns domain values', async () => {
    const investigation = {
      id: 'inv-1', submittedUrl: 'Example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z', capabilities: [],
      observationTimeline: [], evidence: [], findings: [],
    } as const;
    const calls: string[] = [];
    const store = createRemoteInvestigationStore({
      save: async (value) => { calls.push(`save:${value.id}`); },
      get: async () => investigation,
      list: async () => [investigation],
      claim: async (id) => { calls.push(`claim:${id}`); return investigation; },
    });

    await store.save(investigation);
    await expect(store.get('inv-1')).resolves.toEqual(investigation);
    await expect(store.list()).resolves.toEqual([investigation]);
    await expect(store.claim('inv-1')).resolves.toEqual(investigation);
    expect(calls).toEqual(['save:inv-1', 'claim:inv-1']);
  });

  describe('authenticated API transport', () => {
    beforeEach(() => {
      setTokenProvider(async () => 'remote-token');
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
      const store = createRemoteInvestigationStore();

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

      await expect(createRemoteInvestigationStore().get('inv-1'))
        .rejects.toMatchObject({ code: 'contract-invalid' });
    });
  });
});
