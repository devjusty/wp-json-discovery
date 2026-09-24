import { z } from 'zod';

export const CONTRACTS_PACKAGE_VERSION = '0.0.0';

const nonBlankStringSchema = z.string().refine((value) => value.trim().length > 0, {
  message: 'String must contain a non-whitespace character',
});
const identifierSchema = nonBlankStringSchema;
const timestampSchema = z.iso.datetime({ offset: true });

export const domainIdentitySchema = z.object({
  submitted: nonBlankStringSchema,
  normalized: nonBlankStringSchema,
}).strict();
export type DomainIdentity = z.infer<typeof domainIdentitySchema>;

export const capabilityStatusSchema = z.enum([
  'idle',
  'queued',
  'running',
  'success',
  'failed',
  'unavailable',
]);
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;

const capabilityErrorSchema = z.object({
  code: identifierSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
}).strict();

export const jsonValueSchema: z.ZodType = z.lazy(() => z.union([
  z.null(),
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

const investigationCapabilitySchema = z.object({
  name: identifierSchema,
  status: z.enum(['queued', 'running', 'success', 'failed', 'unavailable']),
  dependencies: z.array(identifierSchema).optional(),
  options: z.record(z.string(), jsonValueSchema).optional(),
  metadata: jsonValueSchema.optional(),
  result: jsonValueSchema.optional(),
  reason: z.string().optional(),
  startedAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
  error: capabilityErrorSchema.optional(),
}).strict().superRefine((capability, context) => {
  if (capability.status !== 'success' && 'result' in capability) {
    context.addIssue({ code: 'custom', message: 'Only successful capabilities may contain a result', path: ['result'] });
  }
  if (capability.status === 'failed' && !capability.error) {
    context.addIssue({ code: 'custom', message: 'Failed capabilities require an error', path: ['error'] });
  }
  if (['queued', 'running', 'success'].includes(capability.status) && capability.error) {
    context.addIssue({ code: 'custom', message: 'Active and successful capabilities cannot have an error', path: ['error'] });
  }
  if (capability.status === 'unavailable' && capability.error?.retryable) {
    context.addIssue({ code: 'custom', message: 'Unavailable capability errors cannot be retryable', path: ['error', 'retryable'] });
  }
});

const investigationEvidenceSchema = z.object({
  id: identifierSchema,
  kind: z.enum(['observed', 'inference', 'request-trace', 'absence']),
  capability: identifierSchema,
  value: jsonValueSchema,
  source: z.object({
    locator: z.string().min(1).optional(),
    observedAt: timestampSchema.optional(),
    rawBody: z.string().optional(),
    evidenceIds: z.array(identifierSchema).optional(),
    request: z.object({
      method: z.string().min(1),
      url: z.string().min(1),
      status: z.number().finite().optional(),
    }).strict().optional(),
  }).strict(),
}).strict();

const investigationObservationSchema = z.object({
  id: identifierSchema,
  capability: identifierSchema,
  observedAt: timestampSchema,
  value: jsonValueSchema,
}).strict();

const investigationFindingSchema = z.object({
  id: identifierSchema,
  capability: identifierSchema,
  summary: z.string().min(1),
  evidenceIds: z.array(identifierSchema),
  confidence: z.enum(['low', 'medium', 'high']),
  consequence: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  evidenceQuality: z.enum(['low', 'medium', 'high']).optional(),
  novelty: z.enum(['low', 'medium', 'high', 'new']).optional(),
}).strict();

export const investigationStateSchema = z.object({
  id: identifierSchema,
  submittedUrl: nonBlankStringSchema,
  normalizedUrl: nonBlankStringSchema,
  redirectChain: z.array(z.string().min(1)),
  createdAt: timestampSchema,
  capabilities: z.array(investigationCapabilitySchema),
  observationTimeline: z.array(investigationObservationSchema),
  evidence: z.array(investigationEvidenceSchema),
  findings: z.array(investigationFindingSchema),
}).strict().superRefine((state, context) => {
  const names = state.capabilities.map((capability) => capability.name);
  if (new Set(names).size !== names.length) {
    context.addIssue({ code: 'custom', message: 'Capability names must be unique', path: ['capabilities'] });
  }
});
export type InvestigationState = z.infer<typeof investigationStateSchema>;

type ValidationIssue = { message: string; path: (string | number)[] };

const retryStatusIssues = (
  status: CapabilityStatus,
  retry: RetryState,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (status === 'unavailable' && retry.status !== 'not-retryable') {
    issues.push({ message: 'Unavailable capabilities cannot retry or exhaust retries', path: ['retry'] });
  }
  if (retry.status === 'retrying' && !['failed', 'unavailable'].includes(status)) {
    issues.push({ message: 'Only failed or unavailable capabilities can be retried', path: ['retry'] });
  }
  if (retry.status === 'exhausted' && !['failed', 'unavailable'].includes(status)) {
    issues.push({ message: 'Only failed or unavailable capabilities can exhaust retries', path: ['retry'] });
  }
  return issues;
};

const retryabilityIssues = (
  status: CapabilityStatus,
  retry: RetryState,
  outcomeRetryable?: boolean,
): ValidationIssue[] => {
  if (status !== 'failed' || outcomeRetryable !== false
    || !['retrying', 'exhausted'].includes(retry.status)) return [];
  return [{
    message: retry.status === 'retrying'
      ? 'Non-retryable failures cannot be retried'
      : 'Non-retryable failures cannot exhaust retries',
    path: ['retry'],
  }];
};

const retryStateIssues = (
  status: CapabilityStatus,
  retry: RetryState,
  outcomeRetryable?: boolean,
): ValidationIssue[] => [
  ...retryStatusIssues(status, retry),
  ...retryabilityIssues(status, retry, outcomeRetryable),
];

const addValidationIssues = (
  context: { addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void },
  issues: ValidationIssue[],
) => {
  for (const issue of issues) context.addIssue({ code: 'custom', ...issue });
};

const successOutcomeSchema = z.object({
  status: z.literal('success'), result: jsonValueSchema.optional(), error: z.null(),
}).strict();
const failedOutcomeSchema = z.object({
  status: z.literal('failed'), result: z.null(), error: capabilityErrorSchema,
}).strict();
const unavailableOutcomeSchema = z.object({
  status: z.literal('unavailable'),
  result: z.null(),
  error: capabilityErrorSchema.extend({ retryable: z.literal(false) }).strict(),
}).strict();
const sessionUnavailableOutcomeSchema = unavailableOutcomeSchema;
const partialOutcomeSchema = z.object({
  status: z.literal('partial'),
  result: z.unknown(),
  error: capabilityErrorSchema.extend({ retryable: z.literal(false) }).strict(),
}).strict();

export const capabilityOutcomeSchema = z.discriminatedUnion('status', [
  successOutcomeSchema,
  failedOutcomeSchema,
  unavailableOutcomeSchema,
  partialOutcomeSchema,
]);
export type CapabilityOutcome = z.infer<typeof capabilityOutcomeSchema>;

export const investigationIdentitySchema = z.object({
  id: identifierSchema,
  ownerId: identifierSchema,
  domain: domainIdentitySchema,
}).strict();
export type InvestigationIdentity = z.infer<typeof investigationIdentitySchema>;

export const retryStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not-retryable') }).strict(),
  z.object({
    status: z.literal('retrying'),
    attempt: z.number().int().min(1),
    nextAttemptAt: timestampSchema,
  }).strict(),
  z.object({ status: z.literal('exhausted'), attempts: z.number().int().min(1) }).strict(),
]);
export type RetryState = z.infer<typeof retryStateSchema>;

export const capabilitySelectionSchema = z.object({
  id: identifierSchema,
  dependencies: z.array(identifierSchema),
  options: z.record(z.string(), jsonValueSchema).optional(),
}).strict();
export type CapabilitySelection = z.infer<typeof capabilitySelectionSchema>;

export const capabilityIdentitySchema = z.object({ id: identifierSchema }).strict();
export type CapabilityIdentity = z.infer<typeof capabilityIdentitySchema>;

export const capabilityDefinitionSchema = z.object({
  id: identifierSchema,
  availability: z.enum(['available', 'unavailable']),
  status: capabilityStatusSchema,
  dependencies: z.array(identifierSchema),
  retry: retryStateSchema,
}).strict().superRefine((definition, context) => {
  if (definition.availability === 'unavailable' && definition.status !== 'unavailable') {
    context.addIssue({ code: 'custom', message: 'Unavailable capabilities must have unavailable status', path: ['status'] });
  }
  if (definition.availability === 'available' && definition.status === 'unavailable') {
    context.addIssue({ code: 'custom', message: 'Available capabilities cannot have unavailable status', path: ['status'] });
  }
  addValidationIssues(context, retryStateIssues(definition.status, definition.retry));
});
export type CapabilityDefinition = z.infer<typeof capabilityDefinitionSchema>;

export const dependencyStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready') }).strict(),
  z.object({
    status: z.literal('failed'),
    dependencyId: identifierSchema,
    error: capabilityErrorSchema,
  }).strict(),
]);
export type DependencyState = z.infer<typeof dependencyStateSchema>;

