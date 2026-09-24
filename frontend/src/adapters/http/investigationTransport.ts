import {
  domainIdentitySchema,
  investigationListSchema,
  investigationRecordSchema,
  investigationStateSchema,
  sessionRecordSchema,
  startInvestigationRequestSchema,
} from '@wp-json-discovery/contracts';
import type {
  DomainIdentity,
  InvestigationRecord,
  InvestigationSummary,
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
import type { Investigation } from '../../domain/investigation/model';
import { ContractInvalidError } from '../contractErrors';
import { domainToSession, materializeInvestigationState } from '../persistence/sessionMapping';

export { ContractInvalidError } from '../contractErrors';

export type InvestigationTransport = {
  start(
    domain: DomainIdentity,
    selectedCapabilities: StartInvestigationRequest['selectedCapabilities'],
    redirectChain?: StartInvestigationRequest['redirectChain'],
  ): Promise<Investigation>;
  save(investigation: Investigation): Promise<void>;
  get(id: string): Promise<Investigation | null>;
  list(options?: { hydrate?: boolean }): Promise<Array<Investigation | InvestigationSummary>>;
  claim(id: string): Promise<Investigation>;
};

type ValidatedClient = {
  start?: (domain: DomainIdentity, selectedCapabilities: StartInvestigationRequest['selectedCapabilities'], redirectChain?: StartInvestigationRequest['redirectChain']) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  list: () => Promise<unknown>;
  save: (id: string, session: unknown) => Promise<unknown>;
  claim?: (domain: DomainIdentity, anonymousRecord: unknown) => Promise<unknown>;
  claimPayload?: (id: string) => { domain: DomainIdentity; anonymousRecord: unknown };
};

const defaultClient: ValidatedClient = {
  start: (domain, selectedCapabilities, redirectChain) => startInvestigation(domain, selectedCapabilities, null, redirectChain),
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
  async start(domain, selectedCapabilities, redirectChain) {
    const request = startInvestigationRequestSchema.safeParse({ domain, selectedCapabilities, redirectChain: redirectChain ?? [domain.normalized] });
    if (!request.success) throw new ContractInvalidError('Invalid investigation start request', request.error);
    if (!source.start) throw new Error('Investigation client cannot start.');
    const investigation = mapRecord(await call(source.start(request.data.domain, request.data.selectedCapabilities, request.data.redirectChain), 'start'));
    assertDomainIdentity(investigation, request.data.domain);
    return investigation;
  },
  async save(investigation) {
    const state = parseState(investigation, {
      id: investigation.id,
      submitted: investigation.submittedUrl,
      normalized: investigation.normalizedUrl,
    });
    const outbound = parseSession({
      recordType: 'session',
      session: domainToSession(state),
      persistedAt: state.updatedAt ?? state.createdAt,
    });
    const result = await call(
      source.save(investigation.id, outbound.session),
      'save',
    );
    const session = parseSession(result);
    if (session.session.id !== outbound.session.id
      || session.session.investigationId !== state.id) {
      throw new ContractInvalidError('Investigation save response identity mismatch');
    }
  },
  async get(id) {
    validateIdentifier(id, 'investigation id');
    try {
      const value = await source.get(id);
      return value === null ? null : mapRecord(value, id);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw asContractError(error, 'get');
    }
  },
  async list(options = {}) {
    const summaries = mapList(await call(source.list(), 'list'));
    if (!options.hydrate) return summaries;
    const hydrated = await Promise.all(summaries.map(async summary => {
      if (!summary.latestSessionId) return summary;
      try {
        const value = await source.get(summary.id);
        if (value === null) return summary;
        const record = parseRecord(value, summary.id);
        if (!record.latestSession?.investigationState) return summary;
        const investigation = recordToDomain(record);
        if (investigation.submittedUrl !== summary.domain.submitted
          || investigation.normalizedUrl !== summary.domain.normalized) {
          throw new ContractInvalidError('Investigation list item identity mismatch');
        }
        return investigation;
      } catch (error) {
        if (isNotFound(error)) return summary;
        if (error instanceof ContractInvalidError) throw error;
        throw new ContractInvalidError('Invalid investigation list item', error);
      }
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
    if (anonymous.session.investigationState) {
      parseState(anonymous.session.investigationState, { id, ...domain.data });
    }
    // Claim endpoint allocates canonical authenticated ID; input snapshot ID is
    // the identity that must match, not returned record ID.
    const investigation = mapRecord(await call(source.claim(domain.data, anonymous), 'claim'));
    assertDomainIdentity(investigation, domain.data);
    return investigation;
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
  return (error instanceof Error && (/not found|404/i.test(error.message)))
    || (typeof error === 'object' && error !== null
      && ('status' in error && error.status === 404 || 'code' in error && error.code === 'not-found'));
}

function validateIdentifier(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractInvalidError(`Invalid ${label}`);
  }
}

function mapRecord(value: unknown, expectedId?: string): Investigation {
  const parsed = investigationRecordSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation record', parsed.error);
  if (expectedId !== undefined && parsed.data.investigation.id !== expectedId) {
    throw new ContractInvalidError('Investigation record identity mismatch');
  }
  return recordToDomain(parsed.data);
}

function mapList(value: unknown): InvestigationSummary[] {
  const parsed = investigationListSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation list', parsed.error);
  return parsed.data.investigations;
}

function parseRecord(value: unknown, expectedId?: string): InvestigationRecord {
  const parsed = investigationRecordSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation record', parsed.error);
  if (expectedId !== undefined && parsed.data.investigation.id !== expectedId) {
    throw new ContractInvalidError('Investigation record identity mismatch');
  }
  return parsed.data;
}

function parseSession(value: unknown): SessionRecord {
  const parsed = sessionRecordSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation session response', parsed.error);
  return parsed.data;
}

function recordToDomain(record: InvestigationRecord): Investigation {
  const session = record.latestSession;
  if (session?.investigationState !== undefined) {
    return {
      ...parseState(session.investigationState, { id: record.investigation.id, ...record.investigation.domain }),
      updatedAt: record.updatedAt,
    };
  }
  if (session) {
    const state = materializeInvestigationState(
      session,
      record.investigation.domain,
      session.selectedCapabilities,
      record.createdAt,
    );
    return {
      ...parseState(state, { id: record.investigation.id, ...record.investigation.domain }),
      updatedAt: record.updatedAt,
    };
  }
  throw new ContractInvalidError('Investigation response is missing validated full state');
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

function assertDomainIdentity(investigation: Investigation, domain: DomainIdentity): void {
  if (investigation.submittedUrl !== domain.submitted
    || investigation.normalizedUrl !== domain.normalized) {
    throw new ContractInvalidError('Investigation domain identity mismatch');
  }
}
