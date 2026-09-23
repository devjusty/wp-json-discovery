import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import type { AuthSession } from '../ports/auth-session';
import { createPersistenceContext, InvestigationCommandError, retryWithCoordinator } from './shared';

export async function retryCapability(
  input: { investigation: import('../../domain/investigation/model').Investigation; capability: string },
  dependencies: { runner: CapabilityRunner; store: InvestigationStore; localStore?: InvestigationStore; auth?: AuthSession },
) {
  const capability = input.investigation.capabilities.find(({ name }) => name === input.capability);
  if (!capability || capability.status !== 'failed' || !capability.error?.retryable) {
    throw new InvestigationCommandError('invalid-command', 'Capability is not retryable.');
  }
  const persistence = createPersistenceContext(dependencies);
  const result = await retryWithCoordinator(input.investigation, input.capability, {
    store: persistence.store,
    runner: dependencies.runner,
  });
  return persistence.result(result);
}
