import { URL } from 'node:url';
import * as cheerio from 'cheerio';
import { fetchWithRedirects } from './utils/fetch.js';
import { AppError, NetworkError, ValidationError } from './utils/errors.js';
import { MAX_PAGE_BODY_BYTES, DEFAULT_USER_AGENT } from './config.js';
import { logSilently } from './logger.js'; // Import logSilently

const MAX_PAGE_BYTES = MAX_PAGE_BODY_BYTES;
const DEFAULT_UA = DEFAULT_USER_AGENT;

export async function fetchSitemap(url) {
  const { response, finalUrl, redirects } = await fetchWithRedirects(url, {
    headers: {
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      'user-agent': DEFAULT_UA
    }
  });

  if (!response.ok) {
    throw new NetworkError(`Failed to fetch sitemap from ${url}. Status: ${response.status}`, response.status);
  }

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    url,
    finalUrl,
    redirects,
    body
  };
}

export function parseSitemap(xmlString) {
  const lower = xmlString.toLowerCase();
  const isIndex = lower.includes('<sitemapindex');
  const isUrlset = lower.includes('<urlset');

  const $ = cheerio.load(xmlString, { xml: true });
  const entries = [];
  $('loc').each((_i, el) => {
    const loc = $(el).text().trim();
    const lastmod = $(el).nextAll('lastmod').first().text().trim() || null;
    entries.push({ loc, lastmod });
  });

  if (isIndex) {
    return { type: 'index', sitemapUrls: entries.map((e) => e.loc), urls: [] };
  }

  if (isUrlset) {
    return { type: 'urlset', sitemapUrls: [], urls: entries };
  }

  return { type: 'unknown', sitemapUrls: [], urls: entries };
}

export async function fetchPageDetails(url, { signal, userAgent = DEFAULT_UA } = {}) {
  const start = Date.now();
  const { response, finalUrl, redirects } = await fetchWithRedirects(url, {
    signal,
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': userAgent
    }
  });

  if (!response.ok) {
    throw new NetworkError(`Failed to fetch page details from ${url}. Status: ${response.status}`, response.status);
  }

  const reader = response.body?.getReader?.();
  let bytesRead = 0;
  let chunks = [];
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value?.length ?? 0;
      if (bytesRead > MAX_PAGE_BYTES) {
        break;
      }
      chunks.push(Buffer.from(value));
    }
  } else {
    const text = await response.text();
    bytesRead = Buffer.byteLength(text);
    chunks = [Buffer.from(text)];
  }

  const body = Buffer.concat(chunks).toString();
  const durationMs = Date.now() - start;
  const seo = extractSeo(body);
  const schema = extractSchema(body);
  const flags = buildFlags({ seo, schema, finalUrl });

  return {
    url,
    finalUrl: finalUrl ?? url,
    redirectedTo: redirects > 0 ? finalUrl : null,
    redirects,
    statusCode: response.status,
    ok: response.ok,
    durationMs,
    bytes: bytesRead,
    seo,
    schema,
    flags
  };
}

function extractSeo(html) {
  const $ = cheerio.load(html);
  const title = $('title').first().text();
  const description = $('meta[name="description"]').attr('content');
  const robots = $('meta[name="robots"]').attr('content');
  const canonical = $('link[rel="canonical"]').attr('href');
  const ogTags = {};
  $('meta[property^="og:"]').each((_i, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) {
      ogTags[prop] = content;
    }
  });
  const twitterTags = {};
  $('meta[name^="twitter:"]').each((_i, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) {
      twitterTags[name] = content;
    }
  });

  return {
    title,
    description,
    robots,
    canonical,
    og: ogTags,
    twitter: twitterTags
  };
}

function extractSchema(html) {
  const scripts = extractLdScripts(html);
  const items = [];
  const types = new Set();

  scripts.forEach((raw) => {
    try {
      const parsed = JSON.parse(raw);
      const entries = expandGraph(parsed);
      entries.forEach((entry) => {
        const entryTypes = collectTypes(entry);
        entryTypes.forEach((t) => types.add(t));
        const validation = validateSchema(entry, entryTypes);
        items.push({ type: entryTypes[0] ?? 'unknown', raw: entry, ...validation });
      });
    } catch (error) {
      items.push({ type: 'unknown', raw, valid: false, errors: [error.message] });
      // Optionally re-throw as ValidationError if a hard failure is desired
      // throw new ValidationError(`Failed to parse schema JSON: ${error.message}`, { raw, error: error.message });
    }
  });

  return {
    types: Array.from(types),
    items
  };
}

function extractLdScripts(html) {
  const $ = cheerio.load(html);
  const scripts = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    scripts.push($(el).html());
  });
  return scripts;
}

function buildFlags({ seo, schema, finalUrl }) {
  const flags = [];
  if (!seo.title) flags.push('missing_title');
  if (!seo.description) flags.push('missing_description');
  if (seo.robots && seo.robots.toLowerCase().includes('noindex')) flags.push('noindex');
  if (seo.canonical && seo.canonical !== finalUrl) flags.push('canonical_mismatch');
  const invalidSchema = schema.items.some((item) => item.valid === false);
  if (invalidSchema) flags.push('schema_invalid');
  return flags;
}

function collectTypes(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => collectTypes(item)).filter(Boolean);
  }
  if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
    return parsed['@graph'].flatMap((item) => collectTypes(item)).filter(Boolean);
  }
  if (typeof parsed === 'object' && parsed['@type']) {
    const val = parsed['@type'];
    if (Array.isArray(val)) return val.map((v) => String(v));
    return [String(val)];
  }
  return [];
}

function expandGraph(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed.flatMap((item) => expandGraph(item));
  if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
    return parsed['@graph'];
  }
  return [parsed];
}

function validateSchema(parsed, types) {
  const errors = [];
  const primary = types[0];
  if (!primary) {
    return { valid: true, errors };
  }

  const required = REQUIRED_FIELDS[primary.toLowerCase()];
  if (!required) {
    return { valid: true, errors };
  }

  required.forEach((field) => {
    if (!hasPath(parsed, field)) {
      errors.push(`Missing ${field}`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function hasPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj) !== null;
}

const REQUIRED_FIELDS = {
  organization: ['name', 'url'],
  localbusiness: ['name', 'address'],
  article: ['headline', 'datePublished'],
  blogposting: ['headline', 'datePublished'],
  product: ['name', 'offers', 'offers.price'],
  faqpage: ['mainEntity'],
  howto: ['name', 'step'],
  breadcrumblist: ['itemListElement']
};

export async function fetchAndParseSitemap(targetUrl, maxPages = 50) {
  const sitemapSummaries = [];
  const seenSitemaps = new Set();
  const seenPages = new Set();
  const pageLimit = Math.min(Math.max(Number(maxPages) || 0, 1), 200);

  async function processSitemap(url) {
    if (seenSitemaps.has(url)) return;
    seenSitemaps.add(url);

    const sitemapFetch = await fetchSitemap(url);
    const parsed = parseSitemap(sitemapFetch.body ?? '');

    sitemapSummaries.push({
      url,
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
  }

  await processSitemap(targetUrl);

  return { sitemapSummaries, seenPages };
}

export async function fetchAndProcessPageDetails(pageUrls, sanitizedDomain) {
  const pages = [];

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
      logSilently('sitemap.page_fetching_error', { url, message: error.message });
      // Re-throw if critical, or continue if this is just logging and processing should proceed
      // For now, we'll log and let the sitemap scan complete with whatever pages it managed to fetch
      // If the caller needs strict error handling, they will wrap this in a try/catch
    }
  }

  return pages;
}
