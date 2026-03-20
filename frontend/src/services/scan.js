import { fetchPluginRegistry, proxyRequest } from '../api/client.js';
import { CORE_COLLECTIONS } from '../config/core.js';
import {
  SUPPORTED_PLUGINS,
  CORE_NAMESPACES
} from '../config/plugins.js';
import {
  extractErrorMessage,
  normalizeDomain
} from '../utils/format.js';

const MIN_WORDPRESS_VERSION = '6.3.0';
const REGISTRY_CACHE_TTL_MS = 60 * 1000;

let registryCache = {
  expiresAt: 0,
  plugins: SUPPORTED_PLUGINS,
  coreNamespaces: CORE_NAMESPACES
};
const PLUGIN_VERSION_HINTS = {
  woocommerce: { minVersion: '7.0.0', note: 'Older WooCommerce releases often miss security fixes.' },
  yoast: { minVersion: '20.0.0', note: 'Major SEO updates shipped post-20.x.' },
  jetpack: { minVersion: '12.0.0', note: 'Security fixes land frequently; older builds may be risky.' }
};

export async function scanDomain(domainInput) {
  const domain = normalizeDomain(domainInput);

  if (!domain) {
    throw new Error('Please enter a valid domain before scanning.');
  }

  const scanStartedAt = getTimestamp();

  const rootStartedAt = getTimestamp();
  const registry = await loadPluginRegistry();
  const rootResult = await proxyRequest({
    domain,
    endpoint: '/wp-json/'
  });
  const rootDurationMs = Math.max(0, Math.round(getTimestamp() - rootStartedAt));

  if (!rootResult.ok) {
    const rootErrorMessage = extractErrorMessage(rootResult.data);

    if (rootResult.status === 401 || rootResult.status === 403) {
      const error = new Error(
        'This site restricts REST API access to authenticated users. Provide credentials or skip this domain.'
      );
      error.code = 'auth_required';
      error.status = rootResult.status;
      error.details = {
        domain,
        response: rootResult.data,
        message: rootErrorMessage
      };
      throw error;
    }

    const error = new Error(
      `Unable to reach /wp-json/ for ${domain}: ${rootErrorMessage}`
    );
    error.status = rootResult.status;
    error.details = {
      domain,
      response: rootResult.data
    };
    throw error;
  }

  if (typeof rootResult.data !== 'object' || rootResult.data === null) {
    throw new Error('Received an unexpected response from the WordPress API.');
  }

  const root = rootResult.data;
  const namespaces = collectNamespaces(root);
  const routes = root.routes ?? {};

  const userProbePromise = probeEndpoint(domain, '/wp-json/wp/v2/users?per_page=1&_fields=id,slug,name');
  const settingsProbePromise = probeEndpoint(domain, '/wp-json/wp/v2/settings');
  const xmlrpcProbePromise = probeEndpoint(domain, '/xmlrpc.php');
  const sitemapProbePromise = probeEndpoint(domain, '/sitemap.xml');
  const robotsProbePromise = probeEndpoint(domain, '/robots.txt');
  const homeProbePromise = probeEndpoint(domain, '/');
  const uploadsProbePromise = probeEndpoint(domain, '/wp-content/uploads/');

  const countsPromise = gatherContentOverview(domain, {
    userProbePromise
  });

  const [
    core,
    contentOverview,
    xmlrpcProbe,
    sitemapProbe,
    robotsProbe,
    userProbe,
    settingsProbe,
    homeProbe,
    uploadsProbe
  ] = await Promise.all([
    gatherCoreCollections(domain),
    countsPromise,
    xmlrpcProbePromise,
    sitemapProbePromise,
    robotsProbePromise,
    userProbePromise,
    settingsProbePromise,
    homeProbePromise,
    uploadsProbePromise
  ]);

  const mediaBreakdown = summarizeMediaTypes(core);
  const exposure = gatherExposure({
    rootResult,
    userProbe,
    settingsProbe,
    xmlrpcProbe,
    robotsProbe,
    sitemapProbe,
    uploadsProbe
  });
  const performance = gatherPerformance({
    homeProbe,
    wpJsonProbe: { ...rootResult, durationMs: rootDurationMs, endpoint: '/wp-json/' },
    xmlrpcProbe,
    sitemapProbe,
    robotsProbe
  });
  const pluginMatches = matchSupportedPlugins(namespaces, routes, registry.plugins);
  const versions = gatherVersionHints({
    rootResult,
    performance,
    pluginMatches
  });
  const unsupportedNamespaces = detectUnsupportedNamespaces(
    namespaces,
    pluginMatches,
    registry.coreNamespaces
  );
  const scanCompletedAt = getTimestamp();
  const durationMs = Math.max(0, Math.round(scanCompletedAt - scanStartedAt));

  return {
    domain,
    fetchedAt: new Date().toISOString(),
    summary: pickSummaryFields(root),
    namespaces,
    core,
    contentOverview: {
      ...contentOverview,
      mediaBreakdown
    },
    versions,
    exposure,
    performance,
    plugins: {
      matched: pluginMatches,
      unsupportedNamespaces
    },
    metrics: {
      durationMs,
      performance,
      exposure: {
        restAvailable: exposure.restApiAvailable,
        userEnumerationOpen: exposure.userEnumeration.open,
        settingsExposed: exposure.settingsExposed.open
      },
      versions,
      contentTotals: contentOverview.totals,
      core: core.map((dataset) => ({
        key: dataset.key,
        status: dataset.status,
        rows: dataset.rows.length,
        statusCode: dataset.statusCode,
        durationMs: dataset.durationMs
      })),
      plugins: {
        matchedCount: pluginMatches.length,
        totalRoutes: pluginMatches.reduce(
          (acc, plugin) => acc + plugin.routes.length,
          0
        ),
        unsupportedCount: unsupportedNamespaces.length
      },
      namespacesCount: namespaces.length
    }
  };
}

