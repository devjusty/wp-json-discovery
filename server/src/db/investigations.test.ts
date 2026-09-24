process.env.NODE_ENV = 'test';

import { describe, expect, it, beforeAll } from '@jest/globals';
import {
  claimAnonymousInvestigation,
  createInvestigation,
  getInvestigationForUser,
  listInvestigationsForUser,
  saveInvestigationSession,
} from './investigations.ts';
import { execute, queryAll, queryOne } from './client.js';

const timestamp = '2026-09-10T12:00:00.000Z';

function session(investigationId, id = `${investigationId}-session`) {
  return {
    id,
    investigationId,
    status: 'completed',
    startedAt: timestamp,
    completedAt: timestamp,
    selectedCapabilities: [],
    capabilityStates: {},
    overall: { status: 'complete' },
  };
}

describe('investigation repository', () => {
  beforeAll(() => {
    process.env.TURSO_DATABASE_URL = 'file::memory:';
  });

  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const id of ['user-mapping', 'owner-a', 'snapshot-owner', 'claimed-user', 'other-user', 'list-owner', 'list-other', 'no-session-owner']) {
      await execute(
        `insert or ignore into users (id, email, display_name, role, created_at) values (?, ?, '', 'standard', ?)`,
        [id, `${id}@example.test`, timestamp]
      );
    }
  });

  it('creates and reads an owned investigation with its session', async () => {
    const record = await createInvestigation('user-mapping', {
      domain: { submitted: 'WWW.Example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });
    const saved = await saveInvestigationSession('user-mapping', record.investigation.id, session(record.investigation.id));
    const loaded = await getInvestigationForUser('user-mapping', record.investigation.id);

    expect(record.investigation.ownerId).toBe('user-mapping');
    expect(saved.session.id).toBe(`${record.investigation.id}-session`);
    expect(loaded).toEqual(expect.objectContaining({ recordType: 'investigation' }));
    expect(loaded.investigation.ownerId).toBe('user-mapping');
    expect(loaded.sessionIds).toContain(saved.session.id);
  });

  it('persists complete investigation state on initial authenticated sessions', async () => {
    const record = await createInvestigation('user-mapping', {
      domain: { submitted: 'Initial.example', normalized: 'https://initial.example' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });

    expect(record.latestSession.investigationState).toEqual(expect.objectContaining({
      id: record.investigation.id,
      submittedUrl: 'Initial.example',
      normalizedUrl: 'https://initial.example',
      capabilities: [{ name: 'homepage', status: 'queued' }],
      observationTimeline: [],
      evidence: [],
      findings: [],
    }));
  });

  it('does not return another user investigation', async () => {
    const record = await createInvestigation('owner-a', {
      domain: { submitted: 'example.org', normalized: 'https://example.org' },
      selectedCapabilities: [],
    });

    expect(await getInvestigationForUser('owner-b', record.investigation.id)).toBeNull();
  });

  it('rejects malformed snapshots before writing', async () => {
    const record = await createInvestigation('snapshot-owner', {
      domain: { submitted: 'example.net', normalized: 'https://example.net' },
      selectedCapabilities: [],
    });

    await expect(saveInvestigationSession('snapshot-owner', record.investigation.id, { id: 'bad' }))
      .rejects.toThrow();
  });

  it('rejects session state identity mismatches before persistence', async () => {
    const record = await createInvestigation('snapshot-owner', {
      domain: { submitted: 'state-check.example', normalized: 'https://state-check.example' },
      selectedCapabilities: [],
    });
    const before = await queryOne(
      'select count(1) as count from investigation_sessions where investigation_id = ?',
      [record.investigation.id]
    );
    const invalid = {
      ...session(record.investigation.id, 'mismatched-state-session'),
      investigationState: {
        id: record.investigation.id,
        submittedUrl: 'other.example',
        normalizedUrl: 'https://other.example',
        redirectChain: [],
        createdAt: timestamp,
        capabilities: [],
        observationTimeline: [],
        evidence: [],
        findings: [],
      },
    };

    await expect(saveInvestigationSession('snapshot-owner', record.investigation.id, invalid))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(await queryOne(
      'select count(1) as count from investigation_sessions where investigation_id = ?',
      [record.investigation.id]
    )).toEqual(before);
  });

  it('does not persist an anonymous start', async () => {
    await expect(createInvestigation(null, {
      domain: { submitted: 'anonymous.example', normalized: 'https://anonymous.example' },
      selectedCapabilities: [],
    })).rejects.toThrow();
    expect(await queryOne('select count(1) as count from investigations where owner_id is null')).toEqual({ count: 0 });
  });

  it('does not classify ordinary session history as a pre-v9 claim', async () => {
    const record = await createInvestigation('snapshot-owner', {
      domain: { submitted: 'pre-v9-history.example', normalized: 'https://pre-v9-history.example' },
      selectedCapabilities: [],
    });
    const ordinarySession = session(record.investigation.id, 'ordinary-history-session');

    await saveInvestigationSession('snapshot-owner', record.investigation.id, ordinarySession);

    expect(await queryOne(
      'select count(1) as count from investigation_claims where session_id = ?',
      [ordinarySession.id]
    )).toEqual({ count: 0 });
    expect((await getInvestigationForUser('snapshot-owner', record.investigation.id)).sessionIds)
      .toContain(ordinarySession.id);
  });

  it('imports a browser-held session into an authenticated investigation', async () => {
    const anonymousSession = session('browser-local-investigation', 'browser-local-session');

    const claimed = await claimAnonymousInvestigation('claimed-user', {
      domain: { submitted: 'anonymous.example', normalized: 'https://anonymous.example' },
      anonymousRecord: {
        recordType: 'session',
        session: anonymousSession,
        persistedAt: timestamp,
      },
    });

    expect(claimed.investigation.ownerId).toBe('claimed-user');
    expect(claimed.investigation.domain).toEqual({ submitted: 'anonymous.example', normalized: 'https://anonymous.example' });
    expect(claimed.sessionIds).toEqual(['browser-local-session']);
  });

  it('rewrites claimed full-state identity with canonical investigation ID', async () => {
    const sourceId = 'full-state-browser-investigation';
    const claimed = await claimAnonymousInvestigation('claimed-user', {
      domain: { submitted: 'full-state.example', normalized: 'https://full-state.example' },
      anonymousRecord: {
        recordType: 'session',
        session: {
          ...session(sourceId, 'full-state-browser-session'),
          investigationState: {
            id: sourceId,
            submittedUrl: 'full-state.example',
            normalizedUrl: 'https://full-state.example',
            redirectChain: [],
            createdAt: timestamp,
            capabilities: [],
            observationTimeline: [],
            evidence: [],
            findings: [],
          },
        },
        persistedAt: timestamp,
      },
    });

    expect(claimed.latestSession.investigationState.id).toBe(claimed.investigation.id);
    expect(claimed.latestSession.investigationId).toBe(claimed.investigation.id);
  });

  it('materializes complete state when claiming a legacy session without embedded state', async () => {
    const claimed = await claimAnonymousInvestigation('claimed-user', {
      domain: { submitted: 'legacy.example', normalized: 'https://legacy.example' },
      anonymousRecord: {
        recordType: 'session',
        session: session('legacy-browser-investigation', 'legacy-browser-session'),
        persistedAt: timestamp,
      },
    });

    expect(claimed.latestSession.investigationState).toEqual(expect.objectContaining({
      id: claimed.investigation.id,
      submittedUrl: 'legacy.example',
      normalizedUrl: 'https://legacy.example',
      observationTimeline: [],
      evidence: [],
      findings: [],
    }));
  });

  it('reconstructs claimed state from legacy capability outcomes', async () => {
    const claimed = await claimAnonymousInvestigation('claimed-user', {
      domain: { submitted: 'legacy-results.example', normalized: 'https://legacy-results.example' },
      anonymousRecord: {
        recordType: 'session',
        session: {
          ...session('legacy-results-investigation', 'legacy-results-session'),
          selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
          capabilityStates: {
            homepage: {
              status: 'success',
              outcome: { status: 'success', result: { title: 'Recovered' }, error: null },
              retry: { status: 'not-retryable' },
            },
          },
        },
        persistedAt: timestamp,
      },
    });

    expect(claimed.latestSession.investigationState.capabilities).toEqual([{
      name: 'homepage', status: 'success', result: { title: 'Recovered' },
    }]);
  });

  it('rejects claim identity mismatches before persistence', async () => {
    const before = await queryOne('select count(1) as count from investigations');
    const sourceId = 'mismatched-browser-investigation';

    await expect(claimAnonymousInvestigation('claimed-user', {
      domain: { submitted: 'envelope.example', normalized: 'https://envelope.example' },
      anonymousRecord: {
        recordType: 'session',
        session: {
          ...session(sourceId, 'mismatched-browser-session'),
          investigationState: {
            id: sourceId,
            submittedUrl: 'embedded.example',
            normalizedUrl: 'https://embedded.example',
            redirectChain: [],
            createdAt: timestamp,
            capabilities: [],
            observationTimeline: [],
            evidence: [],
            findings: [],
          },
        },
        persistedAt: timestamp,
      },
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
  });

  it('returns one canonical investigation for concurrent claims by the same user', async () => {
    const anonymousSession = session('raced-browser-investigation', 'raced-browser-session');
    const claim = {
      domain: { submitted: 'raced.example', normalized: 'https://raced.example' },
      anonymousRecord: {
        recordType: 'session',
        session: anonymousSession,
        persistedAt: timestamp,
      },
    };

    const results = await Promise.all([
      claimAnonymousInvestigation('claimed-user', claim),
      claimAnonymousInvestigation('claimed-user', claim),
    ]);

    expect(results[0]).toEqual(results[1]);
    expect(results[0].investigation.ownerId).toBe('claimed-user');
    expect(await queryOne(
      'select count(1) as count from investigations where owner_id = ? and normalized_domain = ?',
      ['claimed-user', 'https://raced.example']
    )).toEqual({ count: 1 });
  });

  it('rejects a concurrent claim by another user without exposing the canonical investigation', async () => {
    const anonymousSession = session('cross-user-raced-investigation', 'cross-user-raced-session');
    const claim = {
      domain: { submitted: 'cross-user-raced.example', normalized: 'https://cross-user-raced.example' },
      anonymousRecord: {
        recordType: 'session',
        session: anonymousSession,
        persistedAt: timestamp,
      },
    };

    const results = await Promise.all([
      claimAnonymousInvestigation('claimed-user', claim),
      claimAnonymousInvestigation('other-user', claim),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(['claimed-user', 'other-user']).toContain(results.find(Boolean).investigation.ownerId);
    expect(await queryOne(
      'select count(1) as count from investigations where normalized_domain = ?',
      ['https://cross-user-raced.example']
    )).toEqual({ count: 1 });
  });

  it('allocates unique append-only sequences for concurrent session saves', async () => {
    const record = await createInvestigation('claimed-user', {
      domain: { submitted: 'concurrent.example', normalized: 'https://concurrent.example' },
      selectedCapabilities: [],
    });
    const saves = await Promise.all([
      saveInvestigationSession('claimed-user', record.investigation.id, session(record.investigation.id, 'concurrent-1')),
      saveInvestigationSession('claimed-user', record.investigation.id, session(record.investigation.id, 'concurrent-2')),
    ]);
    expect(saves).toHaveLength(2);
    const rows = await queryAll(
      'select sequence from investigation_sessions where investigation_id = ? order by sequence',
      [record.investigation.id]
    );
    expect(rows.map((row) => row.sequence)).toEqual([1, 2, 3]);
  });

  it('returns latest snapshots in sequence order after concurrent appends', async () => {
    const record = await createInvestigation('snapshot-owner', {
      domain: { submitted: 'ordered.example', normalized: 'https://ordered.example' },
      selectedCapabilities: [],
    });
    const first = session(record.investigation.id, 'ordered-first');
    const second = session(record.investigation.id, 'ordered-second');

    await Promise.all([
      saveInvestigationSession('snapshot-owner', record.investigation.id, first),
      saveInvestigationSession('snapshot-owner', record.investigation.id, second),
    ]);

    const loaded = await getInvestigationForUser('snapshot-owner', record.investigation.id);
    const rows = await queryAll(
      'select snapshot_json from investigation_sessions where investigation_id = ? order by sequence desc limit 1',
      [record.investigation.id]
    );
    expect(loaded.sessionIds).toHaveLength(3);
    expect(loaded.latestSession.id).toBe(JSON.parse(rows[0].snapshot_json).id);
    expect(await getInvestigationForUser('other-user', record.investigation.id)).toBeNull();
  });

  it('lists only owned investigations in activity order with latest-session summaries', async () => {
    const older = await createInvestigation('list-owner', {
      domain: { submitted: 'older-list.example', normalized: 'https://older-list.example' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });
    const newer = await createInvestigation('list-owner', {
      domain: { submitted: 'newer-list.example', normalized: 'https://newer-list.example' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });
    await createInvestigation('list-other', {
      domain: { submitted: 'foreign-list.example', normalized: 'https://foreign-list.example' },
      selectedCapabilities: [],
    });
    const latest = {
      id: 'latest-list-session',
      investigationId: newer.investigation.id,
      status: 'completed',
      startedAt: timestamp,
      completedAt: timestamp,
      selectedCapabilities: [
        { id: 'homepage', dependencies: [] },
        { id: 'sitemap', dependencies: [] },
        { id: 'robots', dependencies: [] },
      ],
      capabilityStates: {
        homepage: { status: 'success', outcome: { status: 'success', result: { findings: [{ id: 'one' }, { id: 'two' }] }, error: null }, retry: { status: 'not-retryable' } },
        sitemap: { status: 'success', outcome: { status: 'success', result: { findings: [] }, error: null }, retry: { status: 'not-retryable' } },
        robots: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } }, retry: { status: 'not-retryable' } },
      },
      overall: { status: 'incomplete' },
    };
    await saveInvestigationSession('list-owner', newer.investigation.id, latest);
    await execute('update investigations set updated_at = ? where id = ?', ['2027-09-10T12:01:00.000Z', older.investigation.id]);
    await execute('update investigations set updated_at = ? where id = ?', ['2027-09-10T12:02:00.000Z', newer.investigation.id]);

    const list = await listInvestigationsForUser('list-owner');

    expect(list).toEqual({ investigations: [
      {
        id: newer.investigation.id,
        domain: { submitted: 'newer-list.example', normalized: 'https://newer-list.example' },
        createdAt: newer.createdAt,
        updatedAt: '2027-09-10T12:02:00.000Z',
        latestSessionId: 'latest-list-session',
        selectedCapabilityCount: 3,
        completedCapabilityCount: 2,
        findingsCount: 2,
        status: 'incomplete',
        resumable: true,
      },
      {
        id: older.investigation.id,
        domain: { submitted: 'older-list.example', normalized: 'https://older-list.example' },
        createdAt: older.createdAt,
        updatedAt: '2027-09-10T12:01:00.000Z',
        latestSessionId: older.sessionIds[0],
        selectedCapabilityCount: 1,
        completedCapabilityCount: 0,
        findingsCount: 0,
        status: 'incomplete',
        resumable: false,
      },
    ] });
    expect(JSON.stringify(list)).not.toContain('owner_id');
    expect(JSON.stringify(list)).not.toContain('capabilityStates');
  });

  it('uses latest snapshot identity for latest session summaries', async () => {
    const record = await createInvestigation('list-owner', {
      domain: { submitted: 'snapshot-identity.example', normalized: 'https://snapshot-identity.example' },
      selectedCapabilities: [],
    });
    const latestSnapshot = session(record.investigation.id, 'snapshot-session-id');

    await execute(
      `insert into investigation_sessions
        (id, investigation_id, session_id, sequence, snapshot_json, persisted_at)
       values (?, ?, ?, ?, ?, ?)`,
      ['database-row-id', record.investigation.id, 'database-session-id', 2, JSON.stringify(latestSnapshot), timestamp]
    );

    const list = await listInvestigationsForUser('list-owner');

    expect(list.investigations.find(({ id }) => id === record.investigation.id).latestSessionId)
      .toBe('snapshot-session-id');
  });

  it('uses the highest sequence session and returns zero counts without a session', async () => {
    const record = await createInvestigation('list-owner', {
      domain: { submitted: 'sequence-list.example', normalized: 'https://sequence-list.example' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });
    await saveInvestigationSession('list-owner', record.investigation.id, session(record.investigation.id, 'initial-list-session'));
    await execute('insert into investigations (id, owner_id, submitted_domain, normalized_domain, created_at, updated_at) values (?, ?, ?, ?, ?, ?)', [
      'no-session-list-investigation', 'no-session-owner', 'no-session-list.example', 'https://no-session-list.example', timestamp, '2026-09-10T12:03:00.000Z',
    ]);

    const list = await listInvestigationsForUser('list-owner');
    const summary = list.investigations.find(({ id }) => id === record.investigation.id);
    expect(summary).toEqual(expect.objectContaining({
      latestSessionId: 'initial-list-session',
      selectedCapabilityCount: 0,
      completedCapabilityCount: 0,
      findingsCount: 0,
    }));
    expect((await listInvestigationsForUser('no-session-owner')).investigations).toEqual([{
      id: 'no-session-list-investigation',
      domain: { submitted: 'no-session-list.example', normalized: 'https://no-session-list.example' },
      createdAt: timestamp,
      updatedAt: '2026-09-10T12:03:00.000Z',
      selectedCapabilityCount: 0,
      completedCapabilityCount: 0,
      findingsCount: 0,
      status: 'incomplete',
      resumable: false,
    }]);
  });

  it('stores repeated snapshots for one logical session in sequence', async () => {
    const record = await createInvestigation('snapshot-owner', {
      domain: { submitted: 'timeline.example', normalized: 'https://timeline.example' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });
    const logicalSession = {
      ...session(record.investigation.id, record.sessionIds[0]),
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
      capabilityStates: { homepage: { status: 'idle', retry: { status: 'not-retryable' } } },
      overall: { status: 'incomplete' },
      status: 'idle',
      startedAt: null,
      completedAt: null,
    };

    await saveInvestigationSession('snapshot-owner', record.investigation.id, logicalSession);
    await saveInvestigationSession('snapshot-owner', record.investigation.id, {
      ...logicalSession,
      status: 'completed',
      startedAt: timestamp,
      completedAt: timestamp,
      overall: { status: 'complete' },
      capabilityStates: { homepage: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } } },
    });

    const rows = await queryAll(
      'select session_id, sequence, snapshot_json from investigation_sessions where investigation_id = ? order by sequence',
      [record.investigation.id]
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.session_id)).toEqual([record.sessionIds[0], record.sessionIds[0], record.sessionIds[0]]);
    expect(rows.map((row) => JSON.parse(row.snapshot_json).status)).toEqual(['idle', 'idle', 'completed']);
  });
});
