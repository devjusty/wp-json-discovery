import {
  getCapabilitySelection,
  getCapabilityDependencies,
  normalizeSelection
} from './scanCapabilities.js';
import { normalizeScanError } from './scanSession.js';
import { canRetryCapability } from '../domain/investigation/lifecycle.ts';
import { createInvestigatorReadModel } from '../adapters/investigatorReadModel.ts';
import { createPersistableSession, domainToSession } from '../adapters/persistence/sessionMapping.ts';
import { createLegacyCapabilityRunner } from '../adapters/capabilities/legacyCapabilityRunner.ts';
import { createLocalInvestigationStore } from '../adapters/persistence/localInvestigationStore.ts';
import { createRemoteInvestigationStore } from '../adapters/persistence/remoteInvestigationStore.ts';
import { createInvestigationTransport } from '../adapters/http/investigationTransport.ts';
import { createInvestigationApiClient } from '../api/client.ts';
import { normalizeDomain } from '../utils/format.js';
import { saveAuthenticatedInvestigationId } from './anonymousInvestigations.js';
import { InvestigationCommandError } from '../application/investigation/shared.ts';
import { retryWithCoordinator, runCapabilities } from '../application/investigation/shared.ts';
import { createInvestigation } from '../domain/investigation/model.ts';
export { recoverInvestigationSession } from '../application/investigation/recovery.js';

const RUNNER_UNAVAILABLE = {
  code: 'runner_unavailable',
  message: 'Capability runner unavailable.',
  retryable: true
};

export function createInvestigationSession({ investigationId, domain, selection }) {
  const normalizedSelection = normalizeSelection(selection);
  const dependencies = getCapabilityDependencies();
  const sourceOptions = selection?.options ?? {};
  const selectedCapabilities = normalizedSelection.capabilityIds.map((id) => ({
    id,
    dependencies: [...(dependencies[id] ?? [])],
    ...(Object.keys(sourceOptions[id] ?? {}).length > 0
      ? { options: { ...normalizedSelection.options[id] } }
      : {})
  }));
  const session = {
    id: investigationId,
    investigationId,
    status: 'idle',
    startedAt: null,
    completedAt: null,
    selectedCapabilities,
    capabilityStates: Object.fromEntries(
      selectedCapabilities.map(({ id }) => [id, createCapabilityState()])
    ),
    overall: { status: 'incomplete' },
    investigationState: {
      id: investigationId,
      submittedUrl: domain.submitted,
      normalizedUrl: domain.normalized,
      redirectChain: [domain.normalized],
      createdAt: new Date().toISOString(),
      capabilities: selectedCapabilities.map(({ id: name, dependencies, options }) => ({
        name,
        status: 'queued',
        dependencies: [...dependencies],
        ...(options ? { options: { ...options } } : {}),
      })),
      observationTimeline: [],
      evidence: [],
      findings: [],
    }
  };

  // Domain identity is execution context, not persisted session state.
  Object.defineProperty(session, 'domain', { value: cloneDomain(domain), enumerable: false });
  Object.defineProperty(session, 'selection', { value: cloneSelection(normalizedSelection), enumerable: false });
  return session;
}

export async function runInvestigationSession(session, runners, onChange, token) {
  const current = cloneSession(session);
  if (!isActive(token)) return current;
  notify(onChange, queuedProgress(current), token);
  const investigation = toInvestigation(current);
  const result = await runCapabilities(investigation, {
    store: compatibilityStore,
    runner: createCompatibilityRunner(current, runners),
    onProgress: (next) => notify(onChange, toLegacySession(next, current), token),
  });
  return toLegacySession(result, current);
}

export async function retryInvestigationCapability(session, capabilityId, runners, onChange, token) {
  const current = cloneSession(session);
  if (!current.capabilityStates[capabilityId] || !canRetryCapability(current, capabilityId) || !isActive(token)) return current;
  try {
    const result = await retryWithCoordinator(toInvestigation(current), capabilityId, {
      store: compatibilityStore,
      runner: createCompatibilityRunner(current, runners),
      onProgress: (next) => notify(onChange, toLegacySession(next, current), token),
    });
    return toLegacySession(result, current);
  } catch (error) {
    if (error instanceof InvestigationCommandError && error.code === 'invalid-command') return current;
    throw error;
  }
}

// Compatibility adapter for legacy scan callers. State transitions and execution live in application/investigation/shared.ts.
const compatibilityStore = {
  kind: 'local',
  async save() {},
  async get() { return null; },
  async list() { return []; },
};

