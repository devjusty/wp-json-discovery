export type CapabilityStatus = 'queued' | 'running' | 'success' | 'failed' | 'unavailable';

export type EvidenceKind = 'observed' | 'inference' | 'request-trace' | 'absence';

export type JsonValue = null | string | number | boolean | ReadonlyArray<JsonValue> | {
  readonly [key: string]: JsonValue;
};

export type CapabilityError = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
}>;

type CapabilityRunFields = Readonly<{
  name: string;
  dependencies?: ReadonlyArray<string>;
  options?: Readonly<Record<string, JsonValue>>;
  metadata?: JsonValue;
  reason?: string;
  startedAt?: string;
  completedAt?: string;
}>;

export type CapabilityRun =
  | (CapabilityRunFields & Readonly<{ status: 'queued' | 'running'; error?: never }>)
  | (CapabilityRunFields & Readonly<{ status: 'success'; result?: JsonValue; error?: never }>)
  | (CapabilityRunFields & Readonly<{ status: 'failed'; error: CapabilityError }>)
  | (CapabilityRunFields & Readonly<{ status: 'unavailable'; error?: CapabilityError }>);

export type CapabilityRunInput = Readonly<{
  name: string;
  status: CapabilityStatus;
  dependencies?: ReadonlyArray<string>;
  options?: Readonly<Record<string, JsonValue>>;
  metadata?: JsonValue;
  result?: JsonValue;
  error?: CapabilityError;
  reason?: string;
  startedAt?: string;
  completedAt?: string;
}>;

export type EvidenceSource = Readonly<{
  locator?: string;
  observedAt?: string;
  rawBody?: string;
  evidenceIds?: ReadonlyArray<string>;
  request?: Readonly<{
    method: string;
    url: string;
    status?: number;
  }>;
}>;

export type Evidence = Readonly<{
  id: string;
  kind: EvidenceKind;
  capability: string;
  value: JsonValue;
  source: EvidenceSource;
}>;

export type Finding = Readonly<{
  id: string;
  capability: string;
  summary: string;
  evidenceIds: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  consequence?: 'low' | 'medium' | 'high';
  evidenceQuality?: 'low' | 'medium' | 'high';
  novelty?: 'low' | 'medium' | 'high';
}>;

export type Observation = Readonly<{
  id: string;
  capability: string;
  observedAt: string;
  value: JsonValue;
}>;

/** Domain read model. Adapters map transport `domainIdentity` fields into this richer URL identity. */
export type Investigation = Readonly<{
  id: string;
  submittedUrl: string;
  normalizedUrl: string;
  redirectChain: ReadonlyArray<string>;
  createdAt: string;
  capabilities: ReadonlyArray<CapabilityRun>;
  observationTimeline: ReadonlyArray<Observation>;
  evidence: ReadonlyArray<Evidence>;
  findings: ReadonlyArray<Finding>;
}>;

export type CreateInvestigationInput = Readonly<{
  id: string;
  submittedUrl: string;
  normalizedUrl: string;
  redirectChain: ReadonlyArray<string>;
  createdAt: string;
  capabilities?: ReadonlyArray<CapabilityRunInput>;
  observationTimeline?: ReadonlyArray<Observation>;
  evidence?: ReadonlyArray<Evidence>;
  findings?: ReadonlyArray<Finding>;
}>;

export type InvestigationModelErrorCode = 'invalid-capability-run' | 'invalid-investigation' | 'invalid-timestamp';

export class InvestigationModelError extends Error {
  readonly code: InvestigationModelErrorCode;

  constructor(code: InvestigationModelErrorCode, message: string) {
    super(message);
    this.name = 'InvestigationModelError';
    this.code = code;
  }
}