const createCapabilityStateUnionSchema = (unavailableSchema: z.ZodObject<any>) => z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle'), retry: retryStateSchema }).strict(),
  z.object({ status: z.literal('queued'), retry: retryStateSchema }).strict(),
  z.object({ status: z.literal('running'), retry: retryStateSchema }).strict(),
  z.object({
    status: z.literal('success'), outcome: successOutcomeSchema,
    retry: retryStateSchema,
  }).strict(),
  z.object({
    status: z.literal('failed'), outcome: failedOutcomeSchema,
    retry: retryStateSchema,
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    outcome: unavailableSchema,
    dependency: dependencyStateSchema.optional(),
    retry: retryStateSchema,
  }).strict(),
]);
const capabilityStateUnionSchema = createCapabilityStateUnionSchema(unavailableOutcomeSchema);
const sessionCapabilityStateUnionSchema = createCapabilityStateUnionSchema(sessionUnavailableOutcomeSchema);
export const capabilityStateSchema = capabilityStateUnionSchema.superRefine((state, context) => {
  addValidationIssues(
    context,
    retryStateIssues(state.status, state.retry, state.status === 'failed' ? state.outcome.error.retryable : undefined),
  );
});
export type CapabilityState = z.infer<typeof capabilityStateSchema>;

export const sessionCapabilityStateSchema = sessionCapabilityStateUnionSchema.superRefine((state, context) => {
  addValidationIssues(
    context,
    retryStateIssues(state.status, state.retry, state.status === 'failed' ? state.outcome.error.retryable : undefined),
  );
});
export type SessionCapabilityState = z.infer<typeof sessionCapabilityStateSchema>;

