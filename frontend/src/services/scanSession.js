import { scanSessionSchema } from '@wp-json-discovery/contracts';

import { normalizeSelection } from './scanCapabilities.js';
import { selectInvestigationStatus } from '../domain/investigation/selectors.ts';

const DEPENDENCY_ERROR = {
  code: 'dependency_failed',
  message: 'Required scan did not complete.',
  retryable: false
};

export function createScanSession(domain, selection, dependencies = {}, domainIdentity = null) {
  const normalizedSelection = normalizeSelection(selection);

  const session = {
    domain,
    selection: cloneSelection(normalizedSelection),
    dependencies: cloneDependencies(dependencies, normalizedSelection.capabilityIds),
    overallStatus: 'idle',
    capabilities: Object.fromEntries(normalizedSelection.capabilityIds.map((id) => [id, createCapabilityState()]))
  };
  Object.defineProperty(session, 'domainIdentity', {
    value: domainIdentity,
    enumerable: false
  });
  return session;
}

export function normalizeScanError(error) {
  return {
    code: error?.code || 'scan_failed',
    message: error?.message || 'Scan failed. Try again.',
    retryable: error?.retryable !== false
  };
}

function validateContractScanSession(value) {
  return scanSessionSchema.safeParse(value);
}

export function validateSessionSnapshot(value) {
  if (hasLegacySessionKeys(value)) {
    return validateLegacySessionSnapshot(value);
  }

  const validation = validateContractScanSession(value);
  return validation.success
    ? { ...validation, format: 'contract' }
    : validation;
}

export async function executeScanSession(session, runners, onChange, token) {
  let current = cloneAcceptedLegacySession(session);

  while (hasPendingCapabilities(current)) {
    if (token?.active === false) {
      break;
    }
    const pendingIds = getPendingCapabilityIds(current);
    const unavailableIds = pendingIds.filter((id) => hasFailedDependency(current, id));

    for (const id of unavailableIds) {
      current = updateCapability(current, id, {
        status: 'unavailable',
        result: null,
        error: { ...DEPENDENCY_ERROR }
      });
      notify(onChange, current, token);
    }

    const runnableIds = getPendingCapabilityIds(current)
      .filter((id) => hasCompletedDependencies(current, id));

    if (runnableIds.length === 0) {
      for (const id of getPendingCapabilityIds(current)) {
        current = updateCapability(current, id, {
          status: 'unavailable',
          result: null,
          error: { ...DEPENDENCY_ERROR }
        });
        notify(onChange, current, token);
      }
      continue;
    }

    for (const id of runnableIds) {
      current = updateCapability(current, id, { status: 'queued', result: null, error: null });
      notify(onChange, current, token);
    }

    for (const id of runnableIds) {
      current = updateCapability(current, id, { status: 'running', result: null, error: null });
      notify(onChange, current, token);
    }

    const settled = await Promise.allSettled(
      runnableIds.map((id) => Promise.resolve().then(() => runCapability(current, id, runners)))
    );

    settled.forEach((outcome, index) => {
      const id = runnableIds[index];
      current = outcome.status === 'fulfilled'
        ? updateCapability(current, id, { status: 'success', result: outcome.value, error: null })
        : updateCapability(current, id, {
          status: outcome.reason?.code === 'runner_unavailable' ? 'unavailable' : 'failed',
          result: null,
          error: normalizeScanError(outcome.reason)
        });
      notify(onChange, current, token);
    });
  }

  return current;
}

export async function retryCapability(session, id, runners, onChange, token) {
  session = cloneAcceptedLegacySession(session);

  if (!session.selection.capabilityIds.includes(id)
    || session.capabilities[id]?.status !== 'failed'
    || session.capabilities[id]?.error?.retryable !== true) {
    return cloneSession(session);
  }

  let current = cloneSession(session);

  if (!hasCompletedDependencies(current, id)) {
    current = updateCapability(current, id, {
      status: 'unavailable',
      result: null,
      error: { ...DEPENDENCY_ERROR }
    });
    notify(onChange, current, token);
    return current;
  }

  current = updateCapability(current, id, { status: 'queued', result: null, error: null });
  notify(onChange, current, token);
  current = updateCapability(current, id, { status: 'running', result: null, error: null });
  notify(onChange, current, token);

  try {
    const result = await runCapability(current, id, runners);
    current = updateCapability(current, id, { status: 'success', result, error: null });
  } catch (error) {
    current = updateCapability(current, id, {
      status: 'failed',
      result: null,
      error: normalizeScanError(error)
    });
  }

  notify(onChange, current, token);
  return current;
}

