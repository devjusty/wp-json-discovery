import type { CapabilityError, CapabilityStatus } from './model';

export type InvestigationLifecycleStatus = 'idle' | 'queued' | 'running' | 'completed' | 'invalid' | 'auth-required' | 'unusable';
export type InvestigationOverallStatus = 'complete' | 'partial' | 'failed' | 'blocked' | 'incomplete';

export type InvestigationCapabilityState = {
  status: CapabilityStatus | 'idle';
  outcome?: {
    status: CapabilityStatus;
    result: unknown;
    error: CapabilityError | null;
  };
  retry?: { status: 'retryable' | 'not-retryable' };
  dependency?: { status: 'failed'; dependencyId: string; error: CapabilityError };
};

export type InvestigationLifecycleState = {
  status: InvestigationLifecycleStatus | string;
  startedAt: string | null;
  completedAt: string | null;
  selectedCapabilities: ReadonlyArray<{ id: string }>;
  capabilityStates: Record<string, InvestigationCapabilityState>;
  overall: { status: InvestigationOverallStatus | string };
  evidence?: ReadonlyArray<unknown>;
};

type InvestigationEvent =
  | { type: 'capability-queued'; capability: string; at?: string }
  | { type: 'capability-running'; capability: string; at?: string }
  | { type: 'capability-succeeded'; capability: string; result: unknown; at?: string }
  | { type: 'capability-failed'; capability: string; error: CapabilityError; at?: string }
  | { type: 'capability-unavailable'; capability: string; error?: CapabilityError; dependencyId?: string; at?: string };

export class InvalidInvestigationTransitionError extends Error {
  readonly code = 'invalid-transition';

  constructor(capability: string, from: string, to: string) {
    super(`Cannot transition ${capability} from ${from} to ${to}`);
    this.name = 'InvalidInvestigationTransitionError';
  }
}

const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)])) as T;
  }
  return value;
};

const getState = (state: InvestigationLifecycleState, capability: string): InvestigationCapabilityState => {
  const capabilityState = state.capabilityStates[capability];
  if (!capabilityState) throw new InvalidInvestigationTransitionError(capability, 'missing', 'requested');
  return capabilityState;
};

const assertTransition = (state: InvestigationCapabilityState, capability: string, next: CapabilityStatus): void => {
  const allowed = {
    queued: ['idle', 'failed', 'unavailable'],
    running: ['queued'],
    success: ['running'],
    failed: ['queued', 'running'],
    unavailable: ['idle', 'running'],
  } satisfies Record<CapabilityStatus, string[]>;
  if (!allowed[next].includes(state.status)) {
    throw new InvalidInvestigationTransitionError(capability, state.status, next);
  }
};

const terminalStatus = (state: InvestigationLifecycleState): InvestigationOverallStatus => {
  const selected = state.selectedCapabilities.map(({ id }) => state.capabilityStates[id]).filter(Boolean);
  if (state.status === 'invalid' || state.status === 'auth-required' || state.status === 'unusable' || selected.length === 0) return 'blocked';
  const successes = selected.filter(({ status }) => status === 'success').length;
  const failures = selected.some(({ status }) => status === 'failed' || status === 'unavailable');
  if (successes === selected.length) return 'complete';
  if (successes > 0 && failures) return 'partial';
  if (successes === 0 && failures) return 'failed';
  return 'incomplete';
};

export const applyInvestigationEvent = (
  state: InvestigationLifecycleState,
  event: InvestigationEvent,
): InvestigationLifecycleState => {
  const current = getState(state, event.capability);
  const nextStatus = event.type === 'capability-succeeded'
    ? 'success'
    : event.type.replace('capability-', '') as CapabilityStatus;
  assertTransition(current, event.capability, nextStatus);
  const next = clone(state);
  const capability = next.capabilityStates[event.capability];
  capability.status = nextStatus;

  if (nextStatus === 'queued') {
    capability.retry = { status: 'not-retryable' };
    delete capability.outcome;
    delete capability.dependency;
    next.status = 'queued';
    next.startedAt = null;
    next.completedAt = null;
  } else if (nextStatus === 'running') {
    capability.retry = { status: 'not-retryable' };
    delete capability.outcome;
    delete capability.dependency;
    next.status = 'running';
    next.startedAt ??= event.at ?? null;
    next.completedAt = null;
  } else if (event.type === 'capability-succeeded') {
    capability.outcome = { status: 'success', result: event.result, error: null };
    capability.retry = { status: 'not-retryable' };
  } else {
    const error = ('error' in event ? event.error : undefined)
      ?? { code: 'unavailable', message: 'Capability unavailable.', retryable: false };
    capability.outcome = { status: nextStatus, result: null, error };
    capability.retry = { status: error.retryable ? 'retryable' : 'not-retryable' };
    if (nextStatus === 'unavailable' && event.type === 'capability-unavailable' && event.dependencyId) {
      capability.dependency = { status: 'failed', dependencyId: event.dependencyId, error };
    }
  }

  const overall = terminalStatus(next);
  next.overall = { status: overall };
  if (['complete', 'partial', 'failed'].includes(overall)) {
    next.status = 'completed';
    next.completedAt = event.at ?? next.completedAt;
  }
  return next;
};

export const canRetryCapability = (state: InvestigationLifecycleState, capability: string): boolean => {
  const capabilityState = state.capabilityStates[capability];
  return Boolean(
    capabilityState
    && capabilityState.status === 'failed'
    && capabilityState.outcome?.error?.retryable === true,
  );
};

export type { InvestigationEvent };
