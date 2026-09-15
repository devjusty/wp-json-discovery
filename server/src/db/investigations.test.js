process.env.NODE_ENV = 'test';

import { describe, expect, it, beforeAll } from '@jest/globals';
import {
  claimAnonymousInvestigation,
  createInvestigation,
  getInvestigationForUser,
  saveInvestigationSession,
} from './investigations.js';
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
    for (const id of ['user-mapping', 'owner-a', 'snapshot-owner', 'claimed-user', 'other-user']) {
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
