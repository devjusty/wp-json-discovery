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

  it('forwards configured capability options to legacy runners', async () => {
    const runnerFunction = vi.fn(async ({ options }) => options);
    const runner = createLegacyCapabilityRunner({
      getCapabilityById: vi.fn(() => ({
        id: 'sitemap',
        availability: () => true,
        normalizeOptions: (options) => options,
        runner: runnerFunction,
      })),
    });

    await expect(runner.run({
      investigation,
      capability: 'sitemap',
      options: { sitemapUrl: 'https://example.com/sitemap.xml', maxPages: 12 },
    })).resolves.toEqual({ sitemapUrl: 'https://example.com/sitemap.xml', maxPages: 12 });
    expect(runnerFunction).toHaveBeenCalledWith(expect.objectContaining({
      options: { sitemapUrl: 'https://example.com/sitemap.xml', maxPages: 12 },
    }));
  });

  it('rejects malformed legacy runner results at the adapter boundary', async () => {
    const runner = createLegacyCapabilityRunner({
      getCapabilityById: vi.fn(() => ({
        id: 'homepage',
        availability: () => true,
        runner: async () => BigInt(1),
      })),
    });

    await expect(runner.run({ investigation, capability: 'homepage' }))
      .rejects.toMatchObject({ code: 'contract-invalid' });
  });
});
