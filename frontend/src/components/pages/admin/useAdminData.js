import { useMemo } from 'react';
import {
  deriveHeartbeatSeries
} from './utils.js';

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
  const isSnapshotBackedSection = ['unsupported', 'logs', 'heartbeat', 'assets'].includes(activeSection);

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

  const filteredUnsupportedEntries = useMemo(() => {
    const prefix = unsupportedNamespacePrefix.trim().toLowerCase();
    const base = prefix
      ? unsupportedEntries.filter((entry) => (entry.namespace ?? '').toLowerCase().startsWith(prefix))
      : unsupportedEntries;
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
  }, [unsupportedEntries, unsupportedNamespacePrefix, unsupportedSort]);

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

      const match = asset.path.match(/\/wp-content\/plugins\/([^/]+)/i);
      if (!match?.[1]) {
        return;
      }

      const slug = match[1].toLowerCase();
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
  }, [data]);

  return {
    isSnapshotBackedSection,
    activityLogs,
    logTypes,
    filteredActivityLogs,
    unsupportedEntries,
    filteredUnsupportedEntries,
    filteredDomainEntries,
    recentScans,
    heartbeatRecent,
    heartbeatP95Series,
    heartbeatErrorSeries,
    filteredSupportedPlugins,
    filteredSupportedThemes,
    unknownPluginAssetHints
  };
}

export default useAdminData;
