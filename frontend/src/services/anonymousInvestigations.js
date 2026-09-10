import {
  domainIdentitySchema,
  sessionRecordSchema
} from '@wp-json-discovery/contracts';

const STORAGE_KEY = 'wpjd:anonymous-investigation:v1';
const STORAGE_VERSION = 1;
const AUTHENTICATED_ID_KEY = 'wpjd:authenticated-investigation:v1';

export function loadAnonymousInvestigation() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const snapshot = validateSnapshot(stored);
    if (!snapshot) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return snapshot;
  } catch {
    removeAnonymousInvestigation();
    return null;
  }
}

export function saveAnonymousInvestigation(snapshot) {
  const current = loadAnonymousInvestigation();
  const next = normalizeSnapshot(snapshot);
  if (!next) return;
  if (current && Date.parse(current.record.persistedAt) >= Date.parse(next.record.persistedAt)) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      domain: next.domain,
      record: next.record
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

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  const domain = domainIdentitySchema.safeParse(snapshot.domain);
  const record = sessionRecordSchema.safeParse(snapshot.record ?? {
    recordType: 'session',
    session: snapshot.session,
    persistedAt: snapshot.persistedAt
  });
  if (!domain.success || !record.success) return null;
  return { domain: domain.data, record: record.data };
}

function validateSnapshot(stored) {
  if (stored?.version !== STORAGE_VERSION) return null;
  return normalizeSnapshot(stored);
}

export { AUTHENTICATED_ID_KEY, STORAGE_KEY };
