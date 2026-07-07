import { appendFile, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execute, queryAll, queryOne } from './db/client.js';
import { buildActivityRetentionPlan } from './utils/activityRetention.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const logFilePath = path.join(dataDir, 'activity.log');
const MAX_LOG_STRING_CHARS = 4000;
const MAX_LOG_SNIPPET_CHARS = 2000;
const MAX_LOG_ARRAY_ITEMS = 100;
const MAX_LOG_OBJECT_KEYS = 100;
const MAX_LOG_DEPTH = 6;
const SUMMARY_KEYS = new Set(['response', 'html', 'htmlPreview']);
const SUPPRESSION_WINDOW_MS = 10 * 60 * 1000;
const SUPPRESSION_SUMMARY_EVERY = 10;
const SUPPRESSION_TYPES = new Set([
  'scan.error',
  'proxy.error',
  'homepage-scan.error',
  'sitemap.scan.error'
]);
const HEARTBEAT_SCAN_INTERVAL = 10;
const HEARTBEAT_TOP_N = 5;
const ACTIVITY_ARCHIVE_RETENTION_DAYS = positiveIntegerFromEnv('ACTIVITY_LOG_ARCHIVE_RETENTION_DAYS', 21);
const ACTIVITY_ARCHIVE_MAX_FILES = positiveIntegerFromEnv('ACTIVITY_LOG_ARCHIVE_MAX_FILES', 30);
const suppressionState = new Map();
let heartbeatState = createHeartbeatState();
let heartbeatBootstrapped = false;
let heartbeatBootstrapPromise = null;

async function ensureLogFile() {
  try {
    await stat(dataDir);
  } catch {
    await mkdir(dataDir, { recursive: true });
  }

  try {
    await stat(logFilePath);
  } catch {
    await appendFile(logFilePath, '', 'utf-8');
  }
}

export async function recordLog(type, payload = {}) {
  if (!type || typeof type !== 'string') {
    throw new Error('Log type must be a non-empty string');
  }

  await ensureLogFile();

  const enrichedPayload = enrichPayload(type, payload);
  const sanitizedPayload = sanitizePayload(enrichedPayload);
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    payload: sanitizedPayload
  };

  const suppression = handleSuppression(entry);
  if (!suppression.emitPrimary) {
    if (suppression.summaryEntry) {
      await persistEntry(suppression.summaryEntry);
      await maybeEmitHeartbeat(suppression.summaryEntry);
    }
    return;
  }

  await persistEntry(entry);
  await maybeEmitHeartbeat(entry);
  if (suppression.summaryEntry) {
    await persistEntry(suppression.summaryEntry);
    await maybeEmitHeartbeat(suppression.summaryEntry);
  }
}

async function persistEntry(entry) {
  const serialized = JSON.stringify(entry);
  const filePromise = appendFile(logFilePath, `${serialized}\n`, 'utf-8');
  const dbPromise = writeToDb(entry);

  await Promise.allSettled([filePromise, dbPromise]);

  if (process.env.NODE_ENV !== 'test') {
    console.log('[log]', serialized);
  }
}

function enrichPayload(type, payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  if (!isErrorLikeType(type)) {
    return payload;
  }

  if (typeof payload.failureCategory === 'string' && payload.failureCategory.trim().length > 0) {
    return payload;
  }

  const failureCategory = deriveFailureCategory(payload);
  return {
    ...payload,
    failureCategory
  };
}

function createHeartbeatState(startedAt = new Date().toISOString()) {
  return {
    windowStartedAt: startedAt,
    windowEndedAt: startedAt,
    scanCompleted: 0,
    eventsSeen: 0,
    scanDurationsMs: [],
    errorByCategory: new Map(),
    failingDomains: new Map(),
    unsupportedNamespaces: new Map()
  };
}