function collectNamespaces(root) {
  const namespaces = new Set(root.namespaces ?? []);
  const routes = root.routes ?? {};

  for (const details of Object.values(routes)) {
    if (details && typeof details.namespace === 'string') {
      namespaces.add(details.namespace);
    }
  }

  return Array.from(namespaces)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .sort();
}

async function gatherCoreCollections(domain) {
  return Promise.all(
    CORE_COLLECTIONS.map(async (collection) => {
      const startedAt = getTimestamp();
      const result = await proxyRequest({
        domain,
        endpoint: collection.endpoint
      });
      const completedAt = getTimestamp();

      const isArray = Array.isArray(result.data);
      const errorMessage =
        result.ok && isArray ? null : extractErrorMessage(result.data);

      return {
        key: collection.key,
        label: collection.label,
        description: collection.description,
        endpoint: collection.endpoint,
        status: result.ok && isArray ? 'success' : 'error',
        statusCode: result.status,
        rows: result.ok && isArray ? result.data : [],
        raw: result.data,
        error: errorMessage
          ? { message: errorMessage, statusCode: result.status }
          : null,
        columns: collection.columns,
        durationMs: Math.max(0, Math.round(completedAt - startedAt))
      };
    })
  );
}

function matchSupportedPlugins(namespaces, routes, supportedPlugins = []) {
  return supportedPlugins.map((plugin) => {
    const matchedNamespaces = plugin.namespaces.filter((namespace) =>
      namespaces.includes(namespace)
    );

    if (matchedNamespaces.length === 0) {
      return null;
    }

    const pluginRoutes = Object.entries(routes)
      .filter(([, details]) =>
        matchedNamespaces.includes(details?.namespace)
      )
      .map(([path, details]) => ({
        path,
        namespace: details?.namespace ?? 'unknown',
        methods: details?.methods ?? [],
        supports: details?.supports ?? {},
        hasSchema: Boolean(details?.schema),
        accepts: extractArgs(details?.endpoints)
      }));

    return {
      plugin,
      namespaces: matchedNamespaces,
      routes: pluginRoutes.sort((a, b) => a.path.localeCompare(b.path))
    };
  }).filter(Boolean);
}

