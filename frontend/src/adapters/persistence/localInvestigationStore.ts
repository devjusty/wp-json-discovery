import {
  domainIdentitySchema,
  investigationStateSchema,
  sessionRecordSchema,
} from '@wp-json-discovery/contracts';
import type { InvestigationStore } from '../../application/ports/investigation-store';
import { createInvestigation } from '../../domain/investigation/model';
import type { CapabilityRunInput, Investigation } from '../../domain/investigation/model';
import { ContractInvalidError } from '../contractErrors';
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
    async save(investigation) {
      const state = validateDirectValue(investigation);
      try {
        await direct.save(state);
      } catch (cause) {
        throw new ContractInvalidError('Invalid local investigation persistence', cause);
      }
    },
    async get(id) {
      validateIdentifier(id, 'investigation id');
      let value: Investigation | null;
      try {
        value = await direct.load(id);
      } catch (cause) {
        throw new ContractInvalidError('Invalid local investigation persistence', cause);
      }
      return value === null ? null : validateDirectValue(value, id);
    },
    async list() {
      let values: Investigation[];
      try {
        values = await direct.list();
      } catch (cause) {
        throw new ContractInvalidError('Invalid local investigation persistence', cause);
      }
      if (!Array.isArray(values)) throw new ContractInvalidError('Invalid local investigation list');
      return values.map(value => validateDirectValue(value));
    },
    async claim(id) {
      validateIdentifier(id, 'investigation id');
      let value: Investigation | null;
      try {
        value = direct.claim ? await direct.claim(id) : await direct.load(id);
      } catch (cause) {
        throw new ContractInvalidError('Invalid local investigation persistence', cause);
      }
      if (!value) throw new Error(`Investigation not found: ${id}`);
      return validateDirectValue(value, id);
    },
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
      const state = parseState(investigation, {
        id: investigation.id,
        submitted: investigation.submittedUrl,
        normalized: investigation.normalizedUrl,
      });
      persistence.save({
        domain: {
          submitted: state.submittedUrl,
          normalized: state.normalizedUrl,
        },
        investigation: state,
        record: {
          recordType: 'session',
          session: domainToSession(state),
          persistedAt: state.createdAt,
        },
      });
    },
    async get(id) {
      validateIdentifier(id, 'investigation id');
      const investigation = load();
      return investigation?.id === id ? investigation : null;
    },
    async list() {
      const investigation = load();
      return investigation ? [investigation] : [];
    },
    async claim(id) {
      validateIdentifier(id, 'investigation id');
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

  if (snapshot.investigation === undefined) {
    throw new ContractInvalidError('Anonymous investigation is missing validated full state');
  }
  const investigation = parseState(snapshot.investigation, {
    id: record.data.session.investigationId,
    submitted: domain.data.submitted,
    normalized: domain.data.normalized,
  });
  return investigation;
}

function parseState(value: unknown, identity: { id: string; submitted: string; normalized: string }): Investigation {
  const state = investigationStateSchema.safeParse(value);
  if (!state.success) throw new ContractInvalidError('Invalid anonymous investigation state', state.error);
  let investigation: Investigation;
  try {
    investigation = createInvestigation(state.data as Investigation);
  } catch (cause) {
    throw new ContractInvalidError('Invalid anonymous investigation state', cause);
  }
  if (investigation.id !== identity.id
    || investigation.submittedUrl !== identity.submitted
    || investigation.normalizedUrl !== identity.normalized) {
    throw new ContractInvalidError('Anonymous investigation identity mismatch');
  }
  return investigation;
}

function validateDirectValue(value: unknown, expectedId?: string): Investigation {
  if (!value || typeof value !== 'object') {
    throw new ContractInvalidError('Invalid local investigation state');
  }
  const candidate = value as Partial<Investigation>;
  if (typeof candidate.id !== 'string'
    || typeof candidate.submittedUrl !== 'string'
    || typeof candidate.normalizedUrl !== 'string') {
    throw new ContractInvalidError('Invalid local investigation state');
  }
  if (expectedId !== undefined && candidate.id !== expectedId) {
    throw new ContractInvalidError('Local investigation identity mismatch');
  }
  return parseState(value, {
    id: candidate.id,
    submitted: candidate.submittedUrl,
    normalized: candidate.normalizedUrl,
  });
}

function validateIdentifier(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractInvalidError(`Invalid ${label}`);
  }
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