const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const assertTimestamp = (value: unknown, field: string): void => {
  const datePart = typeof value === 'string' ? value.slice(0, 10).split('-').map(Number) : [];
  const [year, month, day] = datePart;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = month === 2
    ? (isLeapYear ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;
  const validCalendarDate = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
  if (typeof value !== 'string' || !timestampPattern.test(value) || !validCalendarDate || Number.isNaN(Date.parse(value))) {
    throw new InvestigationModelError('invalid-timestamp', `${field} must be an ISO timestamp with timezone`);
  }
};

const assertOptionalTimestamp = (value: unknown, field: string): void => {
  if (value !== undefined) assertTimestamp(value, field);
};

const assertRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvestigationModelError('invalid-investigation', `${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const assertNonEmptyString = (value: unknown, field: string): void => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvestigationModelError('invalid-investigation', `${field} must be a non-empty string`);
  }
};

const assertStringArray = (value: unknown, field: string): void => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new InvestigationModelError('invalid-investigation', `${field} must be an array of non-empty strings`);
  }
};

const assertJsonLike = (value: unknown, field: string, ancestors = new Set<object>()): void => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new InvestigationModelError('invalid-investigation', `${field} must contain JSON-like values`);
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    throw new InvestigationModelError('invalid-investigation', `${field} must contain JSON-like values`);
  }
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new InvestigationModelError('invalid-investigation', `${field} must contain JSON-like values`);
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonLike(item, `${field}[${index}]`, ancestors));
  } else {
    Object.entries(value).forEach(([key, nestedValue]) => {
      assertJsonLike(nestedValue, `${field}.${key}`, ancestors);
    });
  }
  ancestors.delete(value);
};

const assertObservation = (value: unknown, index: number): void => {
  const observation = assertRecord(value, `observationTimeline[${index}]`);
  assertNonEmptyString(observation.id, `observationTimeline[${index}].id`);
  assertNonEmptyString(observation.capability, `observationTimeline[${index}].capability`);
  assertTimestamp(observation.observedAt, `observationTimeline[${index}].observedAt`);
  assertJsonLike(observation.value, `observationTimeline[${index}].value`);
};

const assertEvidence = (value: unknown, index: number): void => {
  const evidence = assertRecord(value, `evidence[${index}]`);
  assertNonEmptyString(evidence.id, `evidence[${index}].id`);
  assertNonEmptyString(evidence.capability, `evidence[${index}].capability`);
  assertJsonLike(evidence.value, `evidence[${index}].value`);
  if (!['observed', 'inference', 'request-trace', 'absence'].includes(evidence.kind as EvidenceKind)) {
    throw new InvestigationModelError('invalid-investigation', `evidence[${index}].kind is invalid`);
  }

  const source = assertRecord(evidence.source, `evidence[${index}].source`);
  if (source.locator !== undefined) assertNonEmptyString(source.locator, `evidence[${index}].source.locator`);
  assertOptionalTimestamp(source.observedAt, `evidence[${index}].source.observedAt`);
  if (source.rawBody !== undefined && typeof source.rawBody !== 'string') {
    throw new InvestigationModelError('invalid-investigation', `evidence[${index}].source.rawBody must be a string`);
  }
  if (source.evidenceIds !== undefined) assertStringArray(source.evidenceIds, `evidence[${index}].source.evidenceIds`);
  if (source.request !== undefined) {
    const request = assertRecord(source.request, `evidence[${index}].source.request`);
    assertNonEmptyString(request.method, `evidence[${index}].source.request.method`);
    assertNonEmptyString(request.url, `evidence[${index}].source.request.url`);
    if (request.status !== undefined && (typeof request.status !== 'number' || !Number.isFinite(request.status))) {
      throw new InvestigationModelError('invalid-investigation', `evidence[${index}].source.request.status is invalid`);
    }
  }
};

const assertFinding = (value: unknown, index: number): void => {
  const finding = assertRecord(value, `findings[${index}]`);
  assertNonEmptyString(finding.id, `findings[${index}].id`);
  assertNonEmptyString(finding.capability, `findings[${index}].capability`);
  assertNonEmptyString(finding.summary, `findings[${index}].summary`);
  assertStringArray(finding.evidenceIds, `findings[${index}].evidenceIds`);
  if (!['low', 'medium', 'high'].includes(finding.confidence as Finding['confidence'])) {
    throw new InvestigationModelError('invalid-investigation', `findings[${index}].confidence is invalid`);
  }
  for (const field of ['consequence', 'evidenceQuality', 'novelty'] as const) {
    if (finding[field] !== undefined && !['low', 'medium', 'high'].includes(finding[field] as string)) {
      throw new InvestigationModelError('invalid-investigation', `findings[${index}].${field} is invalid`);
    }
  }
};

const assertCapabilityRun = (capability: CapabilityRunInput): void => {
  if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
    throw new InvestigationModelError('invalid-capability-run', 'Capability run must be an object');
  }
  if (typeof capability.name !== 'string' || !capability.name.trim()) {
    throw new InvestigationModelError('invalid-capability-run', 'Capability run name must be non-empty');
  }
  if (capability.reason !== undefined && typeof capability.reason !== 'string') {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} reason must be a string`);
  }
  if (capability.status !== 'success' && capability.result !== undefined) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} non-success cannot have a result`);
  }
  if (capability.dependencies !== undefined) assertStringArray(capability.dependencies, `${capability.name}.dependencies`);
  if (capability.options !== undefined) {
    assertRecord(capability.options, `${capability.name}.options`);
    assertJsonLike(capability.options, `${capability.name}.options`);
  }
  if (capability.metadata !== undefined) assertJsonLike(capability.metadata, `${capability.name}.metadata`);
  if (capability.result !== undefined) assertJsonLike(capability.result, `${capability.name}.result`);
  if (!['queued', 'running', 'success', 'failed', 'unavailable'].includes(capability.status as CapabilityStatus)) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} has an invalid status`);
  }
  assertOptionalTimestamp(capability.startedAt, `${capability.name}.startedAt`);
  assertOptionalTimestamp(capability.completedAt, `${capability.name}.completedAt`);

  const error = capability.error as unknown;
  const hasError = error !== undefined;
  if (hasError && (
    !error
    || typeof error !== 'object'
    || typeof (error as CapabilityError).code !== 'string'
    || typeof (error as CapabilityError).message !== 'string'
    || typeof (error as CapabilityError).retryable !== 'boolean'
    || !(error as CapabilityError).code
    || !(error as CapabilityError).message
  )) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} has malformed error`);
  }

  if (['queued', 'running', 'success'].includes(capability.status) && hasError) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} success cannot have an error`);
  }
  if (capability.status === 'failed' && !hasError) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} failure requires an error`);
  }
  if (capability.status === 'unavailable' && hasError && (error as CapabilityError).retryable) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} unavailable error cannot be retryable`);
  }
};