const scanSessionFields = {
  id: identifierSchema,
  investigationId: identifierSchema,
  selectedCapabilities: z.array(capabilitySelectionSchema),
  capabilityStates: z.record(identifierSchema, sessionCapabilityStateSchema),
  overall: z.object({
    status: z.enum(['complete', 'partial', 'failed', 'blocked', 'incomplete']),
  }).strict(),
  investigationState: investigationStateSchema.optional(),
};

const scanSessionUnionSchema = z.discriminatedUnion('status', [
  z.object({ ...scanSessionFields, status: z.literal('idle'), startedAt: z.null(), completedAt: z.null() }).strict(),
  z.object({ ...scanSessionFields, status: z.literal('queued'), startedAt: z.null(), completedAt: z.null() }).strict(),
  z.object({ ...scanSessionFields, status: z.literal('running'), startedAt: timestampSchema, completedAt: z.null() }).strict(),
  z.object({ ...scanSessionFields, status: z.literal('completed'), startedAt: timestampSchema, completedAt: timestampSchema }).strict(),
  z.object({ ...scanSessionFields, status: z.literal('failed'), startedAt: timestampSchema, completedAt: timestampSchema }).strict(),
]);
type ScanSessionValue = z.infer<typeof scanSessionUnionSchema>;

const sessionIdentityIssues = (session: ScanSessionValue): ValidationIssue[] => {
  if (session.investigationState && session.investigationState.id !== session.investigationId) {
    return [{ message: 'Investigation state must match session investigation ID', path: ['investigationState', 'id'] }];
  }
  return [];
};

