import { describe, expect, it } from 'vitest';

import {
  apiEnvelopeSchema,
  authStateSchema,
  capabilityDefinitionSchema,
  capabilityIdentitySchema,
  capabilityOutcomeSchema,
  capabilitySelectionSchema,
  capabilityStateSchema,
  sessionCapabilityStateSchema,
  capabilityStatusSchema,
  claimInvestigationRequestSchema,
  dependencyStateSchema,
  domainIdentitySchema,
  evidenceReferenceSchema,
  findingSchema,
  investigationIdentitySchema,
  investigationStateSchema,
  investigationListSchema,
  investigationRecordSchema,
  investigationSummarySchema,
  persistedRecordSchema,
  parseDomainIdentity,
  retryStateSchema,
  safeParseApiEnvelope,
  scanSessionSchema,
  sessionRecordSchema,
  startInvestigationRequestSchema,
} from './index.js';

const timestamp = '2026-09-09T12:00:00.000Z';

describe('domain identity', () => {
  it('keeps submitted and normalized domain identity distinct', () => {
    expect(domainIdentitySchema.parse({
      submitted: ' HTTPS://Example.com/ ',
      normalized: 'https://example.com',
    })).toEqual({ submitted: ' HTTPS://Example.com/ ', normalized: 'https://example.com' });
  });

  it('accepts submitted and normalized values', () => {
    expect(
      domainIdentitySchema.safeParse({
        submitted: ' Example.com ',
        normalized: 'https://example.com',
      }).success,
    ).toBe(true);
  });

  it('rejects a missing normalized value', () => {
    expect(domainIdentitySchema.safeParse({ submitted: 'example.com' }).success).toBe(false);
  });

  it('rejects whitespace-only identity strings without trimming meaningful whitespace', () => {
    expect(domainIdentitySchema.safeParse({ submitted: '   ', normalized: 'https://example.com' }).success).toBe(false);
    expect(domainIdentitySchema.parse({ submitted: ' Example.com ', normalized: ' https://example.com ' })).toEqual({
      submitted: ' Example.com ', normalized: ' https://example.com ',
    });
    expect(startInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{ id: '   ', dependencies: [] }],
    }).success).toBe(false);
  });

  it('parses valid identities and throws for invalid identities', () => {
    expect(parseDomainIdentity({ submitted: 'example.com', normalized: 'https://example.com' }))
      .toEqual({ submitted: 'example.com', normalized: 'https://example.com' });
    expect(() => parseDomainIdentity({ submitted: 'example.com' })).toThrow();
  });
});

describe('capability outcomes', () => {
  it('accepts partial evidence with an explicit structured error', () => {
    expect(capabilityOutcomeSchema.safeParse({
      status: 'partial',
      result: { finding: 'x' },
      error: { code: 'blocked', message: 'Blocked', retryable: false },
    }).success).toBe(true);
  });

  it('accepts success, failed, unavailable, and partial outcomes', () => {
    expect(
      capabilityOutcomeSchema.safeParse({ status: 'success', result: { links: 3 }, error: null })
        .success,
    ).toBe(true);
    expect(
      capabilityOutcomeSchema.safeParse({ status: 'success', error: null }).success,
    ).toBe(true);
    expect(
      capabilityOutcomeSchema.safeParse({
        status: 'failed',
        result: null,
        error: { code: 'TIMEOUT', message: 'Request timed out', retryable: true },
      }).success,
    ).toBe(true);
    expect(
      capabilityOutcomeSchema.safeParse({
        status: 'unavailable',
        result: null,
        error: { code: 'NOT_SUPPORTED', message: 'Not supported', retryable: false },
      }).success,
    ).toBe(true);
    expect(
      capabilityOutcomeSchema.safeParse({
        status: 'partial',
        result: { links: 3 },
        error: { code: 'SOME_ITEMS_FAILED', message: 'Some links failed', retryable: false },
      }).success,
    ).toBe(true);
  });

  it('rejects invalid discriminator and payload combinations', () => {
    expect(
      capabilityOutcomeSchema.safeParse({ status: 'success', result: null, error: null }).success,
    ).toBe(true);
    expect(
      capabilityOutcomeSchema.safeParse({
        status: 'unavailable',
        result: null,
        error: { code: 'BAD', message: 'Wrong retry policy', retryable: true },
      }).success,
    ).toBe(false);
    expect(
      capabilityOutcomeSchema.safeParse({ status: 'unknown', result: null, error: null }).success,
    ).toBe(false);
    expect(capabilityOutcomeSchema.safeParse({
      status: 'partial', result: { links: 3 }, error: null,
    }).success).toBe(false);
    expect(capabilityOutcomeSchema.safeParse({
      status: 'partial', result: { links: 3 },
    }).success).toBe(false);
    expect(capabilityOutcomeSchema.safeParse({
      status: 'partial', result: { links: 3 },
      error: { code: 'SOME_ITEMS_FAILED', message: 'Some links failed', retryable: true },
    }).success).toBe(false);
    expect(capabilityStatusSchema.safeParse('partial').success).toBe(false);
  });
});

