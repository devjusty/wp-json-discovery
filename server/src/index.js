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
import {
  readUnsupportedPlugins,
  upsertUnsupportedPluginRecord,
  reconcileUnsupportedPluginsForRegistryEntry
} from './utils/plugins.js';
import { AppError, NetworkError, ValidationError } from './utils/errors.js';
import { REQUEST_TIMEOUT_MS, HOMEPAGE_HTML_CAP_BYTES, DEFAULT_USER_AGENT, MAX_SITEMAP_PAGES, FRONTEND_ORIGIN_DEFAULT, EXPOSED_HEADERS_LIST, FORWARDED_RESPONSE_HEADERS_LIST, ACTIVITY_LOG_PRUNE_DEFAULTS } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { requireAdminApiKey, requireAdminOrToken } from './middleware/adminAuth.js';
import requireAuthMiddleware from './middleware/requireAuth.js';
import { wrapAsync } from './utils/route.js';
import createUserScanRoutes from './routes/userScans.js';
import createUserNotesRoutes from './routes/userNotes.js';
import createUserMeRoute from './routes/userMe.js';
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
const PROXY_RESPONSE_SAMPLE_RATE = 20;
const PROXY_RESPONSE_SLOW_MS = 1500;
const TURSO_API_BASE_URL = 'https://api.turso.tech';
const proxyCache = new Map();
const ALLOWED_CLIENT_LOG_TYPES = new Set([
  'scan.started',
  'scan.complete',
  'scan.error',
  'unsupported.persist_attempt',
  'unsupported.persist_failed',
  'homepage.scan.started',
  'homepage.scan.complete',
  'homepage.scan.error',
  'sitemap.scan.complete',
  'sitemap.scan.error',
  'logs.rotation_triggered',
  'logs.rotation_failed'
]);

app.use('/api', apiRateLimiter);
app.use('/api', requireAuthMiddleware);

// User-owned routes (require authentication)
app.use('/api/user/scans', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}, createUserScanRoutes());

app.use('/api/user/notes', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}, createUserNotesRoutes());

app.use('/api/user/me', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}, createUserMeRoute());

app.use('/api/admin', requireAdminOrToken);
app.use('/api/logs', requireAdminOrToken);

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

  const normalizedEndpoint = normalizeProxyEndpoint(endpoint);

  let targetUrl;
  try {
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
      allowedHost: sanitizedDomain,
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_USER_AGENT
      }
    });

    const contentType = response.headers.get('content-type') ?? 'application/json';
    const payload = await response.text();
    const durationMs = Date.now() - startedAt;

    const proxyLogReason = getProxyResponseLogReason({
      domain: sanitizedDomain,
      endpoint: normalizedEndpoint,
      status: response.status,
      redirects,
      durationMs
    });

    if (proxyLogReason) {
      logSilently('proxy.response', {
        domain: sanitizedDomain,
        endpoint: normalizedEndpoint,
        targetUrl,
        finalUrl,
        status: response.status,
        redirects,
        durationMs,
        contentType,
        bytes: payload.length,
        reason: proxyLogReason
      });
    }

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

function getProxyResponseLogReason({ domain, endpoint, status, redirects, durationMs }) {
  if (!Number.isFinite(status)) {
    return 'unknown_status';
  }

  if (status >= 400) {
    return 'upstream_error';
  }

  if (Number.isFinite(durationMs) && durationMs >= PROXY_RESPONSE_SLOW_MS) {
    return 'slow_response';
  }

  if (Number.isFinite(redirects) && redirects > 0) {
    return 'redirected';
  }

  const bucket = stableHash(`${domain}:${endpoint}:${status}`) % PROXY_RESPONSE_SAMPLE_RATE;
  if (bucket === 0) {
    return 'sampled';
  }

  return null;
}

