import {
  getCapabilitySelection,
  getCapabilityDependencies,
  normalizeSelection
} from './scanCapabilities.js';
import { normalizeScanError } from './scanSession.js';
import { applyInvestigationEvent, canRetryCapability } from '../domain/investigation/lifecycle.ts';
import { selectInvestigationStatus } from '../domain/investigation/selectors.ts';

const DEPENDENCY_ERROR = {
  code: 'dependency_failed',
  message: 'Required capability did not complete.',
  retryable: false
};

const RUNNER_UNAVAILABLE = {
  code: 'runner_unavailable',
  message: 'Capability runner unavailable.',
  retryable: true
};

const INTERRUPTED_ERROR = {
  code: 'interrupted',
  message: 'Capability was interrupted before it completed.',
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
    overall: { status: 'incomplete' }
  };

  // Domain identity is execution context, not persisted session state.
  Object.defineProperty(session, 'domain', { value: cloneDomain(domain), enumerable: false });
  Object.defineProperty(session, 'selection', { value: cloneSelection(normalizedSelection), enumerable: false });
  return session;
}

export async function runInvestigationSession(session, runners, onChange, token) {
  let current = cloneSession(session);
  if (!isActive(token)) return current;

  while (hasPendingCapabilities(current)) {
    if (!isActive(token)) return current;

    const pendingIds = getPendingIds(current);
    const blockedIds = pendingIds.filter((id) => hasFailedDependency(current, id));
    for (const id of blockedIds) {
      current = updateCapability(current, id, unavailableState(DEPENDENCY_ERROR, getFailedDependency(current, id)));
      notify(onChange, current, token);
    }

    const runnableIds = getPendingIds(current).filter((id) => hasSuccessfulDependencies(current, id));
    if (runnableIds.length === 0) {
      current.startedAt ??= new Date().toISOString();
      for (const id of getPendingIds(current)) {
        current = updateCapability(current, id, unavailableState(DEPENDENCY_ERROR));
        notify(onChange, current, token);
      }
      continue;
    }

    for (const id of runnableIds) {
      if (!isActive(token)) return current;
      current = updateCapability(current, id, { status: 'queued', retry: { status: 'not-retryable' } });
      notify(onChange, current, token);
    }

    for (const id of runnableIds) {
      if (!isActive(token)) return current;
      current = updateCapability(current, id, {
        status: 'running',
        retry: { status: 'not-retryable' }
      });
      notify(onChange, current, token);
    }

    const settled = await Promise.allSettled(
      runnableIds.map((id) => Promise.resolve().then(() => runCapability(current, id, runners)))
    );

    settled.forEach((outcome, index) => {
      const id = runnableIds[index];
      current = outcome.status === 'fulfilled'
        ? updateCapability(current, id, successState(outcome.value))
        : updateCapability(current, id, errorState(outcome.reason));
      if (isActive(token)) notify(onChange, current, token);
    });
  }

  return finalize(current);
}

export async function retryInvestigationCapability(session, capabilityId, runners, onChange, token) {
  let current = cloneSession(session);
  const state = current.capabilityStates[capabilityId];
  if (!state || !canRetryCapability(current, capabilityId) || !isActive(token)) return current;
  if (!hasSuccessfulDependencies(current, capabilityId)) {
    current = updateCapability(current, capabilityId, unavailableState(DEPENDENCY_ERROR, getFailedDependency(current, capabilityId)));
    notify(onChange, current, token);
    return current;
  }

  current = updateCapability(current, capabilityId, { status: 'queued', retry: { status: 'not-retryable' } });
  notify(onChange, current, token);
  if (!isActive(token)) return current;
  current = updateCapability(current, capabilityId, { status: 'running', retry: { status: 'not-retryable' } });
  notify(onChange, current, token);

  const outcome = await Promise.allSettled([
    Promise.resolve().then(() => runCapability(current, capabilityId, runners))
  ]);
  current = updateCapability(current, capabilityId,
    outcome[0].status === 'fulfilled' ? successState(outcome[0].value) : errorState(outcome[0].reason));
  if (isActive(token)) notify(onChange, current, token);
  return finalize(current);
}

export function recoverInvestigationSession(session) {
  const activeSession = ['queued', 'running'].includes(session.status);
  const interruptedIds = Object.entries(session.capabilityStates)
    .filter(([, state]) => activeSession
      ? !['success', 'failed', 'unavailable'].includes(state.status)
      : ['queued', 'running'].includes(state.status))
    .map(([id]) => id);
  if (!activeSession && interruptedIds.length === 0) return session;

  let recovered = cloneSession(session);
  recovered.startedAt ??= new Date().toISOString();
  for (const id of interruptedIds) {
    recovered = updateCapability(recovered, id, {
      status: 'failed',
      outcome: { status: 'failed', result: null, error: { ...INTERRUPTED_ERROR } },
      retry: { status: 'not-retryable' }
    });
  }

  return finalize(recovered);
}

export function getInvestigatorSelection() {
  return normalizeSelection({ capabilityIds: ['wordpress', 'homepage'] });
}

