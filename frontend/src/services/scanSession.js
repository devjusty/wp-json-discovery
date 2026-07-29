import { normalizeSelection } from './scanCapabilities.js';

const DEPENDENCY_ERROR = {
  code: 'dependency_failed',
  message: 'Required scan did not complete.',
  retryable: false
};

export function createScanSession(domain, selection, dependencies = {}) {
  const normalizedSelection = normalizeSelection(selection);

  return {
    domain,
    selection: cloneSelection(normalizedSelection),
    dependencies: cloneDependencies(dependencies),
    overallStatus: 'idle',
    capabilities: Object.fromEntries(normalizedSelection.capabilityIds.map((id) => [id, createCapabilityState()]))
  };
}

export function normalizeScanError(error) {
  return {
    code: error?.code || 'scan_failed',
    message: error?.message || 'Scan failed. Try again.',
    retryable: error?.retryable !== false
  };
}

export async function executeScanSession(session, runners, onChange, token) {
  let current = cloneSession(session);

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
  if (!session.selection.capabilityIds.includes(id) || !['failed', 'unavailable'].includes(session.capabilities[id]?.status)) {
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

function cloneSelection(selection) {
  return {
    capabilityIds: [...selection.capabilityIds],
    options: Object.fromEntries(Object.entries(selection.options).map(([id, options]) => [id, { ...options }]))
  };
}

function cloneDependencies(dependencies) {
  return Object.fromEntries(Object.entries(dependencies).map(([id, ids]) => [id, [...ids]]));
}

function cloneSession(session) {
  return {
    ...session,
    selection: cloneSelection(session.selection),
    dependencies: cloneDependencies(session.dependencies),
    capabilities: Object.fromEntries(Object.entries(session.capabilities).map(([id, state]) => [id, {
      ...state,
      error: state.error ? { ...state.error } : null
    }]))
  };
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

  return {
    ...next,
    overallStatus: getOverallStatus(next)
  };
}

function getOverallStatus(session) {
  const states = Object.values(session.capabilities);
  if (states.every(({ status }) => status === 'success')) {
    return 'complete';
  }
  if (states.every(({ status }) => ['success', 'failed', 'unavailable'].includes(status))) {
    return 'incomplete';
  }
  return states.some(({ status }) => status !== 'idle') ? 'running' : 'idle';
}

function notify(onChange, session, token) {
  if (typeof onChange === 'function' && token?.active !== false) {
    onChange(session);
  }
}
