import type { Investigation } from '../../domain/investigation/model';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import { InvestigationCommandError, runCapabilities } from './shared';

export async function retryCapability(
  input: { investigation: Investigation; capability: string },
  dependencies: { runner: CapabilityRunner; store: InvestigationStore },
): Promise<Investigation> {
  const capability = input.investigation.capabilities.find(({ name }) => name === input.capability);
  if (!capability || capability.status !== 'failed' || !capability.error?.retryable) {
    throw new InvestigationCommandError('invalid-command', 'Capability is not retryable.');
  }
  return runCapabilities(input.investigation, dependencies, input.capability);
}