const sessionReferenceIssues = (session: ScanSessionValue): ValidationIssue[] => {
  const selectedIds = new Set(session.selectedCapabilities.map((capability) => capability.id));
  return [
    ...selectedCapabilityIssues(session, selectedIds),
    ...dependencyStateIssues(session),
    ...sessionIdentityIssues(session),
  ];
};

const selectedCapabilityIssues = (
  session: ScanSessionValue,
  selectedIds: Set<string>,
): ValidationIssue[] => {
  const stateIds = Object.keys(session.capabilityStates);
  const issues: ValidationIssue[] = [];
  if (session.selectedCapabilities.length !== selectedIds.size) {
    issues.push({ message: 'Selected capability IDs must be unique', path: ['selectedCapabilities'] });
  }
  if (stateIds.length !== selectedIds.size || stateIds.some((id) => !selectedIds.has(id))) {
    issues.push({ message: 'Selected capabilities and capability states must have matching IDs', path: ['capabilityStates'] });
  }
  for (const capability of session.selectedCapabilities) {
    for (const dependencyId of capability.dependencies) {
      if (!selectedIds.has(dependencyId)) {
        issues.push({ message: 'Dependencies must reference selected capabilities', path: ['selectedCapabilities'] });
      }
    }
  }
  return issues;
};

const dependencyStateIssues = (session: ScanSessionValue): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  for (const [capabilityId, state] of Object.entries(session.capabilityStates)) {
    if (state.status !== 'unavailable' || state.dependency?.status !== 'failed') continue;
    const selectedCapability = session.selectedCapabilities.find((capability) => capability.id === capabilityId);
    const dependencyState = session.capabilityStates[state.dependency.dependencyId];
    if (!selectedCapability?.dependencies.includes(state.dependency.dependencyId)
      || !dependencyState || !['failed', 'unavailable'].includes(dependencyState.status)) {
      issues.push({ message: 'Dependency failure must reference a failed or unavailable selected capability', path: ['capabilityStates', capabilityId, 'dependency'] });
    }
  }
  return issues;
};

const sessionOverallIssues = (session: ScanSessionValue): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const stateIds = Object.keys(session.capabilityStates);
  const allSuccessful = Object.values(session.capabilityStates).every((state) => state.status === 'success');
  const hasSuccessful = Object.values(session.capabilityStates).some((state) => state.status === 'success');
  const hasFailure = Object.values(session.capabilityStates).some((state) => ['failed', 'unavailable'].includes(state.status));
  if (session.status === 'failed' && allSuccessful) {
    issues.push({ message: 'Failed sessions cannot have all-success capability states', path: ['status'] });
  }
  if (session.overall.status === 'complete' && !allSuccessful) {
    issues.push({ message: 'Complete sessions require successful capability states', path: ['overall'] });
  }
  if (session.overall.status === 'incomplete' && allSuccessful && stateIds.length > 0) {
    issues.push({ message: 'Incomplete sessions require a non-success capability state', path: ['overall'] });
  }
  if (session.overall.status === 'partial' && (!hasSuccessful || !hasFailure)) {
    issues.push({ message: 'Partial sessions require successful and failed or unavailable capability states', path: ['overall'] });
  }
  if (session.overall.status === 'failed' && (hasSuccessful || !hasFailure)) {
    issues.push({ message: 'Failed aggregates require no successful capability states and at least one failure', path: ['overall'] });
  }
  if (session.overall.status === 'blocked' && stateIds.length > 0) {
    issues.push({ message: 'Blocked aggregates cannot contain capability states', path: ['overall'] });
  }
  return issues;
};

