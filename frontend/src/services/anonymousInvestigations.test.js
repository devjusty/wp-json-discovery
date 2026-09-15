import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createClaimPayload,
  loadAnonymousInvestigation,
  removeAnonymousInvestigation,
  saveAnonymousInvestigation
} from './anonymousInvestigations.js';

const session = {
  id: 'session-1',
  investigationId: 'inv-1',
  status: 'idle',
  startedAt: null,
  completedAt: null,
  selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
  capabilityStates: { wordpress: { status: 'idle', retry: { status: 'not-retryable' } } },
  overall: { status: 'incomplete' }
};
const domain = { submitted: 'Example.com', normalized: 'https://example.com' };

describe('anonymous investigation continuity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a valid anonymous session snapshot', () => {
    const snapshot = { domain, session, persistedAt: '2026-09-10T12:00:00.000Z' };

    saveAnonymousInvestigation(snapshot);

    expect(loadAnonymousInvestigation()).toEqual({
      domain,
      record: { recordType: 'session', session, persistedAt: snapshot.persistedAt },
      revision: 1
    });
    expect(JSON.parse(localStorage.getItem('wpjd:anonymous-investigation:v1')).record).not.toHaveProperty('revision');
  });

  it('ignores and removes malformed or contract-invalid storage', () => {
    localStorage.setItem('wpjd:anonymous-investigation:v1', '{bad json');
    expect(loadAnonymousInvestigation()).toBeNull();
    expect(localStorage.getItem('wpjd:anonymous-investigation:v1')).toBeNull();

    localStorage.setItem('wpjd:anonymous-investigation:v1', JSON.stringify({
      version: 1,
      domain,
      record: { recordType: 'session', session: { nope: true }, persistedAt: '2026-09-10T12:00:00.000Z' }
    }));
    expect(loadAnonymousInvestigation()).toBeNull();
    expect(localStorage.getItem('wpjd:anonymous-investigation:v1')).toBeNull();
  });

  it('only replaces a newer snapshot', () => {
    saveAnonymousInvestigation({ domain, session, persistedAt: '2026-09-10T12:00:00.000Z' });
    saveAnonymousInvestigation({ domain, session: { ...session, id: 'older' }, persistedAt: '2026-09-10T11:00:00.000Z' });
    expect(loadAnonymousInvestigation().record.session.id).toBe('session-1');
    saveAnonymousInvestigation({ domain, session: { ...session, id: 'newer' }, persistedAt: '2026-09-10T13:00:00.000Z' });
    expect(loadAnonymousInvestigation().record.session.id).toBe('newer');
  });

  it('keeps terminal progress when queued and terminal writes share timestamp and revision', () => {
    vi.useFakeTimers();
    const persistedAt = new Date().toISOString();
    const queued = { domain, session: { ...session, status: 'queued' }, persistedAt, revision: 7 };
    const failed = {
      domain,
      session: {
        ...session,
        status: 'failed',
        startedAt: persistedAt,
        completedAt: persistedAt,
        capabilityStates: {
          wordpress: {
            status: 'failed',
            outcome: {
              status: 'failed',
              result: null,
              error: { code: 'failed', message: 'failed', retryable: false }
            },
            retry: { status: 'not-retryable' }
          }
        }
      },
      persistedAt,
      revision: 7
    };

    saveAnonymousInvestigation(queued);
    saveAnonymousInvestigation(failed);

    expect(loadAnonymousInvestigation().record.session.status).toBe('failed');
    vi.useRealTimers();
  });

  it('keeps completed progress at equal timestamp and preserves revision after reload', () => {
    vi.useFakeTimers();
    const persistedAt = new Date().toISOString();
    const running = {
      domain,
      session: { ...session, status: 'running', startedAt: persistedAt },
      persistedAt,
      revision: 3
    };
    const completed = {
      domain,
      session: {
        ...session,
        status: 'completed',
        startedAt: persistedAt,
        completedAt: persistedAt,
        capabilityStates: {
          wordpress: {
            status: 'success',
            outcome: { status: 'success', result: {}, error: null },
            retry: { status: 'not-retryable' }
          }
        },
        overall: { status: 'complete' }
      },
      persistedAt,
      revision: 3
    };

    saveAnonymousInvestigation(running);
    saveAnonymousInvestigation(completed);

    expect(loadAnonymousInvestigation().record.session.status).toBe('completed');
    expect(loadAnonymousInvestigation().revision).toBe(3);
    vi.useRealTimers();
  });

  it('does not replace equal-timestamp terminal progress with a derived running revision', () => {
    vi.useFakeTimers();
    const persistedAt = new Date().toISOString();
    const terminal = {
      domain,
      session: {
        ...session,
        status: 'completed',
        startedAt: persistedAt,
        completedAt: persistedAt,
        capabilityStates: {
          wordpress: {
            status: 'success',
            outcome: { status: 'success', result: {}, error: null },
            retry: { status: 'not-retryable' }
          }
        },
        overall: { status: 'complete' }
      },
      persistedAt,
      revision: 3
    };

    saveAnonymousInvestigation(terminal);
    saveAnonymousInvestigation({
      domain,
      session: { ...session, status: 'running', startedAt: persistedAt },
      persistedAt
    });

    expect(loadAnonymousInvestigation().record.session.status).toBe('completed');
    vi.useRealTimers();
  });

  it('uses a newer explicit revision even when its timestamp is older', () => {
    const current = { domain, session, persistedAt: '2026-09-10T13:00:00.000Z', revision: 5 };
    const newerRevision = { domain, session: { ...session, id: 'newer-revision' }, persistedAt: '2026-09-10T12:00:00.000Z', revision: 6 };

    saveAnonymousInvestigation(current);
    saveAnonymousInvestigation(newerRevision);

    expect(loadAnonymousInvestigation().record.session.id).toBe('newer-revision');
  });

  it('deterministically keeps only the lexically later equal terminal snapshot', () => {
    vi.useFakeTimers();
    const persistedAt = new Date().toISOString();
    const failed = (id) => ({
      domain,
      session: {
        ...session,
        id,
        status: 'failed',
        startedAt: persistedAt,
        completedAt: persistedAt,
        capabilityStates: {
          wordpress: {
            status: 'failed',
            outcome: {
              status: 'failed',
              result: null,
              error: { code: 'failed', message: 'failed', retryable: false }
            },
            retry: { status: 'not-retryable' }
          }
        }
      },
      persistedAt,
      revision: 8
    });

    saveAnonymousInvestigation(failed('z-last'));
    saveAnonymousInvestigation(failed('a-first'));
    expect(loadAnonymousInvestigation().record.session.id).toBe('z-last');

    localStorage.clear();
    saveAnonymousInvestigation(failed('a-first'));
    saveAnonymousInvestigation(failed('z-last'));
    expect(loadAnonymousInvestigation().record.session.id).toBe('z-last');
    vi.useRealTimers();
  });

  it('loads old v1 records without revision as revision zero', () => {
    localStorage.setItem('wpjd:anonymous-investigation:v1', JSON.stringify({
      version: 1,
      domain,
      record: { recordType: 'session', session, persistedAt: '2026-09-10T12:00:00.000Z' }
    }));

    expect(loadAnonymousInvestigation().revision).toBe(0);
  });

  it('creates claim payload only when explicitly requested', () => {
    const snapshot = { domain, session, persistedAt: '2026-09-10T12:00:00.000Z' };

    expect(createClaimPayload(snapshot)).toEqual({
      domain,
      anonymousRecord: { recordType: 'session', session, persistedAt: snapshot.persistedAt }
    });
    expect(loadAnonymousInvestigation()).toBeNull();
  });

  it('does not block scanning when storage throws', () => {
    const storage = { getItem: vi.fn(() => { throw new Error('private mode'); }), setItem: vi.fn(() => { throw new Error('private mode'); }), removeItem: vi.fn(() => { throw new Error('private mode'); }) };
    vi.stubGlobal('localStorage', storage);

    expect(loadAnonymousInvestigation()).toBeNull();
    expect(saveAnonymousInvestigation({ domain, session, persistedAt: '2026-09-10T12:00:00.000Z' })).toBeUndefined();
    expect(removeAnonymousInvestigation()).toBeUndefined();
  });
});