function toInvestigation(session) {
  const persistable = createPersistableSession(session, session.domain);
  const state = {
    ...persistable.investigationState,
    capabilities: persistable.investigationState.capabilities.map((capability) => {
      const selected = session.selectedCapabilities.find(({ id }) => id === capability.name);
      if (selected?.dependencies?.length) return capability;
      const { dependencies: _dependencies, ...withoutDependencies } = capability;
      return withoutDependencies;
    }),
  };
  return createInvestigation(state);
}

function createCompatibilityRunner(session, runners) {
  return {
    run: async ({ investigation, capability, options }) => {
      const runner = runners?.[capability];
      if (typeof runner !== 'function') {
        throw Object.assign(new Error(RUNNER_UNAVAILABLE.message), RUNNER_UNAVAILABLE);
      }
      try {
        return await runner({
          domain: investigation.normalizedUrl,
          domainIdentity: session.domain,
          options: options ?? {},
        });
      } catch (cause) {
        const normalized = normalizeScanError(cause);
        throw Object.assign(new Error(normalized.message), normalized);
      }
    },
  };
}

function queuedProgress(session) {
  const next = cloneSession(session);
  next.status = 'queued';
  next.selectedCapabilities.forEach(({ id }) => {
    if (next.capabilityStates[id]?.status === 'idle') next.capabilityStates[id] = { status: 'queued', retry: { status: 'not-retryable' } };
  });
  return next;
}

function toLegacySession(investigation, source) {
  const next = domainToSession(investigation);
  next.id = source.id;
  next.selectedCapabilities = next.selectedCapabilities.map((capability) => {
    const sourceCapability = source.selectedCapabilities.find(({ id }) => id === capability.id);
    return sourceCapability ? { ...capability, dependencies: [...(sourceCapability.dependencies ?? capability.dependencies ?? [])] } : capability;
  });
  next.capabilityStates = Object.fromEntries(Object.entries(next.capabilityStates).map(([id, state]) => {
    const sourceState = source.capabilityStates[id];
    if (sourceState?.dependency) return [id, { ...state, dependency: sourceState.dependency }];
    if (state.status === 'unavailable' && state.outcome?.error?.code === 'dependency_failed') {
      const dependencies = next.selectedCapabilities.find(({ id: candidate }) => candidate === id)?.dependencies ?? [];
      const dependencyId = dependencies.find((dependency) => ['failed', 'unavailable'].includes(next.capabilityStates[dependency]?.status)) ?? dependencies[0];
      if (dependencyId) {
        return [id, {
          ...state,
          dependency: { status: 'failed', dependencyId, error: state.outcome.error },
        }];
      }
    }
    return [id, state];
  }));
  return next;
}

export function getInvestigatorSelection() {
  return normalizeSelection({ capabilityIds: ['wordpress', 'homepage'] });
}

/**
 * Binds application commands to the investigator UI. Pages receive results and
 * commands, never persistence or capability-transition details.
 */
