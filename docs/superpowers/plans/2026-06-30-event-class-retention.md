# Event-Class Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain high-value activity log classes longer than noisy ones without changing the Turso-backed logging model or surprising admins with premature evidence loss.

**Architecture:** Add a shared retention planner in `server/src/utils` that maps event types to retention windows and prune priority. Route pruning and log-rotation cleanup will both call the same planner so the admin endpoint and logger stay consistent. Keep the policy server-side against Turso rows; Netlify stays display-only.

**Tech Stack:** Express 5, Turso/libSQL, Jest, Supertest, Node ESM

---

## File Map

### Server - Create
- `server/src/utils/activityRetention.js` - shared retention rules, fallback behavior, and prune-plan builder.
- `server/src/__tests__/activityRetention.test.js` - unit coverage for rule lookup and class-aware pruning order.

### Server - Modify
- `server/src/logger.js` - export the prune helper and use it in `rotateLog()`.
- `server/src/index.js` - replace inline prune SQL with the shared helper.
- `server/src/__tests__/logger.test.js` - regression coverage for the shared prune helper used by logger cleanup.
- `server/src/index.test.js` - integration coverage for the admin prune endpoint.

---

### Task 1: Shared Retention Planner

**Files:**
- Create: `server/src/utils/activityRetention.js`
- Create: `server/src/__tests__/activityRetention.test.js`

- [ ] **Step 1: Write the failing test**

`server/src/__tests__/activityRetention.test.js`:

```js
process.env.NODE_ENV = 'test';

import { describe, it, expect } from '@jest/globals';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter wp-json-discovery-server run test -- src/__tests__/activityRetention.test.js`
Expected: FAIL because `server/src/utils/activityRetention.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

`server/src/utils/activityRetention.js`:

```js
import { ACTIVITY_LOG_PRUNE_DEFAULTS } from '../config.js';

const EVENT_RETENTION_RULES = {
  'proxy.response': { retentionDays: 7, priority: 0 },
  'scan.error': { retentionDays: 90, priority: 100 },
  'homepage-scan.error': { retentionDays: 90, priority: 100 },
  'sitemap.scan.error': { retentionDays: 90, priority: 100 },
  'proxy.error': { retentionDays: 90, priority: 100 },
  'metrics.heartbeat': { retentionDays: 90, priority: 100 }
};

export function getEventRetentionRule(type, fallbackDays = ACTIVITY_LOG_PRUNE_DEFAULTS.olderThanDays) {
  const key = String(type ?? '').trim();
  return EVENT_RETENTION_RULES[key] ?? {
    retentionDays: fallbackDays,
    priority: 50
  };
}

