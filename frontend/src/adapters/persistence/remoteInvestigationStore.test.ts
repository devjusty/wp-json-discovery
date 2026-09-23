import { describe, expect, it } from 'vitest';
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
});
