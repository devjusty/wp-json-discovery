import { createInvestigation, type CapabilityStatus, type Investigation, type JsonValue, type EvidenceKind } from '../domain/investigation/model';

export type InvestigatorCapabilityStatus = CapabilityStatus | 'idle';
export type InvestigatorStatus = 'queued' | 'running' | 'partial' | 'complete' | 'failed' | 'blocked';

type InvestigatorSession = {
  id?: string;
  status?: string;
  startedAt?: string | null;
  overall?: { status?: string };
  domain?: { submitted?: string; normalized?: string; redirectChain?: string[] };
  capabilityStates?: Record<string, {
    status?: string;
    outcome?: { result?: unknown; error?: { code?: string; message?: string; retryable?: boolean } };
  }>;
  selectedCapabilities?: ReadonlyArray<{ id: string; dependencies?: ReadonlyArray<string> }>;
};

export type InvestigatorReadModel = Readonly<{
  title: string;
  status?: InvestigatorStatus;
  sections: ReadonlyArray<Readonly<{ id: string; label: string; description: string; disabled?: boolean }>>;
  capabilities: ReadonlyArray<Readonly<{ name: string; status: InvestigatorCapabilityStatus; retryable?: boolean }>>;
  investigation?: Investigation;
}>;

export function createInvestigatorReadModel(
  session: InvestigatorSession | null,
  isAdmin: boolean,
  fallbackDomain = '',
): InvestigatorReadModel {
  const domain = session?.domain?.normalized || fallbackDomain;
  const capabilities = mapCapabilities(session?.capabilityStates);
  const mapped = mapResults(session?.capabilityStates);
  const investigation = domain ? createInvestigation({
    id: `current:${domain}`,
    submittedUrl: session?.domain?.submitted || domain,
    normalizedUrl: domain,
    redirectChain: session?.domain?.redirectChain?.length ? session.domain.redirectChain : [domain],
    createdAt: session?.startedAt || '1970-01-01T00:00:00.000Z',
     capabilities: Object.entries(session?.capabilityStates ?? {}).flatMap(([name, state]) => {
       const status = normalizeCapabilityStatus(state.status);
       if (!status || status === 'idle') return [];
       const error = state.outcome?.error;
       return [{
         name,
        status,
        ...(status === 'failed' ? {
          error: {
            code: error?.code || 'capability_failed',
            message: error?.message || 'Capability failed.',
            retryable: error?.retryable === true,
          },
        } : {}),
       }];
     }),
    evidence: mapped.evidence,
    findings: mapped.findings,
  }) : undefined;

  return {
    title: domain || 'Investigation workspace',
    status: normalizeInvestigationStatus(session?.overall?.status, session?.status, session?.capabilityStates),
    capabilities,
    investigation,
    sections: [
      { id: 'overview', label: 'Overview', description: 'Site identity and investigation summary.' },
      { id: 'findings', label: 'Findings', description: 'Ranked signals requiring investigator attention.' },
      { id: 'evidence', label: 'Evidence', description: 'Observed evidence and provenance.' },
      { id: 'assets', label: 'Assets', description: 'Discovered site assets and their sources.' },
      { id: 'history', label: 'History', description: 'Previous investigation activity.', disabled: !domain },
      { id: 'tools', label: 'Tools', description: 'Investigation actions and capability controls.' },
    ],
  };
}

function mapResults(capabilityStates: InvestigatorSession['capabilityStates']) {
  const evidence = new Map<string, Investigation['evidence'][number]>();
  const findings: Investigation['findings'][number][] = [];

  Object.entries(capabilityStates ?? {}).forEach(([capability, state]) => {
    if (!normalizeCapabilityStatus(state.status)) return;
    const result = asRecord(state.outcome?.result);
    const resultFindings = Array.isArray(result.findings) ? result.findings : [];
    resultFindings.forEach((rawFinding) => {
      const finding = asRecord(rawFinding);
      const evidenceIds = mapEvidence(finding.evidence, capability, evidence);
      if (typeof finding.id === 'string' && typeof finding.summary === 'string') {
        findings.push({
          id: finding.id,
          capability,
          summary: finding.summary,
          evidenceIds,
          confidence: finding.evidenceLevel === 'observed' || evidenceIds.length > 0 ? 'high' : 'medium',
        });
      }
    });
  });

  return { evidence: [...evidence.values()], findings };
}

