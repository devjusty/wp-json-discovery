import { describe, expect, it } from '@jest/globals';
import { ACTIVITY_LOG_PRUNE_DEFAULTS } from '../config.js';
import {
  buildActivityRetentionPlan,
  getEventRetentionRule
} from '../utils/activityRetention.js';

describe('getEventRetentionRule', () => {
  it('keeps scan.error longer than proxy.response', () => {
    expect(getEventRetentionRule('scan.error').retentionDays).toBeGreaterThan(
      getEventRetentionRule('proxy.response').retentionDays
    );
  });

  it('falls back to the existing default for unknown classes', () => {
    expect(getEventRetentionRule('custom.event').retentionDays).toBe(
      ACTIVITY_LOG_PRUNE_DEFAULTS.olderThanDays
    );
  });
});

describe('buildActivityRetentionPlan', () => {
  it('prefers pruning noisy rows before high-value rows when keepLatest trims', () => {
    const nowMs = Date.parse('2026-06-30T00:00:00.000Z');
    const rows = [
      { id: 1, type: 'proxy.response', timestamp: '2026-05-01T00:00:00.000Z' },
      { id: 2, type: 'metrics.heartbeat', timestamp: '2026-05-01T00:00:00.000Z' },
      { id: 3, type: 'custom.event', timestamp: '2026-05-01T00:00:00.000Z' }
    ];

    const plan = buildActivityRetentionPlan(rows, {
      keepLatest: 1,
      olderThanDays: 21,
      nowMs
    });

    expect(plan.deleteIds).toContain(1);
    expect(plan.deleteIds).toContain(3);
    expect(plan.deleteIds).not.toContain(2);
  });
});
