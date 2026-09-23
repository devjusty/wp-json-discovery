import { describe, expect, it } from 'vitest';

import { type InvestigationLifecycleState } from './lifecycle';
import {
  selectCapabilityProgress,
  selectInvestigationStatus,
  selectRetryableCapabilities,
} from './selectors';

const state = (capabilityStates: InvestigationLifecycleState['capabilityStates']): InvestigationLifecycleState => ({
  status: 'completed',
  startedAt: null,
  completedAt: null,
  selectedCapabilities: Object.keys(capabilityStates).map((id) => ({ id })),
  capabilityStates,
  overall: { status: 'incomplete' },
});

describe('investigation selectors', () => {
  it('reports complete only when every selected capability succeeds', () => {
    expect(selectInvestigationStatus(state({
      wordpress: { status: 'success', outcome: { status: 'success', result: {}, error: null } },
      sitemap: { status: 'success', outcome: { status: 'success', result: {}, error: null } },
    }))).toBe('complete');
  });

  it('reports partial when success coexists with failure or unavailability', () => {
    expect(selectInvestigationStatus(state({
      wordpress: { status: 'success', outcome: { status: 'success', result: {}, error: null } },
      sitemap: { status: 'unavailable', outcome: { status: 'unavailable', result: null, error: { code: 'auth', message: 'Auth', retryable: false } } },
    }))).toBe('partial');
  });

  it('reports failed when no capability succeeds and a failure exists', () => {
    expect(selectInvestigationStatus(state({
      wordpress: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'timeout', message: 'Timeout', retryable: true } } },
    }))).toBe('failed');
  });

  it('reports blocked for invalid or unusable start state', () => {
    expect(selectInvestigationStatus({ ...state({}), status: 'invalid' })).toBe('blocked');
    expect(selectInvestigationStatus({ ...state({}), status: 'auth-required' })).toBe('blocked');
    expect(selectInvestigationStatus(state({}))).toBe('blocked');
  });

  it('selects progress and retryable capabilities', () => {
    const investigation = state({
      wordpress: { status: 'success', outcome: { status: 'success', result: {}, error: null } },
      sitemap: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'timeout', message: 'Timeout', retryable: true } } },
      homepage: { status: 'running' },
    });

    expect(selectCapabilityProgress(investigation)).toEqual({ total: 3, completed: 1, running: 1, failed: 1, unavailable: 0 });
    expect(selectRetryableCapabilities(investigation)).toEqual(['sitemap']);
  });
});
