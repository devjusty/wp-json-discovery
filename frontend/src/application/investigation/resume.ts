import type { Investigation } from '../../domain/investigation/model';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import { InvestigationCommandError, runCapabilities } from './shared';

export async function resumeInvestigation(
  id: string,
  dependencies: { store: InvestigationStore; runner: CapabilityRunner },
): Promise<Investigation> {
  let investigation: Investigation | null;
  try {
    investigation = await dependencies.store.get(id);
  } catch (cause) {
    throw new InvestigationCommandError('persistence-failed', 'Unable to load investigation.', cause);
  }
  if (!investigation) throw new InvestigationCommandError('not-found', 'Investigation not found.');
  return runCapabilities(investigation, dependencies);
}
