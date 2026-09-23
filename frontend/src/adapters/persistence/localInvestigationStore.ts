import type { InvestigationStore } from '../../application/ports/investigation-store';
import type { Investigation } from '../../domain/investigation/model';

export type LocalInvestigationPersistence = {
  load: (id: string) => Promise<Investigation | null>;
  save: (investigation: Investigation) => Promise<void>;
  list: () => Promise<Investigation[]>;
  claim?: (id: string) => Promise<Investigation>;
};

export const createLocalInvestigationStore = (
  persistence: LocalInvestigationPersistence,
): InvestigationStore => ({
  save: persistence.save,
  get: persistence.load,
  list: persistence.list,
  claim: persistence.claim ?? (async (id) => {
    const investigation = await persistence.load(id);
    if (!investigation) throw new Error(`Investigation not found: ${id}`);
    return investigation;
  }),
});
