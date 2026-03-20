import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseSitemap, fetchPageDetails, fetchSitemap, fetchAndParseSitemap, fetchAndProcessPageDetails } from './sitemap.js';
import { logSilently, recordLog, rotateLog } from './logger.js';
import { loadEnvFile } from './utils/env.js';
import { sanitizeDomain } from './utils/domain.js';
import { fetchWithRedirects } from './utils/fetch.js';
import { readBodyWithLimit } from './utils/http.js';
import { extractHomepageInsights } from './utils/html.js';
import { readUnsupportedPlugins, upsertUnsupportedPluginRecord } from './utils/plugins.js';
import { AppError, NetworkError, ValidationError } from './utils/errors.js';
import { REQUEST_TIMEOUT_MS, HOMEPAGE_HTML_CAP_BYTES, DEFAULT_USER_AGENT, MAX_SITEMAP_PAGES, FRONTEND_ORIGIN_DEFAULT, EXPOSED_HEADERS_LIST, FORWARDED_RESPONSE_HEADERS_LIST, ACTIVITY_LOG_PRUNE_DEFAULTS } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { wrapAsync } from './utils/route.js';
import { execute, getDb, queryAll, queryOne } from './db/client.js';
import {
  assertPluginRegistryReady,
  loadPlugins,
  loadCoreNamespaces,
  loadThemes,
  savePlugins,
  saveThemes,
  validatePlugin,
  validateTheme,
  sortPlugins,
  sortThemes
} from './utils/pluginRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, '..', '.env'));

const app = express();
const PORT = process.env.PORT ?? 4100;

const EXPOSED_HEADERS = EXPOSED_HEADERS_LIST;

