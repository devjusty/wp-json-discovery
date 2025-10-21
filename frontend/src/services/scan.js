import { proxyRequest } from '../api/client.js';
import { CORE_COLLECTIONS } from '../config/core.js';
import {
  SUPPORTED_PLUGINS,
  CORE_NAMESPACES
} from '../config/plugins.js';
import {
  extractErrorMessage,
  normalizeDomain
} from '../utils/format.js';

export async function scanDomain(domainInput) {
  const domain = normalizeDomain(domainInput);

  if (!domain) {
    throw new Error('Please enter a valid domain before scanning.');
  }

  const scanStartedAt = getTimestamp();

  const rootResult = await proxyRequest({
    domain,
    endpoint: '/wp-json/'
  });

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

  const core = await gatherCoreCollections(domain);
  const pluginMatches = matchSupportedPlugins(namespaces, routes);
  const unsupportedNamespaces = detectUnsupportedNamespaces(
    namespaces,
    pluginMatches
  );
  const scanCompletedAt = getTimestamp();
  const durationMs = Math.max(0, Math.round(scanCompletedAt - scanStartedAt));

  return {
    domain,
    fetchedAt: new Date().toISOString(),
    summary: pickSummaryFields(root),
    namespaces,
    core,
    plugins: {
      matched: pluginMatches,
      unsupportedNamespaces
    },
    metrics: {
      durationMs,
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

function matchSupportedPlugins(namespaces, routes) {
  return SUPPORTED_PLUGINS.map((plugin) => {
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

function detectUnsupportedNamespaces(namespaces, pluginMatches) {
  const supportedNamespaces = new Set([
    ...CORE_NAMESPACES,
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
