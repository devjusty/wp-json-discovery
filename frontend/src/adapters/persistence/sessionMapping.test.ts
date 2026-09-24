import { describe, expect, it } from 'vitest';
import { investigationStateSchema } from '@wp-json-discovery/contracts';
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

  it('uses latest update time when closing a terminal session', () => {
    const session = domainToSession({ ...investigation, updatedAt: '2026-09-23T12:05:00.000Z' });

    expect(session.startedAt).toBe('2026-09-23T12:00:00.000Z');
    expect(session.completedAt).toBe('2026-09-23T12:05:00.000Z');
  });

  it.each(['queued', 'running'])('clears stale result and error fields when retry becomes %s', (status) => {
    const session = createPersistableSession({
      id: 'session-1',
      investigationId: 'inv-1',
      status: 'running',
      selectedCapabilities: [{ id: 'sitemap', dependencies: [], options }],
      capabilityStates: {
        sitemap: { status, outcome: { status, result: result, error: { code: 'old', message: 'old', retryable: true } } },
      },
      overall: { status: 'incomplete' },
      investigationState: {
        ...investigation,
        capabilities: [{ ...investigation.capabilities[0], status: 'failed', result, error: { code: 'old', message: 'old', retryable: true } }],
      },
    }, { submitted: investigation.submittedUrl, normalized: investigation.normalizedUrl });

    const capability = session.investigationState.capabilities[0];
    expect(capability).not.toHaveProperty('result');
    expect(capability).not.toHaveProperty('error');
    expect(investigationStateSchema.safeParse(session.investigationState).success).toBe(true);
  });

  it('replaces stale error with current result when retry succeeds', () => {
    const retryResult = { pages: [{ url: 'https://example.com/retry' }] };
    const session = createPersistableSession({
      id: 'session-1',
      investigationId: 'inv-1',
      status: 'completed',
      selectedCapabilities: [{ id: 'sitemap', dependencies: [], options }],
      capabilityStates: {
        sitemap: { status: 'success', outcome: { status: 'success', result: retryResult, error: null } },
      },
      overall: { status: 'complete' },
      investigationState: {
        ...investigation,
        capabilities: [{ ...investigation.capabilities[0], status: 'failed', result, error: { code: 'old', message: 'old', retryable: true } }],
      },
    }, { submitted: investigation.submittedUrl, normalized: investigation.normalizedUrl });

    expect(session.investigationState.capabilities[0]).toMatchObject({ status: 'success', result: retryResult });
    expect(session.investigationState.capabilities[0]).not.toHaveProperty('error');
    expect(investigationStateSchema.safeParse(session.investigationState).success).toBe(true);
  });
});
