import {
  applyInvestigationEvent,
  type InvestigationEvent,
} from '../../domain/investigation/lifecycle';
import { createInvestigation, type CapabilityError, type CapabilityRunInput, type Investigation } from '../../domain/investigation/model';
import type { InvestigationLifecycleState } from '../../domain/investigation/state';
import type { InvestigationStore } from '../ports/investigation-store';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { AuthSession } from '../ports/auth-session';

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

export type PersistenceMetadata = {
  remote?: { code: 'persistence-failed'; message: string };
  local: 'saved' | 'not-needed';
};

export type InvestigationCommandResult = {
  investigation: Investigation;
  persistence: PersistenceMetadata;
};

export type InvestigationProgressCallback = (investigation: Investigation) => void | Promise<void>;

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

export const persist = async (store: InvestigationStore, investigation: Investigation): Promise<Investigation> => {
  const persisted = createInvestigation({ ...investigation, updatedAt: new Date().toISOString() });
  try {
    await store.save(persisted);
    return persisted;
  } catch (cause) {
    throw new InvestigationCommandError('persistence-failed', 'Unable to save investigation.', cause);
  }
};

export const createPersistenceContext = (dependencies: {
  auth?: AuthSession;
  store: InvestigationStore;
  localStore?: InvestigationStore;
}) => {
  const authenticated = Boolean(dependencies.auth?.getUserId?.());
  let remoteFailure: PersistenceMetadata['remote'];
  let localSaved = false;
  const store = authenticated && dependencies.localStore
    ? {
      ...dependencies.store,
      async save(value: Investigation) {
        try {
          await dependencies.store.save(value);
        } catch {
          remoteFailure = { code: 'persistence-failed', message: 'Unable to save investigation.' };
          await persist(dependencies.localStore, value);
          localSaved = true;
        }
      },
    }
    : {
      ...dependencies.store,
      async save(value: Investigation) {
        await dependencies.store.save(value);
        if (!authenticated) localSaved = true;
      },
    };

  return {
    store,
    result(investigation: Investigation): InvestigationCommandResult {
      return {
        investigation,
        persistence: {
          ...(remoteFailure ? { remote: remoteFailure } : {}),
          local: localSaved ? 'saved' : 'not-needed',
        },
      };
    },
  };
};

export const runCapabilities = async (
  investigation: Investigation,
  { store, runner, onProgress }: CommandDependencies & { onProgress?: InvestigationProgressCallback },
): Promise<Investigation> => {
  const changed = investigation.capabilities
    .filter(({ status }) => status === 'queued')
    .map(({ name }) => name);
  if (changed.length === 0) return investigation;
  const current = await runDomainCapabilities(investigation, runner, store, onProgress);
  return persist(store, current);
};

export const retryWithCoordinator = async (
  investigation: Investigation,
  capability: string,
  { store, runner, onProgress }: CommandDependencies & { onProgress?: InvestigationProgressCallback },
): Promise<Investigation> => {
  const currentCapability = investigation.capabilities.find(({ name }) => name === capability);
  if (!currentCapability || currentCapability.status !== 'failed' || !currentCapability.error?.retryable) {
    throw new InvestigationCommandError('invalid-command', 'Capability is not retryable.');
  }
  let current = transition(investigation, { type: 'capability-queued', capability });
  current = transition(current, { type: 'capability-running', capability });
  current = await publishProgress(current, store, onProgress);
  try {
    const result = await runner.run({ investigation: current, capability, options: currentCapability.options });
    current = transition(current, { type: 'capability-succeeded', capability, result });
  } catch (cause) {
    current = transition(current, { type: 'capability-failed', capability, error: normalizeRunnerError(cause) });
  }
  current = await publishProgress(current, store, onProgress);
  return persist(store, current);
};

async function runDomainCapabilities(
  investigation: Investigation,
  runner: CapabilityRunner,
  store: InvestigationStore,
  onProgress?: InvestigationProgressCallback,
): Promise<Investigation> {
  let current = investigation;
  while (current.capabilities.some(({ status }) => status === 'queued')) {
    const pending = current.capabilities.filter(({ status }) => status === 'queued');
    const blocked = pending.filter(({ dependencies = [] }) => dependencies.some((dependency) => {
      const state = current.capabilities.find(({ name }) => name === dependency);
      return state?.status === 'failed' || state?.status === 'unavailable';
    }));
    for (const { name, dependencies = [] } of blocked) {
      const dependency = dependencies.find((id) => current.capabilities.find(({ name: candidate }) => candidate === id)?.status === 'failed');
      if (current.capabilities.find(({ name: candidate }) => candidate === name)?.status === 'queued') {
        current = transition(current, { type: 'capability-running', capability: name });
      }
      current = transition(current, {
        type: 'capability-unavailable', capability: name, dependencyId: dependency,
        error: { code: 'dependency_failed', message: 'Required capability did not complete.', retryable: false },
      });
      current = await publishProgress(current, store, onProgress);
    }
    const runnable = current.capabilities.filter(({ status, dependencies = [] }) => (
      status === 'queued' && dependencies.every((dependency) => current.capabilities.find(({ name }) => name === dependency)?.status === 'success')
    ));
    if (runnable.length === 0) break;
    runnable.forEach(({ name }) => { current = transition(current, { type: 'capability-running', capability: name }); });
    current = await publishProgress(current, store, onProgress);
    const settled = await Promise.allSettled(runnable.map(({ name, options }) => runner.run({ investigation: current, capability: name, options })));
    for (const [index, outcome] of settled.entries()) {
      const name = runnable[index].name;
      current = outcome.status === 'fulfilled'
        ? transition(current, { type: 'capability-succeeded', capability: name, result: outcome.value })
        : transition(current, { type: 'capability-failed', capability: name, error: normalizeRunnerError(outcome.reason) });
      current = await publishProgress(current, store, onProgress);
    }
  }
  return current;
}

async function publishProgress(
  investigation: Investigation,
  store: InvestigationStore,
  onProgress?: InvestigationProgressCallback,
): Promise<Investigation> {
  const persisted = await persist(store, investigation);
  await onProgress?.(persisted);
  return persisted;
}
