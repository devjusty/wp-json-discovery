import { describe, expect, it } from 'vitest';
import { createInvestigatorReadModel, mergeEvidenceOverlay, mergeFindingOverlay } from './investigatorReadModel';

describe('createInvestigatorReadModel', () => {
  it('merges sparse finding overlays through typed helper', () => {
    expect(mergeFindingOverlay(
      { id: 'finding', capability: 'wordpress', summary: 'Old', evidenceIds: ['evidence'], confidence: 'high' },
      { id: 'finding', capability: 'wordpress', summary: 'New', evidenceIds: [] },
    )).toEqual({
      id: 'finding', capability: 'wordpress', summary: 'New', evidenceIds: ['evidence'], confidence: 'high',
    });
  });

  it('merges sparse evidence overlays through typed helper', () => {
    expect(mergeEvidenceOverlay(
      { id: 'evidence', kind: 'request-trace', capability: 'wordpress', value: 'response', source: { locator: '/wp-json', rawBody: '{}' } },
      { id: 'evidence', kind: 'observed', capability: 'wordpress', value: 'Observed evidence', source: {} },
    )).toEqual({
      id: 'evidence', kind: 'request-trace', capability: 'wordpress', value: 'response', source: { locator: '/wp-json', rawBody: '{}' },
    });
  });
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
      {
        name: 'wordpress',
        status: 'failed',
        retryable: true,
        error: { code: 'timeout', message: 'Timed out', retryable: true },
      },
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

    expect(readModel.capabilities).toEqual([{
      name: 'blocked',
      status: 'unavailable',
      retryable: false,
      error: { code: 'legacy', message: 'Unavailable', retryable: false },
    }]);
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

  it('preserves capability execution metadata and unavailable error details', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{
        id: 'wordpress',
        dependencies: ['homepage'],
        options: { apiVersion: 'v2' },
        metadata: { source: 'selection' },
      }],
      capabilityStates: {
        wordpress: {
          status: 'unavailable',
          reason: 'Dependency unavailable',
          metadata: { source: 'runtime' },
          startedAt: '2026-01-01T00:00:00.000Z',
          completedAt: '2026-01-01T00:01:00.000Z',
          outcome: { error: { code: 'dependency_failed', message: 'Homepage failed', retryable: false } },
        },
      },
      overall: { status: 'blocked' },
    }, false);

    expect(readModel.investigation?.capabilities).toEqual([{
      name: 'wordpress',
      status: 'unavailable',
      dependencies: ['homepage'],
      options: { apiVersion: 'v2' },
      metadata: { source: 'runtime' },
      reason: 'Dependency unavailable',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:01:00.000Z',
      error: { code: 'dependency_failed', message: 'Homepage failed', retryable: false },
    }]);
  });

  it('maps completed lifecycle status to complete UI status', () => {
    const readModel = createInvestigatorReadModel({
      status: 'completed',
      overall: { status: 'unknown' },
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      capabilityStates: {},
    }, false);

    expect(readModel.status).toBe('complete');
  });

  it('omits aggregate status when lifecycle does not identify one', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'https://example.com', normalized: 'https://example.com' },
      overall: { status: 'unknown' },
      capabilityStates: { malformed: { status: 'mystery' } },
    }, false);

    expect(readModel.status).toBeUndefined();
  });

  it('hydrates persisted investigation state when live capability states are absent', () => {
    const readModel = createInvestigatorReadModel({
      status: 'completed',
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {},
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: ['https://example.com'],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [{ name: 'wordpress', status: 'success', result: { version: '6.0' } }],
        observationTimeline: [{ id: 'observation-1', capability: 'wordpress', observedAt: '2026-01-01T00:01:00.000Z', value: '6.0' }],
        evidence: [{ id: 'evidence-1', kind: 'observed', capability: 'wordpress', value: '6.0', source: { locator: '/wp-json' } }],
        findings: [{ id: 'finding-1', capability: 'wordpress', summary: 'WordPress detected', evidenceIds: ['evidence-1'], confidence: 'high' }],
      },
    }, false);

    expect(readModel.investigation?.capabilities[0]).toMatchObject({ name: 'wordpress', status: 'success' });
    expect(readModel.investigation?.observationTimeline).toEqual([
      expect.objectContaining({ id: 'observation-1' }),
    ]);
    expect(readModel.investigation?.evidence).toEqual([
      expect.objectContaining({ id: 'evidence-1' }),
    ]);
    expect(readModel.investigation?.findings).toEqual([
      expect.objectContaining({ id: 'finding-1', evidenceIds: ['evidence-1'] }),
    ]);
  });

  it('merges canonical evidence IDs and lets newer live capability state win', () => {
    const readModel = createInvestigatorReadModel({
      status: 'running',
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'running',
          startedAt: '2026-01-01T00:02:00.000Z',
        },
      },
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [{ name: 'wordpress', status: 'success', result: { version: 'old' } }],
        observationTimeline: [],
        evidence: [{ id: 'canonical-evidence', kind: 'observed', capability: 'wordpress', value: 'canonical', source: {} }],
        findings: [{ id: 'canonical-finding', capability: 'wordpress', summary: 'Canonical signal', evidenceIds: ['canonical-evidence'], confidence: 'high' }],
      },
    }, false);

    expect(readModel.investigation?.capabilities).toEqual([
      expect.objectContaining({ name: 'wordpress', status: 'running', startedAt: '2026-01-01T00:02:00.000Z' }),
    ]);
    expect(readModel.investigation?.findings[0]).toEqual(expect.objectContaining({
      id: 'canonical-finding',
      evidenceIds: ['canonical-evidence'],
    }));
    expect(readModel.investigation?.evidence).toEqual([
      expect.objectContaining({ id: 'canonical-evidence' }),
    ]);
  });

  it('maps legacy failed incomplete sessions to failed or partial status without losing retryability', () => {
    const readModel = createInvestigatorReadModel({
      status: 'failed',
      overall: { status: 'incomplete' },
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'failed',
          outcome: { error: { code: 'timeout', message: 'Timed out', retryable: true } },
        },
      },
    }, false);

    expect(readModel.status).toBe('failed');
    expect(readModel.capabilities).toEqual([
      {
        name: 'wordpress',
        status: 'failed',
        retryable: true,
        error: { code: 'timeout', message: 'Timed out', retryable: true },
      },
    ]);
  });

  it('derives persisted partial capabilities and retry controls when live states are absent', () => {
    const readModel = createInvestigatorReadModel({
      status: 'completed',
      overall: { status: 'partial' },
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {},
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [
          { name: 'wordpress', status: 'failed', error: { code: 'timeout', message: 'Timed out', retryable: true } },
          { name: 'homepage', status: 'success', result: { title: 'Example' } },
        ],
        observationTimeline: [],
        evidence: [],
        findings: [],
      },
    }, false);

    expect(readModel.capabilities).toEqual([
      {
        name: 'wordpress',
        status: 'failed',
        retryable: true,
        error: { code: 'timeout', message: 'Timed out', retryable: true },
      },
      { name: 'homepage', status: 'success' },
    ]);
  });

  it('preserves canonical successful results when live state has no result and maps live results when present', () => {
    const readModel = createInvestigatorReadModel({
      status: 'completed',
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: { result: { version: 'new' } },
        },
        homepage: {
          status: 'success',
          outcome: {},
        },
      },
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [
          { name: 'wordpress', status: 'success', result: { version: 'old' } },
          { name: 'homepage', status: 'success', result: { title: 'Example' } },
        ],
        observationTimeline: [],
        evidence: [],
        findings: [],
      },
    }, false);

    expect(readModel.investigation?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'wordpress', status: 'success', result: { version: 'new' } }),
      expect.objectContaining({ name: 'homepage', status: 'success', result: { title: 'Example' } }),
    ]));
  });

  it('preserves persisted failed error and retry metadata across sparse live overlays', () => {
    const readModel = createInvestigatorReadModel({
      status: 'failed',
      overall: { status: 'failed' },
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: { wordpress: { status: 'failed' } },
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [{ name: 'wordpress', status: 'failed', error: { code: 'timeout', message: 'Timed out', retryable: true } }],
        observationTimeline: [],
        evidence: [],
        findings: [],
      },
    }, false);

    expect(readModel.capabilities).toEqual([
      {
        name: 'wordpress',
        status: 'failed',
        retryable: true,
        error: { code: 'timeout', message: 'Timed out', retryable: true },
      },
    ]);
    expect(readModel.investigation?.capabilities[0]).toMatchObject({
      name: 'wordpress',
      status: 'failed',
      error: { code: 'timeout', message: 'Timed out', retryable: true },
    });
  });

  it('returns canonical findings in deterministic ranked order while preserving evidence IDs', () => {
    const readModel = createInvestigatorReadModel({
      status: 'completed',
      overall: { status: 'complete' },
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {},
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [],
        observationTimeline: [],
        evidence: [
          { id: 'low-evidence', kind: 'observed', capability: 'homepage', value: 'low', source: {} },
          { id: 'high-evidence', kind: 'observed', capability: 'wordpress', value: 'high', source: {} },
        ],
        findings: [
          { id: 'low', capability: 'homepage', summary: 'Low signal', evidenceIds: ['low-evidence'], confidence: 'low' },
          { id: 'high', capability: 'wordpress', summary: 'High signal', evidenceIds: ['high-evidence'], confidence: 'high' },
        ],
      },
    }, false);

    expect(readModel.investigation?.findings.map(({ id, evidenceIds }) => ({ id, evidenceIds }))).toEqual([
      { id: 'high', evidenceIds: ['high-evidence'] },
      { id: 'low', evidenceIds: ['low-evidence'] },
    ]);
  });

  it('maps validated finding ranking fields and raw response bodies', () => {
    const readModel = createInvestigatorReadModel({
      status: 'completed',
      overall: { status: 'complete' },
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: {
            result: {
              findings: [{
                id: 'finding-1',
                summary: 'Endpoint exposed',
                consequence: 'critical',
                evidenceQuality: 'high',
                novelty: 'new',
                evidence: [{ id: 'evidence-1', kind: 'observed', value: 'payload', rawBody: '{"ok":true}', source: { locator: '/wp-json' } }],
              }],
            },
          },
        },
      },
    }, false);

    expect(readModel.investigation?.findings[0]).toMatchObject({
      consequence: 'critical',
      evidenceQuality: 'high',
      novelty: 'new',
      evidenceIds: ['evidence-1'],
    });
    expect(readModel.investigation?.evidence[0].source.rawBody).toBe('{"ok":true}');
  });

  it('preserves persisted finding metadata when live overlay is sparse', () => {
    const readModel = createInvestigatorReadModel({
      status: 'completed',
      overall: { status: 'complete' },
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: { result: { findings: [{ id: 'finding-1', summary: 'Updated signal' }] } },
        },
      },
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [],
        observationTimeline: [],
        evidence: [{ id: 'persisted-evidence', kind: 'observed', capability: 'wordpress', value: 'signal', source: {} }],
        findings: [{
          id: 'finding-1',
          capability: 'wordpress',
          summary: 'Persisted signal',
          evidenceIds: ['persisted-evidence'],
          confidence: 'high',
          consequence: 'critical',
          evidenceQuality: 'high',
          novelty: 'new',
        }],
      },
    }, false);

    expect(readModel.investigation?.findings).toEqual([{
      id: 'finding-1',
      capability: 'wordpress',
      summary: 'Updated signal',
      evidenceIds: ['persisted-evidence'],
      confidence: 'high',
      consequence: 'critical',
      evidenceQuality: 'high',
      novelty: 'new',
    }]);
  });

  it('preserves persisted confidence when live finding omits confidence evidence', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: { result: { findings: [{ id: 'finding-1', summary: 'Updated signal' }] } },
        },
      },
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [],
        observationTimeline: [],
        evidence: [],
        findings: [{
          id: 'finding-1',
          capability: 'wordpress',
          summary: 'Persisted signal',
          evidenceIds: [],
          confidence: 'high',
        }],
      },
    }, false);

    expect(readModel.investigation?.findings[0]).toMatchObject({
      id: 'finding-1',
      summary: 'Updated signal',
      confidence: 'high',
    });
  });

  it('merges sparse live evidence into canonical provenance fields', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: { result: { findings: [{
            id: 'finding-1',
            summary: 'Updated signal',
            evidence: [{ id: 'evidence-1' }],
          }] } },
        },
      },
      investigationState: {
        id: 'investigation-1',
        submittedUrl: 'Example.com',
        normalizedUrl: 'https://example.com',
        redirectChain: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        capabilities: [],
        observationTimeline: [],
        evidence: [{
          id: 'evidence-1',
          kind: 'request-trace',
          capability: 'wordpress',
          value: 'Canonical response',
          source: {
            locator: '/wp-json',
            observedAt: '2026-01-01T00:01:00.000Z',
            rawBody: '{"canonical":true}',
            request: { method: 'GET', url: 'https://example.com/wp-json', status: 200 },
          },
        }],
        findings: [],
      },
    }, false);

    expect(readModel.investigation?.evidence).toEqual([{
      id: 'evidence-1',
      kind: 'request-trace',
      capability: 'wordpress',
      value: 'Canonical response',
      source: {
        locator: '/wp-json',
        observedAt: '2026-01-01T00:01:00.000Z',
        rawBody: '{"canonical":true}',
        request: { method: 'GET', url: 'https://example.com/wp-json', status: 200 },
      },
    }]);
  });

  it('maps failed and unavailable capability recovery details without enabling unavailable retry', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      overall: { status: 'partial' },
      capabilityStates: {
        wordpress: {
          status: 'failed',
          reason: 'Request timed out',
          outcome: { error: { code: 'timeout', message: 'WordPress endpoint timed out', retryable: true } },
        },
        homepage: {
          status: 'unavailable',
          reason: 'Dependency unavailable',
          outcome: { error: { code: 'dependency_failed', message: 'Homepage capability is blocked', retryable: true } },
        },
      },
    }, false);

    expect(readModel.capabilities).toEqual([
      {
        name: 'wordpress',
        status: 'failed',
        retryable: true,
        reason: 'Request timed out',
        error: { code: 'timeout', message: 'WordPress endpoint timed out', retryable: true },
      },
      {
        name: 'homepage',
        status: 'unavailable',
        retryable: false,
        reason: 'Dependency unavailable',
        error: { code: 'dependency_failed', message: 'Homepage capability is blocked', retryable: false },
      },
    ]);
  });

  it('maps blocked investigation recovery details from overall state', () => {
    const readModel = createInvestigatorReadModel({
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      overall: {
        status: 'blocked',
        reason: 'Required homepage capability is unavailable',
        guidance: 'Enable homepage access, then start a new scan.',
        command: 'scan --capability homepage',
      },
      capabilityStates: {
        homepage: {
          status: 'unavailable',
          outcome: { error: { code: 'dependency_failed', message: 'Homepage dependency unavailable', retryable: true } },
        },
      },
    }, false);

    expect(readModel.status).toBe('blocked');
    expect(readModel.blocked).toEqual({
      reason: 'Required homepage capability is unavailable',
      guidance: 'Enable homepage access, then start a new scan.',
      command: 'scan --capability homepage',
    });
    expect(readModel.capabilities).toEqual([expect.objectContaining({ status: 'unavailable', retryable: false })]);
  });
});
