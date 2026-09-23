import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
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

  it('validates direct persistence values and preserves capability results', async () => {
    const full = {
      ...investigation,
      capabilities: [{ name: 'wordpress', status: 'success', result: { namespaces: ['wp/v2'] } }],
    } as const;
    let saved: unknown;
    const store = createLocalInvestigationStore({
      load: async () => full,
      save: async (value) => { saved = value; },
      list: async () => [full],
      claim: async () => full,
    });

    await store.save(full);
    await expect(store.get('inv-1')).resolves.toMatchObject({ capabilities: [{ result: full.capabilities[0].result }] });
    await expect(store.list()).resolves.toMatchObject([{ capabilities: [{ result: full.capabilities[0].result }] }]);
    await expect(store.claim('inv-1')).resolves.toMatchObject({ capabilities: [{ result: full.capabilities[0].result }] });
    expect(saved).toMatchObject({ capabilities: [{ result: full.capabilities[0].result }] });
  });

  it('maps malformed direct persistence values to contract-invalid errors', async () => {
    const malformed = { ...investigation, capabilities: [{ name: 'wordpress', status: 'success', result: BigInt(1) }] } as unknown as Investigation;
    const store = createLocalInvestigationStore({
      load: async () => malformed,
      save: async () => {},
      list: async () => [malformed],
      claim: async () => malformed,
    });

    await expect(store.get('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
    await expect(store.list()).rejects.toMatchObject({ code: 'contract-invalid' });
    await expect(store.claim('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
    await expect(store.save(malformed)).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('rejects direct persistence identity mismatches', async () => {
    const mismatched = { ...investigation, id: 'other' };
    const store = createLocalInvestigationStore({
      load: async () => mismatched,
      save: async () => {},
      list: async () => [],
    });

    await expect(store.get('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
    await expect(store.claim('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('validates local IDs before accessing persistence', async () => {
    const load = vi.fn(async () => investigation);
    const store = createLocalInvestigationStore({ load, save: async () => {}, list: async () => [] });

    await expect(store.get('')).rejects.toMatchObject({ code: 'contract-invalid' });
    await expect(store.claim('')).rejects.toMatchObject({ code: 'contract-invalid' });
    expect(load).not.toHaveBeenCalled();
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
    expect(storage.get('snapshot').record.session.capabilityStates.wordpress.outcome).not.toHaveProperty('result');
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

  it('rejects legacy snapshots missing validated full state', async () => {
    const store = createLocalInvestigationStore({
      anonymous: {
        load: () => ({
          domain: { submitted: 'Example.com', normalized: 'https://example.com' },
          record: {
            recordType: 'session',
            session: { id: 'session-1', investigationId: 'inv-1', status: 'idle', startedAt: null, completedAt: null, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'incomplete' } },
            persistedAt: '2026-09-23T12:00:00.000Z',
          },
        }),
        save: () => {},
      },
    });

    await expect(store.get('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('round-trips full domain state through anonymous persistence', async () => {
    const full = {
      ...investigation,
      redirectChain: ['https://redirect.example', 'https://example.com'],
      capabilities: [{
        name: 'wordpress',
        status: 'success',
        dependencies: ['homepage'],
        metadata: { label: 'WordPress API', required: true },
        result: { namespaces: ['wp/v2'] },
        startedAt: '2026-09-23T12:01:00.000Z',
        completedAt: '2026-09-23T12:02:00.000Z',
      }],
      observationTimeline: [{ id: 'obs-1', capability: 'wordpress', observedAt: '2026-09-23T12:02:00.000Z', value: { status: 200 } }],
      evidence: [{ id: 'evidence-1', kind: 'observed', capability: 'wordpress', value: { source: 'api' }, source: { locator: '/wp-json' } }],
      findings: [{ id: 'finding-1', capability: 'wordpress', summary: 'Public API', evidenceIds: ['evidence-1'], confidence: 'high' }],
    } as Investigation;
    const store = createLocalInvestigationStore();

    await store.save(full);

    await expect(store.get('inv-1')).resolves.toEqual(full);
  });
});
