import type { Investigation } from '../../domain/investigation/model';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import type { AuthSession } from '../ports/auth-session';
import {
  createPersistenceContext,
  InvestigationCommandError,
  runCapabilities,
} from './shared';

export async function resumeInvestigation(
  id: string,
  dependencies: { store: InvestigationStore; localStore?: InvestigationStore; auth?: AuthSession; runner: CapabilityRunner },
) {
  let investigation: Investigation | null;
  try {
    investigation = await dependencies.store.get(id);
  } catch (cause) {
    throw new InvestigationCommandError('persistence-failed', 'Unable to load investigation.', cause);
  }
  if (!investigation) throw new InvestigationCommandError('not-found', 'Investigation not found.');
  const persistence = createPersistenceContext(dependencies);
  const result = await runCapabilities(investigation, { store: persistence.store, runner: dependencies.runner });
  return persistence.result(result);
}
