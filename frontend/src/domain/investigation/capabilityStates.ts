export type SafeCapabilityState = {
  status: string;
  outcome?: {
    result?: unknown;
    error?: { message?: string; code?: string; retryable?: boolean } | null;
  };
};

export function normalizeCapabilityStates(value: unknown): Record<string, SafeCapabilityState> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(Object.entries(value).flatMap(([id, state]) => {
    if (!isRecord(state) || typeof state.status !== 'string') return [];
    const outcome = isRecord(state.outcome)
      ? { result: state.outcome.result, error: normalizeError(state.outcome.error) }
      : undefined;
    return [[id, { status: state.status, ...(outcome ? { outcome } : {}) }]];
  }));
}

function normalizeError(value: unknown) {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  return {
    ...(typeof value.message === 'string' ? { message: value.message } : {}),
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
    ...(typeof value.retryable === 'boolean' ? { retryable: value.retryable } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
