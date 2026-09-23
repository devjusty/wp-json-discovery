import {
  investigationListSchema,
  investigationRecordSchema,
} from '@wp-json-discovery/contracts';
import type { InvestigationRecord, SessionCapabilityState } from '@wp-json-discovery/contracts';
import { createInvestigation } from '../../domain/investigation/model';
import type { Investigation } from '../../domain/investigation/model';

export class ContractInvalidError extends Error {
  readonly code = 'contract-invalid';

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ContractInvalidError';
  }
}

export type InvestigationTransport = {
  save(investigation: Investigation): Promise<void>;
  get(id: string): Promise<Investigation | null>;
  list(): Promise<Investigation[]>;
  claim(id: string): Promise<Investigation>;
};

type TransportSource = {
  save?: (investigation: Investigation) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  list?: () => Promise<unknown>;
  claim?: (id: string) => Promise<unknown>;
};

export const mapInvestigationRecord = (value: unknown): Investigation => {
  const parsed = investigationRecordSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation record', parsed.error);
  return recordToDomain(parsed.data);
};

export const mapInvestigationList = (value: unknown): Investigation[] => {
  const parsed = investigationListSchema.safeParse(value);
  if (!parsed.success) throw new ContractInvalidError('Invalid investigation list', parsed.error);
  return parsed.data.investigations.map(summary => createInvestigation({
    id: summary.id,
    submittedUrl: summary.domain.submitted,
    normalizedUrl: summary.domain.normalized,
    redirectChain: [],
    createdAt: summary.createdAt,
  }));
};

export const createInvestigationTransport = (source: TransportSource): InvestigationTransport => ({
  async save(investigation) {
    if (!source.save) throw new Error('Investigation transport cannot save.');
    const result = await source.save(investigation);
    if (result !== undefined) mapInvestigationRecord(result);
  },
  async get(id) {
    const result = await source.get(id);
    return result === null ? null : mapInvestigationRecord(result);
  },
  async list() {
    if (!source.list) throw new Error('Investigation transport cannot list.');
    return mapInvestigationList(await source.list());
  },
  async claim(id) {
    if (!source.claim) throw new Error('Investigation transport cannot claim.');
    return mapInvestigationRecord(await source.claim(id));
  },
});

function recordToDomain(record: InvestigationRecord): Investigation {
  const session = record.latestSession;
  return createInvestigation({
    id: record.investigation.id,
    submittedUrl: record.investigation.domain.submitted,
    normalizedUrl: record.investigation.domain.normalized,
    redirectChain: [],
    createdAt: record.createdAt,
    capabilities: session?.selectedCapabilities.map(capability => (
      mapCapabilityRun(capability.id, session.capabilityStates[capability.id])
    )),
  });
}

function mapCapabilityRun(name: string, state: SessionCapabilityState | undefined) {
  const status = state?.status === 'idle' ? 'queued' : state?.status ?? 'queued';
  const outcome = state && 'outcome' in state ? state.outcome : undefined;
  const error = outcome && typeof outcome === 'object' && 'error' in outcome
    ? outcome.error as { code: string; message: string; retryable: boolean }
    : undefined;

  return {
    name,
    status,
    ...(error && outcome && typeof outcome === 'object' && 'status' in outcome
      && (outcome.status === 'failed' || outcome.status === 'unavailable')
      ? { error: { code: error.code, message: error.message, retryable: error.retryable } }
      : {}),
  };
}