export function getContextualCapabilityIds(session) {
  return ['sitemap'].filter((id) => !session.selectedCapabilities.some((capability) => capability.id === id));
}

export function addInvestigationCapability(session, capabilityId, options = {}) {
  if (session.selectedCapabilities.some(({ id }) => id === capabilityId)) return cloneSession(session);
  const next = cloneSession(session);
  const capabilitySelection = getCapabilitySelection(capabilityId, options);
  if (!capabilitySelection) return cloneSession(session);
  next.selectedCapabilities = [...next.selectedCapabilities, capabilitySelection];
  next.capabilityStates = {
    ...next.capabilityStates,
    [capabilityId]: createCapabilityState()
  };
  Object.defineProperty(next, 'selection', {
    value: cloneSelection({
      capabilityIds: [...session.selection.capabilityIds, capabilityId],
      options: { ...session.selection.options, [capabilityId]: options }
    }),
    enumerable: false,
    configurable: true
  });
  return next;
}

function createCapabilityState() {
  return { status: 'idle', retry: { status: 'not-retryable' } };
}

function runCapability(session, id, runners) {
  if (typeof runners?.[id] !== 'function') throw Object.assign(new Error(RUNNER_UNAVAILABLE.message), RUNNER_UNAVAILABLE);
  return runners[id]({
    domain: session.domain.normalized,
    domainIdentity: session.domain,
    options: session.selection.options[id]
  });
}

function successState(result) {
  return { status: 'success', outcome: { status: 'success', result, error: null }, retry: { status: 'not-retryable' } };
}

function errorState(error) {
  const normalized = normalizeScanError(error);
  return normalized.code === 'runner_unavailable'
    ? unavailableState(normalized)
    : { status: 'failed', outcome: { status: 'failed', result: null, error: normalized }, retry: { status: 'not-retryable' } };
}

function unavailableState(error, dependencyId) {
  const normalizedError = { ...error, retryable: false };
  const state = {
    status: 'unavailable',
    outcome: { status: 'unavailable', result: null, error: normalizedError },
    retry: { status: 'not-retryable' }
  };
  if (dependencyId) state.dependency = { status: 'failed', dependencyId, error: normalizedError };
  return state;
}

function updateCapability(session, id, state) {
  const event = state.status === 'success'
    ? { type: 'capability-succeeded', capability: id, result: state.outcome?.result, at: new Date().toISOString() }
    : state.status === 'failed'
      ? { type: 'capability-failed', capability: id, error: state.outcome.error, at: new Date().toISOString() }
      : state.status === 'unavailable'
        ? {
          type: 'capability-unavailable', capability: id, error: state.outcome?.error,
          dependencyId: state.dependency?.dependencyId, at: new Date().toISOString()
        }
        : { type: `capability-${state.status}`, capability: id, at: new Date().toISOString() };
  const transitioned = applyInvestigationEvent(session, event);
  const next = {
    ...transitioned,
    capabilityStates: transitioned.capabilityStates,
    overall: { status: selectInvestigationStatus(transitioned) }
  };
  if (state.status === 'queued' && session.status !== 'idle') {
    next.status = 'running';
    next.startedAt ??= new Date().toISOString();
  }
  Object.defineProperty(next, 'domain', { value: cloneDomain(session.domain), enumerable: false });
  Object.defineProperty(next, 'selection', { value: cloneSelection(session.selection), enumerable: false, configurable: true });
  return next;
}

function finalize(session) {
  const aggregateStatus = selectInvestigationStatus(session);
  const next = {
    ...session,
    status: ['complete', 'partial'].includes(aggregateStatus) ? 'completed' : 'failed',
    completedAt: new Date().toISOString(),
    overall: { status: aggregateStatus }
  };
  Object.defineProperty(next, 'domain', { value: cloneDomain(session.domain), enumerable: false });
  Object.defineProperty(next, 'selection', { value: cloneSelection(session.selection), enumerable: false, configurable: true });
  return next;
}

function getPendingIds(session) {
  return session.selectedCapabilities
    .map(({ id }) => id)
    .filter((id) => session.capabilityStates[id].status === 'idle');
}

function hasPendingCapabilities(session) {
  return getPendingIds(session).length > 0;
}

function getDependencies(session, id) {
  return session.selectedCapabilities.find((capability) => capability.id === id)?.dependencies ?? [];
}

function hasFailedDependency(session, id) {
  return getDependencies(session, id).some((dependencyId) => ['failed', 'unavailable'].includes(session.capabilityStates[dependencyId]?.status));
}

function hasSuccessfulDependencies(session, id) {
  return getDependencies(session, id).every((dependencyId) => session.capabilityStates[dependencyId]?.status === 'success');
}

function getFailedDependency(session, id) {
  return getDependencies(session, id).find((dependencyId) => ['failed', 'unavailable'].includes(session.capabilityStates[dependencyId]?.status));
}

function cloneSession(session) {
  const next = {
    ...session,
    selectedCapabilities: session.selectedCapabilities.map((capability) => {
      const registered = getCapabilitySelection(capability.id);
      return registered
        ? { ...registered, ...(capability.options ? { options: { ...capability.options } } : {}) }
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
