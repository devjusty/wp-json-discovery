import { selectInvestigationStatus } from '../../domain/investigation/selectors.ts';

const INTERRUPTED_ERROR = {
  code: 'interrupted',
  message: 'Capability was interrupted before it completed.',
  retryable: true,
};

export function recoverInvestigationSession(session) {
  const activeSession = ['queued', 'running'].includes(session.status);
  const interruptedIds = Object.entries(session.capabilityStates)
    .filter(([, state]) => activeSession
      ? !['success', 'failed', 'unavailable'].includes(state.status)
      : ['queued', 'running'].includes(state.status))
    .map(([id]) => id);
  if (!activeSession && interruptedIds.length === 0) return session;

  const recovered = cloneSession(session);
  recovered.startedAt ??= new Date().toISOString();
  for (const id of interruptedIds) {
    const capability = recovered.capabilityStates[id];
    capability.status = 'failed';
    capability.outcome = { status: 'failed', result: null, error: { ...INTERRUPTED_ERROR } };
    capability.retry = { status: 'not-retryable' };
  }

  return finalize(recovered);
}

function cloneSession(session) {
  const next = {
    ...session,
    selectedCapabilities: session.selectedCapabilities.map((capability) => ({
      ...capability,
      dependencies: [...(capability.dependencies ?? [])],
      ...(capability.options ? { options: { ...capability.options } } : {}),
    })),
    capabilityStates: Object.fromEntries(Object.entries(session.capabilityStates).map(([id, state]) => [id, {
      ...state,
      retry: { ...state.retry },
      ...(state.outcome ? { outcome: { ...state.outcome, error: state.outcome.error ? { ...state.outcome.error } : null } } : {}),
      ...(state.dependency ? { dependency: { ...state.dependency, error: { ...state.dependency.error } } } : {}),
    }])),
  };
  Object.defineProperty(next, 'domain', { value: session.domain ? { ...session.domain } : null, enumerable: false });
  Object.defineProperty(next, 'selection', {
    value: {
      capabilityIds: [...session.selection.capabilityIds],
      options: Object.fromEntries(Object.entries(session.selection.options).map(([id, options]) => [id, { ...options }])),
    },
    enumerable: false,
    configurable: true,
  });
  return next;
}

function finalize(session) {
  const aggregateStatus = selectInvestigationStatus(session);
  const next = {
    ...session,
    status: ['complete', 'partial'].includes(aggregateStatus) ? 'completed' : 'failed',
    completedAt: new Date().toISOString(),
    overall: { status: aggregateStatus },
  };
  Object.defineProperty(next, 'domain', { value: session.domain ? { ...session.domain } : null, enumerable: false });
  Object.defineProperty(next, 'selection', { value: session.selection, enumerable: false, configurable: true });
  return next;
}
