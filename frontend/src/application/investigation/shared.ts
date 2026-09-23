import {
  applyInvestigationEvent,
  type InvestigationEvent,
} from '../../domain/investigation/lifecycle';
import { createInvestigation, type CapabilityError, type CapabilityRunInput, type Investigation } from '../../domain/investigation/model';
import type { InvestigationLifecycleState } from '../../domain/investigation/state';
import type { InvestigationStore } from '../ports/investigation-store';
import type { CapabilityRunner } from '../ports/capability-runner';

export type InvestigationCommandCode =
  | 'auth-required'
  | 'invalid-command'
  | 'not-found'
  | 'persistence-failed'
  | 'runner-failed'
  | 'claim-failed';

export class InvestigationCommandError extends Error {
  constructor(readonly code: InvestigationCommandCode, message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'InvestigationCommandError';
  }
}

export type CommandDependencies = {
  store: InvestigationStore;
  runner: CapabilityRunner;
};

export const toLifecycleState = (investigation: Investigation): InvestigationLifecycleState => ({
  status: investigation.capabilities.some(({ status }) => status !== 'queued') ? 'running' : 'idle',
  startedAt: null,
  completedAt: null,
  selectedCapabilities: investigation.capabilities.map(({ name }) => ({ id: name })),
  capabilityStates: Object.fromEntries(investigation.capabilities.map((capability) => [
    capability.name,
    capability.status === 'queued'
      ? { status: 'queued', retry: { status: 'not-retryable' } }
      : {
        status: capability.status,
        ...(capability.status === 'success'
          ? { outcome: { status: 'success' as const, result: capability.result, error: null } }
          : capability.status === 'failed' || capability.status === 'unavailable'
            ? { outcome: { status: capability.status, result: null, error: capability.error ?? null } }
            : {}),
        retry: { status: 'not-retryable' },
      },
  ])),
  overall: { status: 'incomplete' },
});

export const fromLifecycleState = (investigation: Investigation, state: InvestigationLifecycleState): Investigation => createInvestigation({
  ...investigation,
  capabilities: investigation.capabilities.map((capability) => {
    const next = state.capabilityStates[capability.name];
    const stable = Object.fromEntries(
      Object.entries(capability).filter(([key]) => key !== 'error' && key !== 'result'),
    ) as CapabilityRunInput;
    if (!next || next.status === 'idle') return { ...stable, status: 'queued' };
    return {
      ...stable,
      status: next.status,
      ...(next.status === 'success' ? { result: next.outcome?.result as CapabilityRunInput['result'] } : {}),
      ...(next.status === 'failed' || next.status === 'unavailable'
        ? { error: next.outcome?.error as CapabilityError } : {}),
    } as CapabilityRunInput;
  }),
});

export const transition = (investigation: Investigation, event: InvestigationEvent): Investigation =>
  fromLifecycleState(investigation, applyInvestigationEvent(toLifecycleState(investigation), event));

export const normalizeRunnerError = (cause: unknown): CapabilityError => ({
  code: typeof cause === 'object' && cause && 'code' in cause && typeof cause.code === 'string'
    ? cause.code : 'runner-failed',
  message: cause instanceof Error ? cause.message : 'Capability failed.',
  retryable: typeof cause === 'object' && cause && 'retryable' in cause ? cause.retryable !== false : true,
});

export const persist = async (store: InvestigationStore, investigation: Investigation): Promise<void> => {
  try {
    await store.save(investigation);
  } catch (cause) {
    throw new InvestigationCommandError('persistence-failed', 'Unable to save investigation.', cause);
  }
};

export const runCapabilities = async (
  investigation: Investigation,
  { store, runner }: CommandDependencies,
  only?: string,
): Promise<Investigation> => {
  let current = investigation;
  for (const capability of current.capabilities) {
    if (only && capability.name !== only) continue;
    if (capability.status !== 'queued' && capability.status !== 'failed') continue;
    if (capability.status === 'failed') {
      if (!capability.error?.retryable) continue;
      current = transition(current, { type: 'capability-queued', capability: capability.name });
    }
    current = transition(current, { type: 'capability-running', capability: capability.name });
    try {
      const result = await runner.run({
        investigation: current,
        capability: capability.name,
        options: capability.options,
      });
      current = transition(current, { type: 'capability-succeeded', capability: capability.name, result });
    } catch (cause) {
      const error = normalizeRunnerError(cause);
      current = transition(current, {
        type: error.code === 'runner_unavailable' ? 'capability-unavailable' : 'capability-failed',
        capability: capability.name,
        error,
      });
    }
  }
  await persist(store, current);
  return current;
};