function stableHash(value = '') {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
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
    const normalizedType = type.trim();
    const normalizedPayload = normalizeClientLogPayload(normalizedType, payload);
    if (req.user?.sub) {
      normalizedPayload.userId = req.user.sub;
    }

    await recordLog(normalizedType, normalizedPayload);
    res.status(202).json({ acknowledged: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
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

  const resolvedSitemapUrl = resolveSitemapUrl({
    sitemapUrl,
    domain: sanitizedDomain
  });

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
        allowedHost: sanitizedDomain,
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

  const [unsupportedPluginsTotal, unsupportedDomainsTotal, activityLogsTotal, scanDomainsTotal] = await Promise.all([
    queryOne('select count(1) as count from unsupported_plugins'),
    queryOne('select count(1) as count from unsupported_plugin_domains'),
    queryOne('select count(1) as count from activity_logs'),
    queryOne('select count(1) as count from scan_domains')
  ]);

  const totals = {
    unsupportedPlugins: Number(unsupportedPluginsTotal?.count ?? 0),
    unsupportedPluginDomains: Number(unsupportedDomainsTotal?.count ?? 0),
    activityLogs: Number(activityLogsTotal?.count ?? 0),
    scanDomains: Number(scanDomainsTotal?.count ?? 0)
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
  const turso = await collectTursoDiagnostics({
    dbUrl,
    isRemote: db.__meta?.isRemote !== false
  });

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
    logs,
    turso
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
  const reconciliation = await reconcileUnsupportedPluginsForRegistryEntry(plugin);
  logSilently('admin.plugins.updated', {
    action: 'create',
    pluginId: plugin.id,
    total: updated.length,
    reconciliation
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
  const reconciliation = await reconcileUnsupportedPluginsForRegistryEntry(next[index]);
  logSilently('admin.plugins.updated', {
    action: 'update',
    pluginId,
    total: updated.length,
    reconciliation
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

function normalizeClientLogPayload(type, payload) {
  if (!ALLOWED_CLIENT_LOG_TYPES.has(type)) {
    throw new ValidationError(`Unsupported log type: ${type}`);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('payload must be an object');
  }

  switch (type) {
    case 'scan.started':
    case 'homepage.scan.started':
      return {
        domain: requiredDomain(payload.domain),
        triggeredAt: optionalIsoDate(payload.triggeredAt)
      };
    case 'scan.complete':
      return {
        domain: requiredDomain(payload.domain),
        metrics: normalizeMetrics(payload.metrics),
        coreSummary: normalizeCoreSummary(payload.coreSummary),
        matchedPlugins: normalizeMatchedPlugins(payload.matchedPlugins),
        unsupportedNamespaces: normalizeStringArray(payload.unsupportedNamespaces, 100),
        unsupportedPersistence: normalizeUnsupportedPersistence(payload.unsupportedPersistence),
        snapshotBytes: optionalInteger(payload.snapshotBytes)
      };
    case 'scan.error':
      return {
        domain: requiredDomain(payload.domain),
        message: cleanString(payload.message, 500),
        code: cleanString(payload.code, 120),
        status: optionalInteger(payload.status),
        details: normalizeErrorDetails(payload.details)
      };
    case 'unsupported.persist_attempt':
      return {
        domain: requiredDomain(payload.domain),
        attempted: optionalInteger(payload.attempted),
        fulfilled: optionalInteger(payload.fulfilled),
        rejected: optionalInteger(payload.rejected),
        details: normalizeUnsupportedPersistence(payload.details)
      };
    case 'unsupported.persist_failed':
      return {
        domain: requiredDomain(payload.domain),
        namespace: cleanString(payload.namespace, 250),
        message: cleanString(payload.message, 500)
      };
    case 'homepage.scan.complete':
      return {
        domain: requiredDomain(payload.domain),
        source: normalizeSource(payload.source),
        metaCount: optionalInteger(payload.metaCount),
        assetCount: optionalInteger(payload.assetCount),
        frameworks: normalizeStringArray(payload.frameworks, 25),
        assetSample: normalizeAssetSample(payload.assetSample),
        snapshotBytes: optionalInteger(payload.snapshotBytes)
      };
    case 'homepage.scan.error':
    case 'sitemap.scan.error':
    case 'logs.rotation_failed':
      return {
        message: cleanString(payload.message, 500),
        domain: optionalDomain(payload.domain)
      };
    case 'sitemap.scan.complete':
      return {
        domain: requiredDomain(payload.domain),
        totals: normalizeSitemapTotals(payload.totals),
        sitemapCount: optionalInteger(payload.sitemapCount),
        pages: normalizeSitemapPages(payload.pages)
      };
    case 'logs.rotation_triggered':
      return {
        filename: cleanString(payload.filename, 255),
        triggeredAt: optionalIsoDate(payload.triggeredAt)
      };
    default:
      return {};
  }
}

function requiredDomain(value) {
  const domain = sanitizeDomain(value);
  if (!domain) {
    throw new ValidationError('payload.domain must be a valid domain');
  }
  return domain;
}

function optionalDomain(value) {
  if (typeof value !== 'string') return null;
  return sanitizeDomain(value) ?? null;
}

function cleanString(value, maxLength = 300) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function optionalInteger(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function optionalIsoDate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function normalizeStringArray(value, limit = 50) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, limit)
    .map((item) => cleanString(item, 250))
    .filter(Boolean);
}

function normalizeMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return {
    durationMs: optionalInteger(value.durationMs),
    startedAt: optionalIsoDate(value.startedAt),
    completedAt: optionalIsoDate(value.completedAt)
  };
}

function normalizeCoreSummary(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 20).map((item) => ({
    key: cleanString(item?.key, 80),
    status: cleanString(item?.status, 80),
    rows: optionalInteger(item?.rows),
    durationMs: optionalInteger(item?.durationMs)
  }));
}

function normalizeMatchedPlugins(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 50).map((item) => ({
    id: cleanString(item?.id, 120),
    namespaces: normalizeStringArray(item?.namespaces, 20),
    routes: optionalInteger(item?.routes)
  }));
}

function normalizeUnsupportedPersistence(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 100).map((item) => ({
    namespace: cleanString(item?.namespace, 250),
    status: cleanString(item?.status, 40),
    message: cleanString(item?.message, 500)
  }));
}

function normalizeErrorDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return {
    statusCode: optionalInteger(value.statusCode),
    code: cleanString(value.code, 120),
    endpoint: cleanString(value.endpoint, 300)
  };
}

function normalizeSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return {
    statusCode: optionalInteger(value.statusCode),
    finalUrl: cleanString(value.finalUrl, 500),
    contentType: cleanString(value.contentType, 120),
    sizeBytes: optionalInteger(value.sizeBytes),
    durationMs: optionalInteger(value.durationMs),
    redirects: optionalInteger(value.redirects),
    truncated: Boolean(value.truncated),
    ok: Boolean(value.ok)
  };
}

function normalizeAssetSample(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 30).map((item) => ({
    path: cleanString(item?.path, 500),
    type: cleanString(item?.type, 40),
    count: optionalInteger(item?.count),
    slug: cleanString(item?.slug, 120),
    matches: Array.isArray(item?.matches)
      ? item.matches.slice(0, 10).map((match) => ({
        id: cleanString(match?.id, 120),
        label: cleanString(match?.label, 120),
        type: cleanString(match?.type, 40),
        slug: cleanString(match?.slug, 120)
      }))
      : []
  }));
}

