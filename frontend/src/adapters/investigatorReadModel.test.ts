import { describe, expect, it } from 'vitest';
import { createInvestigatorReadModel } from './investigatorReadModel';

describe('createInvestigatorReadModel', () => {
  it('maps active investigator session findings, evidence, and retry state', () => {
    const readModel = createInvestigatorReadModel({
      id: 'session-1',
      status: 'running',
      startedAt: '2026-01-01T00:00:00.000Z',
      overall: { status: 'partial' },
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
      capabilityStates: {
        wordpress: {
          status: 'failed',
          outcome: { error: { code: 'timeout', message: 'Timed out', retryable: true } },
        },
      },
    }, true);

    expect(readModel.investigation?.normalizedUrl).toBe('https://example.com');
    expect(readModel.capabilities).toEqual([
      { name: 'wordpress', status: 'failed', retryable: true },
    ]);
    expect(readModel.status).toBe('partial');
  });

  it('maps capability result findings and evidence into domain read models', () => {
    const readModel = createInvestigatorReadModel({
      id: 'session-1',
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      overall: { status: 'complete' },
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: {
            result: {
              findings: [{ id: 'finding-1', summary: 'Public endpoint', evidence: [{ id: 'evidence-1', locator: '/wp-json/' }] }],
            },
          },
        },
      },
    }, false);

    expect(readModel.investigation?.findings).toEqual([
      { id: 'finding-1', capability: 'wordpress', summary: 'Public endpoint', evidenceIds: ['evidence-1'], confidence: 'high' },
    ]);
    expect(readModel.investigation?.evidence).toEqual([
      expect.objectContaining({ id: 'evidence-1', capability: 'wordpress', kind: 'observed' }),
    ]);
  });

  it('keeps History reachable in investigator shell for non-admin users', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      overall: { status: 'complete' },
      capabilityStates: {},
    }, false);

    expect(readModel.sections.find(({ id }) => id === 'history')?.disabled).toBe(false);
  });

  it('preserves nonterminal capability progress and omits unknown states', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      status: 'running',
      overall: { status: 'incomplete' },
      capabilityStates: {
        idle: { status: 'idle' },
        queued: { status: 'queued' },
        running: { status: 'running' },
        unknown: { status: 'mystery' },
      },
    }, false);

    expect(readModel.capabilities).toEqual([
      { name: 'idle', status: 'idle' },
      { name: 'queued', status: 'queued' },
      { name: 'running', status: 'running' },
    ]);
    expect(readModel.status).toBe('running');
  });

  it('never makes unavailable capabilities retryable from legacy metadata', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      overall: { status: 'blocked' },
      capabilityStates: {
        blocked: {
          status: 'unavailable',
          outcome: { error: { code: 'legacy', message: 'Unavailable', retryable: true } },
        },
      },
    }, false);

    expect(readModel.capabilities).toEqual([{ name: 'blocked', status: 'unavailable', retryable: false }]);
  });

  it('preserves evidence provenance kinds and request metadata', () => {
    const provenance = [
      { id: 'observed', kind: 'observed', value: 'Observed value', source: { locator: '/observed' } },
      { id: 'inference', kind: 'inference', value: 'Inferred value', source: { locator: '/inference' } },
      { id: 'trace', kind: 'request-trace', value: 'Request value', source: { request: { method: 'GET', url: 'https://example.com/wp-json', status: 200 } } },
      { id: 'absence', kind: 'absence', value: 'Absent value', source: { locator: '/missing' } },
    ];
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      overall: { status: 'complete' },
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: { result: { findings: [{ id: 'finding', summary: 'Signals', evidence: provenance }] } },
        },
      },
    }, false);

    expect(readModel.investigation?.evidence).toEqual(provenance.map((item) => ({ ...item, capability: 'wordpress' })));
  });

  it('omits aggregate status when lifecycle does not identify one', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      overall: { status: 'unknown' },
      capabilityStates: { malformed: { status: 'mystery' } },
    }, false);

    expect(readModel.status).toBeUndefined();
  });
});