function mapCapabilities(capabilityStates: InvestigatorSession['capabilityStates']) {
  return Object.entries(capabilityStates ?? {}).flatMap(([name, state]) => {
    const status = normalizeCapabilityStatus(state.status);
    if (!status) return [];
    const retryable = status === 'failed' && state.outcome?.error?.retryable === true;
    return [{ name, status, ...(status === 'failed' || status === 'unavailable' ? { retryable } : {}) }];
  });
}

function mapEvidence(value: unknown, capability: string, evidence: Map<string, Investigation['evidence'][number]>) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawEvidence) => {
    const source = asRecord(rawEvidence);
    if (typeof source.id !== 'string') return [];
    const rawSource = asRecord(source.source);
    const locator = typeof rawSource.locator === 'string'
      ? rawSource.locator
      : typeof source.locator === 'string' ? source.locator : undefined;
    const request = mapRequest(rawSource.request ?? source.request);
    const metadata = {
      ...(locator ? { locator } : {}),
      ...(typeof rawSource.observedAt === 'string' ? { observedAt: rawSource.observedAt } : {}),
      ...(Array.isArray(rawSource.evidenceIds) && rawSource.evidenceIds.every((id) => typeof id === 'string')
        ? { evidenceIds: rawSource.evidenceIds as string[] } : {}),
      ...(request ? { request } : {}),
    };
    const item = {
      id: source.id,
      kind: isEvidenceKind(source.kind) ? source.kind : 'observed',
      capability,
      value: asJsonValue(source.value) ?? locator ?? 'Observed evidence',
      source: metadata,
    };
    evidence.set(item.id, item);
    return [item.id];
  });
}

function mapRequest(value: unknown) {
  const request = asRecord(value);
  if (typeof request.method !== 'string' || typeof request.url !== 'string') return undefined;
  return {
    method: request.method,
    url: request.url,
    ...(typeof request.status === 'number' ? { status: request.status } : {}),
  };
}

function isEvidenceKind(value: unknown): value is EvidenceKind {
  return ['observed', 'inference', 'request-trace', 'absence'].includes(value as string);
}

function asJsonValue(value: unknown): JsonValue | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const values = value.map(asJsonValue);
    return values.every((item) => item !== undefined) ? values as JsonValue : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, nested]) => [key, asJsonValue(nested)] as const);
    return entries.every(([, nested]) => nested !== undefined)
      ? Object.fromEntries(entries) as JsonValue
      : undefined;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeCapabilityStatus(status?: string): InvestigatorCapabilityStatus | null {
  return ['idle', 'queued', 'running', 'success', 'failed', 'unavailable'].includes(status || '')
    ? status as InvestigatorCapabilityStatus
    : null;
}

function normalizeInvestigationStatus(
  status?: string,
  lifecycleStatus?: string,
  capabilityStates?: InvestigatorSession['capabilityStates'],
): InvestigatorStatus | undefined {
  if (status === 'complete' || status === 'partial' || status === 'failed' || status === 'blocked') return status;
  if (lifecycleStatus === 'running') return 'running';
  if (lifecycleStatus === 'queued' || lifecycleStatus === 'idle') return 'queued';
  const progress = Object.values(capabilityStates ?? {}).map(({ status: capabilityStatus }) => normalizeCapabilityStatus(capabilityStatus));
  if (progress.includes('running')) return 'running';
  if (progress.includes('queued') || progress.includes('idle')) return 'queued';
  return undefined;
}
