import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSitemap, fetchPageDetails, fetchSitemap } from './sitemap.js';
import { logSilently, recordLog, rotateLog } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, '..', '.env'));

const app = express();
const PORT = process.env.PORT ?? 4100;
const REQUEST_TIMEOUT_MS = 15000;
const dataDir = path.join(__dirname, '..', 'data');
const unsupportedPluginsPath = path.join(dataDir, 'unsupported-plugins.json');
let pluginsQueue = Promise.resolve();
const HOMEPAGE_HTML_CAP_BYTES = 1024 * 1024; // 1 MB cap

const EXPOSED_HEADERS = [
  'x-wp-total',
  'x-wp-totalpages',
  'link',
  'server',
  'x-powered-by',
  'x-cache',
  'x-cache-status',
  'x-proxy-cache',
  'x-litespeed-cache',
  'cf-ray',
  'age',
  'cache-control',
  'vary',
  'location',
  'x-wpjd-final-url',
  'x-wpjd-redirects',
  'x-wpjd-upstream-status',
  'x-wpjd-upstream-duration'
];

const FORWARDED_RESPONSE_HEADERS = [
  'x-wp-total',
  'x-wp-totalpages',
  'link',
  'server',
  'x-powered-by',
  'x-cache',
  'x-cache-status',
  'x-proxy-cache',
  'x-litespeed-cache',
  'cf-ray',
  'age',
  'cache-control',
  'vary',
  'location',
  'x-wpjd-final-url',
  'x-wpjd-redirects'
];

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
app.use(cors({ origin: FRONTEND_ORIGIN, exposedHeaders: EXPOSED_HEADERS }));
app.use(express.json({ limit: '256kb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/proxy', async (req, res) => {
  const { domain, endpoint = '/wp-json/' } = req.query;

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    return res.status(400).json({ error: 'domain query parameter is required' });
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    return res.status(400).json({ error: 'Invalid domain provided' });
  }

  let targetUrl;
  let normalizedEndpoint;

  try {
    normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    targetUrl = new URL(normalizedEndpoint, `https://${sanitizedDomain}`).toString();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid endpoint path', details: error.message });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const { response, finalUrl, redirects } = await fetchWithRedirects(targetUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': 'wp-json-discovery/0.0.1 (+https://github.com/justinthompson/wp-json-discovery)'
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
      res.status(504).json({ error: 'Request to target domain timed out', targetUrl });
    } else {
      res.status(502).json({ error: 'Failed to reach target domain', targetUrl, details: error.message });
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
    res.status(500).json({ error: 'Failed to read unsupported plugins list', details: error.message });
  }
});

app.post('/api/unsupported-plugins', async (req, res) => {
  const { namespace, domain } = req.body ?? {};

  if (typeof namespace !== 'string' || namespace.trim().length === 0) {
    return res.status(400).json({ error: 'namespace is required' });
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
    res.status(500).json({ error: 'Failed to save unsupported plugin', details: error.message });
  }
});

app.post('/api/logs', async (req, res) => {
  const { type, payload } = req.body ?? {};

  if (typeof type !== 'string' || type.trim().length === 0) {
    return res.status(400).json({ error: 'type is required for log events' });
  }

  try {
    await recordLog(type.trim(), payload ?? {});
    res.status(202).json({ acknowledged: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record log entry', details: error.message });
  }
});

app.post('/api/sitemap-scan', async (req, res) => {
  const { domain, sitemapUrl, maxPages = 50 } = req.body ?? {};

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    return res.status(400).json({ error: 'domain is required' });
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    return res.status(400).json({ error: 'Invalid domain provided' });
  }

  const resolvedSitemapUrl = sitemapUrl
    ? sitemapUrl
    : `https://${sanitizedDomain}/sitemap.xml`;

  const startedAt = Date.now();
  const sitemapSummaries = [];
  const pages = [];
  const errors = [];
  const seenSitemaps = new Set();
  const seenPages = new Set();
  const pageLimit = Math.min(Math.max(Number(maxPages) || 0, 1), 200);

  async function processSitemap(target) {
    if (seenSitemaps.has(target)) return;
    seenSitemaps.add(target);

    try {
      const sitemapFetch = await fetchSitemap(target);
      if (!sitemapFetch.ok) {
        errors.push({ stage: 'sitemap', url: target, message: `HTTP ${sitemapFetch.status}` });
        return;
      }
      const parsed = parseSitemap(sitemapFetch.body ?? '');
      sitemapSummaries.push({
        url: target,
        statusCode: sitemapFetch.status,
        redirects: sitemapFetch.redirects,
        finalUrl: sitemapFetch.finalUrl,
        entries: (parsed.urls ?? []).length,
        type: parsed.type
      });

      if (parsed.type === 'index') {
        for (const child of parsed.sitemapUrls.slice(0, 10)) {
          await processSitemap(child);
        }
      }

      parsed.urls.forEach((entry) => {
        if (seenPages.size < pageLimit && entry.loc && !seenPages.has(entry.loc)) {
          seenPages.add(entry.loc);
        }
      });
    } catch (error) {
      errors.push({ stage: 'sitemap', url: target, message: error.message });
    }
  }

  await processSitemap(resolvedSitemapUrl);

  const pageUrls = Array.from(seenPages).slice(0, pageLimit);
  for (const url of pageUrls) {
    try {
      const detail = await fetchPageDetails(url);
      pages.push(detail);
      if (detail.schema?.items) {
        const invalid = detail.schema.items.filter((item) => item.valid === false);
        if (invalid.length > 0) {
          logSilently('sitemap.page.schema_invalid', {
            domain: sanitizedDomain,
            url,
            types: detail.schema.types,
            errors: invalid.flatMap((item) => item.errors ?? [])
          });
        }
      }
    } catch (error) {
      errors.push({ stage: 'page', url, message: error.message });
    }
  }

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
    },
    errors
  });
});

