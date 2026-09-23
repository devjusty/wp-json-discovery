import {
  capabilitySelectionSchema,
  domainIdentitySchema,
  investigationListSchema,
  investigationRecordSchema,
  investigationStateSchema,
  sessionRecordSchema,
} from '@wp-json-discovery/contracts';
import type {
  DomainIdentity,
  InvestigationRecord,
  SessionRecord,
  StartInvestigationRequest,
} from '@wp-json-discovery/contracts';
import {
  claimAnonymousInvestigation,
  fetchInvestigation,
  fetchInvestigations,
  saveInvestigationSession,
  startInvestigation,
} from '../../api/client';
import {
  createClaimPayload,
  loadAnonymousInvestigation,
} from '../../services/anonymousInvestigations.js';
import { createInvestigation } from '../../domain/investigation/model';
import type { Investigation, JsonValue } from '../../domain/investigation/model';

export class ContractInvalidError extends Error {
  readonly code = 'contract-invalid';

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ContractInvalidError';
  }
}

export type InvestigationTransport = {
  start(
    domain: DomainIdentity,
    selectedCapabilities: StartInvestigationRequest['selectedCapabilities'],
  ): Promise<Investigation>;
  save(investigation: Investigation): Promise<void>;
  get(id: string): Promise<Investigation | null>;
  list(): Promise<Investigation[]>;
  claim(id: string): Promise<Investigation>;
};

type ValidatedClient = {
  start?: (domain: DomainIdentity, selectedCapabilities: StartInvestigationRequest['selectedCapabilities']) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  list: () => Promise<unknown>;
  save: (id: string, session: unknown) => Promise<unknown>;
  claim?: (domain: DomainIdentity, anonymousRecord: unknown) => Promise<unknown>;
  claimPayload?: (id: string) => { domain: DomainIdentity; anonymousRecord: unknown };
};

const defaultClient: ValidatedClient = {
  start: startInvestigation,
  get: fetchInvestigation,
  list: fetchInvestigations,
  save: saveInvestigationSession,
  claim: claimAnonymousInvestigation,
  claimPayload: (id) => {
    const snapshot = loadAnonymousInvestigation({ strict: true });
    if (snapshot?.record.session.investigationId !== id) {
      throw Object.assign(new Error('Anonymous investigation does not match requested id.'), { code: 'claim-mismatch' });
    }
    const payload = createClaimPayload(snapshot);
    if (!payload) throw new Error('No anonymous investigation available to claim.');
    return payload;
  },
};

export const createInvestigationTransport = (
  client: Partial<ValidatedClient> = {},
): InvestigationTransport => {
  const source = { ...defaultClient, ...client };
  return {
  async start(domain, selectedCapabilities) {
    const parsedDomain = domainIdentitySchema.safeParse(domain);
    if (!parsedDomain.success) throw new ContractInvalidError('Invalid investigation domain', parsedDomain.error);
    const selected = capabilitySelectionSchema.array().safeParse(selectedCapabilities);
    if (!selected.success) throw new ContractInvalidError('Invalid capability selection', selected.error);
    if (!source.start) throw new Error('Investigation client cannot start.');
    return mapRecord(await call(source.start(parsedDomain.data, selected.data), 'start'), false);
  },
  async save(investigation) {
    const state = parseState(investigation, {
      id: investigation.id,
      submitted: investigation.submittedUrl,
      normalized: investigation.normalizedUrl,
    });
    const result = await call(
      source.save(investigation.id, domainToSession(state)),
      'save',
    );
    parseSession(result);
  },
  async get(id) {
    validateIdentifier(id, 'investigation id');
    try {
      const value = await source.get(id);
      return value === null ? null : mapRecord(value);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw asContractError(error, 'get');
    }
  },
  async list() {
    const investigations = mapList(await call(source.list(), 'list'));
    const hydrated = await Promise.all(investigations.map(async investigation => {
      const value = await source.get(investigation.id);
      if (value === null) throw new ContractInvalidError('Investigation list item is missing full state');
      return mapRecord(value);
    }));
    return hydrated;
  },
  async claim(id) {
    validateIdentifier(id, 'investigation id');
    if (!source.claim || !source.claimPayload) throw new Error('Investigation client cannot claim.');
    let payload: { domain: DomainIdentity; anonymousRecord: unknown };
    try {
      payload = source.claimPayload(id);
    } catch (cause) {
      throw new ContractInvalidError('Invalid anonymous investigation claim payload', cause);
    }
    const domain = domainIdentitySchema.safeParse(payload.domain);
    if (!domain.success) throw new ContractInvalidError('Invalid claim domain', domain.error);
    const anonymous = parseSession(payload.anonymousRecord);
    if (anonymous.session.investigationId !== id) {
      throw new ContractInvalidError('Anonymous investigation does not match requested id.');
    }
    parseState(anonymous.session.investigationState, { id, ...domain.data });
    // Claim endpoint allocates canonical authenticated ID; input snapshot ID is
    // the identity that must match, not returned record ID.
    return mapRecord(await call(source.claim(domain.data, payload.anonymousRecord), 'claim'));
  },
  };
};

async function call<T>(promise: Promise<T>, operation: string): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    throw asContractError(error, operation);
  }
}