const sessionLifecycleIssues = (session: ScanSessionValue): ValidationIssue[] => {
  const capabilityStatuses = Object.values(session.capabilityStates).map((state) => state.status);
  return [
    ...activeSessionIssues(session, capabilityStatuses),
    ...pendingSessionIssues(session, capabilityStatuses),
    ...terminalSessionIssues(session, capabilityStatuses),
  ];
};

const activeSessionIssues = (
  session: ScanSessionValue,
  capabilityStatuses: CapabilityStatus[],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (session.status === 'queued' && capabilityStatuses.some((status) => status === 'success')) {
    issues.push({ message: 'Queued sessions cannot contain successful capability states', path: ['capabilityStates'] });
  }
  if ((session.status === 'queued' || session.status === 'running') && session.overall.status === 'complete') {
    issues.push({ message: 'Queued and running sessions cannot be overall complete', path: ['overall'] });
  }
  if (session.status === 'idle' && session.overall.status === 'complete') {
    issues.push({ message: 'Idle sessions cannot be overall complete', path: ['overall'] });
  }
  return issues;
};

const pendingSessionIssues = (
  session: ScanSessionValue,
  capabilityStatuses: CapabilityStatus[],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (session.status === 'idle' && capabilityStatuses.some((status) => status !== 'idle')) {
    issues.push({ message: 'Idle sessions can only contain idle capability states', path: ['capabilityStates'] });
  }
  if (session.status === 'queued' && capabilityStatuses.some((status) => status !== 'idle' && status !== 'queued')) {
    issues.push({ message: 'Queued sessions can only contain idle or queued capability states', path: ['capabilityStates'] });
  }
  return issues;
};

const terminalSessionIssues = (
  session: ScanSessionValue,
  capabilityStatuses: CapabilityStatus[],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (session.status === 'completed' || session.status === 'failed') {
    if (capabilityStatuses.some((status) => status === 'idle' || status === 'queued' || status === 'running')) {
      issues.push({ message: 'Terminal sessions cannot contain non-final capability states', path: ['capabilityStates'] });
    }
  }
  return issues;
};

const sessionTimestampIssues = (session: ScanSessionValue): ValidationIssue[] => {
  if (session.startedAt && session.completedAt && Date.parse(session.completedAt) < Date.parse(session.startedAt)) {
    return [{ message: 'completedAt must be on or after startedAt', path: ['completedAt'] }];
  }
  return [];
};

export const scanSessionSchema = scanSessionUnionSchema.superRefine((session, context) => {
  addValidationIssues(context, sessionReferenceIssues(session));
  addValidationIssues(context, sessionOverallIssues(session));
  addValidationIssues(context, sessionLifecycleIssues(session));
  addValidationIssues(context, sessionTimestampIssues(session));
});
export type ScanSession = z.infer<typeof scanSessionSchema>;

export const evidenceReferenceSchema = z.object({
  id: identifierSchema,
  capabilityId: identifierSchema,
  locator: z.string().min(1),
}).strict();
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export const findingSchema = z.object({
  id: identifierSchema,
  capabilityId: identifierSchema,
  consequence: z.enum(['low', 'medium', 'high', 'critical']),
  evidenceLevel: z.enum(['observed', 'corroborated', 'inferred']),
  novelty: z.enum(['new', 'known', 'changed']),
  summary: z.string().min(1),
  evidence: z.array(evidenceReferenceSchema),
}).strict();
export type Finding = z.infer<typeof findingSchema>;

export const authStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('anonymous') }).strict(),
  z.object({ status: z.literal('authenticated'), subjectId: identifierSchema }).strict(),
]);
export type AuthState = z.infer<typeof authStateSchema>;