describe('API envelopes', () => {
  it('accepts success and partial envelopes', () => {
    expect(apiEnvelopeSchema.safeParse({
      status: 'success', requestId: 'request-1', data: { ok: true },
    }).success).toBe(true);
    expect(apiEnvelopeSchema.safeParse({
      status: 'partial', requestId: 'request-2', data: { html: {} },
      errors: [{ code: 'BLOCKED', message: 'Unavailable', retryable: false }],
    }).success).toBe(true);
    expect(apiEnvelopeSchema.safeParse({
      status: 'error', requestId: 'request-3',
      error: { code: 'UPSTREAM_FAILED', message: 'Upstream failed', retryable: true },
    }).success).toBe(true);
  });

  it('accepts retryable errors inside partial envelopes', () => {
    expect(apiEnvelopeSchema.safeParse({
      status: 'partial', requestId: 'request-retry', data: { html: {} },
      errors: [{ code: 'UPSTREAM_TIMEOUT', message: 'Retry later', retryable: true }],
    }).success).toBe(true);
  });

  it('rejects malformed error envelopes', () => {
    expect(
      apiEnvelopeSchema.safeParse({ status: 'error', error: { message: 'Missing code' } }).success,
    ).toBe(false);
    expect(apiEnvelopeSchema.safeParse({
      status: 'partial', requestId: 'request-4', data: {}, errors: [],
    }).success).toBe(false);
    expect(safeParseApiEnvelope({ status: 'success', requestId: 'request-1', data: {} }).success)
      .toBe(true);
    expect(safeParseApiEnvelope({ status: 'partial', requestId: 'request-1', data: {}, errors: [] }).success)
      .toBe(false);
  });
});