function asContractError(error: unknown, operation: string): Error {
  if (error instanceof ContractInvalidError) return error;
  if (error instanceof Error && /Invalid investigation response|Invalid .* response/.test(error.message)) {
    return new ContractInvalidError(`Invalid investigation ${operation} response`, error);
  }
  return error instanceof Error ? error : new Error(`Investigation ${operation} failed`);
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && /not found/i.test(error.message);
}

function validateIdentifier(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractInvalidError(`Invalid ${label}`);
  }
}

function mapRecord(value: unknown, requireState = true): Investigation {
  const parsed = investigationRecordSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation record', parsed.error);
  return recordToDomain(parsed.data, requireState);
}

function mapList(value: unknown): Investigation[] {
  const parsed = investigationListSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation list', parsed.error);
  return parsed.data.investigations.map(summary => createInvestigation({
    id: summary.id,
    submittedUrl: summary.domain.submitted,
    normalizedUrl: summary.domain.normalized,
    redirectChain: [],
    createdAt: summary.createdAt,
  }));
}

function parseSession(value: unknown): SessionRecord {
  const parsed = sessionRecordSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation session response', parsed.error);
  return parsed.data;
}

function recordToDomain(record: InvestigationRecord, requireState: boolean): Investigation {
  const session = record.latestSession;
  if (session?.investigationState !== undefined) {
    return parseState(session.investigationState, { id: record.investigation.id, ...record.investigation.domain });
  }
  if (requireState) {
    throw new ContractInvalidError('Investigation response is missing validated full state');
  }
  return createInvestigation({
    id: record.investigation.id,
    submittedUrl: record.investigation.domain.submitted,
    normalizedUrl: record.investigation.domain.normalized,
    redirectChain: [],
    createdAt: record.createdAt,
    capabilities: session?.selectedCapabilities.map(capability => {
      const state = session.capabilityStates[capability.id];
      const outcome = state && 'outcome' in state ? state.outcome : undefined;
      const error = outcome && typeof outcome === 'object' && 'error' in outcome
        ? outcome.error as { code: string; message: string; retryable: boolean }
        : undefined;
      return {
        name: capability.id,
        status: state?.status === 'idle' ? 'queued' : state?.status ?? 'queued',
        dependencies: capability.dependencies,
        ...(state && 'outcome' in state && state.outcome.status === 'success'
          ? { result: state.outcome.result as JsonValue }
          : {}),
        startedAt: session.startedAt ?? undefined,
        completedAt: session.completedAt ?? undefined,
        ...(error ? { error } : {}),
      };
    }),
  });
}

function parseState(value: unknown, identity: { id: string; submitted: string; normalized: string }): Investigation {
  const parsed = investigationStateSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation state', parsed.error);
  let state: Investigation;
  try {
    state = createInvestigation(parsed.data as Investigation);
  } catch (cause) {
    throw new ContractInvalidError('Invalid investigation state', cause);
  }
  if (state.id !== identity.id
    || state.submittedUrl !== identity.submitted
    || state.normalizedUrl !== identity.normalized) {
    throw new ContractInvalidError('Investigation state identity mismatch');
  }
  return state;
}

function domainToSession(investigation: Investigation) {
  const hasFailure = investigation.capabilities.some(({ status }) => ['failed', 'unavailable'].includes(status));
  const hasSuccess = investigation.capabilities.some(({ status }) => status === 'success');
  const active = investigation.capabilities.some(({ status }) => ['queued', 'running'].includes(status));
  const selectedIds = new Set(investigation.capabilities.map(({ name }) => name));
  const status = active ? 'running' : hasFailure && !hasSuccess ? 'failed' : 'completed';
  const timestamp = investigation.createdAt;

  return {
    id: `${investigation.id}-session`,
    investigationId: investigation.id,
    status,
    startedAt: timestamp,
    completedAt: status === 'running' ? null : timestamp,
    selectedCapabilities: investigation.capabilities.map(({ name, dependencies = [] }) => ({
      id: name,
      dependencies: dependencies.filter(dependency => selectedIds.has(dependency)),
    })),
    capabilityStates: Object.fromEntries(investigation.capabilities.map(capability => [
      capability.name,
      capabilityState(capability),
    ])),
    overall: {
      status: !investigation.capabilities.length || active
        ? 'incomplete'
        : hasSuccess && hasFailure ? 'partial' : hasSuccess ? 'complete' : 'failed',
    },
    investigationState: investigation,
  };
}

function capabilityState(capability: Investigation['capabilities'][number]) {
  if (capability.status === 'failed') {
    return { status: 'failed', outcome: { status: 'failed', result: null, error: capability.error }, retry: { status: 'not-retryable' } };
  }
  if (capability.status === 'unavailable') {
    return {
      status: 'unavailable',
      outcome: { status: 'unavailable', result: null, error: capability.error ?? { code: 'unavailable', message: 'Unavailable', retryable: false } },
      retry: { status: 'not-retryable' },
    };
  }
  if (capability.status === 'success') {
    return { status: 'success', outcome: { status: 'success', result: null, error: null }, retry: { status: 'not-retryable' } };
  }
  return { status: capability.status, retry: { status: 'not-retryable' } };
}
