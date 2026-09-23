import {
  domainIdentitySchema,
  sessionRecordSchema,
} from '@wp-json-discovery/contracts';
import type { InvestigationStore } from '../../application/ports/investigation-store';
import { createInvestigation } from '../../domain/investigation/model';
import type { CapabilityRunInput, Investigation, JsonValue } from '../../domain/investigation/model';
import { ContractInvalidError } from '../http/investigationTransport';
import {
  loadAnonymousInvestigation,
  saveAnonymousInvestigation,
} from '../../services/anonymousInvestigations.js';

export type LocalInvestigationPersistence = {
  load: (id: string) => Promise<Investigation | null>;
  save: (investigation: Investigation) => Promise<void>;
  list: () => Promise<Investigation[]>;
  claim?: (id: string) => Promise<Investigation>;
};

type AnonymousPersistence = {
  load: (options?: { strict?: boolean }) => unknown;
  save: (snapshot: unknown) => void;
};

type LocalStoreInput = LocalInvestigationPersistence | { anonymous?: AnonymousPersistence };

export const createLocalInvestigationStore = (
  persistence: LocalStoreInput = { anonymous: { load: loadAnonymousInvestigation, save: saveAnonymousInvestigation } },
): InvestigationStore => {
  if ('anonymous' in persistence && persistence.anonymous) {
    return createAnonymousStore(persistence.anonymous);
  }

  const direct = persistence as LocalInvestigationPersistence;
  return {
    save: direct.save,
    get: direct.load,
    list: direct.list,
    claim: direct.claim ?? (async (id) => {
      const investigation = await direct.load(id);
      if (!investigation) throw new Error(`Investigation not found: ${id}`);
      return investigation;
    }),
  };
};

function createAnonymousStore(persistence: AnonymousPersistence): InvestigationStore {
  const load = () => {
    let snapshot: unknown;
    try {
      snapshot = persistence.load({ strict: true });
    } catch (cause) {
      throw new ContractInvalidError('Invalid anonymous investigation payload', cause);
    }
    if (snapshot === null || snapshot === undefined) return null;
    return snapshotToDomain(snapshot);
  };

  return {
    async save(investigation) {
      persistence.save({
        domain: {
          submitted: investigation.submittedUrl,
          normalized: investigation.normalizedUrl,
        },
        investigation,
        record: {
          recordType: 'session',
          session: domainToSession(investigation),
          persistedAt: investigation.createdAt,
        },
      });
    },
    async get(id) {
      const investigation = load();
      return investigation?.id === id ? investigation : null;
    },
    async list() {
      const investigation = load();
      return investigation ? [investigation] : [];
    },
    async claim(id) {
      const investigation = load();
      if (!investigation || investigation.id !== id) {
        throw new Error(`Investigation not found: ${id}`);
      }
      return investigation;
    },
  };
}

function snapshotToDomain(value: unknown): Investigation {
  if (!value || typeof value !== 'object') {
    throw new ContractInvalidError('Invalid anonymous investigation payload');
  }
  const snapshot = value as { domain?: unknown; record?: unknown; investigation?: unknown };
  const domain = domainIdentitySchema.safeParse(snapshot.domain);
  const record = sessionRecordSchema.safeParse(snapshot.record);
  if (!domain.success || !record.success) {
    throw new ContractInvalidError('Invalid anonymous investigation payload', {
      domain: domain.success ? undefined : domain.error,
      record: record.success ? undefined : record.error,
    });
  }

  if (snapshot.investigation !== undefined) {
    const investigation = createInvestigation(snapshot.investigation as Investigation);
    if (investigation.id !== record.data.session.investigationId) {
      throw new ContractInvalidError('Anonymous investigation identity mismatch');
    }
    return investigation;
  }

  return createInvestigation({
    id: record.data.session.investigationId,
    submittedUrl: domain.data.submitted,
    normalizedUrl: domain.data.normalized,
    redirectChain: [],
    createdAt: record.data.persistedAt,
    capabilities: record.data.session.selectedCapabilities.map(({ id, dependencies }) => {
      const state = record.data.session.capabilityStates[id];
      const outcome = state && 'outcome' in state ? state.outcome : undefined;
      const error = outcome && typeof outcome === 'object' && 'error' in outcome
        ? outcome.error as CapabilityRunInput['error']
        : undefined;
      return {
        name: id,
        status: state?.status === 'idle' ? 'queued' : state?.status ?? 'queued',
        dependencies,
        ...(outcome && outcome.status === 'success' ? { result: outcome.result as JsonValue } : {}),
        startedAt: record.data.session.startedAt ?? undefined,
        completedAt: record.data.session.completedAt ?? undefined,
        ...(error ? { error } : {}),
      };
    }),
  });
}

function domainToSession(investigation: Investigation) {
  const capabilities = investigation.capabilities;
  const selectedIds = new Set(capabilities.map(({ name }) => name));
  const hasFailure = capabilities.some(({ status }) => ['failed', 'unavailable'].includes(status));
  const hasSuccess = capabilities.some(({ status }) => status === 'success');
  const active = capabilities.some(({ status }) => ['queued', 'running'].includes(status));
  const status = active ? 'running' : hasFailure && !hasSuccess ? 'failed' : 'completed';
  const timestamp = investigation.createdAt;

  return {
    id: `${investigation.id}-session`,
    investigationId: investigation.id,
    status,
    startedAt: timestamp,
    completedAt: status === 'running' ? null : timestamp,
    selectedCapabilities: capabilities.map(({ name, dependencies = [] }) => ({
      id: name,
      dependencies: dependencies.filter(dependency => selectedIds.has(dependency)),
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
    return {
      status: 'success',
      outcome: { status: 'success', result: capability.result ?? null, error: null },
      retry: { status: 'not-retryable' },
    };
  }
  return { status: capability.status, retry: { status: 'not-retryable' } };
}
