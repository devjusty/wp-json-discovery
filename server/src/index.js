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
import { getDb } from './db/client.js';

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
    FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
      const value = response.headers.get(headerName);
      if (value !== null) {
        res.set(headerName, value);
      }
    });
    res.set('content-type', contentType);
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

    const insights = extractHomepageInsights(html);
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
    logSilently('logs.rotated', { archive: archiveName, rowsCleared });
    res.json({ filename: archiveName, rowsCleared });
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

  const totals = {
    unsupportedPlugins: db.prepare('select count(1) as count from unsupported_plugins').get()?.count ?? 0,
    unsupportedPluginDomains: db.prepare('select count(1) as count from unsupported_plugin_domains').get()?.count ?? 0,
    activityLogs: db.prepare('select count(1) as count from activity_logs').get()?.count ?? 0
  };

  const activityLogs = db
    .prepare('select id, timestamp, type, payload_json from activity_logs order by id desc limit ?')
    .all(limit)
    .map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.type,
      payload: safeParseJson(row.payload_json)
    }));

  const unsupportedPlugins = await readUnsupportedPlugins();

  const files = await collectStorageStats(db.name);
  const homepageAssets = aggregateHomepageAssets(activityLogs);

  res.json({
    dbPath: db.name,
    totals,
    unsupportedPlugins,
    activityLogs,
    files,
    homepageAssets
  });
}));

app.post('/api/admin/db/maintenance', wrapAsync(async (_req, res) => {
  if (process.env.ADMIN_ENABLED === 'false') {
    throw new AppError('Admin endpoints are disabled', 403);
  }

  const db = await getDb();
  const dbPath = db.name;

  const fileSize = async () => {
    try {
      const stats = await stat(dbPath);
      return stats.size;
    } catch {
      return null;
    }
  };

  const sizeBefore = await fileSize();
  let walCheckpoint = null;
  let integrity = { ok: false, status: null, error: null };

  try {
    walCheckpoint = db.pragma('wal_checkpoint(TRUNCATE)', { simple: false })?.[0] ?? null;
  } catch (error) {
    walCheckpoint = { error: error.message };
  }

  try {
    const result = db.pragma('quick_check', { simple: false })?.[0];
    const status = result?.quick_check ?? result;
    integrity = {
      ok: status === 'ok',
      status: status ?? 'unknown',
      error: null
    };
  } catch (error) {
    integrity = { ok: false, status: null, error: error.message };
  }

  let vacuumRan = false;
  try {
    db.exec('vacuum');
    vacuumRan = true;
  } catch (error) {
    integrity = integrity.ok ? { ok: false, status: integrity.status, error: error.message } : integrity;
  }

  const sizeAfter = await fileSize();

  res.json({
    walCheckpoint,
    integrity,
    vacuumRan,
    size: {
      beforeBytes: sizeBefore,
      afterBytes: sizeAfter
    }
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

  const db = await getDb();

  let prunedByAge = 0;
  let prunedByCount = 0;

  if (Number.isFinite(olderThanDays) && olderThanDays > 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const result = db
      .prepare('delete from activity_logs where timestamp < ?')
      .run(cutoff);
    prunedByAge = result?.changes ?? 0;
  }

  if (Number.isFinite(keepLatest) && keepLatest > 0) {
    const result = db
      .prepare(`
        delete from activity_logs
        where id not in (
          select id from activity_logs order by id desc limit ?
        )
      `)
      .run(keepLatest);
    prunedByCount = result?.changes ?? 0;
  }

  const totals = db.prepare('select count(1) as count from activity_logs').get()?.count ?? 0;

  res.json({
    prunedByAge,
    prunedByCount,
    remaining: totals
  });
}));

function safeParseJson(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
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

async function collectStorageStats(dbPath) {
  const stats = {
    db: {
      path: dbPath,
      sizeBytes: null
    },
    activityLog: {
      path: path.join(__dirname, 'data', 'activity.log'),
      sizeBytes: null
    }
  };

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
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