describe('scan sessions', () => {
  const selectedCapabilities = [
    { id: 'html', dependencies: [] },
    { id: 'wp-json', dependencies: ['html'] },
  ];

  it('accepts incomplete sessions with failed and unavailable capabilities', () => {
    expect(
      scanSessionSchema.safeParse({
        id: 'session-1',
        investigationId: 'investigation-1',
        status: 'completed',
        startedAt: timestamp,
        completedAt: timestamp,
        selectedCapabilities,
        capabilityStates: {
          html: {
            status: 'failed',
            outcome: { status: 'failed', result: null, error: { code: 'FAILED', message: 'HTML failed', retryable: false } },
            retry: { status: 'not-retryable' },
          },
          'wp-json': {
            status: 'unavailable',
            outcome: {
              status: 'unavailable', result: null,
              error: { code: 'DEPENDENCY_FAILED', message: 'HTML failed', retryable: false },
            },
            dependency: {
              status: 'failed', dependencyId: 'html',
              error: { code: 'FAILED', message: 'Dependency failed', retryable: false },
            },
            retry: { status: 'not-retryable' },
          },
        },
        overall: { status: 'incomplete' },
      }).success,
    ).toBe(true);
  });

  it('accepts typed blocked recovery fields and rejects unknown blocked fields', () => {
    const session = {
      id: 'session-blocked',
      investigationId: 'investigation-1',
      status: 'completed',
      startedAt: timestamp,
      completedAt: timestamp,
      selectedCapabilities: [],
      capabilityStates: {},
      overall: {
        status: 'blocked',
        reason: 'Required capability unavailable',
        guidance: 'Enable capability and start a new scan.',
        command: 'scan --capability homepage',
      },
    };

    expect(scanSessionSchema.safeParse(session).success).toBe(true);
    expect(scanSessionSchema.safeParse({
      ...session,
      overall: { ...session.overall, recoveryUrl: 'https://example.com/recover' },
    }).success).toBe(false);
  });

  it('rejects blocked recovery fields on non-blocked aggregate statuses', () => {
    for (const status of ['complete', 'partial', 'failed', 'incomplete'] as const) {
      expect(scanSessionSchema.safeParse({
        id: 'session-status',
        investigationId: 'investigation-1',
        status: 'completed',
        startedAt: timestamp,
        completedAt: timestamp,
        selectedCapabilities: [],
        capabilityStates: {},
        overall: { status, reason: 'Only blocked sessions explain recovery' },
      }).success).toBe(false);
    }
  });

  it('rejects a complete session with any non-success capability', () => {
    expect(scanSessionSchema.safeParse({
      id: 'session-invalid-complete',
      investigationId: 'investigation-1',
      status: 'completed',
      startedAt: timestamp,
      completedAt: timestamp,
      selectedCapabilities,
      capabilityStates: {
        html: {
          status: 'failed',
          outcome: {
            status: 'failed',
            result: null,
            error: { code: 'FAILED', message: 'HTML failed', retryable: false },
          },
          retry: { status: 'not-retryable' },
        },
        'wp-json': {
          status: 'unavailable',
          outcome: {
            status: 'unavailable',
            result: null,
            error: { code: 'DEPENDENCY_FAILED', message: 'HTML failed', retryable: false },
          },
          dependency: {
            status: 'failed',
            dependencyId: 'html',
            error: { code: 'FAILED', message: 'Dependency failed', retryable: false },
          },
          retry: { status: 'not-retryable' },
        },
      },
      overall: { status: 'complete' },
    }).success).toBe(false);
  });

  it('accepts provider-unavailable capabilities without dependency state', () => {
    expect(capabilityStateSchema.safeParse({
      status: 'unavailable',
      outcome: {
        status: 'unavailable', result: null,
        error: { code: 'NOT_SUPPORTED', message: 'Not supported', retryable: false },
      },
      retry: { status: 'not-retryable' },
    }).success).toBe(true);
  });

  it('rejects retryable unavailable capabilities in generic state contract', () => {
    expect(capabilityStateSchema.safeParse({
      status: 'unavailable',
      outcome: {
        status: 'unavailable', result: null,
        error: { code: 'RUNNER_UNAVAILABLE', message: 'Runner unavailable', retryable: true },
      },
      retry: { status: 'retrying', attempt: 1, nextAttemptAt: timestamp },
    }).success).toBe(false);
  });

  it('rejects retryable unavailable capabilities in session state contract', () => {
    expect(sessionCapabilityStateSchema.safeParse({
      status: 'unavailable',
      outcome: {
        status: 'unavailable', result: null,
        error: { code: 'RUNNER_UNAVAILABLE', message: 'Runner unavailable', retryable: true },
      },
      retry: { status: 'not-retryable' },
    }).success).toBe(false);
  });

  it('rejects retrying and exhausted retry states for unavailable capabilities', () => {
    for (const retry of [
      { status: 'retrying', attempt: 1, nextAttemptAt: timestamp },
      { status: 'exhausted', attempts: 1 },
    ] as const) {
      const state = {
        status: 'unavailable' as const,
        outcome: {
          status: 'unavailable' as const,
          result: null,
          error: { code: 'NOT_SUPPORTED', message: 'Not supported', retryable: false },
        },
        retry,
      };
      expect(capabilityStateSchema.safeParse(state).success).toBe(false);
      expect(sessionCapabilityStateSchema.safeParse(state).success).toBe(false);
    }
  });

  it('preserves retryable failed capabilities in session state contract', () => {
    expect(sessionCapabilityStateSchema.safeParse({
      status: 'failed',
      outcome: {
        status: 'failed', result: null,
        error: { code: 'TIMEOUT', message: 'Timed out', retryable: true },
      },
      retry: { status: 'retrying', attempt: 1, nextAttemptAt: timestamp },
    }).success).toBe(true);
  });

  it('rejects completed timestamp on a running session', () => {
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'running',
      startedAt: timestamp, completedAt: timestamp,
      selectedCapabilities: [], capabilityStates: {}, overall: { status: 'incomplete' },
    }).success).toBe(false);
  });

  it('requires completedAt when a session is completed', () => {
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'completed',
      startedAt: timestamp, completedAt: null,
      selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' },
    }).success).toBe(false);
  });

  it('accepts dependency failure and retry state', () => {
    expect(
      dependencyStateSchema.safeParse({
        status: 'failed',
        dependencyId: 'html',
        error: { code: 'FAILED', message: 'Dependency failed', retryable: false },
      }).success,
    ).toBe(true);
    expect(dependencyStateSchema.safeParse({ status: 'failed', dependencyId: 'html' }).success)
      .toBe(false);
    expect(
      retryStateSchema.safeParse({ status: 'retrying', attempt: 2, nextAttemptAt: timestamp }).success,
    ).toBe(true);
    expect(retryStateSchema.safeParse({ status: 'retrying', attempt: 0, nextAttemptAt: timestamp }).success)
      .toBe(false);
    expect(retryStateSchema.safeParse({ status: 'exhausted', attempts: 2 }).success).toBe(true);
  });

  it('rejects partial lifecycle states and non-retryable failed states', () => {
    const retrying = { status: 'retrying', attempt: 1, nextAttemptAt: timestamp } as const;
    for (const status of ['success', 'queued', 'running'] as const) {
      const state = status === 'success'
        ? { status, outcome: { status: 'success', result: {}, error: null }, retry: retrying }
        : { status, retry: retrying };
      expect(capabilityStateSchema.safeParse(state).success).toBe(false);
    }
    expect(capabilityStateSchema.safeParse({
      status: 'failed',
      outcome: { status: 'failed', result: null, error: { code: 'NOPE', message: 'Nope', retryable: false } },
      retry: retrying,
    }).success).toBe(false);
    expect(capabilityStateSchema.safeParse({
      status: 'success', outcome: { status: 'success', result: {}, error: null },
      retry: { status: 'exhausted', attempts: 2 },
    }).success).toBe(false);
    expect(capabilityStateSchema.safeParse({
      status: 'failed',
      outcome: { status: 'failed', result: null, error: { code: 'TIMEOUT', message: 'Timed out', retryable: true } },
      retry: { status: 'exhausted', attempts: 3 },
    }).success).toBe(true);
    expect(capabilityStateSchema.safeParse({
      status: 'failed',
      outcome: { status: 'failed', result: null, error: { code: 'PERMANENT', message: 'Permanent failure', retryable: false } },
      retry: { status: 'exhausted', attempts: 3 },
    }).success).toBe(false);
  });
});