async function maybeEmitHeartbeat(entry) {
  if (!entry || entry.type === 'metrics.heartbeat') {
    return;
  }

  await ensureHeartbeatBootstrapped(entry.timestamp);
  updateHeartbeatState(entry);
  if (entry.type !== 'scan.complete') {
    return;
  }

  if (heartbeatState.scanCompleted === 0 || heartbeatState.scanCompleted % HEARTBEAT_SCAN_INTERVAL !== 0) {
    return;
  }

  const summaryPayload = buildHeartbeatPayload();
  const heartbeatEntry = {
    timestamp: new Date().toISOString(),
    type: 'metrics.heartbeat',
    payload: sanitizePayload(summaryPayload)
  };

  await persistEntry(heartbeatEntry);
  heartbeatState = createHeartbeatState(entry.timestamp);
}

async function ensureHeartbeatBootstrapped(currentTimestamp) {
  if (heartbeatBootstrapped) {
    return;
  }

  if (!heartbeatBootstrapPromise) {
    heartbeatBootstrapPromise = bootstrapHeartbeatState(currentTimestamp)
      .catch((error) => {
        console.error('[heartbeat:bootstrap:error]', error.message);
        heartbeatState = createHeartbeatState(currentTimestamp);
      })
      .finally(() => {
        heartbeatBootstrapped = true;
      });
  }

  await heartbeatBootstrapPromise;
}

async function bootstrapHeartbeatState(currentTimestamp) {
  const latestHeartbeat = await queryOne(
    "select id, timestamp from activity_logs where type = 'metrics.heartbeat' order by id desc limit 1"
  );

  const lastHeartbeatId = latestHeartbeat?.id ?? 0;
  const windowStart = latestHeartbeat?.timestamp ?? currentTimestamp;
  heartbeatState = createHeartbeatState(windowStart);

  const rows = await queryAll(
    `
      select timestamp, type, payload_json
      from activity_logs
      where id > ?
        and timestamp < ?
        and type in (
          'scan.complete',
          'unsupported_plugins.upserted',
          'error.suppressed',
          'scan.error',
          'proxy.error',
          'homepage-scan.error',
          'homepage.scan.error',
          'sitemap.scan.error',
          'unhandled_error'
        )
      order by id asc
      limit 5000
    `,
    [lastHeartbeatId, currentTimestamp]
  );

  for (const row of rows) {
    updateHeartbeatState({
      timestamp: row.timestamp,
      type: row.type,
      payload: safeParsePayload(row.payload_json)
    });
  }
}

function updateHeartbeatState(entry) {
  const payload = entry.payload ?? {};
  heartbeatState.windowEndedAt = entry.timestamp;
  heartbeatState.eventsSeen += 1;

  if (entry.type === 'scan.complete') {
    heartbeatState.scanCompleted += 1;
    const duration = payload?.metrics?.durationMs;
    if (Number.isFinite(duration) && duration >= 0) {
      heartbeatState.scanDurationsMs.push(duration);
    }
  }

  if (isErrorLikeType(entry.type) && entry.type !== 'error.suppressed') {
    const category = normalizeFailureCategory(payload.failureCategory);
    incrementMapCounter(heartbeatState.errorByCategory, category, 1);
    const domain = normalizeDomain(payload.domain);
    if (domain) {
      incrementMapCounter(heartbeatState.failingDomains, domain, 1);
    }
  }

  if (entry.type === 'error.suppressed') {
    const domain = normalizeDomain(payload.domain);
    const category = normalizeFailureCategory(payload.failureCategory);
    const suppressedCount = Number(payload.suppressedCount);
    const incrementBy = Number.isFinite(suppressedCount) && suppressedCount > 0 ? suppressedCount : 0;
    if (incrementBy > 0) {
      incrementMapCounter(heartbeatState.errorByCategory, category, incrementBy);
      if (domain) {
        incrementMapCounter(heartbeatState.failingDomains, domain, incrementBy);
      }
    }
  }

  if (entry.type === 'unsupported_plugins.upserted') {
    const namespace = String(payload.namespace ?? '').trim();
    if (namespace) {
      incrementMapCounter(heartbeatState.unsupportedNamespaces, namespace, 1);
    }
  }
}

