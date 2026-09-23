import {
  applyInvestigationEvent,
  type InvestigationEvent,
} from '../../domain/investigation/lifecycle';
import { createInvestigation, type CapabilityError, type CapabilityRunInput, type Investigation } from '../../domain/investigation/model';
import type { InvestigationLifecycleState } from '../../domain/investigation/state';
import type { InvestigationStore } from '../ports/investigation-store';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { AuthSession } from '../ports/auth-session';
import {
  retryInvestigationCapability,
  runInvestigationSession,
} from '../../services/investigationSession.js';

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
  { store, runner }: CommandDependencies,
): Promise<Investigation> => {
  const changed = investigation.capabilities
    .filter(({ status }) => status === 'queued')
    .map(({ name }) => name);
  if (changed.length === 0) return investigation;
  const session = await runInvestigationSession(
    toCoordinatorSession(investigation),
    createCoordinatorRunners(investigation, runner),
  );
  const current = fromCoordinatorSession(investigation, session, changed);
  await persist(store, current);
  return current;
};

export const retryWithCoordinator = async (
  investigation: Investigation,
  capability: string,
  { store, runner }: CommandDependencies,
): Promise<Investigation> => {
  const session = await retryInvestigationCapability(
    toCoordinatorSession(investigation),
    capability,
    createCoordinatorRunners(investigation, runner),
  );
  const current = fromCoordinatorSession(investigation, session, [capability]);
  await persist(store, current);
  return current;
};

function toCoordinatorSession(investigation: Investigation) {
  const selectedCapabilities = investigation.capabilities.map(({ name, dependencies = [], options }) => ({
    id: name,
    dependencies: [...dependencies],
    ...(options ? { options } : {}),
  }));
  const session = {
    id: `${investigation.id}-session`,
    investigationId: investigation.id,
    status: 'idle',
    startedAt: null,
    completedAt: null,
    selectedCapabilities,
    capabilityStates: Object.fromEntries(investigation.capabilities.map(capability => [
      capability.name,
      toCoordinatorCapabilityState(capability),
    ])),
    overall: { status: 'incomplete' },
  };
  Object.defineProperty(session, 'domain', {
    value: { submitted: investigation.submittedUrl, normalized: investigation.normalizedUrl },
    enumerable: false,
  });
  Object.defineProperty(session, 'selection', {
    value: {
      capabilityIds: selectedCapabilities.map(({ id }) => id),
      options: Object.fromEntries(selectedCapabilities.map(({ id, options }) => [id, options ?? {}])),
    },
    enumerable: false,
  });
  return session;
}

function createCoordinatorRunners(investigation: Investigation, runner: CapabilityRunner) {
  return Object.fromEntries(investigation.capabilities.map(({ name }) => [
    name,
    ({ options }) => runner.run({ investigation, capability: name, options }),
  ]));
}

function fromCoordinatorSession(investigation: Investigation, session, changedCapabilities: string[]): Investigation {
  let current = investigation;
  for (const capability of investigation.capabilities) {
    if (!changedCapabilities.includes(capability.name)) continue;
    const next = session.capabilityStates[capability.name];
    if (!next || next.status === 'idle' || next.status === 'queued') continue;
    current = applyCoordinatorCapability(current, capability.name, next);
  }
  return current;
}

function toCoordinatorCapabilityState(capability) {
  if (capability.status === 'queued') return { status: 'idle', retry: { status: 'not-retryable' } };
  if (capability.status === 'success') {
    return {
      status: 'success',
      outcome: { status: 'success', result: capability.result, error: null },
      retry: { status: 'not-retryable' },
    };
  }
  return {
    status: capability.status,
    outcome: { status: capability.status, result: null, error: capability.error },
    retry: { status: 'not-retryable' },
  };
}

function applyCoordinatorCapability(investigation: Investigation, capability: string, next): Investigation {
  return completeCoordinatorCapability(prepareCoordinatorCapability(investigation, capability), capability, next);
}

function prepareCoordinatorCapability(investigation: Investigation, capability: string): Investigation {
  let current = investigation;
  const currentStatus = current.capabilities.find(({ name }) => name === capability)?.status;
  if (currentStatus === 'failed') current = transition(current, { type: 'capability-queued', capability });
  if (current.capabilities.find(({ name }) => name === capability)?.status === 'queued') {
    current = transition(current, { type: 'capability-running', capability });
  }
  return current;
}

function completeCoordinatorCapability(investigation: Investigation, capability: string, next): Investigation {
  const current = investigation;
  const error = next.error ?? next.outcome?.error;
  return next.status === 'success'
    ? transition(current, { type: 'capability-succeeded', capability, result: next.outcome?.result })
    : transition(current, {
      type: next.status === 'unavailable' ? 'capability-unavailable' : 'capability-failed',
      capability,
      error: normalizeRunnerError(error),
      ...(next.dependency?.dependencyId ? { dependencyId: next.dependency.dependencyId } : {}),
    });
}