app.post('/api/homepage-scan', async (req, res) => {
  const { domain } = req.body ?? {};

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    return res.status(400).json({ error: 'domain is required' });
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    return res.status(400).json({ error: 'Invalid domain provided' });
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
          'user-agent':
            'wp-json-discovery/0.0.1 (+https://github.com/justinthompson/wp-json-discovery)'
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
      res
        .status(504)
        .json({ error: 'Homepage request timed out', targetUrl, durationMs });
    } else {
      res.status(502).json({
        error: 'Failed to fetch homepage',
        targetUrl,
        durationMs,
        details: error.message
      });
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
    res
      .status(500)
      .json({ error: 'Failed to rotate activity log', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function sanitizeDomain(input) {
  const trimmed = input.trim().toLowerCase();

  // Basic allowlist: alphanumerics, dots, dashes. No protocol or path.
  if (!/^[a-z0-9.-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

async function readBodyWithLimit(response, limitBytes) {
  const reader = response.body?.getReader ? response.body.getReader() : null;
  let received = 0;
  let truncated = false;
  const chunks = [];

  if (!reader) {
    const text = await response.text();
    const slice = text.slice(0, limitBytes);
    return {
      body: slice,
      size: text.length,
      truncated: text.length > limitBytes
    };
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.length;
    if (!truncated) {
      chunks.push(Buffer.from(value));
    }

    if (received > limitBytes && !truncated) {
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        // ignore cancellation errors
      }
      break;
    }
  }

  const buffered = Buffer.concat(chunks);
  return {
    body: buffered.toString('utf-8'),
    size: received,
    truncated
  };
}

function extractHomepageInsights(html = '') {
  const meta = extractMetaTags(html);
  const comments = extractComments(html);
  const assets = extractAssetPaths(html);
  const scriptHints = extractScriptHints(html);
  const frameworks = detectFrameworks(html, assets, scriptHints);
  const other = detectOtherHints(html);

  return {
    meta,
    comments,
    scripts: scriptHints,
    assets,
    frameworks,
    other
  };
}

function extractMetaTags(html) {
  const metaRegex = /<meta\s+[^>]*>/gi;
  const results = [];
  let match;

  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const name = getAttribute(tag, 'name') || getAttribute(tag, 'property');
    const content = getAttribute(tag, 'content');

    if (name && content) {
      results.push({
        name: name.trim(),
        content: content.trim()
      });
    }
  }

  return dedupeByKey(results, (item) => `${item.name}::${item.content}`).slice(
    0,
    50
  );
}

function extractComments(html) {
  const commentRegex = /<!--([\s\S]*?)-->/g;
  const comments = [];
  let match;

  while ((match = commentRegex.exec(html)) !== null) {
    const value = match[1].trim();
    if (value) {
      comments.push(value.slice(0, 240));
    }
    if (comments.length >= 30) break;
  }

  return comments;
}

function extractAssetPaths(html) {
  const assetRegex = /\/wp-content\/(plugins|themes)\/[a-zA-Z0-9._-]+/g;
  const counts = new Map();
  let match;

  while ((match = assetRegex.exec(html)) !== null) {
    const pathValue = match[0];
    counts.set(pathValue, (counts.get(pathValue) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([pathValue, count]) => ({
      path: pathValue,
      count,
      type: pathValue.includes('/plugins/') ? 'plugin' : 'theme'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

function extractScriptHints(html) {
  const hints = [];
  const patterns = [
    'elementorFrontendConfig',
    'elementorKit',
    'et_builder_utils', // Divi
    'Divi',
    'BricksConfig',
    '__NEXT_DATA__',
    'gatsby',
    'astro/assets',
    'oxygen',
    'wpmlBrowserRedirectLanguage',
    'wpeData',
    'wpaas',
    'jetpack',
    'CloudflarePages',
    'Shopify',
    'Squarespace',
    'Wix',
    'Webflow',
    'import.meta.env'
  ];

  patterns.forEach((needle) => {
    if (html.includes(needle)) {
      hints.push(needle);
    }
  });

  return hints;
}

function detectFrameworks(html, assets = [], scriptHints = []) {
  const frameworks = new Set();
  const assetPaths = assets.map((item) => item.path);

  if (html.includes('__NEXT_DATA__') || assetPaths.some((p) => p.includes('/_next/'))) {
    frameworks.add('Next.js');
  }
  if (html.includes('gatsby') || assetPaths.some((p) => p.includes('/static/'))) {
    frameworks.add('Gatsby');
  }
  if (html.includes('Shopify') || assetPaths.some((p) => p.includes('cdn.shopify.com'))) {
    frameworks.add('Shopify');
  }
  if (html.includes('Squarespace')) {
    frameworks.add('Squarespace');
  }
  if (html.includes('import.meta.env') || html.includes('vite')) {
    frameworks.add('Vite');
  }
  if (html.includes('Wix')) {
    frameworks.add('Wix');
  }
  if (html.toLowerCase().includes('webflow')) {
    frameworks.add('Webflow');
  }

  scriptHints.forEach((hint) => {
    if (hint === 'BricksConfig') {
      frameworks.add('Bricks');
    }
    if (hint === 'elementorFrontendConfig' || hint === 'elementorKit') {
      frameworks.add('Elementor');
    }
    if (hint === 'et_builder_utils' || hint === 'Divi') {
      frameworks.add('Divi');
    }
  });

  return Array.from(frameworks);
}

function detectOtherHints(html) {
  const hints = [];
  if (html.includes('/xmlrpc.php')) {
    hints.push('xmlrpc reference present');
  }
  if (html.includes('/wp-json')) {
    hints.push('wp-json reference present');
  }
  if (html.includes('rel="alternate" hreflang=')) {
    hints.push('hreflang tags present');
  }
  return hints.slice(0, 20);
}

function getAttribute(tag, name) {
  const regex = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(regex);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? null;
}

function dedupeByKey(items, selector) {
  const seen = new Set();
  const results = [];
  for (const item of items) {
    const key = selector(item);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }
  return results;
}

async function readUnsupportedPlugins() {
  return withPluginsLock(async () => {
    return readRawUnsupportedPlugins();
  });
}

async function upsertUnsupportedPluginRecord({ namespace, domain }) {
  return withPluginsLock(async () => {
    const plugins = await readRawUnsupportedPlugins();
    const timestamp = new Date().toISOString();
    const existingIndex = plugins.findIndex((plugin) => plugin.namespace === namespace);

    if (existingIndex >= 0) {
      const plugin = plugins[existingIndex];
      const domains = new Set(plugin.domains ?? []);
      if (domain) {
        domains.add(domain);
      }

      plugins[existingIndex] = {
        ...plugin,
        lastDetectedAt: timestamp,
        domains: Array.from(domains)
      };

      await writeRawUnsupportedPlugins(plugins);
      return {
        mode: 'update',
        domainsTracked: plugins[existingIndex].domains?.length ?? 0
      };
    }

    plugins.push({
      namespace,
      firstDetectedAt: timestamp,
      lastDetectedAt: timestamp,
      domains: domain ? [domain] : []
    });

    await writeRawUnsupportedPlugins(plugins);

    return {
      mode: 'insert',
      domainsTracked: domain ? 1 : 0
    };
  });
}

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readRawUnsupportedPlugins() {
  await ensureDataDir();
  try {
    const data = await readFile(unsupportedPluginsPath, 'utf-8');
    if (!data.trim()) {
      return [];
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeRawUnsupportedPlugins([]);
      return [];
    }

    if (error.name === 'SyntaxError') {
      logSilently('unsupported_plugins.repaired_file', {
        reason: 'syntax_error',
        message: error.message
      });
      await writeRawUnsupportedPlugins([]);
      return [];
    }

    throw error;
  }
}

async function fetchWithRedirects(targetUrl, options, maxRedirects = 3) {
  let currentUrl = targetUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual'
    });

    const location = response.headers.get('location');
    const isRedirect = response.status >= 300 && response.status < 400 && location;

    if (!isRedirect) {
      return { response, finalUrl: currentUrl, redirects };
    }

    redirects += 1;
    currentUrl = new URL(location, currentUrl).toString();
  }

  // Return last response even if redirect limit exceeded
  const response = await fetch(currentUrl, {
    ...options,
    redirect: 'manual'
  });
  return { response, finalUrl: currentUrl, redirects };
}

async function writeRawUnsupportedPlugins(plugins) {
  await ensureDataDir();
  const serialized = JSON.stringify(plugins, null, 2);
  await writeFile(unsupportedPluginsPath, `${serialized}\n`, 'utf-8');
}

function withPluginsLock(task) {
  const run = pluginsQueue.then(() => task());
  pluginsQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .forEach((line) => {
        const [key, ...valueParts] = line.split('=');
        if (!key || process.env[key] !== undefined) {
          return;
        }
        const value = valueParts.join('=').trim();
        process.env[key] = value;
      });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[env] Failed to load ${filePath}: ${error.message}`);
    }
  }
}
