import { describe, expect, it } from 'vitest';

import {
  createInvestigation,
  getCapabilityState,
  InvestigationModelError,
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

  it('does not expose mutable nested state', () => {
    const input = {
      id: 'inv-1',
      submittedUrl: 'https://example.com',
      normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'html', status: 'success' as const }],
      evidence: [{
        id: 'evidence-1',
        kind: 'observed' as const,
        capability: 'html',
        value: { title: 'Example' },
        source: { evidenceIds: ['source-1'] },
      }],
      findings: [{
        id: 'finding-1',
        capability: 'html',
        summary: 'Found title',
        evidenceIds: ['evidence-1'],
        confidence: 'high' as const,
      }],
    };
    const investigation = createInvestigation(input);

    input.redirectChain.push('https://example.com/changed');
    input.evidence[0].source.evidenceIds?.push('source-2');
    (input.evidence[0].value as { title: string }).title = 'Changed';

    expect(investigation.redirectChain).toEqual(['https://example.com']);
    expect(investigation.evidence[0].source.evidenceIds).toEqual(['source-1']);
    expect(investigation.evidence[0].value).toEqual({ title: 'Example' });

    expect(() => {
      (investigation.redirectChain as string[]).push('https://example.com/changed');
    }).toThrow();
    expect(() => {
      (investigation.evidence[0].source.evidenceIds as string[]).push('source-2');
    }).toThrow();
    expect(() => {
      ((investigation.evidence[0].value as { title: string }).title = 'Changed');
    }).toThrow();
    expect(() => {
      (getCapabilityState(investigation, 'html') as { status: string }).status = 'failed';
    }).toThrow();
  });

  it('rejects invalid capability combinations and timestamps', () => {
    const base = {
      id: 'inv-1',
      submittedUrl: 'https://example.com',
      normalizedUrl: 'https://example.com',
      redirectChain: [],
      createdAt: '2026-09-23T12:00:00.000Z',
    };

    for (const capability of [
      { name: 'html', status: 'success' as const, error: { code: 'bad', message: 'Bad', retryable: false } },
      { name: 'html', status: 'failed' as const },
      { name: 'html', status: 'unavailable' as const, error: { code: 'bad', message: 'Bad', retryable: true } },
      { name: 'html', status: 'success' as const, completedAt: 'not-a-timestamp' },
    ]) {
      expect(() => createInvestigation({ ...base, capabilities: [capability] })).toThrow(InvestigationModelError);
    }

    expect(() => createInvestigation({ ...base, createdAt: 'not-a-timestamp' })).toThrow(InvestigationModelError);
  });
});