function detectUnsupportedNamespaces(namespaces, pluginMatches, coreNamespaces = CORE_NAMESPACES) {
  const supportedNamespaces = new Set([
    ...coreNamespaces,
    ...pluginMatches.flatMap(({ namespaces }) => namespaces)
  ]);

  const seen = new Set();

  return namespaces.filter((namespace) => {
    if (!namespace || supportedNamespaces.has(namespace) || seen.has(namespace)) {
      return false;
    }
    seen.add(namespace);
    return true;
  });
}

async function loadPluginRegistry() {
  const now = Date.now();
  if (registryCache.expiresAt > now) {
    return {
      plugins: registryCache.plugins,
      coreNamespaces: registryCache.coreNamespaces
    };
  }

  try {
    const data = await fetchPluginRegistry();
    const plugins = Array.isArray(data?.plugins) ? data.plugins : SUPPORTED_PLUGINS;
    const coreNamespaces = Array.isArray(data?.coreNamespaces)
      ? data.coreNamespaces
      : CORE_NAMESPACES;

    registryCache = {
      expiresAt: now + REGISTRY_CACHE_TTL_MS,
      plugins,
      coreNamespaces
    };
  } catch {
    registryCache = {
      expiresAt: now + REGISTRY_CACHE_TTL_MS,
      plugins: SUPPORTED_PLUGINS,
      coreNamespaces: CORE_NAMESPACES
    };
  }

  return {
    plugins: registryCache.plugins,
    coreNamespaces: registryCache.coreNamespaces
  };
}

function extractArgs(endpoints = []) {
  const args = new Set();

  endpoints.forEach((endpoint) => {
    if (endpoint?.args) {
      Object.keys(endpoint.args).forEach((key) => args.add(key));
    }
  });

  return Array.from(args);
}

function pickSummaryFields(root) {
  return {
    name: root.name ?? '',
    description: root.description ?? '',
    url: root.url ?? '',
    home: root.home ?? '',
    gmtOffset: root.gmt_offset ?? '',
    timezoneString: root.timezone_string ?? '',
    namespacesCount: (root.namespaces ?? []).length,
    routesCount: Object.keys(root.routes ?? {}).length,
    authentication: root.authentication ?? null
  };
}

function getTimestamp() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

async function probeEndpoint(domain, endpoint) {
  const startedAt = getTimestamp();
  const result = await proxyRequest({ domain, endpoint });
  const durationMs = Math.max(0, Math.round(getTimestamp() - startedAt));

  return {
    ...result,
    endpoint,
    durationMs
  };
}

async function gatherContentOverview(domain, { userProbePromise } = {}) {
  const postsEndpoint = '/wp-json/wp/v2/posts?_fields=id&per_page=1';
  const pagesEndpoint = '/wp-json/wp/v2/pages?_fields=id&per_page=1';
  const categoriesEndpoint = '/wp-json/wp/v2/categories?_fields=id&per_page=1';
  const tagsEndpoint = '/wp-json/wp/v2/tags?_fields=id&per_page=1';
  const mediaEndpoint = '/wp-json/wp/v2/media?_fields=id&per_page=1';
  const usersEndpoint = '/wp-json/wp/v2/users?_fields=id&per_page=1';

  const [posts, pages, categories, tags, media, users] = await Promise.all([
    fetchCollectionCount({ domain, endpoint: postsEndpoint }),
    fetchCollectionCount({ domain, endpoint: pagesEndpoint }),
    fetchCollectionCount({ domain, endpoint: categoriesEndpoint }),
    fetchCollectionCount({ domain, endpoint: tagsEndpoint }),
    fetchCollectionCount({ domain, endpoint: mediaEndpoint }),
    fetchCollectionCount({
      domain,
      endpoint: usersEndpoint,
      probe: userProbePromise ? await userProbePromise : null
    })
  ]);

  const collections = [
    { key: 'posts', label: 'Posts', ...posts },
    { key: 'pages', label: 'Pages', ...pages },
    { key: 'categories', label: 'Categories', ...categories },
    { key: 'tags', label: 'Tags', ...tags },
    { key: 'media', label: 'Media', ...media },
    { key: 'users', label: 'Users', ...users }
  ];

  return {
    totals: {
      posts: posts.count ?? null,
      pages: pages.count ?? null,
      categories: categories.count ?? null,
      tags: tags.count ?? null,
      media: media.count ?? null,
      users: users.count ?? null
    },
    collections
  };
}

