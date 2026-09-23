import type { CapabilityRunner } from '../../application/ports/capability-runner';
import { jsonValueSchema } from '@wp-json-discovery/contracts';
import {
  getCapabilityById,
  getCapabilityRunners,
} from '../../services/scanCapabilities.js';
import { ContractInvalidError } from '../contractErrors';

type LegacyCapability = {
  id: string;
  availability: () => boolean;
  normalizeOptions?: (options?: unknown) => unknown;
  runner: (input: {
    domain: string;
    domainIdentity: { submitted: string; normalized: string };
    options?: unknown;
    signal?: AbortSignal;
  }) => Promise<unknown> | unknown;
};

type Registry = {
  getCapabilityById?: (id: string) => unknown;
  getCapabilityRunners?: (ids?: string[]) => Record<string, unknown>;
};

const defaultRegistry: Registry = { getCapabilityById, getCapabilityRunners };

export const createLegacyCapabilityRunner = (
  registry: Registry = defaultRegistry,
): CapabilityRunner => ({
  async run({ investigation, capability, options, signal }) {
    const definition = registry.getCapabilityById?.(capability) as LegacyCapability | null | undefined;
    const legacyRunner = definition?.runner
      ?? registry.getCapabilityRunners?.([capability])?.[capability] as LegacyCapability['runner'] | undefined;

    if (!definition || !legacyRunner || !definition.availability()) {
      throw Object.assign(new Error('Capability runner unavailable.'), {
        code: 'runner_unavailable',
        retryable: false,
      });
    }

    const result = await legacyRunner({
      domain: investigation.normalizedUrl,
      domainIdentity: {
        submitted: investigation.submittedUrl,
        normalized: investigation.normalizedUrl,
      },
      options: definition.normalizeOptions?.(options),
      signal,
    });
    const parsed = jsonValueSchema.optional().safeParse(result);
    if (!parsed.success) throw new ContractInvalidError('Invalid legacy capability result', parsed.error);
    return parsed.data;
  },
});

export const legacyCapabilityRunner = createLegacyCapabilityRunner();
