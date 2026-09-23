import {
  canRetryCapability,
  type InvestigationLifecycleState,
  type InvestigationOverallStatus,
} from './lifecycle';

export const selectInvestigationStatus = (state: InvestigationLifecycleState): InvestigationOverallStatus => {
  const selected = state.selectedCapabilities.map(({ id }) => state.capabilityStates[id]).filter(Boolean);
  if (['invalid', 'auth-required', 'unusable'].includes(state.status) || selected.length === 0) return 'blocked';
  if (!selected.every(({ status }) => ['success', 'failed', 'unavailable'].includes(status))) return 'incomplete';
  const successful = selected.filter(({ status }) => status === 'success').length;
  const failed = selected.some(({ status }) => ['failed', 'unavailable'].includes(status));
  if (successful === selected.length) return 'complete';
  if (successful > 0 && failed) return 'partial';
  if (successful === 0 && failed) return 'failed';
  return 'incomplete';
};

export const selectCapabilityProgress = (state: InvestigationLifecycleState) => {
  const capabilities = state.selectedCapabilities.map(({ id }) => state.capabilityStates[id]).filter(Boolean);
  return {
    total: capabilities.length,
    completed: capabilities.filter(({ status }) => status === 'success').length,
    running: capabilities.filter(({ status }) => status === 'running').length,
    failed: capabilities.filter(({ status }) => status === 'failed').length,
    unavailable: capabilities.filter(({ status }) => status === 'unavailable').length,
  };
};

export const selectRetryableCapabilities = (state: InvestigationLifecycleState): string[] => state.selectedCapabilities
  .map(({ id }) => id)
  .filter((id) => canRetryCapability(state, id));

export const selectEvidence = (state: InvestigationLifecycleState) => state.evidence
  ? [...state.evidence]
  : state.selectedCapabilities.flatMap(({ id }) => {
    const outcome = state.capabilityStates[id]?.outcome;
    return outcome?.status === 'success' ? [{ capability: id, result: outcome.result }] : [];
  });
