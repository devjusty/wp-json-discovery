import { randomUUID } from 'node:crypto';
import { ValidationError } from '../utils/errors.js';
import { sanitizeDomain } from '../utils/domain.js';

export function normalizeEnvelope(input = {}) {
  const domain = sanitizeDomain(input.domain);
  if (!domain) {
    throw new ValidationError('domain is required');
  }

  if (typeof input.scanRunId !== 'string' || !input.scanRunId.trim()) {
    throw new ValidationError('scanRunId is required');
  }

  const scannedAt = normalizeIsoDate(input.scannedAt, 'scannedAt');

  const schemaVersion = Number.isFinite(input.schemaVersion)
    ? Math.trunc(input.schemaVersion)
    : 1;

  return {
    envelopeId: typeof input.envelopeId === 'string' && input.envelopeId.trim()
      ? input.envelopeId.trim()
      : randomUUID(),
    domain,
    scanRunId: input.scanRunId.trim(),
    scannedAt,
    schemaVersion,
    coreFindings: normalizeObject(input.coreFindings),
    trustInputs: normalizeObject(input.trustInputs),
    createdAt: new Date().toISOString(),
  };
}

export function normalizeTrustWarningStatus(value) {
  const status = typeof value === 'string' ? value.trim() : '';
  if (!['open', 'resolved', 'ignored'].includes(status)) {
    throw new ValidationError('status must be open, resolved, or ignored');
  }
  return status;
}

export function mapEnvelopeRow(row) {
  if (!row) {
    return null;
  }

  return {
    envelopeId: row.envelope_id,
    domain: row.domain,
    scanRunId: row.scan_run_id,
    scannedAt: row.scanned_at,
    schemaVersion: Number(row.schema_version ?? 1),
    coreFindings: safeParseJson(row.core_findings_json, {}),
    trustInputs: safeParseJson(row.trust_inputs_json, {}),
    createdAt: row.created_at,
  };
}

export function mapWarningRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    envelopeId: row.envelope_id,
    ruleCode: row.rule_code,
    severity: row.severity,
    status: row.status,
    entityRef: safeParseJson(row.entity_ref_json, {}),
    reason: row.reason,
    remediationHint: row.remediation_hint,
    emittedAt: row.emitted_at,
    resolvedAt: row.resolved_at ?? null,
  };
}

function normalizeIsoDate(value, field) {
  const date = new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} must be a valid date`);
  }
  return date.toISOString();
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
}

function safeParseJson(raw, fallback) {
  if (typeof raw !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
