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

export function buildActivityRetentionPlan(
  rows,
  {
    keepLatest = ACTIVITY_LOG_PRUNE_DEFAULTS.keepLatest,
    olderThanDays = ACTIVITY_LOG_PRUNE_DEFAULTS.olderThanDays,
    nowMs = Date.now()
  } = {}
) {
  const enrichedRows = rows.map((row) => {
    const rule = getEventRetentionRule(row.type, olderThanDays);
    const rowTime = Date.parse(row.timestamp);
    const ageDays = Number.isFinite(rowTime)
      ? (nowMs - rowTime) / (24 * 60 * 60 * 1000)
      : Number.POSITIVE_INFINITY;
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