function buildHeartbeatPayload() {
  const scanDurations = heartbeatState.scanDurationsMs;
  const errorCategoryRows = topMapRows(heartbeatState.errorByCategory, 50);
  const totalErrors = errorCategoryRows.reduce((sum, row) => sum + row.count, 0);
  const scans = heartbeatState.scanCompleted;

  return {
    window: {
      startedAt: heartbeatState.windowStartedAt,
      endedAt: heartbeatState.windowEndedAt
    },
    scansCompleted: scans,
    eventsSeen: heartbeatState.eventsSeen,
    scanDurationMs: {
      min: percentile(scanDurations, 0),
      p50: percentile(scanDurations, 50),
      p95: percentile(scanDurations, 95),
      max: percentile(scanDurations, 100),
      avg: average(scanDurations)
    },
    errors: {
      total: totalErrors,
      perCategory: errorCategoryRows.map((row) => ({
        category: row.key,
        count: row.count,
        ratePerScan: scans > 0 ? round(row.count / scans, 3) : 0
      })),
      topFailingDomains: topMapRows(heartbeatState.failingDomains, HEARTBEAT_TOP_N).map((row) => ({
        domain: row.key,
        count: row.count
      }))
    },
    unsupportedPlugins: {
      topNamespaces: topMapRows(heartbeatState.unsupportedNamespaces, HEARTBEAT_TOP_N).map((row) => ({
        namespace: row.key,
        count: row.count
      }))
    }
  };
}

function isErrorLikeType(type) {
  return type.includes('error');
}

const WAF_MARKERS = [
  'cloudflare',
  'captcha',
  'you have been blocked',
  'attention required',
  'ray id',
  'mod_security',
  'modsecurity',
  'web application firewall',
  'waf',
  'request blocked',
  'blocked by security',
  'rate limit',
  'too many requests',
  'bot protection',
  'sucuri',
  'incapsula',
  'akamai'
];

const AUTH_403_MARKERS = [
  'auth',
  'unauthorized',
  'forbidden',
  'access denied',
  'permission denied',
  'login required',
  'credentials',
  'restricted'
];

const NETWORK_MARKERS = [
  'fetch failed',
  'failed to reach target domain',
  'failed to fetch homepage',
  'failed to fetch sitemap',
  'failed to fetch page details',
  'failed to fetch',
  'networkerror',
  'socket hang up',
  'enotfound',
  'eai_again',
  'econnrefused',
  'econnreset',
  'ehostunreach',
  'enetunreach',
  'etimedout',
  'getaddrinfo',
  'und_err_connect_timeout'
];

function includesAny(haystack, values) {
  return values.some((value) => haystack.includes(value));
}

function isAuth403(status, haystack) {
  return status === 403 && includesAny(haystack, AUTH_403_MARKERS);
}

export function deriveFailureCategory(payload = {}) {
  const message = `${payload.message ?? ''} ${payload.error ?? ''}`.toLowerCase();
  const detailsRaw = stringifyForCategory(payload.details);
  const details = detailsRaw.toLowerCase();
  const code = String(payload.code ?? '').toLowerCase();
  const name = String(payload.name ?? '').toLowerCase();
  const status = Number(payload.status ?? payload.statusCode);

  const haystack = `${message} ${details} ${code} ${name}`;

  if (haystack.includes('invalid domain')) return 'invalid_domain';
  if (haystack.includes('admin endpoints are disabled')) return 'admin_disabled';
  if (name.includes('payloadtoolargeerror') || haystack.includes('request entity too large')) return 'payload_too_large';
  if (code === 'auth_required') return 'auth_required';
  if (includesAny(haystack, WAF_MARKERS)) return 'blocked_waf';
  if (status === 401 || isAuth403(status, haystack)) return 'auth_required';
  if (includesAny(haystack, ['timed out', 'timeout', 'aborterror'])) return 'timeout';
  if (includesAny(haystack, NETWORK_MARKERS)) return 'network_failure';
  if (status === 404 && haystack.includes('/wp-json/')) return 'non_wordpress';
  if (haystack.includes('unexpected response from the wordpress api')) return 'non_wordpress';
  if (Number.isFinite(status) && status >= 500) return 'upstream_http_error';
  if (Number.isFinite(status) && status >= 400) return 'upstream_http_error';
  return 'unknown';
}

