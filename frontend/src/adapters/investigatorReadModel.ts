import { createInvestigation, type CapabilityError, type CapabilityStatus, type Investigation, type JsonValue, type EvidenceKind } from '../domain/investigation/model';
import { rankFindings } from '../domain/investigation/findings';
import { ContractInvalidError } from './contractErrors';

export type InvestigatorCapabilityStatus = CapabilityStatus | 'idle';
export type InvestigatorStatus = 'queued' | 'running' | 'partial' | 'complete' | 'failed' | 'blocked';

type InvestigatorSession = {
  id?: string;
  status?: string;
  startedAt?: string | null;
  overall?: { status?: string; reason?: string; guidance?: string; command?: string };
  domain?: { submitted?: string; normalized?: string; redirectChain?: string[] };
  capabilityStates?: Record<string, {
    status?: string;
    dependencies?: ReadonlyArray<string>;
    options?: Record<string, unknown>;
    metadata?: unknown;
    reason?: string;
    startedAt?: string;
    completedAt?: string;
    outcome?: { result?: unknown; error?: { code?: string; message?: string; retryable?: boolean } };
  }>;
  selectedCapabilities?: ReadonlyArray<{
    id: string;
    dependencies?: ReadonlyArray<string>;
    options?: Record<string, unknown>;
    metadata?: unknown;
    reason?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  selection?: { options?: Record<string, Record<string, unknown>> };
  investigationState?: unknown;
};

type MappedFinding = Omit<Investigation['findings'][number], 'confidence'> & {
  confidence?: Investigation['findings'][number]['confidence'];
};

export type InvestigatorReadModel = Readonly<{
  title: string;
  status?: InvestigatorStatus;
  blocked?: Readonly<{ reason?: string; guidance?: string; command?: string }>;
  sections: ReadonlyArray<Readonly<{ id: string; label: string; description: string; disabled?: boolean }>>;
  capabilities: ReadonlyArray<Readonly<{
    name: string;
    status: InvestigatorCapabilityStatus;
    retryable?: boolean;
    reason?: string;
    error?: CapabilityError;
  }>>;
  investigation?: Investigation;
}>;

export function createInvestigatorReadModel(
  session: InvestigatorSession | null,
  isAdmin: boolean,
  fallbackDomain = '',
): InvestigatorReadModel {
  const canonical = mapCanonicalInvestigation(session?.investigationState);
  const domain = session?.domain?.normalized || canonical?.normalizedUrl || fallbackDomain;
  const capabilities = mergeCapabilitySummaries(
    mapCanonicalCapabilitySummaries(canonical),
    mapCapabilities(session?.capabilityStates),
  );
  const mapped = mapResults(session?.capabilityStates);
  const liveCapabilities = mapCapabilityRuns(session);
  const investigation = domain ? createInvestigation({
    id: canonical?.id ?? `current:${domain}`,
    submittedUrl: canonical?.submittedUrl ?? session?.domain?.submitted ?? domain,
    normalizedUrl: canonical?.normalizedUrl ?? domain,
    redirectChain: canonical?.redirectChain ?? (session?.domain?.redirectChain?.length ? session.domain.redirectChain : [domain]),
    createdAt: canonical?.createdAt ?? session?.startedAt ?? '1970-01-01T00:00:00.000Z',
    capabilities: mergeCapabilityRuns(canonical?.capabilities ?? [], liveCapabilities),
    observationTimeline: canonical?.observationTimeline,
    evidence: mergeEvidence(canonical?.evidence ?? [], mapped.evidence),
    findings: rankFindings(mergeFindings(canonical?.findings ?? [], mapped.findings)),
  }) : undefined;

  return {
    title: domain || 'Investigation workspace',
    status: normalizeInvestigationStatus(session?.overall?.status, session?.status, session?.capabilityStates),
    blocked: mapBlockedState(session, capabilities),
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

function mapBlockedState(
  session: InvestigatorSession | null,
  capabilities: InvestigatorReadModel['capabilities'],
) {
  if (session?.overall?.status !== 'blocked') return undefined;
  const blockedCapability = capabilities.find(({ status }) => status === 'unavailable' || status === 'failed');
  const reason = session.overall.reason ?? blockedCapability?.reason ?? blockedCapability?.error?.message;
  const guidance = session.overall.guidance;
  const command = session.overall.command;
  return {
    ...(reason ? { reason } : {}),
    ...(guidance ? { guidance } : {}),
    ...(command ? { command } : {}),
  };
}

function mapResults(capabilityStates: InvestigatorSession['capabilityStates']) {
  const evidence = new Map<string, Investigation['evidence'][number]>();
  const findings: MappedFinding[] = [];

  Object.entries(capabilityStates ?? {}).forEach(([capability, state]) => {
    if (!normalizeCapabilityStatus(state.status)) return;
    const result = asRecord(state.outcome?.result);
    const resultFindings = Array.isArray(result.findings) ? result.findings : [];
    resultFindings.forEach((rawFinding) => {
      const finding = mapLiveFinding(rawFinding, capability, evidence);
      if (finding) findings.push(finding);
    });
  });

  return { evidence: [...evidence.values()], findings };
}

function mapLiveFinding(
  rawFinding: unknown,
  capability: string,
  evidence: Map<string, Investigation['evidence'][number]>,
): MappedFinding | undefined {
  const finding = asRecord(rawFinding);
  const evidenceIds = mapEvidence(finding.evidence, capability, evidence);
  if (typeof finding.id !== 'string' || typeof finding.summary !== 'string') return undefined;
  return {
    id: finding.id,
    capability,
    summary: finding.summary,
    evidenceIds,
    ...(isConfidence(finding.confidence)
      ? { confidence: finding.confidence }
      : finding.evidenceLevel === 'observed' || evidenceIds.length > 0
        ? { confidence: 'high' as const }
        : {}),
    ...(isConsequence(finding.consequence) ? { consequence: finding.consequence } : {}),
    ...(isEvidenceQuality(finding.evidenceQuality) ? { evidenceQuality: finding.evidenceQuality } : {}),
    ...(isNovelty(finding.novelty) ? { novelty: finding.novelty } : {}),
  };
}

function mapCanonicalInvestigation(value: unknown): Investigation | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractInvalidError('Invalid persisted investigation state');
  }
  try {
    return createInvestigation(value as Investigation);
  } catch (cause) {
    throw new ContractInvalidError('Invalid persisted investigation state', cause);
  }
}

function mergeCapabilityRuns(canonical: Investigation['capabilities'], live: ReturnType<typeof mapCapabilityRuns>) {
  const merged = new Map(canonical.map((item) => [item.name, item]));
  live.forEach((item) => {
    const previous = merged.get(item.name);
    const result = item.status === 'success' && !('result' in item) && previous?.status === 'success'
      ? previous.result
      : undefined;
    const error = !('error' in item) && previous && 'error' in previous ? previous.error : undefined;
    merged.set(item.name, {
      ...item,
      ...(result !== undefined ? { result } : {}),
      ...(error !== undefined ? { error } : {}),
    } as Investigation['capabilities'][number]);
  });
  return [...merged.values()];
}

function mergeEvidence(canonical: Investigation['evidence'], live: Investigation['evidence']) {
  const merged = new Map(canonical.map((item) => [item.id, item]));
  live.forEach((item) => {
    const previous = merged.get(item.id);
    merged.set(item.id, mergeEvidenceOverlay(previous, item));
  });
  return [...merged.values()];
}

function mergeFindings(canonical: Investigation['findings'], live: ReadonlyArray<MappedFinding>) {
  const merged = new Map(canonical.map((finding) => [finding.id, finding]));
  live.forEach((finding) => {
    merged.set(finding.id, mergeFindingOverlay(merged.get(finding.id), finding));
  });
  return [...merged.values()];
}

export function mergeFindingOverlay(
  previous: Investigation['findings'][number] | undefined,
  finding: MappedFinding,
): Investigation['findings'][number] {
  if (!previous) return { ...finding, confidence: finding.confidence ?? 'medium' };
  return {
    ...previous,
    ...finding,
    ...(finding.confidence === undefined ? { confidence: previous.confidence } : {}),
    ...(finding.evidenceIds.length === 0 ? { evidenceIds: previous.evidenceIds } : {}),
  };
}

export function mergeEvidenceOverlay(
  previous: Investigation['evidence'][number] | undefined,
  evidence: Investigation['evidence'][number],
): Investigation['evidence'][number] {
  if (!previous) return evidence;
  const sparseDefaults = evidence.kind === 'observed' && evidence.value === 'Observed evidence';
  return {
    ...previous,
    ...(sparseDefaults ? {} : { kind: evidence.kind, value: evidence.value }),
    source: { ...previous.source, ...evidence.source },
  };
}

function mapCapabilities(capabilityStates: InvestigatorSession['capabilityStates']) {
  return Object.entries(capabilityStates ?? {}).flatMap(([name, state]) => {
    const status = normalizeCapabilityStatus(state.status);
    if (!status) return [];
    const error = mapCapabilityError(state.outcome?.error, status);
    const retryable = status === 'unavailable'
      ? false
      : error?.retryable;
    return [{
      name,
      status,
      ...(status === 'failed' || status === 'unavailable') && typeof retryable === 'boolean' ? { retryable } : {},
      ...(typeof state.reason === 'string' ? { reason: state.reason } : {}),
      ...(error ? { error } : {}),
    }];
  });
}

function mapCanonicalCapabilitySummaries(investigation?: Investigation) {
  return investigation?.capabilities.map(({ name, status, error, reason }) => ({
    name,
    status,
    ...(reason ? { reason } : {}),
    ...(error ? { error } : {}),
    ...(status === 'failed' || status === 'unavailable'
      ? { retryable: status === 'failed' && error?.retryable === true }
      : {}),
  })) ?? [];
}

function mergeCapabilitySummaries(
  canonical: ReadonlyArray<Readonly<{ name: string; status: InvestigatorCapabilityStatus; retryable?: boolean }>>,
  live: ReadonlyArray<Readonly<{ name: string; status: InvestigatorCapabilityStatus; retryable?: boolean }>>,
) {
  const merged = new Map(canonical.map((capability) => [capability.name, capability]));
  live.forEach((capability) => {
    const previous = merged.get(capability.name);
    merged.set(capability.name, {
      ...previous,
      ...capability,
      ...(capability.retryable === undefined && previous?.retryable !== undefined
        ? { retryable: previous.retryable }
        : {}),
    });
  });
  return [...merged.values()];
}

function mapCapabilityRuns(session: InvestigatorSession | null) {
  const selections = new Map((session?.selectedCapabilities ?? []).map((selection) => [selection.id, selection]));
  return Object.entries(session?.capabilityStates ?? {}).flatMap(([name, state]) => {
    const status = normalizeCapabilityStatus(state.status);
    if (!status || status === 'idle') return [];
    const selection = selections.get(name);
    const error = mapCapabilityError(state.outcome?.error, status);
    const options = mapJsonRecord(state.options ?? selection?.options ?? session?.selection?.options?.[name]);
    const metadata = asJsonValue(state.metadata ?? selection?.metadata);
    const result = asJsonValue(state.outcome?.result);
    return [{
      name,
      status,
      ...(selection?.dependencies ? { dependencies: [...selection.dependencies] } : {}),
      ...(options ? { options } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      ...(state.reason || selection?.reason ? { reason: state.reason || selection?.reason } : {}),
      ...(state.startedAt || selection?.startedAt ? { startedAt: state.startedAt || selection?.startedAt } : {}),
      ...(state.completedAt || selection?.completedAt ? { completedAt: state.completedAt || selection?.completedAt } : {}),
      ...(status === 'success' && result !== undefined ? { result } : {}),
      ...(error ? { error } : {}),
    }];
  });
}

function mapCapabilityError(value: unknown, status: InvestigatorCapabilityStatus) {
  const error = asRecord(value);
  if (typeof error.code !== 'string' && typeof error.message !== 'string') return undefined;
  return {
    code: typeof error.code === 'string' ? error.code : 'capability_failed',
    message: typeof error.message === 'string' ? error.message : 'Capability failed.',
    retryable: status === 'failed' && error.retryable === true,
  };
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
    const observedAt = typeof rawSource.observedAt === 'string'
      ? rawSource.observedAt
      : typeof source.observedAt === 'string' ? source.observedAt : undefined;
    const rawBodyValue = rawSource.rawBody ?? source.rawBody;
    const rawBody = typeof rawBodyValue === 'string' ? rawBodyValue : undefined;
    const rawEvidenceIds = rawSource.evidenceIds ?? source.evidenceIds;
    const evidenceIds = Array.isArray(rawEvidenceIds) && rawEvidenceIds.every((id): id is string => typeof id === 'string')
      ? rawEvidenceIds
      : undefined;
    const metadata = {
      ...(locator ? { locator } : {}),
      ...(observedAt ? { observedAt } : {}),
      ...(rawBody !== undefined ? { rawBody } : {}),
      ...(evidenceIds ? { evidenceIds } : {}),
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

function isEvidenceQuality(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isConfidence(value: unknown): value is Investigation['findings'][number]['confidence'] {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isConsequence(value: unknown): value is 'low' | 'medium' | 'high' | 'critical' {
  return isEvidenceQuality(value) || value === 'critical';
}

function isNovelty(value: unknown): value is 'low' | 'medium' | 'high' | 'new' {
  return isEvidenceQuality(value) || value === 'new';
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

function mapJsonRecord(value: unknown): Readonly<Record<string, JsonValue>> | undefined {
  const record = asRecord(value);
  const mapped = Object.entries(record).map(([key, nested]) => [key, asJsonValue(nested)] as const);
  return mapped.every(([, nested]) => nested !== undefined)
    ? Object.fromEntries(mapped) as Readonly<Record<string, JsonValue>>
    : undefined;
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
  if (lifecycleStatus === 'completed') return 'complete';
  if (lifecycleStatus === 'failed') {
    const progress = Object.values(capabilityStates ?? {}).map(({ status: capabilityStatus }) => normalizeCapabilityStatus(capabilityStatus));
    return progress.includes('success') ? 'partial' : 'failed';
  }
  if (lifecycleStatus === 'running') return 'running';
  if (lifecycleStatus === 'queued' || lifecycleStatus === 'idle') return 'queued';
  const progress = Object.values(capabilityStates ?? {}).map(({ status: capabilityStatus }) => normalizeCapabilityStatus(capabilityStatus));
  if (progress.includes('running')) return 'running';
  if (progress.includes('queued') || progress.includes('idle')) return 'queued';
  return undefined;
}
