import type { InvestigationLifecycleState } from './lifecycle';

export const canRetryCapability = (state: InvestigationLifecycleState, capability: string): boolean => {
  const capabilityState = state.capabilityStates[capability];
  return Boolean(
    capabilityState
    && capabilityState.status === 'failed'
    && capabilityState.outcome?.error?.retryable === true,
  );
};