async function fetchCollectionCount({ domain, endpoint, probe = null }) {
  const result = probe ?? (await probeEndpoint(domain, endpoint));
  const count = parseHeaderInt(result.headers, 'x-wp-total');
  const totalPages = parseHeaderInt(result.headers, 'x-wp-totalpages');

  return {
    endpoint,
    status: result.status,
    statusCode: result.status,
    ok: result.ok,
    count: Number.isFinite(count) ? count : null,
    totalPages: Number.isFinite(totalPages) ? totalPages : null,
    durationMs: result.durationMs ?? null,
    contentType: result.contentType ?? null
  };
}

function parseHeaderInt(headers, name) {
  const rawValue = getHeader(headers, name);
  const parsed = rawValue ? parseInt(rawValue, 10) : NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

function getHeader(headers, name) {
  if (!headers) {
    return undefined;
  }
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === target
  );
  return entry ? entry[1] : undefined;
}

function gatherExposure({ rootResult, userProbe, settingsProbe, xmlrpcProbe, robotsProbe, sitemapProbe, uploadsProbe }) {
  const userCount = parseHeaderInt(userProbe?.headers, 'x-wp-total');

  return {
    restApiAvailable: rootResult?.ok ?? false,
    userEnumeration: {
      open: userProbe?.ok ?? false,
      statusCode: userProbe?.status ?? null,
      total: userCount,
      sample:
        Array.isArray(userProbe?.data) && userProbe.data.length > 0
          ? userProbe.data[0]
          : null
    },
    settingsExposed: {
      open: settingsProbe?.ok ?? false,
      statusCode: settingsProbe?.status ?? null
    },
    xmlrpc: {
      enabled: xmlrpcProbe ? xmlrpcProbe.status !== 404 : false,
      statusCode: xmlrpcProbe?.status ?? null
    },
    robotsTxt: {
      available: robotsProbe?.ok ?? false,
      statusCode: robotsProbe?.status ?? null
    },
    sitemapXml: {
      available: sitemapProbe?.ok ?? false,
      statusCode: sitemapProbe?.status ?? null
    },
    uploads: {
      indexable: uploadsIndexable(uploadsProbe),
      statusCode: uploadsProbe?.status ?? null
    }
  };
}

function gatherPerformance({ homeProbe, wpJsonProbe, xmlrpcProbe, sitemapProbe, robotsProbe }) {
  const summarize = (probe, label) => {
    const redirectCount = parseHeaderInt(probe?.headers, 'x-wpjd-redirects');
    const finalUrl =
      getHeader(probe?.headers, 'x-wpjd-final-url') ||
      getHeader(probe?.headers, 'location') ||
      null;

    return {
      label,
      endpoint: probe?.endpoint ?? label,
      statusCode: probe?.status ?? null,
      ok: probe?.ok ?? false,
      durationMs: probe?.durationMs ?? null,
      contentType: probe?.contentType ?? null,
      cache: extractCacheHeader(probe?.headers),
      server: getHeader(probe?.headers, 'server'),
      redirected: Number.isFinite(redirectCount) && redirectCount > 0,
      redirectCount: Number.isFinite(redirectCount) ? redirectCount : 0,
      finalUrl,
      compression: getHeader(probe?.headers, 'content-encoding') || null,
      hsts: Boolean(getHeader(probe?.headers, 'strict-transport-security'))
    };
  };

  return {
    home: summarize(homeProbe, '/'),
    wpJson: summarize(wpJsonProbe, '/wp-json/'),
    xmlrpc: summarize(xmlrpcProbe, '/xmlrpc.php'),
    sitemap: summarize(sitemapProbe, '/sitemap.xml'),
    robots: summarize(robotsProbe, '/robots.txt')
  };
}

