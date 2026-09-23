import type { Investigation } from '../../domain/investigation/model';

export interface InvestigationStore {
  save(investigation: Investigation): Promise<void>;
  get(id: string): Promise<Investigation | null>;
  list(): Promise<Investigation[]>;
  claim(id: string): Promise<Investigation>;
}
