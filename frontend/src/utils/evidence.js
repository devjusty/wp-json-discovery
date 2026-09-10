export const SUCCESSFUL_EVIDENCE_STATUSES = ['observed', 'corroborated', 'inferred'];

export function normalizeEvidence(evidence, metadata = {}) {
  const entries = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
  const successful = entries.filter((entry) => SUCCESSFUL_EVIDENCE_STATUSES.includes(entry?.status));
  const unavailable = entries.filter((entry) => !SUCCESSFUL_EVIDENCE_STATUSES.includes(entry?.status));

  if (entries.length === 0 && (metadata.evidenceLevel === 'unavailable' || metadata.source || metadata.reason)) {
    unavailable.push({
      status: 'unavailable',
      source: metadata.source,
      reason: metadata.reason ?? 'Evidence was not successful.'
    });
  }

  return { successful, unavailable: canonicalizeEvidence(unavailable) };
}

export function evidenceStatus(entries) {
  return entries.reduce((selected, entry) => (
    evidenceRank(entry?.status) > evidenceRank(selected) ? entry.status : selected
  ), 'unavailable');
}

export function evidenceLabel(status) {
  return {
    observed: 'Observed',
    corroborated: 'Corroborated',
    inferred: 'Inferred',
    unavailable: 'Unavailable'
  }[normalizeEvidenceStatus(status)];
}

export function evidenceSources(entries) {
  return canonicalValues(entries, 'source').join(', ');
}

export function evidenceReasons(entries) {
  return canonicalValues(entries, 'reason').join('; ');
}

export function canonicalizeEvidence(entries) {
  return [...new Map(entries.map((entry) => [
    [entry?.label, entry?.status, entry?.source, entry?.reason].join('\u0000'),
    entry
  ])).values()].sort((left, right) => (
    [left?.label, left?.source, left?.reason, left?.status].map((value) => value ?? '').join('\u0000')
      .localeCompare([right?.label, right?.source, right?.reason, right?.status].map((value) => value ?? '').join('\u0000'))
  ));
}

function canonicalValues(entries, field) {
  return [...new Set(entries.map((entry) => entry?.[field]).filter(Boolean))].sort();
}

function evidenceRank(status) {
  return { observed: 3, corroborated: 2, inferred: 1 }[status] ?? 0;
}

function normalizeEvidenceStatus(status) {
  return SUCCESSFUL_EVIDENCE_STATUSES.includes(status) ? status : 'unavailable';
}