function createCapabilityState() {
  return { status: 'idle', result: null, error: null };
}

function cloneAcceptedLegacySession(session) {
  const validation = validateSessionSnapshot(session);
  if (!validation.success || validation.format !== 'legacy') {
    const error = new Error(
      validation.success
        ? 'Redesigned session snapshots require an explicit migration boundary.'
        : 'Invalid scan session snapshot.'
    );
    error.code = 'invalid_session_snapshot';
    error.cause = validation.success ? null : validation.error;
    throw error;
  }
  const accepted = cloneSession(validation.data);
  Object.defineProperty(accepted, 'domainIdentity', {
    value: session.domainIdentity,
    enumerable: false
  });
  return accepted;
}

function isLegacySessionSnapshot(value) {
  if (!hasLegacySessionKeys(value) || typeof value.domain !== 'string') return false;

  const { selection, dependencies, capabilities, overallStatus } = value;
  if (!isValidLegacySelection(selection)) return false;

  const selectedCapabilityIds = new Set(selection.capabilityIds);
  return isValidLegacyDependencies(dependencies, selection.capabilityIds, selectedCapabilityIds)
    && isValidOverallStatus(overallStatus)
    && isValidLegacyCapabilities(capabilities, selection.capabilityIds);
}

function isValidLegacySelection(selection) {
  if (!isRecord(selection) || !Array.isArray(selection.capabilityIds) || !isRecord(selection.options)) {
    return false;
  }

  const capabilityIds = selection.capabilityIds;
  return capabilityIds.every((id) => typeof id === 'string')
    && new Set(capabilityIds).size === capabilityIds.length;
}

function isValidLegacyDependencies(dependencies, capabilityIds, selectedCapabilityIds) {
  return isRecord(dependencies)
    && hasExactKeys(dependencies, capabilityIds)
    && Object.values(dependencies).every((ids) => isValidDependencyList(ids, selectedCapabilityIds));
}

function isValidDependencyList(ids, selectedCapabilityIds) {
  return Array.isArray(ids) && ids.every((id) => selectedCapabilityIds.has(id));
}

function isValidOverallStatus(status) {
  return ['idle', 'running', 'complete', 'partial', 'failed', 'incomplete'].includes(status);
}

function isValidLegacyCapabilities(capabilities, capabilityIds) {
  return isRecord(capabilities)
    && hasExactKeys(capabilities, capabilityIds)
    && capabilityIds.every((id) => isValidCapabilityState(capabilities[id]));
}

const CAPABILITY_STATE_VALIDATORS = Object.freeze({
  idle: isIdleCapabilityState,
  queued: isQueuedCapabilityState,
  running: isRunningCapabilityState,
  success: isSuccessfulCapabilityState,
  failed: isFailedCapabilityState,
  unavailable: isUnavailableCapabilityState
});

function isValidCapabilityState(state) {
  if (!isRecord(state) || !Object.hasOwn(CAPABILITY_STATE_VALIDATORS, state.status)) return false;
  return CAPABILITY_STATE_VALIDATORS[state.status](state);
}

function isIdleCapabilityState(state) {
  return state.result === null && state.error === null;
}

function isQueuedCapabilityState(state) {
  return isIdleCapabilityState(state);
}

function isRunningCapabilityState() {
  return true;
}

function isSuccessfulCapabilityState(state) {
  return 'result' in state && state.error === null;
}

function isFailedCapabilityState(state) {
  return state.result === null && isValidCapabilityError(state.error);
}

function isUnavailableCapabilityState(state) {
  return state.result === null
    && isValidCapabilityError(state.error)
    && state.error.retryable === false;
}

function isValidCapabilityError(error) {
  return isRecord(error)
    && typeof error.code === 'string'
    && error.code.length > 0
    && typeof error.message === 'string'
    && error.message.length > 0
    && typeof error.retryable === 'boolean';
}

