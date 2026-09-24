import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContractInvalidError, createInvestigationTransport } from './investigationTransport';
import { createInvestigatorReadModel } from '../investigatorReadModel';
import { InvestigatorShell } from '../../ui/shell/InvestigatorShell';

describe('investigation transport', () => {
  it('maps validated records into domain investigations', async () => {
    const state = fullInvestigation();
    const transport = createInvestigationTransport({
      get: async () => ({
        recordType: 'investigation',
        investigation: { id: 'inv-1', ownerId: 'user-1', domain: { submitted: 'Example.com', normalized: 'https://example.com' } },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        sessionIds: ['session-1'],
        latestSession: { ...validSessionRecord().session, investigationState: state },
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

  it('accepts blocked recovery fields on real session responses for read-model mapping', async () => {
    const blockedSession = {
      ...validSessionRecord().session,
      status: 'completed',
      startedAt: '2026-09-23T12:00:00.000Z',
      completedAt: '2026-09-23T12:01:00.000Z',
      overall: {
        status: 'blocked',
        reason: 'Required capability unavailable',
        guidance: 'Enable capability and start a new scan.',
        command: 'scan --capability homepage',
      },
    };
    const transport = createInvestigationTransport({
      get: async () => investigationRecord('inv-1', fullInvestigation(), blockedSession),
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.get('inv-1')).resolves.toMatchObject({ id: 'inv-1' });
    const readModel = createInvestigatorReadModel(blockedSession, false);
    expect(readModel.blocked).toEqual({
      reason: 'Required capability unavailable',
      guidance: 'Enable capability and start a new scan.',
      command: 'scan --capability homepage',
    });
    render(<InvestigatorShell
      readModel={{ ...readModel, sections: [{ id: 'overview', label: 'Overview' }], capabilities: [] }}
      commands={{ onSectionChange: vi.fn() }}
    />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required capability unavailable');
    expect(screen.getByText('scan --capability homepage')).toBeInTheDocument();
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

  it('rejects a validly shaped state with mismatched envelope identity', async () => {
    const transport = createInvestigationTransport({
      get: async () => ({
        recordType: 'investigation',
        investigation: { id: 'inv-1', ownerId: 'user-1', domain: { submitted: 'Example.com', normalized: 'https://example.com' } },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        sessionIds: ['session-1'],
        latestSession: { ...validSessionRecord().session, investigationState: { ...fullInvestigation(), id: 'other' } },
      }),
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.get('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('rejects a record without full state instead of projecting empty fields', async () => {
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

    await expect(transport.get('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('rejects start responses without full state instead of projecting empty fields', async () => {
    const transport = createInvestigationTransport({
      start: async () => ({
        recordType: 'investigation',
        investigation: { id: 'inv-1', ownerId: 'user-1', domain: { submitted: 'Example.com', normalized: 'https://example.com' } },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        sessionIds: ['session-1'],
        latestSession: validSessionRecord().session,
      }),
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.start({ submitted: 'Example.com', normalized: 'https://example.com' }, []))
      .rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('rejects start responses with a different requested domain', async () => {
    const full = fullInvestigation();
    const transport = createInvestigationTransport({
      start: async () => investigationRecord('inv-1', { ...full, normalizedUrl: 'https://other.example' }),
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.start({ submitted: full.submittedUrl, normalized: full.normalizedUrl }, []))
      .rejects.toBeInstanceOf(ContractInvalidError);
  });

  it('validates start domain input before calling the API client', async () => {
    const start = vi.fn();
    const transport = createInvestigationTransport({ start, get: async () => null, list: async () => ({ investigations: [] }), save: async () => validSessionRecord() });

    await expect(transport.start({ submitted: '', normalized: 'https://example.com' }, [])).rejects.toMatchObject({ code: 'contract-invalid' });
    expect(start).not.toHaveBeenCalled();
  });

  it('validates the complete start request before calling the API client', async () => {
    const start = vi.fn();
    const transport = createInvestigationTransport({ start, get: async () => null, list: async () => ({ investigations: [] }), save: async () => validSessionRecord() });
    const domain = { submitted: 'Example.com', normalized: 'https://example.com' };

    await expect(transport.start(domain, [
      { id: 'wordpress', dependencies: [] },
      { id: 'wordpress', dependencies: [] },
    ])).rejects.toMatchObject({ code: 'contract-invalid' });
    await expect(transport.start(domain, [
      { id: 'wordpress', dependencies: ['homepage'] },
    ])).rejects.toMatchObject({ code: 'contract-invalid' });
    expect(start).not.toHaveBeenCalled();
  });

  it('rejects save responses for a different investigation', async () => {
    const full = fullInvestigation();
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => ({
        ...validSessionRecord(),
        session: { ...validSessionRecord().session, investigationId: 'other' },
      }),
    });

    await expect(transport.save(full)).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('rejects save responses for a different session', async () => {
    const full = fullInvestigation();
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => ({
        ...validSessionRecord(),
        session: { ...validSessionRecord().session, id: 'other-session' },
      }),
    });

    await expect(transport.save(full)).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('validates outbound session state before calling save client', async () => {
    const save = vi.fn(async () => validSessionRecord());
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save,
    });
    const invalid = { ...fullInvestigation(), capabilities: [{
      name: 'wordpress', status: 'failed', result: { stale: true },
      error: { code: 'FAILED', message: 'Failed', retryable: false },
    }] } as const;

    await expect(transport.save(invalid)).rejects.toMatchObject({ code: 'contract-invalid' });
    expect(save).not.toHaveBeenCalled();
  });

  it('wraps list hydration failures as contract-invalid errors', async () => {
    const transport = createInvestigationTransport({
      get: async () => { throw new Error('malformed response'); },
      list: async () => ({ investigations: [{
        id: 'inv-1',
        domain: { submitted: 'Example.com', normalized: 'https://example.com' },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        selectedCapabilityCount: 0,
        completedCapabilityCount: 0,
        findingsCount: 0,
      }] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.list()).rejects.toMatchObject({ code: 'contract-invalid' });
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

    await expect(transport.get(full.id)).resolves.toEqual({ ...full, updatedAt: full.createdAt });
  });

  it('preserves successful capability results when serializing a session', async () => {
    const full = fullInvestigation();
    let savedSession;
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async (_id, session) => {
        savedSession = session;
        return { recordType: 'session', session, persistedAt: full.createdAt };
      },
    });

    await transport.save(full);

    expect(savedSession.capabilityStates.wordpress.outcome.result).toEqual(full.capabilities[0].result);
    expect(savedSession.investigationState.findings).toHaveLength(1);
  });

  it('round-trips capability options through session transport', async () => {
    const full = {
      ...fullInvestigation(),
      capabilities: [{
        ...fullInvestigation().capabilities[0],
        name: 'sitemap',
        options: { sitemapUrl: '/custom.xml', maxPages: 2 },
      }],
    };
    let savedSession;
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async (_id, session) => {
        savedSession = session;
        return { recordType: 'session', session, persistedAt: full.createdAt };
      },
    });

    await transport.save(full);

    expect(savedSession.selectedCapabilities).toContainEqual({
      id: 'sitemap',
      dependencies: [],
      options: { sitemapUrl: '/custom.xml', maxPages: 2 },
    });
  });

  it('omits absent successful capability results when serializing a session', async () => {
    const investigation = { ...fullInvestigation(), capabilities: [{ name: 'wordpress', status: 'success' }] } as const;
    let savedSession;
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async (_id, session) => {
        savedSession = session;
        return { recordType: 'session', session, persistedAt: investigation.createdAt };
      },
    });

    await transport.save(investigation);

    expect(savedSession.capabilityStates.wordpress.outcome).not.toHaveProperty('result');
  });

  it('omits absent successful results when mapping full session state', async () => {
    const transport = createInvestigationTransport({
      start: async () => ({
        recordType: 'investigation',
        investigation: { id: 'inv-1', ownerId: 'user-1', domain: { submitted: 'Example.com', normalized: 'https://example.com' } },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        sessionIds: ['session-1'],
        latestSession: {
          ...validSessionRecord().session,
          status: 'completed',
          startedAt: '2026-09-23T12:00:00.000Z',
          completedAt: '2026-09-23T12:00:00.000Z',
          selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
          capabilityStates: {
            wordpress: {
              status: 'success',
              outcome: { status: 'success', error: null },
              retry: { status: 'not-retryable' },
            },
          },
          overall: { status: 'complete' },
          investigationState: {
            ...fullInvestigation(),
            capabilities: [{ name: 'wordpress', status: 'success' }],
          },
        },
      }),
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    const result = await transport.start({ submitted: 'Example.com', normalized: 'https://example.com' }, []);
    expect(result.capabilities[0]).not.toHaveProperty('result');
  });

  it('rejects get results whose record identity differs from requested id', async () => {
    const state = { ...fullInvestigation(), id: 'other' };
    const transport = createInvestigationTransport({
      get: async () => investigationRecord('other', state),
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.get('inv-1')).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('rejects list hydration when a hydrated record identity differs from its summary', async () => {
    const state = { ...fullInvestigation(), id: 'other' };
    const transport = createInvestigationTransport({
      get: async () => investigationRecord('other', state),
      list: async () => ({ investigations: [{
        id: 'inv-1',
        domain: { submitted: 'Example.com', normalized: 'https://example.com' },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        selectedCapabilityCount: 1,
        completedCapabilityCount: 1,
        findingsCount: 1,
      }] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.list()).rejects.toMatchObject({ code: 'contract-invalid' });
  });

  it('rejects list hydration when hydrated URL identity differs from its summary', async () => {
    const state = { ...fullInvestigation(), normalizedUrl: 'https://other.example' };
    const transport = createInvestigationTransport({
      get: async () => investigationRecord('inv-1', state),
      list: async () => ({ investigations: [{
        id: 'inv-1',
        domain: { submitted: 'Example.com', normalized: 'https://example.com' },
        createdAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        selectedCapabilityCount: 1,
        completedCapabilityCount: 1,
        findingsCount: 1,
      }] }),
      save: async () => validSessionRecord(),
    });

    await expect(transport.list()).rejects.toMatchObject({ code: 'contract-invalid' });
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

    await expect(transport.claim('requested-investigation')).rejects.toBeInstanceOf(ContractInvalidError);
  });

  it('sends the validated anonymous session payload when claiming', async () => {
    const full = fullInvestigation();
    let claimedRecord;
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
      claimPayload: () => ({
        domain: { submitted: full.submittedUrl, normalized: full.normalizedUrl },
        anonymousRecord: { ...validSessionRecord(), session: { ...validSessionRecord().session, investigationState: full } },
      }),
      claim: async (_domain, record) => {
        claimedRecord = record;
        return investigationRecord('claimed', { ...full, id: 'claimed' });
      },
    });

    await transport.claim('inv-1');

    expect(claimedRecord).toMatchObject({ recordType: 'session', session: { investigationState: full } });
  });

  it('rejects claim responses with a different requested domain', async () => {
    const full = fullInvestigation();
    const transport = createInvestigationTransport({
      get: async () => null,
      list: async () => ({ investigations: [] }),
      save: async () => validSessionRecord(),
      claimPayload: () => ({
        domain: { submitted: full.submittedUrl, normalized: full.normalizedUrl },
        anonymousRecord: { ...validSessionRecord(), session: { ...validSessionRecord().session, investigationState: full } },
      }),
      claim: async () => investigationRecord('claimed', { ...full, normalizedUrl: 'https://other.example' }),
    });

    await expect(transport.claim('inv-1')).rejects.toBeInstanceOf(ContractInvalidError);
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

function investigationRecord(id, state, sessionOverrides = {}) {
  return {
    recordType: 'investigation',
    investigation: {
      id,
      ownerId: 'user-1',
      domain: { submitted: state.submittedUrl, normalized: state.normalizedUrl },
    },
    createdAt: state.createdAt,
    updatedAt: state.createdAt,
    sessionIds: ['session-1'],
    latestSession: {
      ...validSessionRecord().session,
      ...sessionOverrides,
      investigationId: id,
      investigationState: state,
    },
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
  } as const;
}