export function buildActivityRetentionPlan(rows, { keepLatest = ACTIVITY_LOG_PRUNE_DEFAULTS.keepLatest, olderThanDays = ACTIVITY_LOG_PRUNE_DEFAULTS.olderThanDays, nowMs = Date.now() } = {}) {
  const enrichedRows = rows.map((row) => {
    const rule = getEventRetentionRule(row.type, olderThanDays);
    const rowTime = Date.parse(row.timestamp);
    const ageDays = Number.isFinite(rowTime) ? (nowMs - rowTime) / (24 * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;
    return { ...row, rule, ageDays };
  });

  const agePrunedIds = enrichedRows
    .filter((row) => row.ageDays > row.rule.retentionDays)
    .map((row) => row.id);

  const survivors = enrichedRows
    .filter((row) => !agePrunedIds.includes(row.id))
    .sort((a, b) => a.rule.priority - b.rule.priority || Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id - b.id);

  const overLimit = Math.max(0, survivors.length - keepLatest);
  const countPrunedIds = survivors.slice(0, overLimit).map((row) => row.id);

  return {
    deleteIds: [...agePrunedIds, ...countPrunedIds],
    agePrunedIds,
    countPrunedIds,
    retainedIds: survivors.slice(overLimit).map((row) => row.id),
    keepLatest,
    olderThanDays
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter wp-json-discovery-server run test -- src/__tests__/activityRetention.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/activityRetention.js server/src/__tests__/activityRetention.test.js
git commit -m "feat: add activity retention planner"
```

---

### Task 2: Apply Policy to Pruning Paths

**Files:**
- Modify: `server/src/logger.js:759-779`
- Modify: `server/src/index.js:880-929`
- Modify: `server/src/__tests__/logger.test.js`
- Modify: `server/src/index.test.js`

- [ ] **Step 1: Write the failing tests**

`server/src/__tests__/logger.test.js`:

```js
process.env.NODE_ENV = 'test';

import { describe, it, expect } from '@jest/globals';
import { execute, queryAll } from '../db/client.js';
import { pruneActivityLogs } from '../logger.js';

describe('pruneActivityLogs', () => {
  it('keeps metrics.heartbeat before proxy.response when keepLatest trims', async () => {
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
```

`server/src/index.test.js`:

```js
it('retains higher-value activity classes when pruning', async () => {
  process.env.ADMIN_ENABLED = 'true';
  await getDb();

  const oldTimestamp = '2026-05-01T00:00:00.000Z';
  await execute('delete from activity_logs');
  await execute('insert into activity_logs (timestamp, type, payload_json) values (?, ?, ?)', [oldTimestamp, 'proxy.response', '{"url":"https://example.com"}']);
  await execute('insert into activity_logs (timestamp, type, payload_json) values (?, ?, ?)', [oldTimestamp, 'metrics.heartbeat', '{"ok":true}']);

  const res = await request(app)
    .post('/api/admin/activity/prune')
    .set(adminHeaders)
    .send({ keepLatest: 1, olderThanDays: 21 });

  expect(res.statusCode).toBe(200);

  const remaining = await queryAll('select type from activity_logs order by id asc');
  expect(remaining.map((row) => row.type)).toEqual(['metrics.heartbeat']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
`pnpm --filter wp-json-discovery-server run test -- src/__tests__/logger.test.js src/index.test.js`

Expected: FAIL because `pruneActivityLogs` and the class-aware prune path are not wired yet.

- [ ] **Step 3: Write minimal implementation**

`server/src/logger.js`:

```js
export async function pruneActivityLogs({ keepLatest = ACTIVITY_LOG_PRUNE_DEFAULTS.keepLatest, olderThanDays = ACTIVITY_LOG_PRUNE_DEFAULTS.olderThanDays, nowMs = Date.now() } = {}) {
  const rows = await queryAll('select id, timestamp, type from activity_logs order by timestamp asc, id asc');
  const { deleteIds, agePrunedIds, countPrunedIds, retainedIds } = buildActivityRetentionPlan(rows, { keepLatest, olderThanDays, nowMs });

  for (let index = 0; index < deleteIds.length; index += 500) {
    const batch = deleteIds.slice(index, index + 500);
    if (batch.length === 0) continue;
    await execute(`delete from activity_logs where id in (${batch.map(() => '?').join(', ')})`, batch);
  }

  return {
    prunedByAge: agePrunedIds.length,
    prunedByCount: countPrunedIds.length,
    remaining: retainedIds.length
  };
}

export async function rotateLog() {
  ...
  const archiveCleanup = await pruneActivityLogs({
    keepLatest: ACTIVITY_ARCHIVE_MAX_FILES,
    olderThanDays: ACTIVITY_ARCHIVE_RETENTION_DAYS
  });
  ...
}
```

`server/src/index.js`:

```js
import { logSilently, recordLog, rotateLog, pruneActivityLogs } from './logger.js';

app.post('/api/admin/activity/prune', wrapAsync(async (req, res) => {
  ...
  const result = await pruneActivityLogs({ keepLatest, olderThanDays });
  const prunedAt = new Date().toISOString();

  logSilently('activity.pruned', {
    prunedAt,
    prunedByAge: result.prunedByAge,
    prunedByCount: result.prunedByCount,
    remaining: result.remaining,
    params: { keepLatest, olderThanDays }
  });

  res.json({ ...result, prunedAt });
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
`pnpm --filter wp-json-discovery-server run test -- src/__tests__/logger.test.js src/index.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/logger.js server/src/index.js server/src/__tests__/logger.test.js server/src/index.test.js
git commit -m "feat: make activity retention class-aware"
```

---

### Task 3: Full Verification

**Files:**
- None

- [ ] **Step 1: Run the full server suite**

Run: `pnpm --filter wp-json-discovery-server run test`
Expected: PASS with all server suites green.

- [ ] **Step 2: Sanity-check the activity log snapshot after pruning**

Run:
`pnpm --filter wp-json-discovery-server run db:inspect`

Expected: prints the current activity log snapshot without error.

- [ ] **Step 3: Commit if any verification-only cleanup was needed**

```bash
git add -A
git commit -m "test: verify class-aware retention"
```

---

## Self-Review Checklist

- Spec coverage: the plan covers the shared policy helper, the prune route, and the logger rotation path.
- Placeholder scan: no TBD/TODO/implement later language remains.
- Type consistency: `getEventRetentionRule`, `buildActivityRetentionPlan`, and `pruneActivityLogs` are used consistently across tasks.
- Scope check: this stays inside the server-side retention subsystem and does not add frontend work.
