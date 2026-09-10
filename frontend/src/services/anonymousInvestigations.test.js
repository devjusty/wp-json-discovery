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
      record: { recordType: 'session', session, persistedAt: snapshot.persistedAt }
    });
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
