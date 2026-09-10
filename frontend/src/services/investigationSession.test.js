import { describe, expect, it, vi } from 'vitest';
import { scanSessionSchema } from '@wp-json-discovery/contracts';

import {
  createInvestigationSession,
  getContextualCapabilityIds,
  getInvestigatorSelection,
  retryInvestigationCapability,
  runInvestigationSession
} from './investigationSession.js';

const session = createInvestigationSession({
  investigationId: 'inv-1',
  domain: { submitted: 'Example.com', normalized: 'https://example.com' },
  selection: { capabilityIds: ['wordpress', 'homepage'] }
});

const runners = {
  wordpress: vi.fn().mockResolvedValue({ exposure: { status: 'observed' } }),
  homepage: vi.fn().mockResolvedValue({ assets: [] })
};

describe('investigation session', () => {
  it('emits identity and capability progress before final completion', async () => {
    const changes = [];
    const result = await runInvestigationSession(session, runners, (next) => changes.push(next), { active: true });

    changes.forEach((next) => {
      const validation = scanSessionSchema.safeParse(next);
      expect(validation.success, JSON.stringify(validation.error?.issues)).toBe(true);
    });
    const resultValidation = scanSessionSchema.safeParse(result);
    expect(resultValidation.success, JSON.stringify(resultValidation.error?.issues)).toBe(true);
    const sessionStatuses = changes.map((next) => next.status);
    expect(sessionStatuses).toContain('queued');
    expect(sessionStatuses).toContain('running');
    expect(sessionStatuses.indexOf('queued')).toBeLessThan(sessionStatuses.indexOf('running'));
    expect(changes.find((next) => next.status === 'queued')).toMatchObject({
      startedAt: null,
      completedAt: null
    });
    expect(changes.find((next) => next.status === 'running').startedAt).toEqual(expect.any(String));
    expect(result.startedAt).toEqual(expect.any(String));
    expect(result.completedAt).toEqual(expect.any(String));
    const wordpressStatuses = changes.map((next) => next.capabilityStates.wordpress.status);
    expect(wordpressStatuses).toContain('queued');
    expect(wordpressStatuses).toContain('running');
    expect(result.capabilityStates.wordpress.status).toBe('success');
    expect(wordpressStatuses.indexOf('queued')).toBeLessThan(wordpressStatuses.indexOf('running'));
    expect(result.status).toBe('completed');
    expect(changes.some((next) => next.capabilityStates.wordpress.status === 'running')).toBe(true);
    expect(result.overall.status).toBe('complete');
    expect(result.capabilityStates.wordpress.outcome).toEqual({
      status: 'success',
      result: { exposure: { status: 'observed' } },
      error: null
    });
  });

  it('keeps successful evidence while another capability fails', async () => {
    const result = await runInvestigationSession(session, {
      wordpress: async () => ({ exposure: { status: 'observed' } }),
      homepage: async () => { throw Object.assign(new Error('blocked'), { code: 'blocked' }); }
    });

    expectValidSession(result);
    expect(result.capabilityStates.wordpress.outcome.status).toBe('success');
    expect(result.capabilityStates.homepage.outcome.status).toBe('failed');
    expect(result.overall.status).toBe('incomplete');
  });

  it('maps missing runners to unavailable outcomes', async () => {
    const result = await runInvestigationSession(session, { wordpress: runners.wordpress });

    expectValidSession(result);
    expect(result.capabilityStates.homepage).toMatchObject({
      status: 'unavailable',
      outcome: { status: 'unavailable', error: { code: 'runner_unavailable', retryable: false } }
    });
  });

  it('propagates failed dependencies without running dependents', async () => {
    const dependentSession = createInvestigationSession({
      investigationId: 'inv-1',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress', 'sitemap'] }
    });
    const sitemap = vi.fn();
    const result = await runInvestigationSession(dependentSession, {
      wordpress: vi.fn().mockRejectedValue(new Error('blocked')), sitemap
    });

    expectValidSession(result);
    expect(sitemap).not.toHaveBeenCalled();
    expect(result.capabilityStates.sitemap).toMatchObject({
      status: 'unavailable',
      dependency: {
        status: 'failed',
        dependencyId: 'wordpress',
        error: { code: 'dependency_failed', retryable: false }
      },
      outcome: { status: 'unavailable', error: { code: 'dependency_failed', retryable: false } }
    });
    expect(result.capabilityStates.wordpress).toMatchObject({
      status: 'failed',
      outcome: { error: { code: 'scan_failed', retryable: true } }
    });
  });

  it('suppresses work and later callbacks after cancellation', async () => {
    const onChange = vi.fn();
    const token = { active: false };
    const cancelledRunners = {
      wordpress: vi.fn(),
      homepage: vi.fn()
    };
    const result = await runInvestigationSession(session, cancelledRunners, onChange, token);

    expectValidSession(result);
    expect(result.status).toBe('idle');
    expect(onChange).not.toHaveBeenCalled();
    expect(cancelledRunners.wordpress).not.toHaveBeenCalled();
  });

  it('suppresses callbacks when cancellation happens during a runner', async () => {
    let release;
    const onChange = vi.fn();
    const token = { active: true };
    const pending = new Promise((resolve) => { release = resolve; });
    const execution = runInvestigationSession(session, {
      wordpress: () => pending,
      homepage: vi.fn().mockResolvedValue({ assets: [] })
    }, onChange, token);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    token.active = false;
    release({ exposure: { status: 'observed' } });
    const result = await execution;

    expectValidSession(result);
    expect(result.capabilityStates.wordpress.status).toBe('success');
    expect(result.capabilityStates.homepage.status).toBe('success');
    expect(onChange.mock.calls.every(([next]) => next.capabilityStates.wordpress.status !== 'success')).toBe(true);
  });

  it('retries only failed capability and preserves other outcomes', async () => {
    const failed = await runInvestigationSession(session, {
      wordpress: vi.fn().mockResolvedValue({ ok: true }),
      homepage: vi.fn().mockRejectedValue(new Error('temporary'))
    });
    const wordpress = vi.fn().mockResolvedValue({ ok: true });
    const homepage = vi.fn().mockResolvedValue({ assets: [] });
    const retried = await retryInvestigationCapability(failed, 'homepage', { wordpress, homepage });

    expectValidSession(retried);
    expect(homepage).toHaveBeenCalledOnce();
    expect(wordpress).not.toHaveBeenCalled();
    expect(retried.capabilityStates.wordpress.outcome.result).toEqual({ ok: true });
    expect(retried.capabilityStates.homepage.outcome.status).toBe('success');
  });

  it('retries unavailable capability when its runner becomes available', async () => {
    const wordpress = vi.fn().mockResolvedValue({ ok: true });
    const unavailable = await runInvestigationSession(session, { wordpress });
    const homepage = vi.fn().mockResolvedValue({ assets: [] });

    expect(unavailable.capabilityStates.homepage.status).toBe('unavailable');
    const changes = [];
    const retried = await retryInvestigationCapability(unavailable, 'homepage', { wordpress, homepage }, (next) => changes.push(next));

    expectValidSession(retried);
    changes.forEach(expectValidSession);
    expect(homepage).toHaveBeenCalledOnce();
    expect(wordpress).toHaveBeenCalledOnce();
    expect(retried.capabilityStates.wordpress.outcome.result).toEqual({ ok: true });
    expect(retried.capabilityStates.homepage.outcome.status).toBe('success');
  });

  it('preserves settled retry evidence after cancellation without notifying success', async () => {
    let release;
    const token = { active: true };
    const changes = [];
    const unavailable = await runInvestigationSession(session, {
      wordpress: vi.fn().mockResolvedValue({ ok: true })
    });
    const retried = retryInvestigationCapability(unavailable, 'homepage', {
      homepage: () => new Promise((resolve) => { release = resolve; })
    }, (next) => changes.push(next), token);

    await vi.waitFor(() => expect(changes.some((next) => next.capabilityStates.homepage.status === 'running')).toBe(true));
    token.active = false;
    release({ assets: [] });
    const result = await retried;

    expectValidSession(result);
    expect(result.capabilityStates.homepage.outcome).toEqual({ status: 'success', result: { assets: [] }, error: null });
    expect(changes.some((next) => next.capabilityStates.homepage.outcome?.status === 'success')).toBe(false);
  });

  it('keeps sitemap contextual across wordpress states and excludes selected sitemap', () => {
    expect(getInvestigatorSelection()).toEqual({ capabilityIds: ['homepage', 'wordpress'], options: { homepage: {}, wordpress: {} } });
    expect(getContextualCapabilityIds(session)).toEqual(['sitemap']);

    for (const status of ['idle', 'success', 'failed']) {
      const wordpressSession = createInvestigationSession({
        investigationId: `inv-${status}`,
        domain: sessionDomain(),
        selection: { capabilityIds: ['wordpress'] }
      });
      wordpressSession.capabilityStates.wordpress = status === 'idle'
        ? wordpressSession.capabilityStates.wordpress
        : status === 'success'
          ? { status, outcome: { status, result: {}, error: null }, retry: { status: 'not-retryable' } }
          : { status, outcome: { status, result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } }, retry: { status: 'not-retryable' } };
      expect(getContextualCapabilityIds(wordpressSession)).toEqual(['sitemap']);
    }

    const selectedSitemap = createInvestigationSession({
      investigationId: 'inv-sitemap',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress', 'sitemap'] }
    });
    expect(getContextualCapabilityIds(selectedSitemap)).toEqual([]);
  });
});

function sessionDomain() {
  return { submitted: 'Example.com', normalized: 'https://example.com' };
}

function expectValidSession(value) {
  const validation = scanSessionSchema.safeParse(value);
  expect(validation.success, JSON.stringify(validation.error?.issues)).toBe(true);
}
