import { describe, expect, it } from 'vitest';
import type { Investigation } from '../../domain/investigation/model';
import { createLocalInvestigationStore } from './localInvestigationStore';

const investigation = {
  id: 'inv-1',
  submittedUrl: 'Example.com',
  normalizedUrl: 'https://example.com',
  redirectChain: [],
  createdAt: '2026-09-23T12:00:00.000Z',
  capabilities: [],
  observationTimeline: [],
  evidence: [],
  findings: [],
} satisfies Investigation;

describe('investigation store port', () => {
  it('round-trips domain values through an in-memory persistence fake', async () => {
    const values = new Map<string, Investigation>();
    const store = createLocalInvestigationStore({
      load: async (id) => values.get(id) ?? null,
      save: async (value) => { values.set(value.id, value); },
      list: async () => [...values.values()],
    });

    await store.save(investigation);

    await expect(store.get('inv-1')).resolves.toEqual(investigation);
    await expect(store.list()).resolves.toEqual([investigation]);
    await expect(store.claim('inv-1')).resolves.toEqual(investigation);
  });
});