export function createInvestigatorWorkflow({
  auth,
  localStore = undefined,
  remoteStore = undefined,
  runner = createLegacyCapabilityRunner(),
  normalize = normalizeDomain,
  redirectChain = undefined,
  remoteStart = undefined,
  onProgress = undefined,
}) {
  if (!auth || typeof auth.getUserId !== 'function' || typeof auth.getAccessToken !== 'function') {
    throw new Error('Investigation workflow requires an AuthSession.');
  }
  const resolvedLocalStore = localStore ?? createLocalInvestigationStore();
  const resolvedRemoteStore = remoteStore ?? createRemoteInvestigationStore({ authSession: auth });
  const authenticatedTransport = createInvestigationTransport(
    createInvestigationApiClient(() => auth.getAccessToken()),
  );
  localStore = resolvedLocalStore;
  remoteStore = resolvedRemoteStore;
  const dependencies = { auth, localStore, remoteStore, runner };
  const storeAffinity = new Map();
  const defaultAffinity = () => (auth?.getUserId?.() ? 'remote' : 'local');
  const storeForAffinity = (affinity) => affinity === 'local' ? localStore : remoteStore;
  const affinityFromResult = (result, fallback) => result.persistence.remote && result.persistence.local === 'saved'
    ? 'local'
    : fallback;

  const present = (result, affinity = storeAffinity.get(result.investigation.id) ?? result.investigation.storeAffinity ?? defaultAffinity()) => {
    storeAffinity.set(result.investigation.id, affinity);
    const investigation = { ...result.investigation };
    Object.defineProperty(investigation, 'storeAffinity', { value: affinity, enumerable: false, configurable: true });
    const session = domainToSession(investigation);
    Object.defineProperty(session, 'storeAffinity', { value: affinity, enumerable: false, configurable: true });
    return {
      ...result,
      investigation,
      session,
      readModel: createInvestigatorReadModel(session, Boolean(auth?.getUserId?.())),
      commands: {
        retry: (capability) => retry(investigation, capability),
        resume: () => resume(investigation.id),
        claim: () => claim(investigation.id),
      },
    };
  };

  function rememberAuthenticatedInvestigation(investigation) {
    if (auth.getUserId?.()) saveAuthenticatedInvestigationId(investigation.id);
  }

  const start = async (submittedUrl, capabilities = getInvestigatorSelection()) => {
    const selection = normalizeSelection(capabilities);
    const { startInvestigation: startCommand } = await import('../application/investigation/start.ts');
    const result = await startCommand({
      domain: { submittedUrl, normalizedUrl: normalize(submittedUrl) },
       redirectChain: redirectChain ?? [normalize(submittedUrl)],
       capabilities: selection.capabilityIds.map((name) => ({
        name,
        options: selection.options[name],
        dependencies: getCapabilityDependencies()[name] ?? [],
      })),
       onProgress,
    }, {
      ...dependencies,
      onAllocated: rememberAuthenticatedInvestigation,
      remoteStart: auth.getUserId?.()
        ? (remoteStart ?? ((identity, selectedCapabilities, chain) => authenticatedTransport.start(
          identity,
          selectedCapabilities.map(({ name, dependencies = [], options }) => ({
            id: name,
            dependencies,
            ...(options ? { options } : {}),
          })),
          chain,
        )))
        : undefined,
    });
    rememberAuthenticatedInvestigation(result.investigation);
    return present(result, affinityFromResult(result, defaultAffinity()));
  };

  const retry = async (investigation, capability) => {
    const { retryCapability: retryCommand } = await import('../application/investigation/retry.ts');
    const affinity = storeAffinity.get(investigation.id) ?? investigation.storeAffinity ?? defaultAffinity();
    const result = await retryCommand({ investigation, capability }, {
      auth,
      store: storeForAffinity(affinity),
      localStore,
       runner,
       onProgress,
    });
    return present(result, affinityFromResult(result, affinity));
  };

  const resume = async (id) => {
    const { resumeInvestigation: resumeCommand } = await import('../application/investigation/resume.ts');
    let affinity = storeAffinity.get(id);
    let probeFailure;
    if (!affinity && auth?.getUserId?.()) {
      try {
        affinity = await localStore.get(id) ? 'local' : 'remote';
      } catch (cause) {
        probeFailure = new InvestigationCommandError('persistence-failed', 'Unable to load investigation.', cause);
        affinity = 'remote';
      }
    }
    affinity ??= defaultAffinity();
    try {
      const result = await resumeCommand(id, {
       auth,
       store: storeForAffinity(affinity),
       localStore,
        runner,
        onProgress,
       });
       return present(result, affinityFromResult(result, affinity));
    } catch (cause) {
      if (probeFailure && cause?.code === 'not-found') throw probeFailure;
      throw cause;
    }
  };

  const claim = async (id) => {
    const { claimInvestigation: claimCommand } = await import('../application/investigation/claim.ts');
    const result = await claimCommand(id, { auth, localStore, remoteStore });
    rememberAuthenticatedInvestigation(result.investigation);
    return present(result);
  };

  const run = async (investigation) => {
    const { createPersistenceContext, runCapabilities } = await import('../application/investigation/shared.ts');
    const authenticated = Boolean(auth.getUserId?.());
    const affinity = storeAffinity.get(investigation.id) ?? investigation.storeAffinity ?? defaultAffinity();
    const persistence = createPersistenceContext({
      auth,
      store: storeForAffinity(affinity),
      localStore: authenticated ? localStore : undefined,
    });
    rememberAuthenticatedInvestigation(investigation);
    await persistence.store.save(investigation);
    const result = await runCapabilities(investigation, {
      store: persistence.store,
      runner,
      onProgress,
    });
    const commandResult = persistence.result(result);
    return present(commandResult, affinityFromResult(commandResult, affinity));
  };

  return { start, run, retry, resume, claim, list: () => (auth?.getUserId?.() ? remoteStore : localStore).list() };
}

