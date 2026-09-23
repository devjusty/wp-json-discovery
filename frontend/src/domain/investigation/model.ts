export type CapabilityStatus = 'queued' | 'running' | 'success' | 'failed' | 'unavailable';

export type EvidenceKind = 'observed' | 'inference' | 'request-trace' | 'absence';

export type CapabilityError = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
}>;

type CapabilityRunFields = Readonly<{
  name: string;
  reason?: string;
  startedAt?: string;
  completedAt?: string;
}>;

export type CapabilityRun =
  | (CapabilityRunFields & Readonly<{ status: 'queued' | 'running'; error?: never }>)
  | (CapabilityRunFields & Readonly<{ status: 'success'; error?: never }>)
  | (CapabilityRunFields & Readonly<{ status: 'failed'; error: CapabilityError }>)
  | (CapabilityRunFields & Readonly<{ status: 'unavailable'; error?: CapabilityError }>);

export type CapabilityRunInput = Readonly<{
  name: string;
  status: CapabilityStatus;
  error?: CapabilityError;
  reason?: string;
  startedAt?: string;
  completedAt?: string;
}>;

export type EvidenceSource = Readonly<{
  locator?: string;
  observedAt?: string;
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
  value: unknown;
  source: EvidenceSource;
}>;

export type Finding = Readonly<{
  id: string;
  capability: string;
  summary: string;
  evidenceIds: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
}>;

export type Observation = Readonly<{
  id: string;
  capability: string;
  observedAt: string;
  value: unknown;
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

export type InvestigationModelErrorCode = 'invalid-capability-run' | 'invalid-timestamp';

export class InvestigationModelError extends Error {
  readonly code: InvestigationModelErrorCode;

  constructor(code: InvestigationModelErrorCode, message: string) {
    super(message);
    this.name = 'InvestigationModelError';
    this.code = code;
  }
}

const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const assertTimestamp = (value: string, field: string): void => {
  if (!timestampPattern.test(value) || Number.isNaN(Date.parse(value))) {
    throw new InvestigationModelError('invalid-timestamp', `${field} must be an ISO timestamp with timezone`);
  }
};

const assertOptionalTimestamp = (value: string | undefined, field: string): void => {
  if (value !== undefined) assertTimestamp(value, field);
};

const assertCapabilityRun = (capability: CapabilityRunInput): void => {
  assertOptionalTimestamp(capability.startedAt, `${capability.name}.startedAt`);
  assertOptionalTimestamp(capability.completedAt, `${capability.name}.completedAt`);

  if (capability.error && (!capability.error.code || !capability.error.message)) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} has malformed error`);
  }

  if (capability.status === 'success' && capability.error !== undefined) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} success cannot have an error`);
  }
  if (capability.status === 'failed' && capability.error === undefined) {
    throw new InvestigationModelError('invalid-capability-run', `${capability.name} failure requires an error`);
  }
  if (capability.status === 'unavailable' && capability.error?.retryable) {
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
  assertTimestamp(input.createdAt, 'createdAt');
  input.capabilities?.forEach(assertCapabilityRun);
  input.observationTimeline?.forEach((observation) => {
    assertTimestamp(observation.observedAt, `${observation.id}.observedAt`);
  });
  input.evidence?.forEach((evidence) => {
    assertOptionalTimestamp(evidence.source.observedAt, `${evidence.id}.source.observedAt`);
  });

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
