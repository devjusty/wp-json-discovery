import type { Investigation } from '../../domain/investigation/model';
import type { AuthSession } from '../ports/auth-session';
import type { InvestigationStore } from '../ports/investigation-store';
import { InvestigationCommandError } from './shared';

export async function claimInvestigation(
  id: string,
  dependencies: { auth: AuthSession; localStore: InvestigationStore; remoteStore: InvestigationStore },
): Promise<Investigation> {
  if (!dependencies.auth.getUserId()) throw new InvestigationCommandError('auth-required', 'Authenticated session required.');
  try {
    return await dependencies.remoteStore.claim(id);
  } catch (cause) {
    throw new InvestigationCommandError('claim-failed', 'Unable to claim investigation.', cause);
  }
}