function normalizeFailureCategory(category) {
  const normalized = String(category ?? '').trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  if (normalized === 'dns_network_failure') {
    return 'network_failure';
  }

  return normalized;
}

function stringifyForCategory(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return String(value ?? '');
  }
}

function normalizeDomain(value) {
  const domain = String(value ?? '').trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

function incrementMapCounter(map, key, amount) {
  const current = map.get(key) ?? 0;
  map.set(key, current + amount);
}

function topMapRows(map, limit = HEARTBEAT_TOP_N) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[index];
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function safeParsePayload(raw) {
  if (typeof raw !== 'string') return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function handleSuppression(entry) {
  pruneSuppressionState(Date.parse(entry.timestamp) || Date.now());

  if (!SUPPRESSION_TYPES.has(entry.type)) {
    return { emitPrimary: true, summaryEntry: null };
  }

  const domain = String(entry.payload?.domain ?? '').trim().toLowerCase();
  const failureCategory = String(entry.payload?.failureCategory ?? '').trim().toLowerCase();
  if (!domain || !failureCategory) {
    return { emitPrimary: true, summaryEntry: null };
  }

  const now = Date.parse(entry.timestamp) || Date.now();
  const key = `${entry.type}:${domain}:${failureCategory}`;
  const state = suppressionState.get(key);

  if (!state) {
    suppressionState.set(key, {
      firstSeen: entry.timestamp,
      lastSeen: entry.timestamp,
      windowStartedAt: now,
      suppressedCount: 0,
      summarizedCount: 0
    });
    return { emitPrimary: true, summaryEntry: null };
  }

  if (now - state.windowStartedAt > SUPPRESSION_WINDOW_MS) {
    const summaryEntry = createSuppressionSummaryEntry({
      key,
      type: entry.type,
      domain,
      failureCategory,
      firstSeen: state.firstSeen,
      lastSeen: state.lastSeen,
      suppressedCount: state.suppressedCount - state.summarizedCount
    });
    suppressionState.set(key, {
      firstSeen: entry.timestamp,
      lastSeen: entry.timestamp,
      windowStartedAt: now,
      suppressedCount: 0,
      summarizedCount: 0
    });
    return { emitPrimary: true, summaryEntry };
  }

  state.lastSeen = entry.timestamp;
  state.suppressedCount += 1;

  if (state.suppressedCount - state.summarizedCount >= SUPPRESSION_SUMMARY_EVERY) {
    const batchCount = state.suppressedCount - state.summarizedCount;
    state.summarizedCount = state.suppressedCount;
    suppressionState.set(key, state);
    return {
      emitPrimary: false,
      summaryEntry: createSuppressionSummaryEntry({
        key,
        type: entry.type,
        domain,
        failureCategory,
        firstSeen: state.firstSeen,
        lastSeen: state.lastSeen,
        suppressedCount: batchCount
      })
    };
  }

  suppressionState.set(key, state);
  return { emitPrimary: false, summaryEntry: null };
}

function pruneSuppressionState(nowMs) {
  for (const [key, state] of suppressionState.entries()) {
    if (nowMs - state.windowStartedAt > SUPPRESSION_WINDOW_MS * 3) {
      suppressionState.delete(key);
    }
  }
}

function createSuppressionSummaryEntry({
  type,
  domain,
  failureCategory,
  firstSeen,
  lastSeen,
  suppressedCount
}) {
  if (suppressedCount <= 0) {
    return null;
  }

  return {
    timestamp: new Date().toISOString(),
    type: 'error.suppressed',
    payload: sanitizePayload({
      sourceType: type,
      domain,
      failureCategory,
      suppressedCount,
      firstSeen,
      lastSeen,
      windowMs: SUPPRESSION_WINDOW_MS
    })
  };
}

function sanitizePayload(payload) {
  const meta = {
    truncated: [],
    summarized: [],
    scriptStripped: []
  };
  const sanitized = sanitizeValue(payload, {
    path: 'payload',
    depth: 0,
    key: null,
    meta
  });

  if (!hasMetaEvents(meta)) {
    return sanitized;
  }

  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return {
      ...sanitized,
      _logSanitizer: compactMeta(meta)
    };
  }

  return {
    value: sanitized,
    _logSanitizer: compactMeta(meta)
  };
}

function sanitizeValue(value, context) {
  const { path, depth, key, meta } = context;

  if (value === null || value === undefined) {
    return value;
  }

  if (depth > MAX_LOG_DEPTH) {
    meta.truncated.push({ path, reason: 'max_depth' });
    return '[truncated:max_depth]';
  }

  if (typeof value === 'string') {
    if (key && SUMMARY_KEYS.has(key.toLowerCase())) {
      return summarizeLargeText(value, { path, meta });
    }
    return sanitizeString(value, { path, meta });
  }

  if (Array.isArray(value)) {
    const limit = Math.min(value.length, MAX_LOG_ARRAY_ITEMS);
    const items = value
      .slice(0, limit)
      .map((item, index) => sanitizeValue(item, {
        path: `${path}[${index}]`,
        depth: depth + 1,
        key: null,
        meta
      }));
    if (value.length > MAX_LOG_ARRAY_ITEMS) {
      meta.truncated.push({
        path,
        reason: 'array_items',
        originalLength: value.length,
        kept: MAX_LOG_ARRAY_ITEMS
      });
    }
    return items;
  }

  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString();
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return String(value);
    }

    const entries = Object.entries(value);
    const limited = entries.slice(0, MAX_LOG_OBJECT_KEYS);
    const next = {};
    for (const [entryKey, entryValue] of limited) {
      next[entryKey] = sanitizeValue(entryValue, {
        path: `${path}.${entryKey}`,
        depth: depth + 1,
        key: entryKey,
        meta
      });
    }
    if (entries.length > MAX_LOG_OBJECT_KEYS) {
      meta.truncated.push({
        path,
        reason: 'object_keys',
        originalLength: entries.length,
        kept: MAX_LOG_OBJECT_KEYS
      });
    }
    return next;
  }

  return value;
}