function normalizeSitemapTotals(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return {
    pagesScanned: optionalInteger(value.pagesScanned),
    invalidSchema: optionalInteger(value.invalidSchema),
    noindex: optionalInteger(value.noindex)
  };
}

function normalizeSitemapPages(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 50).map((item) => ({
    url: cleanString(item?.url, 500),
    statusCode: optionalInteger(item?.statusCode),
    flags: normalizeStringArray(item?.flags, 20)
  }));
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

function normalizeProxyEndpoint(rawEndpoint) {
  const endpoint = typeof rawEndpoint === 'string' && rawEndpoint.trim().length > 0
    ? rawEndpoint.trim()
    : '/wp-json/';

  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(endpoint)) {
    throw new ValidationError('Endpoint must be a relative path');
  }

  if (endpoint.startsWith('//')) {
    throw new ValidationError('Endpoint must not start with double slashes');
  }

  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

function normalizeForComparison(value) {
  return value.replace(/^www\./i, '').toLowerCase();
}

function resolveSitemapUrl({ sitemapUrl, domain }) {
  if (!sitemapUrl) {
    return `https://${domain}/sitemap.xml`;
  }

  let parsed;
  try {
    parsed = new URL(sitemapUrl);
  } catch (error) {
    throw new ValidationError(`Invalid sitemapUrl: ${error.message}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError('sitemapUrl must use http or https');
  }

  const sitemapHost = sanitizeDomain(parsed.hostname);
  if (!sitemapHost) {
    throw new ValidationError('sitemapUrl hostname is invalid');
  }

  if (normalizeForComparison(sitemapHost) !== normalizeForComparison(domain)) {
    throw new ValidationError('sitemapUrl host must match the requested domain');
  }

  return parsed.toString();
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
    dbSize: files?.db?.sizeBytes ?? null
  };
}

async function collectTursoDiagnostics({ dbUrl, isRemote }) {
  if (!isRemote) {
    return {
      enabled: false,
      reason: 'local_database',
      checkedAt: new Date().toISOString()
    };
  }

  const parsed = parseTursoDatabaseRef(dbUrl);
  const organization = process.env.TURSO_ORGANIZATION ?? parsed?.organization ?? null;
  const database = process.env.TURSO_DATABASE_NAME ?? parsed?.database ?? null;
  const hostname = parsed?.hostname ?? null;

  const dbToken = process.env.TURSO_AUTH_TOKEN;
  const apiToken = process.env.TURSO_API_TOKEN ?? process.env.TURSO_PLATFORM_API_TOKEN ?? null;

  const health = await fetchTursoDatabaseHealth({ hostname, dbToken });

  if (!apiToken) {
    return {
      enabled: false,
      reason: 'missing_api_token',
      checkedAt: new Date().toISOString(),
      source: {
        organization,
        database,
        hostname
      },
      health
    };
  }

  if (!organization || !database) {
    return {
      enabled: false,
      reason: 'missing_database_identifier',
      checkedAt: new Date().toISOString(),
      source: {
        organization,
        database,
        hostname
      },
      health
    };
  }

  const [statsResult, orgUsageResult, instancesResult] = await Promise.allSettled([
    fetchTursoControlPlane(`/v1/organizations/${encodeURIComponent(organization)}/databases/${encodeURIComponent(database)}/stats`, apiToken),
    fetchTursoControlPlane(`/v1/organizations/${encodeURIComponent(organization)}/usage`, apiToken),
    fetchTursoControlPlane(`/v1/organizations/${encodeURIComponent(organization)}/databases/${encodeURIComponent(database)}/instances`, apiToken)
  ]);

  const statsData = settledJson(statsResult);
  const orgUsageData = settledJson(orgUsageResult);
  const instancesData = settledJson(instancesResult);
  const instances = Array.isArray(instancesData?.instances) ? instancesData.instances : [];

  return {
    enabled: true,
    checkedAt: new Date().toISOString(),
    source: {
      organization,
      database,
      hostname
    },
    health,
    stats: {
      data: statsData?.stats ?? null,
      error: settledError(statsResult)
    },
    orgUsage: {
      data: orgUsageData ?? null,
      error: settledError(orgUsageResult)
    },
    instances: {
      data: instances,
      error: settledError(instancesResult),
      summary: {
        total: instances.length,
        primaryRegion: instances.find((instance) => instance?.primary)?.region ?? null,
        replicaRegions: Array.from(new Set(instances.filter((instance) => !instance?.primary).map((instance) => instance?.region).filter(Boolean))).sort()
      }
    }
  };
}

function parseTursoDatabaseRef(dbUrl) {
  if (typeof dbUrl !== 'string' || !dbUrl.startsWith('libsql://')) {
    return null;
  }

  try {
    const normalized = dbUrl.replace(/^libsql:\/\//, 'https://');
    const parsedUrl = new URL(normalized);
    const hostname = parsedUrl.hostname;
    const left = hostname.replace(/\.turso\.io$/i, '');
    const splitIndex = left.lastIndexOf('-');
    if (splitIndex <= 0 || splitIndex >= left.length - 1) {
      return { hostname, database: null, organization: null };
    }

    return {
      hostname,
      database: left.slice(0, splitIndex),
      organization: left.slice(splitIndex + 1)
    };
  } catch {
    return null;
  }
}

async function fetchTursoDatabaseHealth({ hostname, dbToken }) {
  if (!hostname) {
    return {
      ok: false,
      statusCode: null,
      checkedAt: new Date().toISOString(),
      error: 'missing_hostname'
    };
  }

  try {
    const response = await fetch(`https://${hostname}/health`, {
      headers: dbToken
        ? { Authorization: `Bearer ${dbToken}` }
        : undefined
    });
    return {
      ok: response.ok,
      statusCode: response.status,
      checkedAt: new Date().toISOString(),
      error: response.ok ? null : `http_${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      checkedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

async function fetchTursoControlPlane(pathname, token) {
  const response = await fetch(`${TURSO_API_BASE_URL}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`turso_api_${response.status}:${body.slice(0, 200)}`);
  }

  return response.json();
}

function settledJson(result) {
  if (!result || result.status !== 'fulfilled') {
    return null;
  }
  return result.value;
}

function settledError(result) {
  if (!result || result.status !== 'rejected') {
    return null;
  }
  return result.reason?.message ?? 'request_failed';
}

async function collectStorageStats(dbPath, isRemote = true) {
  const stats = {
    db: {
      path: dbPath,
      sizeBytes: null,
      remote: isRemote
    },
    activityLog: {
      path: path.join(__dirname, '..', 'data', 'activity.log'),
      sizeBytes: null
    }
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