const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, clone(nestedValue)]),
    ) as T;
  }
  return value;
};

const freeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach((nestedValue) => freeze(nestedValue, seen));
  return Object.freeze(value);
};

const cloneAndFreeze = <T>(value: T): T => freeze(clone(value));

export const createInvestigation = (input: CreateInvestigationInput): Investigation => {
  assertRecord(input, 'investigation');
  assertNonEmptyString(input.id, 'id');
  assertNonEmptyString(input.submittedUrl, 'submittedUrl');
  assertNonEmptyString(input.normalizedUrl, 'normalizedUrl');
  assertStringArray(input.redirectChain, 'redirectChain');
  assertTimestamp(input.createdAt, 'createdAt');
  if (input.capabilities !== undefined) {
    if (!Array.isArray(input.capabilities)) {
      throw new InvestigationModelError('invalid-investigation', 'capabilities must be an array');
    }
    const names = input.capabilities.map((capability) => capability?.name);
    if (new Set(names).size !== names.length) {
      throw new InvestigationModelError('invalid-capability-run', 'Capability names must be unique');
    }
    input.capabilities.forEach(assertCapabilityRun);
  }
  if (input.observationTimeline !== undefined) {
    if (!Array.isArray(input.observationTimeline)) {
      throw new InvestigationModelError('invalid-investigation', 'observationTimeline must be an array');
    }
    input.observationTimeline.forEach(assertObservation);
  }
  if (input.evidence !== undefined) {
    if (!Array.isArray(input.evidence)) {
      throw new InvestigationModelError('invalid-investigation', 'evidence must be an array');
    }
    input.evidence.forEach(assertEvidence);
  }
  if (input.findings !== undefined) {
    if (!Array.isArray(input.findings)) {
      throw new InvestigationModelError('invalid-investigation', 'findings must be an array');
    }
    input.findings.forEach(assertFinding);
  }

  return cloneAndFreeze({
    id: input.id,
    submittedUrl: input.submittedUrl,
    normalizedUrl: input.normalizedUrl,
    redirectChain: input.redirectChain,
    createdAt: input.createdAt,
    capabilities: input.capabilities ?? [],
    observationTimeline: input.observationTimeline ?? [],
    evidence: input.evidence ?? [],
    findings: input.findings ?? [],
  }) as Investigation;
};

export const getCapabilityState = (
  investigation: Investigation,
  capabilityName: string,
): CapabilityRun | undefined => investigation.capabilities.find(
  (capability) => capability.name === capabilityName,
);

export const isPartialInvestigation = (investigation: Investigation): boolean => investigation.capabilities.some(
  ({ status }) => status !== 'success',
);