function sanitizeString(input, { path, meta }) {
  const stripped = stripScriptTags(input);
  let value = stripped.text;

  if (stripped.changed) {
    meta.scriptStripped.push({ path, removed: stripped.removed });
  }

  if (value.length > MAX_LOG_STRING_CHARS) {
    meta.truncated.push({
      path,
      reason: 'string_length',
      originalLength: value.length,
      kept: MAX_LOG_STRING_CHARS
    });
    value = `${value.slice(0, MAX_LOG_STRING_CHARS)}...[truncated]`;
  }

  return value;
}

function summarizeLargeText(input, { path, meta }) {
  const stripped = stripScriptTags(input);
  const normalized = stripped.text;
  const truncated = normalized.length > MAX_LOG_SNIPPET_CHARS;
  const snippet = truncated
    ? `${normalized.slice(0, MAX_LOG_SNIPPET_CHARS)}...[truncated]`
    : normalized;

  meta.summarized.push({
    path,
    originalLength: input.length,
    kept: snippet.length
  });
  if (stripped.changed) {
    meta.scriptStripped.push({ path, removed: stripped.removed });
  }

  return {
    snippet,
    sha256: createHash('sha256').update(normalized).digest('hex'),
    originalLength: input.length,
    truncated
  };
}

function stripScriptTags(input) {
  const pattern = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let removed = 0;
  const text = input.replace(pattern, () => {
    removed += 1;
    return '[script omitted]';
  });
  return {
    text,
    removed,
    changed: removed > 0
  };
}

function hasMetaEvents(meta) {
  return meta.truncated.length > 0 || meta.summarized.length > 0 || meta.scriptStripped.length > 0;
}

