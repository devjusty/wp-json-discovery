import { createInvestigation, type JsonValue } from '../../domain/investigation/model';
import type { AuthSession } from '../ports/auth-session';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import {
  createPersistenceContext,
  InvestigationCommandError,
  type InvestigationCommandResult,
  persist,
  runCapabilities,
} from './shared';

export type StartInvestigationInput = {
  domain: { submittedUrl: string; normalizedUrl: string };
  capabilities: ReadonlyArray<{ name: string; dependencies?: ReadonlyArray<string>; options?: Record<string, JsonValue> }>;
};

export type InvestigationCommandDependencies = {
  auth: AuthSession;
  runner: CapabilityRunner;
  localStore: InvestigationStore;
  remoteStore: InvestigationStore;
  createId?: () => string;
  now?: () => string;
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
  const investigation = createInvestigation({
    id: dependencies.createId?.() ?? globalThis.crypto.randomUUID(),
    submittedUrl: input.domain.submittedUrl,
    normalizedUrl: input.domain.normalizedUrl,
    redirectChain: [],
    createdAt: now,
    capabilities: input.capabilities.map((capability) => ({
      ...capability,
      status: 'queued',
    })),
  });
  const persistence = createPersistenceContext({
    auth: dependencies.auth,
    store: dependencies.remoteStore,
    localStore: dependencies.localStore,
  });
  const store = dependencies.auth.getUserId() ? persistence.store : dependencies.localStore;
  await persist(store, investigation);
  const result = await runCapabilities(investigation, { store, runner: dependencies.runner });
  return persistence.result(result);
}