describe('capabilities, identity, findings, and auth', () => {
  it('allows results only on successful investigation capabilities', () => {
    const base = {
      id: 'investigation-1',
      submittedUrl: 'example.com',
      normalizedUrl: 'https://example.com',
      redirectChain: [],
      createdAt: timestamp,
      observationTimeline: [],
      evidence: [],
      findings: [],
    };
    for (const capability of [
      { name: 'queued', status: 'queued', result: {} },
      { name: 'running', status: 'running', result: {} },
      { name: 'failed', status: 'failed', result: {}, error: { code: 'FAILED', message: 'Failed', retryable: false } },
      { name: 'unavailable', status: 'unavailable', result: {}, error: { code: 'UNAVAILABLE', message: 'Unavailable', retryable: false } },
    ]) {
      expect(investigationStateSchema.safeParse({ ...base, capabilities: [capability] }).success).toBe(false);
    }
    expect(investigationStateSchema.safeParse({
      ...base,
      capabilities: [{ name: 'success', status: 'success', result: {} }],
    }).success).toBe(true);
  });

  it('rejects duplicate investigation capability names', () => {
    expect(investigationStateSchema.safeParse({
      id: 'investigation-1', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: timestamp, observationTimeline: [], evidence: [], findings: [],
      capabilities: [
        { name: 'html', status: 'success' },
        { name: 'html', status: 'queued' },
      ],
    }).success).toBe(false);
  });

  it('rejects non-JSON capability results', () => {
    expect(capabilityStateSchema.safeParse({
      status: 'success',
      outcome: { status: 'success', result: BigInt(1), error: null },
      retry: { status: 'not-retryable' },
    }).success).toBe(false);
  });

  it('accepts investigation identity with ownership', () => {
    expect(investigationIdentitySchema.safeParse({
      id: 'investigation-1', ownerId: 'user-1',
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
    }).success).toBe(true);
  });

  it('accepts capability selection and public definition', () => {
    expect(capabilitySelectionSchema.safeParse({ id: 'html', dependencies: [] }).success).toBe(true);
    expect(capabilitySelectionSchema.safeParse({
      id: 'sitemap', dependencies: ['html'], options: { sitemapUrl: '/custom.xml', maxPages: 2 },
    }).success).toBe(true);
    expect(capabilitySelectionSchema.safeParse({
      id: 'sitemap', dependencies: [], options: { maxPages: BigInt(2) },
    }).success).toBe(false);
    expect(capabilitySelectionSchema.safeParse({
      id: 'sitemap', dependencies: ['html'], options: { sitemapUrl: '/custom.xml', maxPages: 2 },
    }).success).toBe(true);
    expect(capabilitySelectionSchema.safeParse({
      id: 'sitemap', dependencies: [], options: { maxPages: BigInt(2) },
    }).success).toBe(false);
    expect(capabilityDefinitionSchema.safeParse({
      id: 'wp-json', availability: 'available', status: 'failed',
      dependencies: ['html'], retry: { status: 'retrying', attempt: 1, nextAttemptAt: timestamp },
    }).success).toBe(true);
    expect(capabilityDefinitionSchema.safeParse({
      id: 'wp-json', availability: 'unavailable', status: 'unavailable',
      dependencies: [], retry: { status: 'retrying', attempt: 1, nextAttemptAt: timestamp },
    }).success).toBe(false);
    expect(capabilityDefinitionSchema.safeParse({
      id: 'wp-json', availability: 'unavailable', status: 'unavailable',
      dependencies: [], retry: { status: 'exhausted', attempts: 1 },
    }).success).toBe(false);
    expect(capabilityDefinitionSchema.safeParse({
      id: 'wp-json', availability: 'available', status: 'queued', dependencies: [],
      retry: { status: 'retrying', attempt: 1, nextAttemptAt: timestamp },
    }).success).toBe(false);
    expect(capabilityDefinitionSchema.safeParse({
      id: 'wp-json', availability: 'unavailable', status: 'failed', dependencies: [],
      retry: { status: 'not-retryable' },
    }).success).toBe(false);
  });

  it('accepts capability statuses and start requests', () => {
    expect(capabilityStatusSchema.safeParse('queued').success).toBe(true);
    expect(capabilityStatusSchema.safeParse('bogus').success).toBe(false);
    expect(capabilityIdentitySchema.safeParse({ id: 'html' }).success).toBe(true);
    expect(startInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{ id: 'html', dependencies: [] }],
    }).success).toBe(true);
    expect(startInvestigationRequestSchema.safeParse({ domain: {}, selectedCapabilities: [] }).success)
      .toBe(false);
    expect(startInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com', extra: true },
      selectedCapabilities: [],
    }).success).toBe(false);
    expect(startInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{ id: 'html', dependencies: [] }, { id: 'html', dependencies: [] }],
    }).success).toBe(false);
    expect(startInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      selectedCapabilities: [{ id: 'wp-json', dependencies: ['html'] }],
    }).success).toBe(false);
  });

  it('accepts findings with evidence references and auth states', () => {
    expect(evidenceReferenceSchema.safeParse({
      id: 'evidence-1', capabilityId: 'html', locator: 'title',
    }).success).toBe(true);
    expect(findingSchema.safeParse({
      id: 'finding-1', capabilityId: 'html', consequence: 'medium',
      evidenceLevel: 'observed', novelty: 'new', summary: 'Found title',
      evidence: [{ id: 'evidence-1', capabilityId: 'html', locator: 'title' }],
    }).success).toBe(true);
    expect(authStateSchema.safeParse({ status: 'authenticated', subjectId: 'user-1' }).success)
      .toBe(true);
    expect(authStateSchema.safeParse({ status: 'authenticated' }).success).toBe(false);
    expect(authStateSchema.safeParse({ status: 'anonymous' }).success).toBe(true);
  });

  it('rejects partial as a capability lifecycle status', () => {
    expect(capabilityStatusSchema.safeParse('partial').success).toBe(false);
    expect(capabilityStateSchema.safeParse({
      status: 'partial',
      outcome: {
        status: 'partial', result: {},
        error: { code: 'PARTIAL', message: 'Partial', retryable: false },
      },
      retry: { status: 'not-retryable' },
    }).success).toBe(false);
  });

  it('rejects inconsistent session capability keys, dependencies, and overall state', () => {
    const base = {
      id: 'session-1', investigationId: 'investigation-1', status: 'completed',
      startedAt: timestamp, completedAt: timestamp,
      selectedCapabilities: [{ id: 'html', dependencies: ['missing'] }],
      capabilityStates: { html: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } } },
    };
    expect(scanSessionSchema.safeParse({ ...base, overall: { status: 'complete' } }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      ...base, selectedCapabilities: [{ id: 'html', dependencies: [] }], capabilityStates: {},
      overall: { status: 'incomplete' },
    }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      ...base, selectedCapabilities: [{ id: 'html', dependencies: [] }],
      overall: { status: 'complete' },
    }).success).toBe(true);
    expect(scanSessionSchema.safeParse({
      ...base, selectedCapabilities: [{ id: 'html', dependencies: [] }],
      capabilityStates: {
        html: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } },
      }, overall: { status: 'failed' },
    }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      ...base, selectedCapabilities: [
        { id: 'html', dependencies: [] }, { id: 'wp-json', dependencies: ['html'] },
      ],
      capabilityStates: {
        html: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } },
        'wp-json': {
          status: 'unavailable',
          outcome: { status: 'unavailable', result: null, error: { code: 'DEPENDENCY_FAILED', message: 'Failed', retryable: false } },
          dependency: { status: 'failed', dependencyId: 'html', error: { code: 'FAILED', message: 'Failed', retryable: false } },
          retry: { status: 'not-retryable' },
        },
      }, overall: { status: 'incomplete' },
    }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      ...base,
      selectedCapabilities: [{ id: 'html', dependencies: [] }, { id: 'html', dependencies: [] }],
      overall: { status: 'complete' },
    }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      ...base, selectedCapabilities: [
        { id: 'html', dependencies: [] }, { id: 'wp-json', dependencies: ['other'] },
      ],
      capabilityStates: {
        html: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'FAILED', message: 'Failed', retryable: false } }, retry: { status: 'not-retryable' } },
        'wp-json': {
          status: 'unavailable',
          outcome: { status: 'unavailable', result: null, error: { code: 'DEPENDENCY_FAILED', message: 'Failed', retryable: false } },
          dependency: { status: 'failed', dependencyId: 'html', error: { code: 'FAILED', message: 'Failed', retryable: false } },
          retry: { status: 'not-retryable' },
        },
      }, overall: { status: 'incomplete' },
    }).success).toBe(false);
  });

  it('accepts idle and queued sessions with no completion timestamp', () => {
    for (const status of ['idle', 'queued'] as const) {
      expect(scanSessionSchema.safeParse({
        id: 'session-1', investigationId: 'investigation-1', status,
        startedAt: null, completedAt: null, selectedCapabilities: [], capabilityStates: {},
        overall: { status: 'incomplete' },
      }).success).toBe(true);
    }
  });

  it('rejects session state with a different investigation identity', () => {
    const base = {
      id: 'session-1', investigationId: 'investigation-1', status: 'completed',
      startedAt: timestamp, completedAt: timestamp, selectedCapabilities: [], capabilityStates: {},
      overall: { status: 'complete' },
    };
    const state = {
      id: 'other-investigation', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: timestamp, capabilities: [], observationTimeline: [], evidence: [], findings: [],
    };
    expect(scanSessionSchema.safeParse({ ...base, investigationState: state }).success).toBe(false);
    expect(scanSessionSchema.safeParse({ ...base, investigationState: { ...state, id: 'investigation-1' } }).success).toBe(true);
  });

  it('keeps queued sessions incomplete and without final capability states', () => {
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'queued',
      startedAt: null, completedAt: null, selectedCapabilities: [{ id: 'html', dependencies: [] }],
      capabilityStates: {
        html: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } },
      }, overall: { status: 'incomplete' },
    }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'running',
      startedAt: timestamp, completedAt: null, selectedCapabilities: [{ id: 'html', dependencies: [] }],
      capabilityStates: {
        html: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } },
      }, overall: { status: 'complete' },
    }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'running',
      startedAt: timestamp, completedAt: null, selectedCapabilities: [
        { id: 'html', dependencies: [] }, { id: 'wp-json', dependencies: [] },
      ],
      capabilityStates: {
        html: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } },
        'wp-json': { status: 'running', retry: { status: 'not-retryable' } },
      }, overall: { status: 'incomplete' },
    }).success).toBe(true);
  });

  it('rejects idle complete sessions and terminal sessions with active capabilities', () => {
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'idle',
      startedAt: null, completedAt: null, selectedCapabilities: [], capabilityStates: {},
      overall: { status: 'complete' },
    }).success).toBe(false);
    for (const status of ['idle', 'queued', 'running'] as const) {
      expect(scanSessionSchema.safeParse({
        id: 'session-1', investigationId: 'investigation-1', status: 'completed',
        startedAt: timestamp, completedAt: timestamp,
        selectedCapabilities: [{ id: 'html', dependencies: [] }],
        capabilityStates: { html: { status, retry: { status: 'not-retryable' } } },
        overall: { status: 'incomplete' },
      }).success).toBe(false);
      expect(scanSessionSchema.safeParse({
        id: 'session-1', investigationId: 'investigation-1', status: 'failed',
        startedAt: timestamp, completedAt: timestamp,
        selectedCapabilities: [{ id: 'html', dependencies: [] }],
        capabilityStates: { html: { status, retry: { status: 'not-retryable' } } },
        overall: { status: 'incomplete' },
      }).success).toBe(false);
    }
  });

  it('rejects invalid idle and queued capability states', () => {
    const stateFor = (status: 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'unavailable') => {
      if (status === 'success') {
        return { status, outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } };
      }
      if (status === 'failed') {
        return { status, outcome: { status: 'failed', result: null, error: { code: 'FAILED', message: 'Failed', retryable: false } }, retry: { status: 'not-retryable' } };
      }
      if (status === 'unavailable') {
        return { status, outcome: { status: 'unavailable', result: null, error: { code: 'NOPE', message: 'Unavailable', retryable: false } }, dependency: { status: 'ready' }, retry: { status: 'not-retryable' } };
      }
      return { status, retry: { status: 'not-retryable' } };
    };
    for (const capabilityStatus of ['queued', 'running', 'success', 'failed', 'unavailable'] as const) {
      expect(scanSessionSchema.safeParse({
        id: 'session-1', investigationId: 'investigation-1', status: 'idle',
        startedAt: null, completedAt: null, selectedCapabilities: [{ id: 'html', dependencies: [] }],
        capabilityStates: { html: stateFor(capabilityStatus) }, overall: { status: 'incomplete' },
      }).success).toBe(false);
    }
    for (const capabilityStatus of ['running', 'success', 'failed', 'unavailable'] as const) {
      expect(scanSessionSchema.safeParse({
        id: 'session-1', investigationId: 'investigation-1', status: 'queued',
        startedAt: null, completedAt: null, selectedCapabilities: [{ id: 'html', dependencies: [] }],
        capabilityStates: { html: stateFor(capabilityStatus) }, overall: { status: 'incomplete' },
      }).success).toBe(false);
    }
  });

  it('requires chronological session timestamps', () => {
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'running',
      startedAt: '2026-09-09T12:00:00.000Z', completedAt: null,
      selectedCapabilities: [], capabilityStates: {}, overall: { status: 'incomplete' },
    }).success).toBe(true);
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'completed',
      startedAt: '2026-09-09T12:00:00.000Z', completedAt: '2026-09-09T11:00:00.000Z',
      selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' },
    }).success).toBe(false);
    expect(scanSessionSchema.safeParse({
      id: 'session-1', investigationId: 'investigation-1', status: 'completed',
      startedAt: '2026-09-09T12:00:00.000Z', completedAt: '2026-09-09T14:00:00.000+02:00',
      selectedCapabilities: [], capabilityStates: {}, overall: { status: 'incomplete' },
    }).success).toBe(true);
  });
});