function compactMeta(meta) {
  const next = {};
  if (meta.truncated.length > 0) next.truncated = meta.truncated;
  if (meta.summarized.length > 0) next.summarized = meta.summarized;
  if (meta.scriptStripped.length > 0) next.scriptStripped = meta.scriptStripped;
  return next;
}

async function writeToDb(entry) {
  try {
    const storedPayload = compactPayloadForStorage(entry);
    await execute(
      `
      insert into activity_logs (timestamp, type, payload_json)
      values (?, ?, ?)
    `,
      [entry.timestamp, entry.type, JSON.stringify(storedPayload)]
    );
    await persistScanHistoryFromLog(entry);
  } catch (error) {
    console.error('[log:db:error]', error.message);
  }
}

export function logSilently(type, payload = {}) {
  recordLog(type, payload).catch((error) => {
    console.error('[log:error]', error.message);
  });
}

export async function rotateLog() {
  await ensureLogFile();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `activity-${timestamp}.log`;
  const archivePath = path.join(dataDir, archiveName);

  await rename(logFilePath, archivePath);
  await appendFile(logFilePath, '', 'utf-8');
  const archiveCleanup = await pruneArchivedLogs({
    keepLatest: ACTIVITY_ARCHIVE_MAX_FILES,
    olderThanDays: ACTIVITY_ARCHIVE_RETENTION_DAYS
  });

  const retentionCleanup = await pruneActivityLogs();
  const rowsCleared = retentionCleanup.prunedByAge + retentionCleanup.prunedByCount;

  return {
    archivePath,
    archiveName,
    rowsCleared,
    archiveCleanup
  };
}

export async function pruneActivityLogs({
  keepLatest = 500,
  olderThanDays = 21,
  nowMs = Date.now()
} = {}) {
  const rows = await queryAll(
    'select id, timestamp, type from activity_logs order by timestamp asc, id asc'
  );

  const { deleteIds, agePrunedIds, countPrunedIds, retainedIds } = buildActivityRetentionPlan(rows, {
    keepLatest,
    olderThanDays,
    nowMs
  });

  for (let index = 0; index < deleteIds.length; index += 500) {
    const batch = deleteIds.slice(index, index + 500);
    if (batch.length === 0) continue;

    const placeholders = batch.map(() => '?').join(', ');
    await execute(`delete from activity_logs where id in (${placeholders})`, batch);
  }

  return {
    prunedByAge: agePrunedIds.length,
    prunedByCount: countPrunedIds.length,
    remaining: retainedIds.length
  };
}

function compactPayloadForStorage(entry) {
  const payload = entry?.payload ?? {};
  if (entry?.type !== 'scan.complete') {
    return payload;
  }

  const unsupportedNamespaces = Array.isArray(payload.unsupportedNamespaces)
    ? payload.unsupportedNamespaces
    : [];
  const matchedPlugins = Array.isArray(payload.matchedPlugins)
    ? payload.matchedPlugins
    : [];

  return {
    domain: payload.domain ?? null,
    failureCategory: payload.failureCategory ?? null,
    message: payload.message ?? null,
    metrics: payload.metrics ?? null,
    snapshotBytes: safeSerializedBytes(payload),
    snapshot: {
      domain: payload.domain ?? null,
      metrics: payload.metrics ?? null,
      coreSummary: Array.isArray(payload.coreSummary) ? payload.coreSummary : [],
      unsupportedNamespaces: unsupportedNamespaces.slice(0, 50),
      matchedPlugins: matchedPlugins.slice(0, 25).map((plugin) => ({
        id: plugin?.id ?? null,
        label: plugin?.label ?? null,
        namespaceCount: Array.isArray(plugin?.matchedNamespaces) ? plugin.matchedNamespaces.length : 0
      })),
      notes: {
        unsupportedNamespacesTruncated: unsupportedNamespaces.length > 50,
        matchedPluginsTruncated: matchedPlugins.length > 25
      }
    }
  };
}

function safeSerializedBytes(value) {
  try {
    return JSON.stringify(value ?? {}).length;
  } catch {
    return null;
  }
}

