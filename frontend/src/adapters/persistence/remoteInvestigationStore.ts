import type { InvestigationStore } from '../../application/ports/investigation-store';
import type { Investigation } from '../../domain/investigation/model';

export type RemoteInvestigationTransport = {
  save: (investigation: Investigation) => Promise<void>;
  get: (id: string) => Promise<Investigation | null>;
  list: () => Promise<Investigation[]>;
  claim: (id: string) => Promise<Investigation>;
};

export const createRemoteInvestigationStore = (
  transport: RemoteInvestigationTransport,
): InvestigationStore => ({
  save: transport.save,
  get: transport.get,
  list: transport.list,
  claim: transport.claim,
});