export function getContextualCapabilityIds(session) {
  return ['sitemap'].filter((id) => !session.selectedCapabilities.some((capability) => capability.id === id));
}

export function addInvestigationCapability(session, capabilityId, options = {}) {
  if (session.selectedCapabilities.some(({ id }) => id === capabilityId)) {
    const next = cloneSession(session);
    const state = next.capabilityStates[capabilityId];
    next.selectedCapabilities = next.selectedCapabilities.map((capability) => capability.id === capabilityId
      ? { ...capability, options: { ...options } }
      : capability);
    Object.defineProperty(next, 'selection', {
      value: cloneSelection({
        ...next.selection,
        options: { ...next.selection.options, [capabilityId]: { ...options } },
      }),
      enumerable: false,
      configurable: true,
    });
    if (state && ['success', 'failed'].includes(state.status)) {
      next.capabilityStates[capabilityId] = createCapabilityState();
      if (next.investigationState) {
        next.investigationState = {
          ...next.investigationState,
          capabilities: next.investigationState.capabilities.map((capability) => {
            if (capability.name !== capabilityId) return capability;
            const reset = { ...capability, status: 'queued' };
            delete reset.result;
            delete reset.error;
            reset.options = { ...options };
            return reset;
          }),
        };
      }
    }
    return next;
  }
  const next = cloneSession(session);
  const capabilitySelection = getCapabilitySelection(capabilityId, options);
  if (!capabilitySelection) return cloneSession(session);
  next.selectedCapabilities = [...next.selectedCapabilities, capabilitySelection];
  next.capabilityStates = {
    ...next.capabilityStates,
    [capabilityId]: createCapabilityState()
  };
  if (session.investigationState) {
    next.investigationState = {
      ...session.investigationState,
      capabilities: [...session.investigationState.capabilities, {
        name: capabilityId,
        status: 'queued',
        dependencies: [...(capabilitySelection.dependencies ?? [])],
        ...(capabilitySelection.options ? { options: { ...capabilitySelection.options } } : {}),
      }],
    };
  }
  Object.defineProperty(next, 'selection', {
    value: cloneSelection({
      capabilityIds: [...session.selection.capabilityIds, capabilityId],
      options: { ...session.selection.options, [capabilityId]: capabilitySelection.options ?? {} }
    }),
    enumerable: false,
    configurable: true
  });
  return next;
}

function createCapabilityState() {
  return { status: 'idle', retry: { status: 'not-retryable' } };
}

function cloneSession(session) {
  const next = {
    ...session,
    selectedCapabilities: session.selectedCapabilities.map((capability) => {
      const registered = getCapabilitySelection(capability.id);
      return registered
        ? {
          ...registered,
          ...capability,
          dependencies: [...(capability.dependencies ?? registered.dependencies ?? [])],
          ...(capability.options ? { options: { ...capability.options } } : {}),
        }
        : { ...capability, dependencies: [...(capability.dependencies ?? [])] };
    }),
    capabilityStates: Object.fromEntries(Object.entries(session.capabilityStates).map(([id, state]) => {
      const clonedState = {
        status: state.status,
        retry: { ...state.retry }
      };
      if ('outcome' in state) {
        clonedState.outcome = { ...state.outcome, error: state.outcome.error ? { ...state.outcome.error } : null };
      }
      if ('dependency' in state) {
        clonedState.dependency = { ...state.dependency, error: { ...state.dependency.error } };
      }
      return [id, clonedState];
    }))
  };
  Object.defineProperty(next, 'domain', { value: cloneDomain(session.domain), enumerable: false });
  Object.defineProperty(next, 'selection', { value: cloneSelection(session.selection), enumerable: false, configurable: true });
  return next;
}

function cloneDomain(domain) {
  return domain ? { submitted: domain.submitted, normalized: domain.normalized } : null;
}

function cloneSelection(selection) {
  return { capabilityIds: [...selection.capabilityIds], options: Object.fromEntries(Object.entries(selection.options).map(([id, options]) => [id, { ...options }])) };
}

function isActive(token) {
  return token?.active !== false;
}

function notify(onChange, session, token) {
  if (typeof onChange === 'function' && isActive(token)) onChange(cloneSession(session));
}
