import {
  domainIdentitySchema,
  sessionRecordSchema
} from '@wp-json-discovery/contracts';

const STORAGE_KEY = 'wpjd:anonymous-investigation:v1';
const STORAGE_VERSION = 1;
const AUTHENTICATED_ID_KEY = 'wpjd:authenticated-investigation:v1';
const TERMINAL_STATUSES = new Set(['failed', 'unavailable', 'completed', 'success']);

export function loadAnonymousInvestigation(options = {}) {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    removeAnonymousInvestigation();
    return null;
  }

  let stored;
  try {
    stored = JSON.parse(raw);
  } catch (cause) {
    removeAnonymousInvestigation();
    if (options.strict) throw Object.assign(new Error('Invalid anonymous investigation snapshot'), { cause });
    return null;
  }

  const snapshot = validateSnapshot(stored);
  if (!snapshot) {
    removeAnonymousInvestigation();
    if (options.strict) throw new Error('Invalid anonymous investigation snapshot');
    return null;
  }
  return snapshot;
}

export function saveAnonymousInvestigation(snapshot) {
  const current = loadAnonymousInvestigation();
  const next = normalizeSnapshot(snapshot, current ? getNextRevision(current.revision) : 1);
  if (!next) return;
  if (current && !shouldReplace(current, next)) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      revision: next.revision,
      domain: next.domain,
      record: next.record,
      ...(next.investigation ? { investigation: next.investigation } : {})
    }));
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}

export function removeAnonymousInvestigation() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}

export function createClaimPayload(snapshot) {
  const normalized = normalizeSnapshot(snapshot);
  if (!normalized) return null;
  return {
    domain: normalized.domain,
    anonymousRecord: normalized.record
  };
}

export function loadAuthenticatedInvestigationId() {
  try {
    return localStorage.getItem(AUTHENTICATED_ID_KEY);
  } catch {
    return null;
  }
}

export function saveAuthenticatedInvestigationId(investigationId) {
  try {
    localStorage.setItem(AUTHENTICATED_ID_KEY, investigationId);
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}

function normalizeSnapshot(snapshot, revisionFallback = 0) {
  if (!snapshot) return null;
  const revision = getRevision(snapshot.revision, revisionFallback);
  const domain = domainIdentitySchema.safeParse(snapshot.domain);
  const record = sessionRecordSchema.safeParse(snapshot.record ?? {
    recordType: 'session',
    session: snapshot.session,
    persistedAt: snapshot.persistedAt
  });
  if (!domain.success || !record.success) return null;
  const normalized = {
    domain: domain.data,
    record: record.data,
    ...(snapshot.investigation ? { investigation: snapshot.investigation } : {}),
    revision,
  };
  Object.defineProperty(normalized, 'hasExplicitRevision', {
    value: Number.isSafeInteger(snapshot.revision),
    enumerable: false
  });
  return normalized;
}

function validateSnapshot(stored) {
  if (stored?.version !== STORAGE_VERSION) return null;
  return normalizeSnapshot(stored, 0);
}

function getRevision(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function getNextRevision(currentRevision) {
  return currentRevision >= Number.MAX_SAFE_INTEGER
    ? Number.MAX_SAFE_INTEGER
    : currentRevision + 1;
}

function shouldReplace(current, next) {
  if (isTerminal(current.record.session.status)
    && !isTerminal(next.record.session.status)
    && Date.parse(next.record.persistedAt) === Date.parse(current.record.persistedAt)) return false;

  if (next.hasExplicitRevision && next.revision !== current.revision) {
    return next.revision > current.revision;
  }

  const currentTime = Date.parse(current.record.persistedAt);
  const nextTime = Date.parse(next.record.persistedAt);
  if (nextTime !== currentTime) return nextTime > currentTime;
  if (next.revision !== current.revision) return next.revision > current.revision;

  const currentRank = getStatusRank(current.record.session.status);
  const nextRank = getStatusRank(next.record.session.status);
  if (nextRank !== currentRank) return nextRank > currentRank;
  if (nextRank < 2 || !TERMINAL_STATUSES.has(next.record.session.status)
    || next.record.session.status !== current.record.session.status) return false;

  return serializeSnapshot(next) > serializeSnapshot(current);
}

function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

function getStatusRank(status) {
  if (TERMINAL_STATUSES.has(status)) return 2;
  if (status === 'running' || status === 'queued') return 1;
  return 0;
}

function serializeSnapshot(snapshot) {
  return JSON.stringify({
    domain: snapshot.domain,
    record: snapshot.record,
    ...(snapshot.investigation ? { investigation: snapshot.investigation } : {}),
  });
}

export { AUTHENTICATED_ID_KEY, STORAGE_KEY };
