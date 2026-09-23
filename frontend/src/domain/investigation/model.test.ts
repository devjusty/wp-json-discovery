import { describe, expect, it } from 'vitest';

import {
  createInvestigation,
  getCapabilityState,
  isPartialInvestigation,
} from './model';

describe('investigation model', () => {
  it('creates a complete investigation with immutable URL identity', () => {
    const investigation = createInvestigation({
      id: 'inv-1',
      submittedUrl: 'HTTP://Example.com/path',
      normalizedUrl: 'https://example.com/path',
      redirectChain: ['HTTP://Example.com/path', 'https://example.com/path'],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [
        { name: 'html', status: 'success', completedAt: '2026-09-23T12:00:01.000Z' },
      ],
    });

    expect(investigation.submittedUrl).toBe('HTTP://Example.com/path');
    expect(investigation.normalizedUrl).toBe('https://example.com/path');
    expect(investigation.redirectChain).toEqual([
      'HTTP://Example.com/path',
      'https://example.com/path',
    ]);
    expect(investigation.observationTimeline).toEqual([]);
    expect(isPartialInvestigation(investigation)).toBe(false);
  });

  it('distinguishes retryable failure from unavailable capability', () => {
    const investigation = createInvestigation({
      id: 'inv-1',
      submittedUrl: 'https://example.com',
      normalizedUrl: 'https://example.com',
      redirectChain: [],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [
        {
          name: 'wordpress',
          status: 'failed',
          error: { code: 'timeout', message: 'Timed out', retryable: true },
        },
        { name: 'sitemap', status: 'unavailable', reason: 'robots-policy' },
      ],
    });

    expect(getCapabilityState(investigation, 'wordpress')?.status).toBe('failed');
    expect(getCapabilityState(investigation, 'wordpress')?.error?.retryable).toBe(true);
    expect(getCapabilityState(investigation, 'sitemap')?.status).toBe('unavailable');
    expect(isPartialInvestigation(investigation)).toBe(true);
  });

  it('preserves evidence provenance for observations and inferences', () => {
    const investigation = createInvestigation({
      id: 'inv-1',
      submittedUrl: 'https://example.com',
      normalizedUrl: 'https://example.com',
      redirectChain: [],
      createdAt: '2026-09-23T12:00:00.000Z',
      evidence: [
        {
          id: 'evidence-1',
          kind: 'observed',
          capability: 'html',
          value: 'WordPress generator meta tag',
          source: { locator: 'meta[name="generator"]', observedAt: '2026-09-23T12:00:02.000Z' },
        },
        {
          id: 'evidence-2',
          kind: 'inference',
          capability: 'wordpress',
          value: 'WordPress is likely installed',
          source: { evidenceIds: ['evidence-1'] },
        },
      ],
      findings: [
        {
          id: 'finding-1',
          capability: 'wordpress',
          summary: 'WordPress detected',
          evidenceIds: ['evidence-1', 'evidence-2'],
          confidence: 'high',
        },
      ],
    });

    expect(investigation.evidence).toHaveLength(2);
    expect(investigation.evidence[0].kind).toBe('observed');
    expect(investigation.evidence[1].source).toEqual({ evidenceIds: ['evidence-1'] });
    expect(investigation.findings[0].evidenceIds).toEqual(['evidence-1', 'evidence-2']);
  });

  it('marks an investigation partial when any capability is unfinished', () => {
    const investigation = createInvestigation({
      id: 'inv-1',
      submittedUrl: 'https://example.com',
      normalizedUrl: 'https://example.com',
      redirectChain: [],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'html', status: 'running' }],
    });

    expect(isPartialInvestigation(investigation)).toBe(true);
  });
});
