import { describe, expect, it } from 'vitest';
import { createPersistableSession, domainToSession } from './sessionMapping';

const options = { sitemapUrl: '/custom.xml', maxPages: 2 };
const result = { pages: [{ url: 'https://example.com/one' }] };
const investigation = {
  id: 'inv-1',
  submittedUrl: 'Example.com',
  normalizedUrl: 'https://example.com',
  redirectChain: [],
  createdAt: '2026-09-23T12:00:00.000Z',
  capabilities: [{
    name: 'sitemap',
    status: 'success',
    options,
    result,
  }],
  observationTimeline: [],
  evidence: [],
  findings: [],
} as const;

describe('session mapping adapter', () => {
  it('serializes capability options and successful results for every persistence path', () => {
    const session = domainToSession(investigation);

    expect(session.selectedCapabilities).toEqual([{
      id: 'sitemap',
      dependencies: [],
      options: { sitemapUrl: '/custom.xml', maxPages: 2 },
    }]);
    expect((session.capabilityStates.sitemap.outcome as { result: unknown }).result).toEqual(result);
    expect(createPersistableSession({
      id: 'session-1',
      investigationId: 'inv-1',
      status: 'completed',
      selectedCapabilities: session.selectedCapabilities,
      capabilityStates: session.capabilityStates,
      overall: session.overall,
    }, { submitted: investigation.submittedUrl, normalized: investigation.normalizedUrl }).investigationState.capabilities)
      .toEqual(expect.arrayContaining([{ name: 'sitemap', status: 'success', options, result }]));
  });
});