async function pruneArchivedLogs({ keepLatest, olderThanDays }) {
  const entries = await readdir(dataDir, { withFileTypes: true });
  const now = Date.now();
  const cutoffMs = olderThanDays > 0
    ? now - olderThanDays * 24 * 60 * 60 * 1000
    : null;

  const archives = await Promise.all(entries
    .filter((entry) => entry.isFile() && /^activity-.*\.log$/i.test(entry.name))
    .map(async (entry) => {
      const filePath = path.join(dataDir, entry.name);
      const details = await stat(filePath);
      return {
        name: entry.name,
        path: filePath,
        mtimeMs: details.mtimeMs
      };
    }));

  archives.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const keepCount = Number.isFinite(keepLatest) && keepLatest > 0 ? keepLatest : Number.POSITIVE_INFINITY;

  const toDelete = archives.filter((archive, index) => {
    const oldByCount = index >= keepCount;
    const oldByAge = Number.isFinite(cutoffMs) ? archive.mtimeMs < cutoffMs : false;
    return oldByCount || oldByAge;
  });

  await Promise.all(toDelete.map((archive) => unlink(archive.path).catch(() => null)));

  return {
    inspected: archives.length,
    deleted: toDelete.length,
    keepLatest: Number.isFinite(keepCount) ? keepCount : null,
    olderThanDays: Number.isFinite(cutoffMs) ? olderThanDays : null
  };
}

function positiveIntegerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

async function persistScanHistoryFromLog(entry) {
  if (!entry || (entry.type !== 'scan.complete' && entry.type !== 'scan.error')) {
    return;
  }

  const payload = entry.payload ?? {};
  const domain = normalizeDomain(payload.domain);
  if (!domain) {
    return;
  }

  const scannedAt = entry.timestamp ?? new Date().toISOString();
  const status = entry.type === 'scan.complete' ? 'success' : 'failed';
  const durationMs = Number.isFinite(payload?.metrics?.durationMs)
    ? payload.metrics.durationMs
    : null;
  const unsupportedCount = Array.isArray(payload.unsupportedNamespaces)
    ? payload.unsupportedNamespaces.length
    : 0;
  const errorCategory =
    typeof payload.failureCategory === 'string' && payload.failureCategory.trim().length > 0
      ? payload.failureCategory.trim()
      : null;
  const errorMessage =
    typeof payload.message === 'string' && payload.message.trim().length > 0
      ? payload.message.trim()
      : null;
  const userId = typeof payload.userId === 'string' ? payload.userId : null;

  const summary = {
    metrics: payload.metrics ?? null,
    unsupportedNamespaces: payload.unsupportedNamespaces ?? [],
    matchedPlugins: payload.matchedPlugins ?? [],
    coreSummary: payload.coreSummary ?? []
  };

  const existing = await queryOne('select domain from scan_domains where domain = ?', [domain]);
  if (!existing) {
    await execute(
      `
        insert into scan_domains (
          domain,
          first_scanned_at,
          last_scanned_at,
          last_status,
          last_duration_ms,
          last_error_category,
          last_unsupported_count
        )
        values (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        domain,
        scannedAt,
        scannedAt,
        status,
        durationMs,
        errorCategory,
        unsupportedCount
      ]
    );
  }
  if (existing) {
    await execute(
      `
        update scan_domains
        set
          last_scanned_at = ?,
          last_status = ?,
          last_duration_ms = ?,
          last_error_category = ?,
          last_unsupported_count = ?
        where domain = ?
      `,
      [
        scannedAt,
        status,
        durationMs,
        errorCategory,
        unsupportedCount,
        domain
      ]
    );
  }

  await execute(
    `
      insert into scan_runs (
        domain,
        scanned_at,
        status,
        duration_ms,
        unsupported_count,
        error_category,
        error_message,
        summary_json,
        user_id
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      domain,
      scannedAt,
      status,
      durationMs,
      unsupportedCount,
      errorCategory,
      errorMessage,
      JSON.stringify(summary),
      userId
    ]
  );
}
