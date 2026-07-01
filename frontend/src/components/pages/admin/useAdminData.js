import { useMemo } from 'react';
import {
  deriveHeartbeatSeries
} from './utils.js';
import { namespaceToSlug } from './drafts.js';

const SNAPSHOT_BACKED_SECTIONS = new Set(['unsupported', 'logs', 'heartbeat', 'assets']);
const WP_PLUGIN_ASSET_PATH_REGEX = /\/wp-content\/plugins\/([^/]+)/i;

function useAdminData({
  data,
  activeSection,
  logTypeFilter,
  unsupportedNamespacePrefix,
  unsupportedSort,
  domainHistoryItems = [],
  domainsQuery,
  domainsSort,
  pluginCatalogQuery,
  pluginCatalogSort,
  supportedPlugins = [],
  themeCatalogQuery,
  themeCatalogSort,
  supportedThemes = []
}) {
  const isSnapshotBackedSection = SNAPSHOT_BACKED_SECTIONS.has(activeSection);

  const activityLogs = useMemo(
    () => data?.activityLogs ?? [],
    [data]
  );

  const logTypes = useMemo(() => {
    return Array.from(new Set(activityLogs.map((log) => log.type).filter(Boolean))).sort();
  }, [activityLogs]);

  const filteredActivityLogs = useMemo(() => {
    if (logTypeFilter === 'all') return activityLogs;
    return activityLogs.filter((log) => log.type === logTypeFilter);
  }, [activityLogs, logTypeFilter]);

  const unsupportedEntries = useMemo(
    () => data?.unsupportedPlugins ?? [],
    [data]
  );

  const supportedPluginLookup = useMemo(() => {
    const ids = new Set();
    const namespacePrefixes = new Set();
    const assetHints = new Set();

    supportedPlugins.forEach((plugin) => {
      if (typeof plugin?.id === 'string' && plugin.id.trim().length > 0) {
        ids.add(plugin.id.trim().toLowerCase());
      }

      const namespaces = Array.isArray(plugin?.namespaces) ? plugin.namespaces : [];
      namespaces.forEach((namespace) => {
        if (typeof namespace === 'string' && namespace.trim().length > 0) {
          namespacePrefixes.add(namespace.trim().toLowerCase());
        }
      });

      const hints = Array.isArray(plugin?.assetHints) ? plugin.assetHints : [];
      hints.forEach((hint) => {
        if (typeof hint === 'string' && hint.trim().length > 0) {
          assetHints.add(hint.trim().toLowerCase());
        }
      });
    });

    return {
      ids,
      namespacePrefixes,
      assetHints
    };
  }, [supportedPlugins]);

  const unresolvedUnsupportedEntries = useMemo(() => {
    if (!supportedPluginLookup.namespacePrefixes.size) {
      return unsupportedEntries;
    }

    return unsupportedEntries.filter((entry) => {
      const namespace = (entry?.namespace ?? '').toLowerCase();
      if (!namespace) {
        return true;
      }

      for (const prefix of supportedPluginLookup.namespacePrefixes) {
        if (namespace === prefix || namespace.startsWith(`${prefix}/`)) {
          return false;
        }
      }

      return true;
    });
  }, [unsupportedEntries, supportedPluginLookup]);

  const filteredUnsupportedEntries = useMemo(() => {
    const prefix = unsupportedNamespacePrefix.trim().toLowerCase();
    const base = prefix
      ? unresolvedUnsupportedEntries.filter((entry) => (entry.namespace ?? '').toLowerCase().startsWith(prefix))
      : unresolvedUnsupportedEntries;
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (unsupportedSort === 'namespaceAsc') {
        return (a.namespace ?? '').localeCompare(b.namespace ?? '');
      }
      if (unsupportedSort === 'domainsDesc') {
        return (b.domains?.length ?? 0) - (a.domains?.length ?? 0);
      }
      return Date.parse(b.lastDetectedAt ?? '') - Date.parse(a.lastDetectedAt ?? '');
    });
    return sorted;
  }, [unresolvedUnsupportedEntries, unsupportedNamespacePrefix, unsupportedSort]);

  const filteredDomainEntries = useMemo(() => {
    const query = domainsQuery.trim().toLowerCase();
    const base = domainHistoryItems.filter((entry) => {
      if (!query) return true;
      return entry.domain.toLowerCase().includes(query);
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (domainsSort === 'domainAsc') {
        return a.domain.localeCompare(b.domain);
      }
      if (domainsSort === 'status') {
        return (b.lastStatus ?? '').localeCompare(a.lastStatus ?? '');
      }
      return Date.parse(b.lastScannedAt ?? '') - Date.parse(a.lastScannedAt ?? '');
    });
    return sorted;
  }, [domainHistoryItems, domainsQuery, domainsSort]);

  const recentScans = useMemo(() => {
    if (!data?.activityLogs?.length) return [];
    return data.activityLogs
      .filter((log) => log.type === 'scan.complete' && log.payload?.domain)
      .slice(0, 10);
  }, [data]);

  const heartbeatRecent = useMemo(
    () => data?.heartbeat?.recent ?? [],
    [data]
  );

  const heartbeatP95Series = useMemo(
    () => deriveHeartbeatSeries(heartbeatRecent, (payload) => payload?.scanDurationMs?.p95),
    [heartbeatRecent]
  );

  const heartbeatErrorSeries = useMemo(
    () => deriveHeartbeatSeries(heartbeatRecent, (payload) => payload?.errors?.total),
    [heartbeatRecent]
  );

  const filteredSupportedPlugins = useMemo(() => {
    const query = pluginCatalogQuery.trim().toLowerCase();
    const base = supportedPlugins.filter((plugin) => {
      if (!query) return true;
      return (
        (plugin.label ?? '').toLowerCase().includes(query) ||
        (plugin.id ?? '').toLowerCase().includes(query)
      );
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (pluginCatalogSort === 'namespacesDesc') {
        return (b.namespaces?.length ?? 0) - (a.namespaces?.length ?? 0);
      }
      if (pluginCatalogSort === 'namespacesAsc') {
        return (a.namespaces?.length ?? 0) - (b.namespaces?.length ?? 0);
      }
      return (a.label ?? '').localeCompare(b.label ?? '');
    });
    return sorted;
  }, [pluginCatalogQuery, pluginCatalogSort, supportedPlugins]);

  const filteredSupportedThemes = useMemo(() => {
    const query = themeCatalogQuery.trim().toLowerCase();
    const base = supportedThemes.filter((theme) => {
      if (!query) return true;
      return (
        (theme.label ?? '').toLowerCase().includes(query) ||
        (theme.id ?? '').toLowerCase().includes(query)
      );
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (themeCatalogSort === 'pathsDesc') {
        return (b.pathSignals?.length ?? 0) - (a.pathSignals?.length ?? 0);
      }
      if (themeCatalogSort === 'pathsAsc') {
        return (a.pathSignals?.length ?? 0) - (b.pathSignals?.length ?? 0);
      }
      return (a.label ?? '').localeCompare(b.label ?? '');
    });
    return sorted;
  }, [themeCatalogQuery, themeCatalogSort, supportedThemes]);

  const unknownPluginAssetHints = useMemo(() => {
    const unknownAssets = data?.homepageAssets?.unknown ?? [];
    const bySlug = new Map();

    unknownAssets.forEach((asset) => {
      if (asset?.type !== 'plugin' || typeof asset?.path !== 'string') {
        return;
      }

      const match = asset.path.match(WP_PLUGIN_ASSET_PATH_REGEX);
      if (!match?.[1]) {
        return;
      }

      const slug = match[1].toLowerCase();
      if (supportedPluginLookup.ids.has(slug) || supportedPluginLookup.assetHints.has(slug)) {
        return;
      }

      const existing = bySlug.get(slug) ?? {
        slug,
        occurrences: 0,
        paths: new Set()
      };

      existing.occurrences += Number.isFinite(asset.occurrences) ? asset.occurrences : 1;
      existing.paths.add(asset.path);
      bySlug.set(slug, existing);
    });

    return Array.from(bySlug.values())
      .map((entry) => ({
        slug: entry.slug,
        occurrences: entry.occurrences,
        pathCount: entry.paths.size
      }))
      .sort((a, b) => b.occurrences - a.occurrences || a.slug.localeCompare(b.slug));
  }, [data, supportedPluginLookup]);

  const pluginSuggestions = useMemo(() => {
    const namespaceSuggestions = unresolvedUnsupportedEntries
      .map((entry) => {
        const namespace = typeof entry?.namespace === 'string' ? entry.namespace.trim() : '';
        const slug = namespaceToSlug(namespace);
        if (!slug) {
          return null;
        }

        const domainCount = Array.isArray(entry?.domains) ? entry.domains.length : 0;
        return {
          key: `namespace:${namespace.toLowerCase()}`,
          kind: 'namespace',
          namespace,
          slug,
          label: namespace,
          searchText: [namespace, slug].join(' ').toLowerCase(),
          meta: `${domainCount} domain${domainCount === 1 ? '' : 's'}`
        };
      })
      .filter(Boolean);

    const assetSuggestions = unknownPluginAssetHints.map((asset) => ({
      key: `asset:${asset.slug}`,
      kind: 'asset',
      slug: asset.slug,
      label: asset.slug,
      searchText: asset.slug.toLowerCase(),
      meta: `${asset.occurrences} occurrence${asset.occurrences === 1 ? '' : 's'}`
    }));

    return [...namespaceSuggestions, ...assetSuggestions]
      .sort((a, b) => {
        const aScore = a.kind === 'namespace' ? Number.parseInt(a.meta, 10) || 0 : Number.parseInt(a.meta, 10) || 0;
        const bScore = b.kind === 'namespace' ? Number.parseInt(b.meta, 10) || 0 : Number.parseInt(b.meta, 10) || 0;
        if (bScore !== aScore) {
          return bScore - aScore;
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, 12);
  }, [unresolvedUnsupportedEntries, unknownPluginAssetHints]);

  return {
    isSnapshotBackedSection,
    activityLogs,
    logTypes,
    filteredActivityLogs,
    unsupportedEntries: unresolvedUnsupportedEntries,
    filteredUnsupportedEntries,
    filteredDomainEntries,
    recentScans,
    heartbeatRecent,
    heartbeatP95Series,
    heartbeatErrorSeries,
    filteredSupportedPlugins,
    filteredSupportedThemes,
    unknownPluginAssetHints,
    pluginSuggestions
  };
}

export default useAdminData;
