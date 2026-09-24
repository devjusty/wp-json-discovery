import type { Investigation } from '../../domain/investigation/model';
import type { InvestigationSummary } from '@wp-json-discovery/contracts';

export interface InvestigationStore {
  save(investigation: Investigation): Promise<void>;
  get(id: string): Promise<Investigation | null>;
  list(): Promise<Array<Investigation | InvestigationSummary>>;
  claim(id: string): Promise<Investigation>;
}
