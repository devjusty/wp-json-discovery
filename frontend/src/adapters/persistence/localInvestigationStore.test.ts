import { beforeEach, afterEach, describe, expect, it } from 'vitest';
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
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

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

  it('wraps anonymous persistence and preserves domain continuity', async () => {
    const storage = new Map();
    const store = createLocalInvestigationStore({
      anonymous: {
        load: () => storage.get('snapshot') ?? null,
        save: (snapshot) => { storage.set('snapshot', snapshot); },
      },
    });

    await store.save({ ...investigation, capabilities: [{ name: 'wordpress', status: 'success' }] });

    await expect(store.get('inv-1')).resolves.toMatchObject({
      id: 'inv-1',
      normalizedUrl: 'https://example.com',
      capabilities: [{ name: 'wordpress', status: 'success' }],
    });
    expect(storage.get('snapshot').revision).toBeUndefined();
  });

  it('surfaces malformed anonymous payloads as contract-invalid errors', async () => {
    const store = createLocalInvestigationStore({
      anonymous: { load: () => ({ version: 1, record: { nope: true } }), save: () => {} },
    });

    await expect(store.list()).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('uses existing anonymous storage revision and contract behavior', async () => {
    const store = createLocalInvestigationStore();
    const value = { ...investigation, capabilities: [{ name: 'wordpress', status: 'success' as const }] };

    await store.save(value);

    await expect(store.get('inv-1')).resolves.toMatchObject(value);
    expect(JSON.parse(localStorage.getItem('wpjd:anonymous-investigation:v1'))).toMatchObject({
      version: 1,
      revision: 1,
    });
  });

  it('rejects invalid persisted anonymous payloads without returning empty state', async () => {
    localStorage.setItem('wpjd:anonymous-investigation:v1', JSON.stringify({
      version: 1,
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      record: { recordType: 'session', session: { nope: true }, persistedAt: 'invalid' },
    }));

    await expect(createLocalInvestigationStore().list()).rejects.toMatchObject({ code: 'contract-invalid' });
  });
});
