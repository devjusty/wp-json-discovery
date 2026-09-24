import type { Investigation } from '../../domain/investigation/model';
import type { CapabilityRunner } from '../ports/capability-runner';
import type { InvestigationStore } from '../ports/investigation-store';
import type { AuthSession } from '../ports/auth-session';
import { createPersistableSession, domainToSession } from '../../adapters/persistence/sessionMapping';
import { recoverInvestigationSession } from './recovery.js';
import {
  createPersistenceContext,
  InvestigationCommandError,
  persist,
  runCapabilities,
  type InvestigationProgressCallback,
} from './shared';

export async function resumeInvestigation(
  id: string,
  dependencies: { store: InvestigationStore; localStore?: InvestigationStore; auth?: AuthSession; runner: CapabilityRunner; onProgress?: InvestigationProgressCallback },
) {
  let investigation: Investigation | null;
  try {
    investigation = await dependencies.store.get(id);
  } catch (cause) {
    throw new InvestigationCommandError('persistence-failed', 'Unable to load investigation.', cause);
  }
  if (!investigation) throw new InvestigationCommandError('not-found', 'Investigation not found.');
  const persistence = createPersistenceContext(dependencies);
  const recoveredSession = recoverInvestigationSession(domainToSession(investigation));
  const recovered = createPersistableSession(recoveredSession, {
    submitted: investigation.submittedUrl,
    normalized: investigation.normalizedUrl,
  }).investigationState;
  const resumable = {
    ...recovered,
    capabilities: recovered.capabilities.map((capability) => {
      const original = investigation.capabilities.find(({ name }) => name === capability.name);
      if (original?.status !== 'queued' || capability.status !== 'failed') return capability;
      const resumableCapability = { ...capability, status: 'queued' as const };
      delete resumableCapability.error;
      return resumableCapability;
    }),
  };
  if (investigation.capabilities.some(({ status }) => status === 'running')) {
    await persist(persistence.store, resumable);
  }
  const result = await runCapabilities(resumable, { store: persistence.store, runner: dependencies.runner, onProgress: dependencies.onProgress });
  return persistence.result(result);
}
