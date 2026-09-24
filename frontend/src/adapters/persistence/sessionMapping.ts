import type { DomainIdentity } from '@wp-json-discovery/contracts';
import type { CapabilityRunInput, Investigation } from '../../domain/investigation/model';

export function domainToSession(investigation: Investigation) {
  const capabilities = investigation.capabilities;
  const selectedIds = new Set(capabilities.map(({ name }) => name));
  const hasFailure = capabilities.some(({ status }) => ['failed', 'unavailable'].includes(status));
  const hasSuccess = capabilities.some(({ status }) => status === 'success');
  const active = capabilities.some(({ status }) => ['queued', 'running'].includes(status));
  const status = active ? 'running' : hasFailure && !hasSuccess ? 'failed' : 'completed';
  const timestamp = investigation.createdAt;

  const session = {
    id: `${investigation.id}-session`,
    investigationId: investigation.id,
    status,
    startedAt: timestamp,
    completedAt: status === 'running' ? null : timestamp,
    selectedCapabilities: capabilities.map(({ name, dependencies = [], options }) => ({
      id: name,
      dependencies: dependencies.filter(dependency => selectedIds.has(dependency)),
      ...(options ? { options } : {}),
    })),
    capabilityStates: Object.fromEntries(capabilities.map(capability => [
      capability.name,
      capabilityState(capability),
    ])),
    overall: {
      status: !capabilities.length || active
        ? 'incomplete'
        : hasSuccess && hasFailure ? 'partial' : hasSuccess ? 'complete' : 'failed',
    },
    investigationState: investigation,
  };
  Object.defineProperty(session, 'domain', {
    value: { submitted: investigation.submittedUrl, normalized: investigation.normalizedUrl },
    enumerable: false,
  });
  return session;
}

export function createPersistableSession(session, domain: DomainIdentity) {
  const persistable = { ...session };
  Object.defineProperty(persistable, 'investigationState', {
    value: materializeInvestigationState(session, domain, session.selectedCapabilities ?? []),
    enumerable: false,
    configurable: true,
  });
  return persistable;
}

function materializeInvestigationState(session, domain: DomainIdentity, selectedCapabilities) {
  const source = session.investigationState;
  const sourceCapabilities = new Map((source?.capabilities ?? []).map((capability) => [capability.name, capability]));
  const capabilities = selectedCapabilities.map(({ id: name, dependencies, options }) => {
    const capabilityState = session.capabilityStates?.[name];
    const status = capabilityState?.status === 'idle' ? 'queued' : capabilityState?.status ?? 'queued';
    const stableFields = Object.fromEntries(
      Object.entries(sourceCapabilities.get(name) ?? {})
        .filter(([key]) => key !== 'result' && key !== 'error'),
    );
    const capability: Record<string, unknown> = Object.assign(
      {},
      stableFields,
      {
        name,
        status,
        ...(dependencies?.length ? { dependencies } : {}),
        ...(options ? { options } : {}),
      },
    );
    if (status === 'success' && Object.prototype.hasOwnProperty.call(capabilityState?.outcome ?? {}, 'result')) {
      capability.result = capabilityState.outcome.result;
    }
    if (status === 'failed' || status === 'unavailable') {
      capability.error = capabilityState?.outcome?.error;
    }
    return capability;
  });

  return {
    ...(source ?? {}),
    id: session.investigationId,
    submittedUrl: domain.submitted,
    normalizedUrl: domain.normalized,
    redirectChain: source?.redirectChain ?? [],
    createdAt: source?.createdAt ?? session.startedAt ?? new Date().toISOString(),
    capabilities,
    observationTimeline: source?.observationTimeline ?? [],
    evidence: source?.evidence ?? [],
    findings: source?.findings ?? [],
  };
}

function capabilityState(capability: CapabilityRunInput) {
  if (capability.status === 'failed') {
    return {
      status: 'failed',
      outcome: { status: 'failed', result: null, error: capability.error },
      retry: { status: 'not-retryable' },
    };
  }
  if (capability.status === 'unavailable') {
    return {
      status: 'unavailable',
      outcome: {
        status: 'unavailable',
        result: null,
        error: capability.error ?? { code: 'unavailable', message: 'Unavailable', retryable: false },
      },
      retry: { status: 'not-retryable' },
    };
  }
  if (capability.status === 'success') {
    const outcome = { status: 'success' as const, error: null };
    return {
      status: 'success',
      outcome: capability.result === undefined ? outcome : { ...outcome, result: capability.result },
      retry: { status: 'not-retryable' },
    };
  }
  return { status: capability.status, retry: { status: 'not-retryable' } };
}
