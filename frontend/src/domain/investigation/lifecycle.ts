import type { CapabilityError, CapabilityStatus } from './model';
import { selectInvestigationStatus } from './selectors';
import type {
  InvestigationCapabilityState,
  InvestigationLifecycleState,
} from './state';

export { canRetryCapability } from './retry';
export type {
  InvestigationCapabilityState,
  InvestigationLifecycleState,
  InvestigationLifecycleStatus,
  InvestigationOverallStatus,
} from './state';

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
    queued: ['idle'],
    running: ['queued'],
    success: ['running'],
    failed: ['queued', 'running'],
    unavailable: ['idle', 'running'],
  } satisfies Record<CapabilityStatus, string[]>;
  if (next === 'queued' && state.status === 'failed' && state.outcome?.error?.retryable === true) return;
  if (!allowed[next].includes(state.status)) {
    throw new InvalidInvestigationTransitionError(capability, state.status, next);
  }
};

export const applyInvestigationEvent = (
  state: InvestigationLifecycleState,
  event: InvestigationEvent,
): InvestigationLifecycleState => {
  const current = getState(state, event.capability);
  const nextStatus = getCapabilityStatus(event);
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
    const eventError = ('error' in event ? event.error : undefined);
    const error = (nextStatus === 'unavailable' && eventError
      ? { ...eventError, retryable: false }
      : eventError)
      ?? { code: 'unavailable', message: 'Capability unavailable.', retryable: false };
    capability.outcome = { status: nextStatus, result: null, error };
    capability.retry = { status: 'not-retryable' };
    if (nextStatus === 'unavailable' && event.type === 'capability-unavailable' && event.dependencyId) {
      capability.dependency = { status: 'failed', dependencyId: event.dependencyId, error };
    }
  }

  const overall = selectInvestigationStatus(next);
  next.overall = { status: overall };
  if (['complete', 'partial', 'failed'].includes(overall)) {
    next.status = 'completed';
    next.completedAt = event.at ?? next.completedAt;
  }
  return next;
};

export type { InvestigationEvent };

const getCapabilityStatus = (event: InvestigationEvent): CapabilityStatus => {
  switch (event.type) {
    case 'capability-queued': return 'queued';
    case 'capability-running': return 'running';
    case 'capability-succeeded': return 'success';
    case 'capability-failed': return 'failed';
    case 'capability-unavailable': return 'unavailable';
  }
};
