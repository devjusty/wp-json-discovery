import { createInvestigation, type Investigation, type JsonValue } from '../../domain/investigation/model';
import type { AuthSession } from '../ports/auth-session';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import { persist, runCapabilities, InvestigationCommandError } from './shared';

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

export async function startInvestigation(
  input: StartInvestigationInput,
  dependencies: InvestigationCommandDependencies,
): Promise<Investigation> {
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
  const store = dependencies.auth.getUserId() ? dependencies.remoteStore : dependencies.localStore;
  await persist(store, investigation);
  return runCapabilities(investigation, { store, runner: dependencies.runner });
}
