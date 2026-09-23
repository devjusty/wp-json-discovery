import type { CapabilityError, CapabilityStatus } from './model';

export type InvestigationLifecycleStatus = 'idle' | 'queued' | 'running' | 'completed' | 'invalid' | 'auth-required' | 'unusable';
export type InvestigationOverallStatus = 'complete' | 'partial' | 'failed' | 'blocked' | 'incomplete';

export type InvestigationCapabilityState = {
  status: CapabilityStatus | 'idle';
  outcome?: {
    status: CapabilityStatus;
    result: unknown;
    error: CapabilityError | null;
  };
  retry?: { status: 'not-retryable' };
  dependency?: { status: 'failed'; dependencyId: string; error: CapabilityError };
};

export type InvestigationLifecycleState = {
  status: InvestigationLifecycleStatus;
  startedAt: string | null;
  completedAt: string | null;
  selectedCapabilities: ReadonlyArray<{ id: string }>;
  capabilityStates: Record<string, InvestigationCapabilityState>;
  overall: { status: InvestigationOverallStatus };
  evidence?: ReadonlyArray<unknown>;
};
