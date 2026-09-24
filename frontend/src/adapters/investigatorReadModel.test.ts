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
});
