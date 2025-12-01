import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
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
import { REQUEST_TIMEOUT_MS, HOMEPAGE_HTML_CAP_BYTES, DEFAULT_USER_AGENT, MAX_SITEMAP_PAGES, FRONTEND_ORIGIN_DEFAULT, EXPOSED_HEADERS_LIST, FORWARDED_RESPONSE_HEADERS_LIST } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, '..', '.env'));

const app = express();
const PORT = process.env.PORT ?? 4100;
const REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS;
const HOMEPAGE_HTML_CAP_BYTES = HOMEPAGE_HTML_CAP_BYTES;

const EXPOSED_HEADERS = EXPOSED_HEADERS_LIST;

const FORWARDED_RESPONSE_HEADERS = FORWARDED_RESPONSE_HEADERS_LIST;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? FRONTEND_ORIGIN_DEFAULT;
app.use(cors({ origin: FRONTEND_ORIGIN, exposedHeaders: EXPOSED_HEADERS }));
app.use(express.json({ limit: '256kb' }));
app.use(morgan('dev'));

app.use('/api', apiRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/proxy', async (req, res) => {
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
});

app.get('/api/unsupported-plugins', async (_req, res) => {
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
});

app.post('/api/unsupported-plugins', async (req, res) => {
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
});

app.post('/api/logs', async (req, res) => {
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
});

app.post('/api/sitemap-scan', async (req, res) => {
  const { domain, sitemapUrl, maxPages = MAX_SITEMAP_PAGES } = req.body ?? {};

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    throw new ValidationError('domain is required');
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    throw new ValidationError('Invalid domain provided');
  }

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
});

app.post('/api/homepage-scan', async (req, res) => {
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
});

app.post('/api/logs/rotate', async (_req, res) => {
  try {
    const { archiveName } = await rotateLog();
    logSilently('logs.rotated', { archive: archiveName });
    res.json({ filename: archiveName });
  } catch (error) {
    logSilently('logs.rotate_error', { message: error.message });
    const rotateError = new AppError('Failed to rotate activity log', 500);
    throw rotateError;
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

app.use(errorHandler);



