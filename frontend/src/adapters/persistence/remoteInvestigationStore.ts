import type { InvestigationStore } from '../../application/ports/investigation-store';
import type { Investigation } from '../../domain/investigation/model';
import {
  createInvestigationTransport,
} from '../http/investigationTransport';

export type RemoteInvestigationTransport = {
  save: (investigation: Investigation) => Promise<void>;
  get: (id: string) => Promise<Investigation | null>;
  list: () => Promise<Investigation[]>;
  claim: (id: string) => Promise<Investigation>;
};

export const createRemoteInvestigationStore = (
  transport: RemoteInvestigationTransport = createInvestigationTransport(),
): InvestigationStore => ({
  save: transport.save,
  get: transport.get,
  list: transport.list,
  claim: transport.claim,
});
