import type { Investigation } from '../../domain/investigation/model';

export type CapabilityResult = unknown;

export interface CapabilityRunner {
  run(input: {
    investigation: Investigation;
    capability: string;
    signal?: AbortSignal;
  }): Promise<CapabilityResult>;
}
