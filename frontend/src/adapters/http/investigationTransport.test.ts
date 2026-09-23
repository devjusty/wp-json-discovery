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
