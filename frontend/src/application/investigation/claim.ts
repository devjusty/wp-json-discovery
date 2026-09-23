import type { AuthSession } from '../ports/auth-session';
import type { InvestigationStore } from '../ports/investigation-store';
import type { InvestigationCommandResult } from './shared';
import { InvestigationCommandError } from './shared';

export async function claimInvestigation(
  id: string,
  dependencies: { auth: AuthSession; localStore: InvestigationStore; remoteStore: InvestigationStore },
): Promise<InvestigationCommandResult> {
  if (!dependencies.auth.getUserId()) throw new InvestigationCommandError('auth-required', 'Authenticated session required.');
  try {
    const local = await dependencies.localStore.get(id);
    if (!local) throw new InvestigationCommandError('not-found', 'Anonymous investigation not found.');
    const investigation = await dependencies.remoteStore.claim(id);
    return { investigation, persistence: { local: 'not-needed' } };
  } catch (cause) {
    if (cause instanceof InvestigationCommandError) throw cause;
    throw new InvestigationCommandError('claim-failed', 'Unable to claim investigation.', cause);
  }
}