function validateLegacySessionSnapshot(value) {
  if (isLegacySessionSnapshot(value)) {
    return { success: true, format: 'legacy', data: value };
  }

  return {
    success: false,
    error: new Error('Invalid legacy scan session snapshot.')
  };
}

function hasLegacySessionKeys(value) {
  return Boolean(value)
    && typeof value === 'object'
    && 'selection' in value
    && 'dependencies' in value
    && 'overallStatus' in value
    && 'capabilities' in value;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  const valueKeys = Object.keys(value);
  return valueKeys.length === keys.length && keys.every((key) => valueKeys.includes(key));
}

function cloneSelection(selection) {
  return {
    capabilityIds: [...selection.capabilityIds],
    options: Object.fromEntries(Object.entries(selection.options).map(([id, options]) => [id, { ...options }]))
  };
}

function cloneDependencies(dependencies, capabilityIds) {
  return Object.fromEntries(capabilityIds.map((id) => [id, [...(dependencies[id] ?? [])]]));
}

function cloneSession(session) {
  const next = {
    ...session,
    selection: cloneSelection(session.selection),
    dependencies: cloneDependencies(session.dependencies, session.selection.capabilityIds),
    capabilities: Object.fromEntries(Object.entries(session.capabilities).map(([id, state]) => [id, {
      ...state,
      error: state.error ? { ...state.error } : null
    }]))
  };
  Object.defineProperty(next, 'domainIdentity', {
    value: session.domainIdentity,
    enumerable: false
  });
  return next;
}

function getDependencies(session, id) {
  return session.dependencies[id] ?? [];
}

function getPendingCapabilityIds(session) {
  return session.selection.capabilityIds.filter((id) => session.capabilities[id].status === 'idle');
}

function hasPendingCapabilities(session) {
  return getPendingCapabilityIds(session).length > 0;
}

function hasFailedDependency(session, id) {
  return getDependencies(session, id).some((dependencyId) => (
    ['failed', 'unavailable'].includes(session.capabilities[dependencyId]?.status)
  ));
}

function hasCompletedDependencies(session, id) {
  return getDependencies(session, id).every((dependencyId) => (
    session.capabilities[dependencyId]?.status === 'success'
  ));
}

function runCapability(session, id, runners) {
  if (typeof runners[id] !== 'function') {
    throw Object.assign(new Error('Capability runner unavailable.'), {
      code: 'runner_unavailable',
      retryable: false
    });
  }
  return runners[id]({
    domain: session.domain,
    ...(id === 'wordpress' && session.domainIdentity
      ? { domainIdentity: session.domainIdentity }
      : {}),
    options: session.selection.options[id]
  });
}

function updateCapability(session, id, state) {
  const next = {
    ...session,
    capabilities: {
      ...session.capabilities,
      [id]: state
    }
  };

  const updated = {
    ...next,
    overallStatus: getOverallStatus(next)
  };
  Object.defineProperty(updated, 'domainIdentity', {
    value: session.domainIdentity,
    enumerable: false
  });
  return updated;
}

function getOverallStatus(session) {
  const states = Object.values(session.capabilities);
  const lifecycleStatus = selectInvestigationStatus({
    status: states.some(({ status }) => status !== 'idle') ? 'running' : 'idle',
    startedAt: null,
    completedAt: null,
    selectedCapabilities: session.selection.capabilityIds.map((id) => ({ id })),
    capabilityStates: Object.fromEntries(session.selection.capabilityIds.map((id) => {
      const state = session.capabilities[id];
      return [id, {
      status: state.status,
      outcome: state.status === 'success'
        ? { status: 'success', result: state.result, error: null }
        : ['failed', 'unavailable'].includes(state.status)
          ? { status: state.status, result: null, error: state.error }
          : undefined
      }];
    })),
    overall: { status: 'incomplete' }
  });

  // Legacy sessions retain idle/running presentation while terminal semantics come from domain selector.
  return lifecycleStatus === 'blocked' ? 'idle' : lifecycleStatus === 'incomplete'
    ? (states.some(({ status }) => status !== 'idle') ? 'running' : 'idle')
    : lifecycleStatus;
}

function notify(onChange, session, token) {
  if (typeof onChange === 'function' && token?.active !== false) {
    onChange(session);
  }
}
