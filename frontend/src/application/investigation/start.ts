import { createInvestigation, type JsonValue, type Investigation } from '../../domain/investigation/model';
import { startInvestigationRequestSchema } from '@wp-json-discovery/contracts';
import type { AuthSession } from '../ports/auth-session';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import {
  createPersistenceContext,
  InvestigationCommandError,
  type InvestigationCommandResult,
  persist,
  runCapabilities,
  type InvestigationProgressCallback,
} from './shared';

export type StartInvestigationInput = {
  domain: { submittedUrl: string; normalizedUrl: string };
  redirectChain?: ReadonlyArray<string>;
  capabilities: ReadonlyArray<{ name: string; dependencies?: ReadonlyArray<string>; options?: Record<string, JsonValue> }>;
  onProgress?: InvestigationProgressCallback;
};

export type InvestigationCommandDependencies = {
  auth: AuthSession;
  runner: CapabilityRunner;
  localStore: InvestigationStore;
  remoteStore: InvestigationStore;
  createId?: () => string;
  now?: () => string;
  remoteStart?: (domain: { submitted: string; normalized: string }, capabilities: ReadonlyArray<{ name: string; dependencies?: ReadonlyArray<string>; options?: Record<string, JsonValue> }>, redirectChain: ReadonlyArray<string>) => Promise<Investigation>;
  onAllocated?: (investigation: Investigation) => void | Promise<void>;
};

export type StartInvestigationResult = InvestigationCommandResult;

export async function startInvestigation(
  input: StartInvestigationInput,
  dependencies: InvestigationCommandDependencies,
): Promise<StartInvestigationResult> {
  if (!input?.domain?.submittedUrl || !input.domain.normalizedUrl) {
    throw new InvestigationCommandError('invalid-command', 'Investigation domain is required.');
  }
  const request = startInvestigationRequestSchema.safeParse({
    domain: {
      submitted: input.domain.submittedUrl,
      normalized: input.domain.normalizedUrl,
    },
    selectedCapabilities: Array.isArray(input.capabilities)
      ? input.capabilities.map((capability) => {
        if (!capability || typeof capability !== 'object') return capability;
        const { name, dependencies = [], options } = capability;
        return { id: name, dependencies, ...(options ? { options } : {}) };
      })
      : input.capabilities,
    redirectChain: input.redirectChain ?? [input.domain.normalizedUrl],
  });
  if (!request.success) {
    throw new InvestigationCommandError('invalid-command', 'Invalid investigation start request.', request.error);
  }
  const now = dependencies.now?.() ?? new Date().toISOString();
  const authenticated = Boolean(dependencies.auth.getUserId());
  let remoteFailure;
  let usingRemote = authenticated;
  let investigation;
  if (authenticated && dependencies.remoteStart) {
    try {
      investigation = await dependencies.remoteStart(
        { submitted: input.domain.submittedUrl, normalized: input.domain.normalizedUrl },
        input.capabilities,
        input.redirectChain ?? [input.domain.normalizedUrl],
      );
    } catch (error) {
      if (!isRemoteAllocationFallback(error)) throw error;
      remoteFailure = { code: 'persistence-failed', message: 'Unable to allocate investigation.' } as const;
      usingRemote = false;
    }
  }
  investigation ??= createInvestigation({
      id: dependencies.createId?.() ?? globalThis.crypto.randomUUID(),
      submittedUrl: input.domain.submittedUrl,
      normalizedUrl: input.domain.normalizedUrl,
      redirectChain: input.redirectChain ?? [input.domain.normalizedUrl],
      createdAt: now,
      capabilities: input.capabilities.map((capability) => ({ ...capability, status: 'queued' })),
    });
  const persistence = createPersistenceContext({
    auth: dependencies.auth,
    store: usingRemote ? dependencies.remoteStore : dependencies.localStore,
    localStore: authenticated ? dependencies.localStore : undefined,
    remoteFailure,
  });
  await dependencies.onAllocated?.(investigation);
  const store = persistence.store;
  await persist(store, investigation);
  const result = await runCapabilities(investigation, {
    store,
    runner: dependencies.runner,
    onProgress: input.onProgress,
  });
  return persistence.result(result);
}

function isRemoteAllocationFallback(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const status = 'status' in error && typeof error.status === 'number' ? error.status : 0;
  if (status >= 400 && status < 500) return false;
  if (status >= 500) return true;
  if ('retryable' in error && error.retryable === true) return true;
  return !('code' in error);
}
