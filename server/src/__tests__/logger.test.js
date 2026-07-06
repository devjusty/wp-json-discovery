import { describe, expect, it } from '@jest/globals';
import { deriveFailureCategory, pruneActivityLogs } from '../logger.js';
import { execute, queryAll } from '../db/client.js';

describe('deriveFailureCategory', () => {
  it('classifies homepage fetch failures as network_failure', () => {
    expect(
      deriveFailureCategory({
        message: 'Failed to fetch homepage: fetch failed',
        status: 502
      })
    ).toBe('network_failure');
  });

  it('classifies access denied 403s as auth_required', () => {
    expect(
      deriveFailureCategory({
        message: 'Forbidden - access denied',
        status: 403
      })
    ).toBe('auth_required');
  });

  it('classifies cloudflare and captcha failures as blocked_waf', () => {
    expect(
      deriveFailureCategory({
        message: 'Attention required by Cloudflare captcha',
        status: 403
      })
    ).toBe('blocked_waf');
  });

  it('classifies request timeouts as timeout', () => {
    expect(
      deriveFailureCategory({
        error: 'AbortError: request timed out',
        status: 504
      })
    ).toBe('timeout');
  });

  it('classifies wp-json 404 responses as non_wordpress', () => {
    expect(
      deriveFailureCategory({
        message: 'GET /wp-json/ returned 404',
        status: 404
      })
    ).toBe('non_wordpress');
  });

  it('keeps metrics.heartbeat before proxy.response when pruning activity logs', async () => {
    await execute('delete from activity_logs');

    const oldTimestamp = '2026-05-01T00:00:00.000Z';
    await execute('insert into activity_logs (timestamp, type, payload_json) values (?, ?, ?)', [oldTimestamp, 'proxy.response', '{"ok":true}']);
    await execute('insert into activity_logs (timestamp, type, payload_json) values (?, ?, ?)', [oldTimestamp, 'metrics.heartbeat', '{"ok":true}']);

    const result = await pruneActivityLogs({ keepLatest: 1, olderThanDays: 21, nowMs: Date.parse('2026-06-30T00:00:00.000Z') });

    expect(result.prunedByAge + result.prunedByCount).toBeGreaterThan(0);

    const remaining = await queryAll('select type from activity_logs order by id asc');
    expect(remaining.map((row) => row.type)).toEqual(['metrics.heartbeat']);
  });
});
