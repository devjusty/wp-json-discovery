import { URL } from 'node:url';

const MAX_PAGE_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_UA = 'wp-json-discovery/0.0.1 (+https://github.com/justinthompson/wp-json-discovery)';

export async function fetchSitemap(url) {
  const { response, finalUrl, redirects } = await fetchWithRedirects(url, {
    headers: {
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      'user-agent': DEFAULT_UA
    }
  });

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

  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  const lastmodRegex = /<lastmod>([^<]+)<\/lastmod>/gi;

  const entries = [];
  let match;
  while ((match = locRegex.exec(xmlString)) !== null) {
    const loc = match[1].trim();
    const lastmodMatch = lastmodRegex.exec(xmlString);
    entries.push({ loc, lastmod: lastmodMatch ? lastmodMatch[1].trim() : null });
  }

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
  const title = matchTag(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = matchMeta(html, 'name', 'description');
  const robots = matchMeta(html, 'name', 'robots');
  const canonical = matchLink(html, 'canonical');
  const ogTags = pickMeta(html, 'property', /^og:/i);
  const twitterTags = pickMeta(html, 'name', /^twitter:/i);

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
    }
  });

  return {
    types: Array.from(types),
    items
  };
}

function extractLdScripts(html) {
  const scripts = [];
  const regex = /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
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

function matchTag(html, regex) {
  const m = regex.exec(html);
  return m ? decode(m[1]) : '';
}

function matchMeta(html, attr, name) {
  const regex = new RegExp(`<meta[^>]*${attr}=["']${escapeRegex(name)}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
  const match = regex.exec(html);
  return match ? decode(match[1]) : '';
}

function pickMeta(html, attr, prefixRegex) {
  const regex = new RegExp(`<meta[^>]*${attr}=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>`, 'gi');
  const out = {};
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (prefixRegex.test(match[1])) {
      out[match[1]] = decode(match[2]);
    }
  }
  return out;
}

function matchLink(html, rel) {
  const regex = new RegExp(`<link[^>]*rel=["']${escapeRegex(rel)}["'][^>]*href=["']([^"']+)["'][^>]*>`, 'i');
  const match = regex.exec(html);
  return match ? decode(match[1]) : '';
}

function decode(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const response = await fetch(currentUrl, {
    ...options,
    redirect: 'manual'
  });
  return { response, finalUrl: currentUrl, redirects };
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
