import { createInvestigation, type CapabilityStatus, type Investigation } from '../domain/investigation/model';

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
  status: 'complete' | 'partial' | 'failed' | 'blocked' | 'incomplete';
  sections: ReadonlyArray<Readonly<{ id: string; label: string; description: string; disabled?: boolean }>>;
  capabilities: ReadonlyArray<Readonly<{ name: string; status: CapabilityStatus; retryable?: boolean }>>;
  investigation?: Investigation;
}>;

export function createInvestigatorReadModel(
  session: InvestigatorSession | null,
  isAdmin: boolean,
  fallbackDomain = '',
): InvestigatorReadModel {
  const domain = session?.domain?.normalized || fallbackDomain;
  const capabilities = Object.entries(session?.capabilityStates ?? {}).map(([name, state]) => {
    const status = normalizeCapabilityStatus(state.status);
    const retryable = state.outcome?.error?.retryable === true;
    return { name, status, ...(status === 'failed' || status === 'unavailable' ? { retryable } : {}) };
  });
  const mapped = mapResults(session?.capabilityStates);
  const investigation = domain ? createInvestigation({
    id: `current:${domain}`,
    submittedUrl: session?.domain?.submitted || domain,
    normalizedUrl: domain,
    redirectChain: session?.domain?.redirectChain?.length ? session.domain.redirectChain : [domain],
    createdAt: session?.startedAt || '1970-01-01T00:00:00.000Z',
    capabilities: Object.entries(session?.capabilityStates ?? {}).map(([name, state]) => {
      const status = normalizeCapabilityStatus(state.status);
      const error = state.outcome?.error;
      return {
        name,
        status,
        ...(status === 'failed' ? {
          error: {
            code: error?.code || 'capability_failed',
            message: error?.message || 'Capability failed.',
            retryable: error?.retryable === true,
          },
        } : {}),
      };
    }),
    evidence: mapped.evidence,
    findings: mapped.findings,
  }) : undefined;

  return {
    title: domain || 'Investigation workspace',
    status: normalizeInvestigationStatus(session?.overall?.status),
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

function mapEvidence(value: unknown, capability: string, evidence: Map<string, Investigation['evidence'][number]>) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawEvidence) => {
    const source = asRecord(rawEvidence);
    if (typeof source.id !== 'string') return [];
    const item = {
      id: source.id,
      kind: 'observed' as const,
      capability,
      value: typeof source.locator === 'string' ? source.locator : 'Observed evidence',
      source: typeof source.locator === 'string' ? { locator: source.locator } : {},
    };
    evidence.set(item.id, item);
    return [item.id];
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeCapabilityStatus(status?: string): CapabilityStatus {
  return ['queued', 'running', 'success', 'failed', 'unavailable'].includes(status || '')
    ? status as CapabilityStatus
    : 'unavailable';
}

function normalizeInvestigationStatus(status?: string): InvestigatorReadModel['status'] {
  return status === 'complete' || status === 'partial' || status === 'failed' || status === 'blocked'
    ? status
    : 'incomplete';
}
