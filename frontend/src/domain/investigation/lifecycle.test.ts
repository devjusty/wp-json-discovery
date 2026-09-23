import { describe, expect, it } from 'vitest';

import {
  applyInvestigationEvent,
  canRetryCapability,
  InvalidInvestigationTransitionError,
  type InvestigationLifecycleState,
} from './lifecycle';
import { selectEvidence, selectInvestigationStatus } from './selectors';

const startingState = (): InvestigationLifecycleState => ({
  status: 'idle',
  startedAt: null,
  completedAt: null,
  selectedCapabilities: [{ id: 'wordpress' }, { id: 'sitemap' }],
  capabilityStates: {
    wordpress: { status: 'idle', retry: { status: 'not-retryable' } },
    sitemap: { status: 'idle', retry: { status: 'not-retryable' } },
  },
  overall: { status: 'incomplete' },
});

describe('investigation lifecycle', () => {
  it('moves a capability from queued to running', () => {
    const queued = applyInvestigationEvent(startingState(), {
      type: 'capability-queued', capability: 'wordpress', at: '2026-09-23T12:00:00.000Z',
    });
    const running = applyInvestigationEvent(queued, {
      type: 'capability-running', capability: 'wordpress', at: '2026-09-23T12:00:01.000Z',
    });

    expect(running.capabilityStates.wordpress.status).toBe('running');
    expect(running.startedAt).toBe('2026-09-23T12:00:01.000Z');
  });

  it('moves a running capability to success and preserves its result', () => {
    const running = applyInvestigationEvent(startingState(), {
      type: 'capability-queued', capability: 'wordpress',
    });
    const active = applyInvestigationEvent(running, {
      type: 'capability-running', capability: 'wordpress',
    });
    const complete = applyInvestigationEvent(active, {
      type: 'capability-succeeded', capability: 'wordpress', result: { identity: 'WordPress' },
    });

    expect(complete.capabilityStates.wordpress.outcome).toEqual({
      status: 'success', result: { identity: 'WordPress' }, error: null,
    });
  });

  it('moves a running capability to failed', () => {
    const running = applyInvestigationEvent(
      applyInvestigationEvent(startingState(), { type: 'capability-queued', capability: 'wordpress' }),
      { type: 'capability-running', capability: 'wordpress' },
    );
    const failed = applyInvestigationEvent(running, {
      type: 'capability-failed', capability: 'wordpress',
      error: { code: 'timeout', message: 'Timed out', retryable: true },
    });

    expect(failed.capabilityStates.wordpress.status).toBe('failed');
    expect(canRetryCapability(failed, 'wordpress')).toBe(true);
  });

  it('rejects invalid transitions with a typed error', () => {
    expect(() => applyInvestigationEvent(startingState(), {
      type: 'capability-succeeded', capability: 'wordpress', result: {},
    })).toThrow(InvalidInvestigationTransitionError);
    expect(() => applyInvestigationEvent(startingState(), {
      type: 'capability-succeeded', capability: 'wordpress', result: {},
    })).toThrowError(expect.objectContaining({ code: 'invalid-transition' }));
  });

  it('does not terminalize while a selected capability is still idle', () => {
    let state = applyInvestigationEvent(startingState(), {
      type: 'capability-queued', capability: 'wordpress',
    });
    state = applyInvestigationEvent(state, {
      type: 'capability-running', capability: 'wordpress',
    });
    const after = applyInvestigationEvent(state, {
      type: 'capability-succeeded', capability: 'wordpress', result: { ok: true },
    });

    expect(after.status).toBe('running');
    expect(after.completedAt).toBeNull();
    expect(after.overall.status).toBe('incomplete');
  });

  it('terminalizes partial status only after every selected capability is terminal', () => {
    let state = startingState();
    state = applyInvestigationEvent(state, { type: 'capability-queued', capability: 'wordpress' });
    state = applyInvestigationEvent(state, { type: 'capability-running', capability: 'wordpress' });
    state = applyInvestigationEvent(state, {
      type: 'capability-succeeded', capability: 'wordpress', result: { ok: true },
    });
    expect(state.overall.status).toBe('incomplete');

    state = applyInvestigationEvent(state, {
      type: 'capability-unavailable', capability: 'sitemap',
      error: { code: 'auth_required', message: 'Authentication required', retryable: true },
    });

    expect(state.status).toBe('completed');
    expect(state.overall.status).toBe('partial');
    expect(state.completedAt).toBeNull();
  });

  it('rejects direct retry transitions unless failed capability is retryable', () => {
    let state = startingState();
    state = applyInvestigationEvent(state, { type: 'capability-queued', capability: 'wordpress' });
    state = applyInvestigationEvent(state, { type: 'capability-running', capability: 'wordpress' });
    state = applyInvestigationEvent(state, {
      type: 'capability-failed', capability: 'wordpress',
      error: { code: 'permanent', message: 'Permanent failure', retryable: false },
    });

    expect(() => applyInvestigationEvent(state, {
      type: 'capability-queued', capability: 'wordpress',
    })).toThrowError(expect.objectContaining({ code: 'invalid-transition' }));
  });

  it('never permits unavailable capability retry transitions', () => {
    const unavailable = applyInvestigationEvent(startingState(), {
      type: 'capability-unavailable', capability: 'sitemap',
      error: { code: 'runner_unavailable', message: 'Runner unavailable', retryable: true },
    });

    expect(() => applyInvestigationEvent(unavailable, {
      type: 'capability-queued', capability: 'sitemap',
    })).toThrowError(expect.objectContaining({ code: 'invalid-transition' }));
  });

  it('does not retry unavailable capabilities without retryable error', () => {
    const unavailable = applyInvestigationEvent(startingState(), {
      type: 'capability-unavailable', capability: 'sitemap',
      error: { code: 'auth_required', message: 'Authentication required', retryable: false },
    });

    expect(canRetryCapability(unavailable, 'sitemap')).toBe(false);
  });

  it('marks unavailable capabilities non-retryable even when runner error is transient', () => {
    const unavailable = applyInvestigationEvent(startingState(), {
      type: 'capability-unavailable', capability: 'sitemap',
      error: { code: 'runner_unavailable', message: 'Runner unavailable', retryable: true },
    });

    expect(canRetryCapability(unavailable, 'sitemap')).toBe(false);
    expect(unavailable.capabilityStates.sitemap.outcome?.error?.retryable).toBe(false);
    expect(unavailable.capabilityStates.sitemap.retry).toEqual({ status: 'not-retryable' });
  });

  it('preserves successful evidence while another capability fails', () => {
    let state = startingState();
    state = applyInvestigationEvent(state, { type: 'capability-queued', capability: 'wordpress' });
    state = applyInvestigationEvent(state, { type: 'capability-running', capability: 'wordpress' });
    state = applyInvestigationEvent(state, {
      type: 'capability-succeeded', capability: 'wordpress', result: { exposure: 'observed' },
    });
    state = applyInvestigationEvent(state, { type: 'capability-queued', capability: 'sitemap' });
    state = applyInvestigationEvent(state, { type: 'capability-running', capability: 'sitemap' });
    const after = applyInvestigationEvent(state, {
      type: 'capability-failed', capability: 'sitemap',
      error: { code: 'timeout', message: 'Timed out', retryable: true },
    });

    expect(selectEvidence(after)).toEqual([{ capability: 'wordpress', result: { exposure: 'observed' } }]);
    expect(selectInvestigationStatus(after)).toBe('partial');
  });
});