const apiErrorSchema = z.object({
  code: identifierSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  details: jsonValueSchema.optional(),
}).strict();

export const apiEnvelopeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), requestId: identifierSchema, data: z.unknown() }).strict(),
  z.object({ status: z.literal('error'), requestId: identifierSchema, error: apiErrorSchema }).strict(),
  z.object({
    status: z.literal('partial'),
    requestId: identifierSchema,
    data: z.unknown(),
    errors: z.array(apiErrorSchema).min(1),
  }).strict(),
]);
export type ApiEnvelope = z.infer<typeof apiEnvelopeSchema>;

export const startInvestigationRequestSchema = z.object({
  domain: domainIdentitySchema,
  selectedCapabilities: z.array(capabilitySelectionSchema),
}).strict().superRefine((request, context) => {
  const selectedIds = new Set(request.selectedCapabilities.map((capability) => capability.id));
  if (request.selectedCapabilities.length !== selectedIds.size) {
    context.addIssue({ code: 'custom', message: 'Selected capability IDs must be unique', path: ['selectedCapabilities'] });
  }
  for (const capability of request.selectedCapabilities) {
    if (capability.dependencies.some((dependencyId) => !selectedIds.has(dependencyId))) {
      context.addIssue({ code: 'custom', message: 'Dependencies must reference selected capabilities', path: ['selectedCapabilities'] });
    }
  }
});
export type StartInvestigationRequest = z.infer<typeof startInvestigationRequestSchema>;

export const investigationRecordSchema = z.object({
  recordType: z.literal('investigation'),
  investigation: investigationIdentitySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  sessionIds: z.array(identifierSchema).min(1),
  latestSession: scanSessionSchema.optional(),
}).strict().superRefine((record, context) => {
  if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
    context.addIssue({ code: 'custom', message: 'updatedAt must be on or after createdAt', path: ['updatedAt'] });
  }
});
export type InvestigationRecord = z.infer<typeof investigationRecordSchema>;

export const investigationSummarySchema = z.object({
  id: identifierSchema,
  domain: domainIdentitySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  latestSessionId: identifierSchema.optional(),
  selectedCapabilityCount: z.number().int().min(0),
  completedCapabilityCount: z.number().int().min(0),
  findingsCount: z.number().int().min(0),
}).strict().superRefine((summary, context) => {
  if (Date.parse(summary.updatedAt) < Date.parse(summary.createdAt)) {
    context.addIssue({ code: 'custom', message: 'updatedAt must be on or after createdAt', path: ['updatedAt'] });
  }
  if (summary.completedCapabilityCount > summary.selectedCapabilityCount) {
    context.addIssue({ code: 'custom', message: 'Completed capabilities cannot exceed selected capabilities', path: ['completedCapabilityCount'] });
  }
});
export type InvestigationSummary = z.infer<typeof investigationSummarySchema>;

export const investigationListSchema = z.object({
  investigations: z.array(investigationSummarySchema),
}).strict();
export type InvestigationList = z.infer<typeof investigationListSchema>;

export const sessionRecordSchema = z.object({
  recordType: z.literal('session'),
  session: scanSessionSchema,
  persistedAt: timestampSchema,
}).strict();
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const persistedRecordSchema = z.discriminatedUnion('recordType', [
  investigationRecordSchema,
  sessionRecordSchema,
]);
export type PersistedRecord = z.infer<typeof persistedRecordSchema>;

const anonymousPersistedRecordSchema = sessionRecordSchema;

export const claimInvestigationRequestSchema = z.object({
  domain: domainIdentitySchema,
  anonymousRecord: anonymousPersistedRecordSchema,
}).strict();
export type ClaimInvestigationRequest = z.infer<typeof claimInvestigationRequestSchema>;

export const parseDomainIdentity = (value: unknown): DomainIdentity =>
  domainIdentitySchema.parse(value);

export const safeParseApiEnvelope = (value: unknown) => apiEnvelopeSchema.safeParse(value);
