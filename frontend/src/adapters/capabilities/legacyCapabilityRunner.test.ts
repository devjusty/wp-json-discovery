import { describe, expect, it, vi } from 'vitest';
import type { Investigation } from '../../domain/investigation/model';
import { createLegacyCapabilityRunner } from './legacyCapabilityRunner';

const investigation = {
  id: 'inv-1',
  submittedUrl: 'Example.com',
  normalizedUrl: 'https://example.com',
  redirectChain: [],
  createdAt: '2026-09-23T12:00:00.000Z',
  capabilities: [],
  observationTimeline: [],
  evidence: [],
  findings: [],
} satisfies Investigation;

describe('capability runner port', () => {
  it('runs a registered legacy capability without application dependencies', async () => {
    const runner = createLegacyCapabilityRunner({
      getCapabilityById: vi.fn(() => ({
        id: 'homepage',
        availability: () => true,
        runner: vi.fn(async ({ domain }) => ({ domain })),
        normalizeOptions: () => ({}),
      })),
    });

    await expect(runner.run({ investigation, capability: 'homepage' })).resolves.toEqual({
      domain: 'https://example.com',
    });
  });
});