function extractCacheHeader(headers) {
  const cacheHeaders = [
    'x-cache',
    'x-cache-status',
    'x-proxy-cache',
    'x-litespeed-cache',
    'age',
    'cache-control'
  ];

  for (const header of cacheHeaders) {
    const value = getHeader(headers, header);
    if (value) {
      return `${header}: ${value}`;
    }
  }

  return null;
}

function summarizeMediaTypes(coreDatasets = []) {
  const mediaDataset = coreDatasets.find((dataset) => dataset.key === 'media');
  if (!mediaDataset || !Array.isArray(mediaDataset.rows)) {
    return [];
  }

  const counts = mediaDataset.rows.reduce((acc, row) => {
    const type = row?.media_type || 'unknown';
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function uploadsIndexable(uploadsProbe) {
  if (!uploadsProbe) {
    return false;
  }
  const okStatus = uploadsProbe.status >= 200 && uploadsProbe.status < 300;
  const contentType = getHeader(uploadsProbe.headers, 'content-type') || '';
  const likelyIndex = okStatus && contentType.includes('text/html');
  return likelyIndex;
}

function gatherVersionHints({ rootResult, performance, pluginMatches }) {
  const wpVersion = extractWordPressVersion(rootResult);
  const wordpressStatus = evaluateVersionStatus(wpVersion?.version, MIN_WORDPRESS_VERSION);

  const pluginStatuses = (pluginMatches ?? []).map((match) => {
    const headerVersion = detectPluginVersionFromHeaders(match.plugin.id, [rootResult, performance?.home, performance?.wpJson]);
    const hint = PLUGIN_VERSION_HINTS[match.plugin.id];
    const status = hint && headerVersion
      ? evaluateVersionStatus(headerVersion, hint.minVersion)
      : null;

    return {
      id: match.plugin.id,
      label: match.plugin.label,
      version: headerVersion,
      status: status ?? 'unknown',
      note: hint?.note ?? null,
      minimum: hint?.minVersion ?? null
    };
  });

  return {
    wordpress: {
      version: wpVersion?.version ?? null,
      source: wpVersion?.source ?? null,
      status: wordpressStatus,
      minimum: MIN_WORDPRESS_VERSION
    },
    plugins: pluginStatuses
  };
}

function extractWordPressVersion(rootResult) {
  const generator = rootResult?.data?.generator;
  const generatorHeader = getHeader(rootResult?.headers, 'x-generator');
  const poweredBy = getHeader(rootResult?.headers, 'x-powered-by');
  const candidate = generator || generatorHeader || poweredBy;

  if (!candidate || typeof candidate !== 'string') {
    return null;
  }

  const match = candidate.match(/wordpress[\\s/]*([0-9.]+)/i);
  if (match && match[1]) {
    return { version: match[1], source: 'generator' };
  }

  return null;
}

function evaluateVersionStatus(current, minimum) {
  if (!current || !minimum) {
    return 'unknown';
  }

  const cmp = compareVersions(current, minimum);
  return cmp < 0 ? 'outdated' : 'ok';
}

function compareVersions(a, b) {
  const aParts = String(a).split('.').map((part) => parseInt(part, 10) || 0);
  const bParts = String(b).split('.').map((part) => parseInt(part, 10) || 0);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i += 1) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }

  return 0;
}

function detectPluginVersionFromHeaders(pluginId, probes = []) {
  const headersList = probes
    .filter(Boolean)
    .map((probe) => probe.headers)
    .filter(Boolean);

  const headerNames = {
    woocommerce: ['x-woocommerce-version', 'x-wc-store-api'],
    jetpack: ['x-jetpack-version'],
    yoast: ['x-yoast-version']
  };

  const names = headerNames[pluginId] ?? [];
  for (const headers of headersList) {
    for (const name of names) {
      const value = getHeader(headers, name);
      if (value) {
        const versionMatch = String(value).match(/([0-9]+(?:\\.[0-9]+)+)/);
        if (versionMatch && versionMatch[1]) {
          return versionMatch[1];
        }
      }
    }
  }

  return null;
}
