import type { InvestigationStore } from '../../application/ports/investigation-store';
import type { AuthSession } from '../../application/ports/auth-session';
import type { Investigation } from '../../domain/investigation/model';
import { createInvestigationApiClient } from '../../api/client';
import {
  createInvestigationTransport,
} from '../http/investigationTransport';
import { AuthenticationRequiredError } from '../contractErrors';

export type RemoteInvestigationTransport = {
  save: (investigation: Investigation) => Promise<void>;
  get: (id: string) => Promise<Investigation | null>;
  list: () => Promise<Investigation[]>;
  claim: (id: string) => Promise<Investigation>;
};

export const createRemoteInvestigationStore = ({
  authSession,
  transport,
}: {
  authSession: AuthSession;
  transport?: RemoteInvestigationTransport;
}): InvestigationStore => {
  const boundTransport = transport ?? createInvestigationTransport(
    createInvestigationApiClient(() => authSession.getAccessToken())
  );
  const requireAuthentication = async () => {
    try {
      const token = await authSession.getAccessToken();
      if (typeof token !== 'string' || token.trim() === '') throw new AuthenticationRequiredError();
    } catch (cause) {
      if (cause instanceof AuthenticationRequiredError) throw cause;
      throw new AuthenticationRequiredError('Unable to establish authenticated session', cause);
    }
  };

  return {
    async save(investigation) {
      await requireAuthentication();
      return boundTransport.save(investigation);
    },
    async get(id) {
      await requireAuthentication();
      return boundTransport.get(id);
    },
    async list() {
      await requireAuthentication();
      return boundTransport.list();
    },
    async claim(id) {
      await requireAuthentication();
      return boundTransport.claim(id);
    },
  };
};
