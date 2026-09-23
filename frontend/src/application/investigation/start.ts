import { createInvestigation, type Investigation, type JsonValue } from '../../domain/investigation/model';
import type { AuthSession } from '../ports/auth-session';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import { InvestigationCommandError, persist, runCapabilities } from './shared';

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

export type StartInvestigationResult = {
  investigation: Investigation;
  persistence: {
    remote?: { code: 'persistence-failed'; message: string };
    local: 'saved' | 'not-needed';
  };
};

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
  const remote = dependencies.auth.getUserId() ? dependencies.remoteStore : null;
  let remoteFailure;
  const store = remote
    ? {
      ...remote,
      async save(value: Investigation) {
        try {
          await remote.save(value);
        } catch {
          remoteFailure = { code: 'persistence-failed' as const, message: 'Unable to save investigation.' };
          await persist(dependencies.localStore, value);
        }
      },
    }
    : dependencies.localStore;
  await persist(store, investigation);
  const result = await runCapabilities(investigation, { store, runner: dependencies.runner });
  return {
    investigation: result,
    persistence: {
      ...(remoteFailure ? { remote: remoteFailure } : {}),
      local: remoteFailure ? 'saved' : 'not-needed',
    },
  };
}