describe('persisted records', () => {
  const session = {
    id: 'session-1', investigationId: 'investigation-1', status: 'completed',
    startedAt: timestamp, completedAt: timestamp, selectedCapabilities: [],
    capabilityStates: {}, overall: { status: 'complete' },
  };

  it('accepts valid investigation and session records', () => {
    expect(investigationRecordSchema.safeParse({
      recordType: 'investigation',
      investigation: {
        id: 'investigation-1', ownerId: 'user-1',
        domain: { submitted: 'example.com', normalized: 'https://example.com' },
      },
      createdAt: timestamp, updatedAt: timestamp, sessionIds: ['session-1'],
    }).success).toBe(true);
    expect(investigationRecordSchema.safeParse({
      recordType: 'investigation',
      investigation: { id: 'investigation-1', ownerId: 'user-1', domain: { submitted: 'example.com', normalized: 'https://example.com' } },
      createdAt: timestamp, updatedAt: '2026-09-09T11:00:00.000Z', sessionIds: ['session-1'],
    }).success).toBe(false);
    expect(investigationRecordSchema.safeParse({
      recordType: 'investigation',
      investigation: { id: 'investigation-1', ownerId: 'user-1', domain: { submitted: 'example.com', normalized: 'https://example.com' } },
      createdAt: timestamp, updatedAt: timestamp, sessionIds: [],
    }).success).toBe(false);
    expect(sessionRecordSchema.safeParse({ recordType: 'session', session, persistedAt: timestamp })
      .success).toBe(true);
    expect(persistedRecordSchema.safeParse({ recordType: 'session', session, persistedAt: timestamp })
      .success).toBe(true);
  });

  it('rejects malformed persisted records', () => {
    expect(persistedRecordSchema.safeParse({ recordType: 'session', session: {} }).success).toBe(false);
  });

  it('accepts a claim request containing only an anonymous persisted record', () => {
    expect(claimInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      anonymousRecord: {
        recordType: 'session',
        session,
        persistedAt: timestamp,
      },
    }).success).toBe(true);
  });

  it('rejects a claim request with a target user identity in its body', () => {
    expect(claimInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      anonymousRecord: {
        recordType: 'session',
        session,
        persistedAt: timestamp,
      },
      ownerId: 'user-from-request',
    }).success).toBe(false);
  });

  it('rejects a claim request with an owner-bearing investigation record', () => {
    expect(claimInvestigationRequestSchema.safeParse({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      anonymousRecord: {
        recordType: 'investigation',
        investigation: {
          id: 'investigation-attacker',
          ownerId: 'attacker-controlled-owner',
          domain: { submitted: 'example.com', normalized: 'https://example.com' },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        sessionIds: ['session-1'],
      },
    }).success).toBe(false);
  });
});

