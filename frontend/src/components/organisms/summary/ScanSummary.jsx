import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';
import Button from '../../atoms/Button.jsx';
import { CORE_NAMESPACES } from '../../../config/plugins.js';

const MAX_NAMESPACES_VISIBLE = 12;

function ScanSummary({
  domain,
  fetchedAt,
  summary,
  namespaces,
  metrics,
  plugins,
  coreDatasets
}) {
  const hasSummary = Boolean(summary);
  const safeSummary = summary || {};
  const [showAllNamespaces, setShowAllNamespaces] = useState(false);

  const rootUrl = safeSummary.home || safeSummary.url || `https://${domain}/`;
  const rootEndpoint = `${rootUrl.replace(/\/?$/, '')}/wp-json/`;

  const statItems = useMemo(() => {
    const successCoreCount = (coreDatasets || []).filter(
      (dataset) => dataset.status === 'success'
    ).length;
    const contentTotalsLabel = formatContentTotals(metrics?.contentTotals);

    return [
      {
        label: 'Duration',
        value: formatDuration(metrics?.durationMs),
        hint: 'Total time to collect root, core, and plugin data.'
      },
      {
        label: 'Namespaces',
        value: metrics?.namespacesCount ?? namespaces.length,
        hint: 'Unique namespaces discovered across routes.'
      },
      {
        label: 'Routes',
        value: safeSummary.routesCount ?? '—',
        hint: 'Total REST routes exposed by the site.'
      },
      {
        label: 'Plugins',
        value: `${plugins?.matched.length ?? 0} matched · ${plugins?.unsupportedNamespaces.length ?? 0} unsupported`,
        hint: 'Supported plugins with routes plus unknown namespaces.'
      },
      {
        label: 'Core datasets',
        value: `${successCoreCount}/${coreDatasets?.length ?? 0} ok`,
        hint: 'Availability of posts, pages, users, and media.'
      },
      {
        label: 'Content',
        value: contentTotalsLabel,
        hint: 'Totals from X-WP-Total headers.'
      }
    ];
  }, [metrics, namespaces.length, safeSummary.routesCount, plugins, coreDatasets]);

  const namespaceGroups = useMemo(() => {
    const coreSet = new Set(CORE_NAMESPACES);
    const pluginNamespaceOwners = new Map();

    (plugins?.matched ?? []).forEach((pluginMatch) => {
      pluginMatch.namespaces.forEach((ns) => {
        pluginNamespaceOwners.set(ns, pluginMatch.plugin.label);
      });
    });

    return namespaces.map((ns) => {
      if (coreSet.has(ns)) {
        return { namespace: ns, type: 'Core', label: 'Core REST' };
      }
      if (pluginNamespaceOwners.has(ns)) {
        return {
          namespace: ns,
          type: 'Plugin',
          label: pluginNamespaceOwners.get(ns)
        };
      }
      return { namespace: ns, type: 'Unknown', label: 'Unclassified' };
    });
  }, [namespaces, plugins]);

  const visibleNamespaces = showAllNamespaces
    ? namespaceGroups
    : namespaceGroups.slice(0, MAX_NAMESPACES_VISIBLE);
  const hasHiddenNamespaces = namespaceGroups.length > MAX_NAMESPACES_VISIBLE;

  const authProviders = normalizeAuthentication(safeSummary.authentication);

  const namespaceCountLabel = showAllNamespaces
    ? `Showing all ${namespaceGroups.length}`
    : `Showing ${visibleNamespaces.length} of ${namespaceGroups.length}`;

  const handleCopy = (text) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (!hasSummary) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="summary__header">
          <div>
            <h2>Scan summary</h2>
            <p className="card__meta">
              {domain} · Scanned {new Date(fetchedAt).toLocaleString()}
            </p>
          </div>
          <div className="summary-actions">
            <Button
              as="a"
              href={rootEndpoint}
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="secondary"
            >
              Open /wp-json/
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCopy(domain)}
            >
              Copy domain
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCopy(rootEndpoint)}
            >
              Copy root URL
            </Button>
          </div>
        </div>
        <div className="summary-stats">
          {statItems.map((stat) => (
            <div key={stat.label} className="summary-stat">
              <div className="summary-stat__label">{stat.label}</div>
              <div className="summary-stat__value">{stat.value ?? '—'}</div>
              <div className="summary-stat__hint">{stat.hint}</div>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="summary-grid">
          <div>
            <dt>Site name</dt>
            <dd>{safeSummary.name || '—'}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{safeSummary.description || '—'}</dd>
          </div>
          <div>
            <dt>Home URL</dt>
            <dd>
              {safeSummary.home ? (
                <a href={safeSummary.home} target="_blank" rel="noreferrer">
                  {safeSummary.home}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Site URL</dt>
            <dd>
              {safeSummary.url ? (
                <a href={safeSummary.url} target="_blank" rel="noreferrer">
                  {safeSummary.url}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{safeSummary.timezoneString || '—'}</dd>
          </div>
          <div>
            <dt>GMT offset</dt>
            <dd>{safeSummary.gmtOffset ?? '—'}</dd>
          </div>
          <div>
            <dt>WordPress version</dt>
            <dd>{metrics?.versions?.wordpress?.version || 'Unknown'}</dd>
          </div>
        </dl>

        <div className="namespaces">
          <div className="namespaces__header">
            <div>
              <h3>Namespaces</h3>
              <p className="card__meta">{namespaceCountLabel}</p>
            </div>
            {hasHiddenNamespaces ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAllNamespaces((value) => !value)}
              >
                {showAllNamespaces ? 'Show fewer' : 'Show all'}
              </Button>
            ) : null}
          </div>
          <ul className="namespaces__list">
            {visibleNamespaces.map((item) => (
              <li key={item.namespace} className="namespace-pill">
                <span className="namespace-pill__namespace">{item.namespace}</span>
                <span className={`namespace-pill__badge namespace-pill__badge--${item.type.toLowerCase()}`}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {authProviders.length > 0 ? (
          <div className="authentication">
            <h3>Authentication providers</h3>
            <div className="auth-grid">
              {authProviders.map((provider) => (
                <div key={provider.id} className="auth-card">
                  <div className="auth-card__header">
                    <strong>{provider.label}</strong>
                    {provider.id ? (
                      <code className="auth-card__code">{provider.id}</code>
                    ) : null}
                  </div>
                  {provider.description ? (
                    <p className="auth-card__description">
                      {provider.description}
                    </p>
                  ) : null}
                  {provider.endpoints.length > 0 ? (
                    <ul className="auth-card__list">
                      {provider.endpoints.map((endpoint) => (
                        <li key={endpoint}>{endpoint}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : safeSummary.authentication ? (
          <div className="authentication">
            <h3>Authentication providers</h3>
            <pre>{JSON.stringify(safeSummary.authentication, null, 2)}</pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatDuration(durationMs) {
  if (!durationMs && durationMs !== 0) {
    return '—';
  }
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${durationMs}ms`;
}

function formatContentTotals(totals) {
  if (!totals) {
    return '—';
  }

  const parts = [];
  if (Number.isFinite(totals.posts)) {
    parts.push(`${totals.posts} posts`);
  }
  if (Number.isFinite(totals.pages)) {
    parts.push(`${totals.pages} pages`);
  }
  if (Number.isFinite(totals.users)) {
    parts.push(`${totals.users} users`);
  }

  if (parts.length === 0) {
    return '—';
  }

  return parts.join(' · ');
}

function normalizeAuthentication(authentication) {
  if (!authentication) {
    return [];
  }

  if (Array.isArray(authentication)) {
    return authentication.map((provider, index) => ({
      id: provider?.id || provider?.name || `provider-${index + 1}`,
      label: provider?.name || provider?.id || `Provider ${index + 1}`,
      description: provider?.description || provider?.doc || '',
      endpoints: extractEndpoints(provider)
    }));
  }

  if (typeof authentication === 'object') {
    return Object.entries(authentication).map(([key, value]) => ({
      id: key,
      label: value?.name || key,
      description: value?.description || '',
      endpoints: extractEndpoints(value)
    }));
  }

  return [];
}

function extractEndpoints(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value?.endpoints)) {
    return value.endpoints;
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractEndpoints(item));
  }

  return [];
}

ScanSummary.propTypes = {
  domain: PropTypes.string.isRequired,
  fetchedAt: PropTypes.string.isRequired,
  summary: PropTypes.shape({
    name: PropTypes.string,
    description: PropTypes.string,
    url: PropTypes.string,
    home: PropTypes.string,
    gmtOffset: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    timezoneString: PropTypes.string,
    namespacesCount: PropTypes.number,
    routesCount: PropTypes.number,
    authentication: PropTypes.any
  }),
  namespaces: PropTypes.arrayOf(PropTypes.string).isRequired,
  metrics: PropTypes.shape({
    durationMs: PropTypes.number,
    namespacesCount: PropTypes.number,
    contentTotals: PropTypes.object,
    performance: PropTypes.object,
    exposure: PropTypes.object,
    versions: PropTypes.object
  }),
  plugins: PropTypes.shape({
    matched: PropTypes.arrayOf(
      PropTypes.shape({
        plugin: PropTypes.shape({
          id: PropTypes.string.isRequired,
          label: PropTypes.string
        }).isRequired,
        namespaces: PropTypes.arrayOf(PropTypes.string).isRequired
      })
    ),
    unsupportedNamespaces: PropTypes.arrayOf(PropTypes.string)
  }),
  coreDatasets: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      status: PropTypes.string
    })
  )
};

export default ScanSummary;
