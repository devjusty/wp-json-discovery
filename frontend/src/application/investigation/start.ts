import { createInvestigation, type JsonValue, type Investigation } from '../../domain/investigation/model';
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
  const now = dependencies.now?.() ?? new Date().toISOString();
  const authenticated = Boolean(dependencies.auth.getUserId());
  const investigation = authenticated && dependencies.remoteStart
    ? await dependencies.remoteStart(
      { submitted: input.domain.submittedUrl, normalized: input.domain.normalizedUrl },
       input.capabilities,
       input.redirectChain ?? [input.domain.normalizedUrl],
    )
    : createInvestigation({
      id: dependencies.createId?.() ?? globalThis.crypto.randomUUID(),
      submittedUrl: input.domain.submittedUrl,
      normalizedUrl: input.domain.normalizedUrl,
      redirectChain: input.redirectChain ?? [input.domain.normalizedUrl],
      createdAt: now,
      capabilities: input.capabilities.map((capability) => ({ ...capability, status: 'queued' })),
    });
  const persistence = createPersistenceContext({
    auth: dependencies.auth,
    store: authenticated ? dependencies.remoteStore : dependencies.localStore,
    localStore: authenticated ? dependencies.localStore : undefined,
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