describe('public investigation summaries and lists', () => {
  const summary = {
    id: 'investigation-1',
    domain: { submitted: 'example.com', normalized: 'https://example.com' },
    createdAt: timestamp,
    updatedAt: timestamp,
    latestSessionId: 'session-1',
    selectedCapabilityCount: 2,
    completedCapabilityCount: 1,
    findingsCount: 3,
  };

  it('accepts valid public investigation data', () => {
    expect(investigationSummarySchema.parse(summary)).toEqual(summary);
    expect(investigationListSchema.parse({ investigations: [summary] })).toEqual({ investigations: [summary] });
  });

  it('rejects owner identity from public investigation data', () => {
    expect(investigationSummarySchema.safeParse({ ...summary, ownerId: 'user-1' }).success).toBe(false);
  });

  it('rejects invalid timestamps and counts', () => {
    expect(investigationSummarySchema.safeParse({ ...summary, updatedAt: '2026-09-09T11:00:00.000Z' }).success).toBe(false);
    expect(investigationSummarySchema.safeParse({ ...summary, selectedCapabilityCount: -1 }).success).toBe(false);
    expect(investigationSummarySchema.safeParse({ ...summary, findingsCount: 1.5 }).success).toBe(false);
    expect(investigationSummarySchema.safeParse({ ...summary, completedCapabilityCount: 3 }).success).toBe(false);
  });
});