const FORWARDED_RESPONSE_HEADERS = FORWARDED_RESPONSE_HEADERS_LIST;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? FRONTEND_ORIGIN_DEFAULT;
app.use(cors({ origin: FRONTEND_ORIGIN, exposedHeaders: EXPOSED_HEADERS }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const PROXY_CACHE_TTL_MS = 10 * 60 * 1000;
const PROXY_CACHE_MAX_ENTRIES = 200;
const PROXY_CACHE_MAX_PAYLOAD_BYTES = 750 * 1024;
const proxyCache = new Map();

app.use('/api', apiRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/proxy', wrapAsync(async (req, res) => {
  const { domain, endpoint = '/wp-json/' } = req.query;

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    throw new ValidationError('domain query parameter is required');
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    throw new ValidationError('Invalid domain provided');
  }

  let targetUrl;
  let normalizedEndpoint;

  try {
    normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    targetUrl = new URL(normalizedEndpoint, `https://${sanitizedDomain}`).toString();
  } catch (error) {
    throw new ValidationError(`Invalid endpoint path: ${error.message}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const cacheKey = `${sanitizedDomain}${normalizedEndpoint}`;
    const cached = readProxyCache(cacheKey);
    if (cached) {
      logSilently('proxy.cache_hit', {
        domain: sanitizedDomain,
        endpoint: normalizedEndpoint,
        status: cached.status,
        contentType: cached.contentType,
        bytes: cached.payload.length,
        cachedAt: cached.cachedAt
      });

      res.status(cached.status);
      res.set('x-wpjd-cache', 'HIT');
      res.set('x-wpjd-upstream-status', String(cached.status));
      res.set('x-wpjd-upstream-duration', String(cached.durationMs));
      res.set('x-wpjd-final-url', cached.finalUrl ?? targetUrl);
      res.set('x-wpjd-redirects', String(cached.redirects ?? 0));
      FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
        const value = cached.forwardedHeaders?.[headerName];
        if (value) {
          res.set(headerName, value);
        }
      });
      res.set('content-type', cached.contentType);
      res.send(cached.payload);
      return;
    }

    const { response, finalUrl, redirects } = await fetchWithRedirects(targetUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_USER_AGENT
      }
    });

    const contentType = response.headers.get('content-type') ?? 'application/json';
    const payload = await response.text();
    const durationMs = Date.now() - startedAt;

    logSilently('proxy.response', {
      domain: sanitizedDomain,
      endpoint: normalizedEndpoint,
      targetUrl,
      finalUrl,
      status: response.status,
      redirects,
      durationMs,
      contentType,
      bytes: payload.length
    });

    res.status(response.status);
    res.set('x-wpjd-upstream-status', String(response.status));
    res.set('x-wpjd-upstream-duration', String(durationMs));
    res.set('x-wpjd-final-url', finalUrl ?? targetUrl);
    res.set('x-wpjd-redirects', String(redirects ?? 0));
    res.set('x-wpjd-cache', 'MISS');
    FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
      const value = response.headers.get(headerName);
      if (value !== null) {
        res.set(headerName, value);
      }
    });
    res.set('content-type', contentType);

    maybeWriteProxyCache({
      cacheKey,
      endpoint: normalizedEndpoint,
      status: response.status,
      contentType,
      payload,
      finalUrl: finalUrl ?? targetUrl,
      redirects,
      durationMs,
      responseHeaders: response.headers
    });

    res.send(payload);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logSilently('proxy.error', {
      domain: sanitizedDomain,
      endpoint: normalizedEndpoint ?? endpoint,
      targetUrl,
      durationMs,
      error: error.message
    });

    if (error.name === 'AbortError') {
      throw new NetworkError('Request to target domain timed out', 504);
    } else {
      throw new NetworkError(`Failed to reach target domain: ${error.message}`, 502);
    }
  } finally {
    clearTimeout(timeout);
  }
}));

function readProxyCache(key) {
  const now = Date.now();
  const entry = proxyCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    proxyCache.delete(key);
    return null;
  }
  return entry;
}

function maybeWriteProxyCache({
  cacheKey,
  endpoint,
  status,
  contentType,
  payload,
  finalUrl,
  redirects,
  durationMs,
  responseHeaders
}) {
  if (endpoint !== '/wp-json/') return;
  if (status !== 200) return;
  if (typeof payload !== 'string' || payload.length === 0) return;
  if (payload.length > PROXY_CACHE_MAX_PAYLOAD_BYTES) return;

  const forwardedHeaders = {};
  FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
    const value = responseHeaders.get(headerName);
    if (value !== null) {
      forwardedHeaders[headerName] = value;
    }
  });

  proxyCache.set(cacheKey, {
    status,
    contentType,
    payload,
    finalUrl,
    redirects,
    durationMs,
    forwardedHeaders,
    cachedAt: new Date().toISOString(),
    expiresAt: Date.now() + PROXY_CACHE_TTL_MS
  });

  if (proxyCache.size > PROXY_CACHE_MAX_ENTRIES) {
    const oldestKey = proxyCache.keys().next().value;
    if (oldestKey) {
      proxyCache.delete(oldestKey);
    }
  }
}

app.get('/api/unsupported-plugins', wrapAsync(async (_req, res) => {
  try {
    const plugins = await readUnsupportedPlugins();
    res.json(plugins);
  } catch (error) {
    logSilently('unsupported_plugins.read_error', {
      message: error.message
    });
    const pluginsError = new AppError('Failed to read unsupported plugins list', 500);
    throw pluginsError;
  }
}));

app.post('/api/unsupported-plugins', wrapAsync(async (req, res) => {
  const { namespace, domain } = req.body ?? {};

  if (typeof namespace !== 'string' || namespace.trim().length === 0) {
    throw new ValidationError('namespace is required');
  }

  const sanitizedNamespace = namespace.trim();
  const sanitizedDomain = typeof domain === 'string' ? sanitizeDomain(domain) : null;

  try {
    const { mode, domainsTracked } = await upsertUnsupportedPluginRecord({
      namespace: sanitizedNamespace,
      domain: sanitizedDomain
    });

    res.status(mode === 'insert' ? 201 : 200).json({ namespace: sanitizedNamespace });

    logSilently('unsupported_plugins.upserted', {
      namespace: sanitizedNamespace,
      domain: sanitizedDomain,
      mode,
      domainsTracked
    });
  } catch (error) {
    const saveError = new AppError('Failed to save unsupported plugin', 500);
    throw saveError;
  }
}));

app.post('/api/logs', wrapAsync(async (req, res) => {
  const { type, payload } = req.body ?? {};

  if (typeof type !== 'string' || type.trim().length === 0) {
    throw new ValidationError('type is required for log events');
  }

  try {
    await recordLog(type.trim(), payload ?? {});
    res.status(202).json({ acknowledged: true });
  } catch (error) {
    const logError = new AppError('Failed to record log entry', 500);
    throw logError;
  }
}));

app.get('/api/registry/plugins', wrapAsync(async (_req, res) => {
  const plugins = await loadPlugins();
  const coreNamespaces = await loadCoreNamespaces();
  res.json({
    plugins,
    coreNamespaces
  });
}));

app.get('/api/scan-history', wrapAsync(async (req, res) => {
  const includeFailed = parseBooleanQuery(req.query.includeFailed, false);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
  const limitRaw = Number.parseInt(req.query.limit ?? '50', 10);
  const offsetRaw = Number.parseInt(req.query.offset ?? '0', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const whereClauses = [];
  const args = [];

  if (!includeFailed) {
    whereClauses.push('last_status != ?');
    args.push('failed');
  }

  if (q.length > 0) {
    whereClauses.push('lower(domain) like ?');
    args.push(`%${q}%`);
  }

  const whereSql = whereClauses.length ? `where ${whereClauses.join(' and ')}` : '';
  const orderSql =
    sort === 'domain'
      ? 'order by domain asc'
      : sort === 'duration'
        ? 'order by coalesce(last_duration_ms, 0) desc, last_scanned_at desc'
        : 'order by last_scanned_at desc';

  const totalRow = await queryOne(
    `select count(1) as count from scan_domains ${whereSql}`,
    args
  );

  const rows = await queryAll(
    `
      select
        domain,
        first_scanned_at,
        last_scanned_at,
        last_status,
        last_duration_ms,
        last_error_category,
        last_unsupported_count
      from scan_domains
      ${whereSql}
      ${orderSql}
      limit ? offset ?
    `,
    [...args, limit, offset]
  );

  res.json({
    items: rows.map((row) => ({
      domain: row.domain,
      firstScannedAt: row.first_scanned_at,
      lastScannedAt: row.last_scanned_at,
      lastStatus: row.last_status,
      lastDurationMs: row.last_duration_ms,
      lastErrorCategory: row.last_error_category,
      lastUnsupportedCount: row.last_unsupported_count
    })),
    pagination: {
      total: Number(totalRow?.count ?? 0),
      limit,
      offset
    },
    filters: {
      includeFailed,
      q,
      sort
    }
  });
}));

app.get('/api/scan-history/:domain', wrapAsync(async (req, res) => {
  const domain = sanitizeDomain(req.params.domain ?? '');
  if (!domain) {
    throw new ValidationError('Invalid domain provided');
  }

  const includeFailed = parseBooleanQuery(req.query.includeFailed, false);
  const limitRaw = Number.parseInt(req.query.limit ?? '25', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 25;

  const domainRow = await queryOne(
    `
      select
        domain,
        first_scanned_at,
        last_scanned_at,
        last_status,
        last_duration_ms,
        last_error_category,
        last_unsupported_count
      from scan_domains
      where domain = ?
      limit 1
    `,
    [domain]
  );

  if (!domainRow) {
    throw new AppError('No scan history found for this domain', 404);
  }

  const runs = await queryAll(
    `
      select
        id,
        scanned_at,
        status,
        duration_ms,
        unsupported_count,
        error_category,
        error_message,
        summary_json
      from scan_runs
      where domain = ?
        ${includeFailed ? '' : 'and status != ?'}
      order by scanned_at desc
      limit ?
    `,
    includeFailed ? [domain, limit] : [domain, 'failed', limit]
  );

  res.json({
    domain: {
      domain: domainRow.domain,
      firstScannedAt: domainRow.first_scanned_at,
      lastScannedAt: domainRow.last_scanned_at,
      lastStatus: domainRow.last_status,
      lastDurationMs: domainRow.last_duration_ms,
      lastErrorCategory: domainRow.last_error_category,
      lastUnsupportedCount: domainRow.last_unsupported_count
    },
    runs: runs.map((run) => ({
      id: run.id,
      scannedAt: run.scanned_at,
      status: run.status,
      durationMs: run.duration_ms,
      unsupportedCount: run.unsupported_count,
      errorCategory: run.error_category,
      errorMessage: run.error_message,
      summary: safeParseJson(run.summary_json)
    })),
    filters: {
      includeFailed
    }
  });
}));

app.post('/api/sitemap-scan', wrapAsync(async (req, res) => {
  const { domain, sitemapUrl, maxPages = MAX_SITEMAP_PAGES } = req.body ?? {};

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    throw new ValidationError('domain is required');
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    throw new ValidationError('Invalid domain provided');
  }

  const startedAt = Date.now();
  const parsedPageLimit = Number.parseInt(maxPages, 10);
  const pageLimit = Number.isFinite(parsedPageLimit) && parsedPageLimit > 0
    ? Math.min(parsedPageLimit, MAX_SITEMAP_PAGES)
    : MAX_SITEMAP_PAGES;

  const resolvedSitemapUrl = sitemapUrl
    ? sitemapUrl
    : `https://${sanitizedDomain}/sitemap.xml`;

  const { sitemapSummaries, seenPages } = await fetchAndParseSitemap(resolvedSitemapUrl, pageLimit);
  const pages = await fetchAndProcessPageDetails(Array.from(seenPages).slice(0, pageLimit), sanitizedDomain);

  const completedAt = Date.now();
  const invalidSchemaCount = pages.filter((p) => p.flags.includes('schema_invalid')).length;
  const noindexCount = pages.filter((p) => p.flags.includes('noindex')).length;

  res.json({
    domain: sanitizedDomain,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    durationMs: completedAt - startedAt,
    sitemap: {
      root: resolvedSitemapUrl,
      sitemaps: sitemapSummaries
    },
    pages,
    totals: {
      pagesScanned: pages.length,
      invalidSchema: invalidSchemaCount,
      noindex: noindexCount
    }
  });
}));

app.post('/api/homepage-scan', wrapAsync(async (req, res) => {
  const { domain } = req.body ?? {};

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    throw new ValidationError('domain is required');
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    throw new ValidationError('Invalid domain provided');
  }

  const targetUrl = `https://${sanitizedDomain}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const { response, finalUrl, redirects } = await fetchWithRedirects(
      targetUrl,
      {
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                    'user-agent': DEFAULT_USER_AGENT
        }
      }
    );

    const durationMs = Date.now() - startedAt;
    const contentType = response.headers.get('content-type') ?? '';
    const { body: html, size, truncated } = await readBodyWithLimit(
      response,
      HOMEPAGE_HTML_CAP_BYTES
    );

    const insights = await extractHomepageInsights(html);
    const assetsForLog = insights.assets
      .map(({ path, type, count, slug, matches = [] }) => ({
        path,
        type,
        count,
        slug,
        matches: matches.map((match) => ({
          id: match.id,
          label: match.label,
          type: match.type,
          slug: match.slug
        }))
      }));
    const unknownAssets = assetsForLog.filter((asset) => (asset.matches?.length ?? 0) === 0);
    const source = {
      statusCode: response.status,
      finalUrl: finalUrl ?? targetUrl,
      contentType,
      sizeBytes: size,
      durationMs,
      redirects,
      truncated,
      ok: response.ok
    };

    logSilently('homepage-scan', {
      domain: sanitizedDomain,
      targetUrl,
      finalUrl: source.finalUrl,
      durationMs,
      status: response.status,
      redirects,
      sizeBytes: size,
      truncated,
      metaCount: insights.meta.length,
      commentCount: insights.comments.length,
      scriptCount: insights.scripts.length,
      assetPaths: insights.assets.length,
      assets: assetsForLog,
      unknownAssets,
      frameworks: insights.frameworks,
      htmlPreviewLength: html.slice(0, 2000).length,
      capBytes: HOMEPAGE_HTML_CAP_BYTES
    });

    res.status(response.ok ? 200 : response.status).json({
      domain: sanitizedDomain,
      source,
      insights,
      htmlPreview: html.slice(0, 2000)
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logSilently('homepage-scan.error', {
      domain: sanitizedDomain,
      targetUrl,
      durationMs,
      message: error.message
    });

    if (error.name === 'AbortError') {
      throw new NetworkError('Homepage request timed out', 504);
    } else {
      throw new NetworkError(`Failed to fetch homepage: ${error.message}`, 502);
    }
  } finally {
    clearTimeout(timeout);
  }
}));

app.post('/api/logs/rotate', wrapAsync(async (_req, res) => {
  try {
    const { archiveName, rowsCleared } = await rotateLog();
    const rotatedAt = new Date().toISOString();
    logSilently('logs.rotated', { archive: archiveName, rowsCleared, rotatedAt });
    res.json({ filename: archiveName, rowsCleared, rotatedAt });
  } catch (error) {
    logSilently('logs.rotate_error', { message: error.message });
    const rotateError = new AppError('Failed to rotate activity log', 500);
    throw rotateError;
  }
}));

app.get('/api/admin/db-snapshot', wrapAsync(async (req, res) => {
  const limitRaw = Number.parseInt(req.query.limit ?? '50', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const db = await getDb();

  const [unsupportedPluginsTotal, unsupportedDomainsTotal, activityLogsTotal] = await Promise.all([
    queryOne('select count(1) as count from unsupported_plugins'),
    queryOne('select count(1) as count from unsupported_plugin_domains'),
    queryOne('select count(1) as count from activity_logs')
  ]);

  const totals = {
    unsupportedPlugins: Number(unsupportedPluginsTotal?.count ?? 0),
    unsupportedPluginDomains: Number(unsupportedDomainsTotal?.count ?? 0),
    activityLogs: Number(activityLogsTotal?.count ?? 0)
  };

  const activityLogs = (await queryAll(
    'select id, timestamp, type, payload_json from activity_logs order by id desc limit ?',
    [limit]
  )).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    payload: safeParseJson(row.payload_json)
  }));

  const heartbeatLogs = (await queryAll(
    `
      select id, timestamp, type, payload_json
      from activity_logs
      where type = 'metrics.heartbeat'
      order by id desc
      limit 10
    `
  )).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    payload: safeParseJson(row.payload_json)
  }));

  const unsupportedPlugins = await readUnsupportedPlugins();

  const dbUrl = db.__meta?.url ?? process.env.TURSO_DATABASE_URL ?? 'unknown';
  const files = await collectStorageStats(dbUrl, db.__meta?.isRemote !== false);
  const homepageAssets = aggregateHomepageAssets(activityLogs);
  const logs = await summarizeLogTimestamps(files);

  res.json({
    dbPath: dbUrl,
    totals,
    unsupportedPlugins,
    activityLogs,
    heartbeat: {
      latest: heartbeatLogs[0] ?? null,
      recent: heartbeatLogs
    },
    files,
    homepageAssets,
    logs
  });
}));

app.post('/api/admin/db/maintenance', wrapAsync(async (_req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const db = await getDb();

  let integrity = { ok: false, status: null, error: null };
  let vacuumRan = false;
  let walCheckpoint = {
    skipped: true,
    reason: 'not_applicable_for_turso'
  };
  const maintenanceAt = new Date().toISOString();

  try {
    await queryOne('select 1 as ok');
    integrity = {
      ok: true,
      status: 'ok',
      error: null
    };
  } catch (error) {
    integrity = {
      ok: false,
      status: 'error',
      error: error.message
    };
  }

  logSilently('db.maintenance', {
    maintenanceAt,
    walCheckpoint,
    integrity,
    vacuumRan,
    size: null,
    mode: db.__meta?.isRemote !== false ? 'turso' : 'local'
  });

  res.json({
    walCheckpoint,
    integrity,
    vacuumRan,
    maintenanceAt,
    size: null,
    mode: db.__meta?.isRemote !== false ? 'turso' : 'local'
  });
}));

app.post('/api/admin/activity/prune', wrapAsync(async (req, res) => {
  const {
    keepLatest = ACTIVITY_LOG_PRUNE_DEFAULTS.keepLatest,
    olderThanDays = ACTIVITY_LOG_PRUNE_DEFAULTS.olderThanDays
  } = req.body ?? {};

  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  let prunedByAge = 0;
  let prunedByCount = 0;

  if (Number.isFinite(olderThanDays) && olderThanDays > 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const result = await execute('delete from activity_logs where timestamp < ?', [cutoff]);
    prunedByAge = result?.rowsAffected ?? 0;
  }

  if (Number.isFinite(keepLatest) && keepLatest > 0) {
    const result = await execute(
      `
        delete from activity_logs
        where id not in (
          select id from activity_logs order by id desc limit ?
        )
      `,
      [keepLatest]
    );
    prunedByCount = result?.rowsAffected ?? 0;
  }

  const totals = Number((await queryOne('select count(1) as count from activity_logs'))?.count ?? 0);
  const prunedAt = new Date().toISOString();

  logSilently('activity.pruned', {
    prunedAt,
    prunedByAge,
    prunedByCount,
    remaining: totals,
    params: { keepLatest, olderThanDays }
  });

  res.json({
    prunedByAge,
    prunedByCount,
    prunedAt,
    remaining: totals
  });
}));

app.get('/api/admin/plugins', wrapAsync(async (_req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const plugins = await loadPlugins();
  res.json({ plugins: sortPlugins(plugins) });
}));

app.post('/api/admin/plugins', wrapAsync(async (req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const { plugin, errors } = validatePlugin(req.body ?? {});
  if (errors.length) {
    throw new ValidationError(errors.join(', '));
  }

  const existing = await loadPlugins();
  if (existing.some((p) => p.id === plugin.id)) {
    throw new ValidationError(`Plugin with id "${plugin.id}" already exists`);
  }

  const updated = await savePlugins([...existing, plugin]);
  logSilently('admin.plugins.updated', {
    action: 'create',
    pluginId: plugin.id,
    total: updated.length
  });
  res.status(201).json({ plugins: updated, plugin });
}));

app.put('/api/admin/plugins/:id', wrapAsync(async (req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const pluginId = req.params.id;
  const existing = await loadPlugins();
  const index = existing.findIndex((p) => p.id === pluginId);
  if (index === -1) {
    throw new AppError(`Plugin with id "${pluginId}" not found`, 404);
  }

  const { plugin, errors } = validatePlugin({ ...existing[index], ...req.body, id: pluginId }, { requireId: false });
  if (errors.length) {
    throw new ValidationError(errors.join(', '));
  }

  const next = [...existing];
  next[index] = { ...existing[index], ...plugin, id: pluginId };
  const updated = await savePlugins(next);
  logSilently('admin.plugins.updated', {
    action: 'update',
    pluginId,
    total: updated.length
  });
  res.json({ plugins: updated, plugin: next[index] });
}));

app.delete('/api/admin/plugins/:id', wrapAsync(async (req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const pluginId = req.params.id;
  const existing = await loadPlugins();
  const next = existing.filter((p) => p.id !== pluginId);
  if (next.length === existing.length) {
    throw new AppError(`Plugin with id "${pluginId}" not found`, 404);
  }

  const updated = await savePlugins(next);
  logSilently('admin.plugins.updated', {
    action: 'delete',
    pluginId,
    total: updated.length
  });
  res.status(204).json({});
}));

app.post('/api/admin/plugins/sort', wrapAsync(async (_req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }
  const plugins = await loadPlugins();
  const updated = await savePlugins(plugins);
  logSilently('admin.plugins.updated', {
    action: 'sort',
    total: updated.length
  });
  res.json({ plugins: updated });
}));

app.get('/api/admin/themes', wrapAsync(async (_req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const themes = await loadThemes();
  res.json({ themes: sortThemes(themes) });
}));

app.post('/api/admin/themes', wrapAsync(async (req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const { theme, errors } = validateTheme(req.body ?? {});
  if (errors.length) {
    throw new ValidationError(errors.join(', '));
  }

  const existing = await loadThemes();
  if (existing.some((t) => t.id === theme.id)) {
    throw new ValidationError(`Theme with id "${theme.id}" already exists`);
  }

  const updated = await saveThemes([...existing, theme]);
  logSilently('admin.themes.updated', {
    action: 'create',
    themeId: theme.id,
    total: updated.length
  });

  res.status(201).json({ themes: updated, theme });
}));

app.put('/api/admin/themes/:id', wrapAsync(async (req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const themeId = req.params.id;
  const existing = await loadThemes();
  const index = existing.findIndex((theme) => theme.id === themeId);
  if (index === -1) {
    throw new AppError(`Theme with id "${themeId}" not found`, 404);
  }

  const { theme, errors } = validateTheme(
    { ...existing[index], ...req.body, id: themeId },
    { requireId: false }
  );
  if (errors.length) {
    throw new ValidationError(errors.join(', '));
  }

  const next = [...existing];
  next[index] = { ...existing[index], ...theme, id: themeId };
  const updated = await saveThemes(next);

  logSilently('admin.themes.updated', {
    action: 'update',
    themeId,
    total: updated.length
  });

  res.json({ themes: updated, theme: next[index] });
}));

app.delete('/api/admin/themes/:id', wrapAsync(async (req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const themeId = req.params.id;
  const existing = await loadThemes();
  const next = existing.filter((theme) => theme.id !== themeId);
  if (next.length === existing.length) {
    throw new AppError(`Theme with id "${themeId}" not found`, 404);
  }

  const updated = await saveThemes(next);
  logSilently('admin.themes.updated', {
    action: 'delete',
    themeId,
    total: updated.length
  });

  res.status(204).json({});
}));

app.post('/api/admin/themes/sort', wrapAsync(async (_req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const themes = await loadThemes();
  const updated = await saveThemes(themes);
  logSilently('admin.themes.updated', {
    action: 'sort',
    total: updated.length
  });

  res.json({ themes: updated });
}));

function safeParseJson(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseBooleanQuery(value, defaultValue = false) {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function aggregateHomepageAssets(activityLogs = []) {
  const byPath = new Map();

  activityLogs
    .filter((log) => log.type === 'homepage-scan')
    .forEach((log) => {
      const assets = log.payload?.assets ?? log.payload?.assetSamples ?? [];
      assets.forEach((asset) => {
        const key = asset.path;
        const matches = asset.matches ?? [];
        const existing = byPath.get(key) ?? {
          path: asset.path,
          type: asset.type ?? (asset.path?.includes('/themes/') ? 'theme' : 'plugin'),
          occurrences: 0,
          matches: new Map()
        };
        existing.occurrences += asset.count ?? 1;
        matches.forEach((match) => {
          const matchId = match.id ?? match.slug ?? match.label ?? 'unknown';
          if (!existing.matches.has(matchId)) {
            existing.matches.set(matchId, match);
          }
        });
        byPath.set(key, existing);
      });
    });

  const all = Array.from(byPath.values())
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      occurrences: entry.occurrences,
      matches: Array.from(entry.matches.values())
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  const unknown = all.filter((asset) => (asset.matches?.length ?? 0) === 0);

  return {
    totalPaths: all.length,
    unknownPaths: unknown.length,
    all,
    unknown
  };
}

async function summarizeLogTimestamps(files) {
  const [lastRotation, lastPrune, lastMaintenance] = await Promise.all([
    queryOne("select timestamp, payload_json from activity_logs where type = 'logs.rotated' order by id desc limit 1"),
    queryOne("select timestamp, payload_json from activity_logs where type = 'activity.pruned' order by id desc limit 1"),
    queryOne("select timestamp, payload_json from activity_logs where type = 'db.maintenance' order by id desc limit 1")
  ]);

  return {
    lastRotatedAt: lastRotation?.payload_json ? safeParseJson(lastRotation.payload_json)?.rotatedAt ?? lastRotation.timestamp : null,
    lastPrunedAt: lastPrune?.timestamp ?? null,
    lastMaintenanceAt: lastMaintenance?.payload_json ? safeParseJson(lastMaintenance.payload_json)?.maintenanceAt ?? lastMaintenance.timestamp : null,
    activityLogSize: files?.activityLog?.sizeBytes ?? null,
    dbSize: files?.db?.sizeBytes ?? null,
    walSize: files?.wal?.sizeBytes ?? null,
    shmSize: files?.shm?.sizeBytes ?? null
  };
}

async function collectStorageStats(dbPath, isRemote = true) {
  const stats = {
    db: {
      path: dbPath,
      sizeBytes: null,
      remote: isRemote
    },
    activityLog: {
      path: path.join(__dirname, 'data', 'activity.log'),
      sizeBytes: null
    },
    wal: null,
    shm: null
  };

  if (isRemote) {
    return stats;
  }

  try {
    const dbStats = await stat(dbPath);
    stats.db.sizeBytes = dbStats.size;
  } catch {
    stats.db.sizeBytes = null;
  }

  try {
    const logStats = await stat(stats.activityLog.path);
    stats.activityLog.sizeBytes = logStats.size;
  } catch {
    stats.activityLog.sizeBytes = null;
  }

  return stats;
}

app.use(errorHandler);

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

if (!isTestEnv) {
  const adminEnabled = process.env.ADMIN_ENABLED !== 'false';

  const start = async () => {
    if (adminEnabled) {
      const pluginRegistry = await assertPluginRegistryReady();
      console.log(
        `[startup] registry ready: ${pluginRegistry.pluginsCount} plugins, ${pluginRegistry.themesCount} themes`
      );
    }

    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  };

  start().catch((error) => {
    console.error(`[startup] failed: ${error.message}`);
    process.exit(1);
  });
}

export default app;
