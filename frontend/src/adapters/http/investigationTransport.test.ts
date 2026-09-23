import { describe, expect, it } from 'vitest';
import { ContractInvalidError, createInvestigationTransport } from './investigationTransport';

describe('investigation transport', () => {
  it('maps validated records into domain investigations', async () => {
    const transport = createInvestigationTransport({
      get: async () => ({
        recordType: 'investigation',
        investigation: { id: 'inv-1', ownerId: 'user-1', domain: { submitted: 'Example.com', normalized: 'https://example.com' } },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        sessionIds: ['session-1'],
      }),
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.get('inv-1')).resolves.toMatchObject({
      id: 'inv-1',
      submittedUrl: 'Example.com',
      normalizedUrl: 'https://example.com',
    });
  });

  it('returns typed contract errors instead of empty state', async () => {
    const transport = createInvestigationTransport({
      get: async () => ({ invalid: true }),
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.get('inv-1')).rejects.toSatisfy((error) => {
      return error instanceof ContractInvalidError && error.code === 'contract-invalid';
    });
  });

  it('preserves a valid not-found null from the HTTP client', async () => {
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.get('missing')).resolves.toBeNull();
  });

  it('round-trips full domain state carried by the validated session', async () => {
    const full = fullInvestigation();
    const transport = createInvestigationTransport({
      get: async () => ({
        recordType: 'investigation',
        investigation: { id: full.id, ownerId: 'user-1', domain: { submitted: full.submittedUrl, normalized: full.normalizedUrl } },
        createdAt: full.createdAt,
        updatedAt: full.createdAt,
        sessionIds: ['session-1'],
        latestSession: {
          ...validSessionRecord().session,
          investigationState: full,
        },
      }),
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.get(full.id)).resolves.toEqual(full);
  });

  it('rejects claim when anonymous payload belongs to another investigation', async () => {
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
      claim: async () => { throw new Error('must not claim'); },
      claimPayload: () => ({
        domain: { submitted: 'Example.com', normalized: 'https://example.com' },
        anonymousRecord: {
          ...validSessionRecord(),
          session: { ...validSessionRecord().session, investigationId: 'other-investigation' },
        },
      }),
    });

    await expect(transport.claim('requested-investigation')).rejects.toMatchObject({ code: 'claim-mismatch' });
  });
});

function validSessionRecord() {
  return {
    recordType: 'session',
    session: {
      id: 'session-1',
      investigationId: 'inv-1',
      status: 'idle',
      startedAt: null,
      completedAt: null,
      selectedCapabilities: [],
      capabilityStates: {},
      overall: { status: 'incomplete' },
    },
    persistedAt: '2026-09-23T12:00:00.000Z',
  };
}

function fullInvestigation() {
  return {
    id: 'inv-1',
    submittedUrl: 'Example.com',
    normalizedUrl: 'https://example.com',
    redirectChain: ['https://redirect.example', 'https://example.com'],
    createdAt: '2026-09-23T12:00:00.000Z',
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
  };
}
