import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import { Card, CardContent, CardHeader } from '../atoms/Card.jsx';
import Button from '../atoms/Button.jsx';
import {
  fetchDbSnapshot,
  pruneActivityLogs,
  runDbMaintenance,
  fetchPlugins,
  createPlugin,
  updatePlugin,
  deletePlugin,
  sortPlugins as sortPluginsApi
} from '../../api/admin.js';
import { SUPPORTED_PLUGINS } from '../../config/plugins.js';
import { SUPPORTED_THEMES } from '../../config/themes.js';

const ADMIN_SECTION_ANCHORS = {
  db: [
    { id: 'admin-db-database', label: 'Database' },
    { id: 'admin-db-health', label: 'Data health' },
    { id: 'admin-db-scans', label: 'Recent scans' },
    { id: 'admin-db-activity', label: 'Recent activity logs' }
  ],
  maintenance: [
    { id: 'admin-maintenance-main', label: 'Maintenance run' }
  ],
  unsupported: [
    { id: 'admin-unsupported-main', label: 'Unsupported plugins' }
  ],
  domains: [
    { id: 'admin-domains-main', label: 'Domains tracked' }
  ],
  logs: [
    { id: 'admin-logs-main', label: 'Activity logs' }
  ],
  heartbeat: [
    { id: 'admin-heartbeat-overview', label: 'Overview' },
    { id: 'admin-heartbeat-errors', label: 'Errors by category' },
    { id: 'admin-heartbeat-failing-domains', label: 'Top failing domains' },
    { id: 'admin-heartbeat-unsupported', label: 'Top unsupported namespaces' },
    { id: 'admin-heartbeat-recent', label: 'Recent events' }
  ],
  plugins: [
    { id: 'admin-supported-plugins-main', label: 'Supported plugins' }
  ],
  'plugin-manager': [
    { id: 'admin-plugin-manager-main', label: 'Plugin manager' }
  ],
  themes: [
    { id: 'admin-supported-themes-main', label: 'Supported themes' }
  ],
  assets: [
    { id: 'admin-assets-overview', label: 'Asset signals' },
    { id: 'admin-assets-unknown', label: 'Unknown assets' },
    { id: 'admin-assets-all', label: 'All assets' }
  ]
};

function AdminPage({ headerActions, onNavigate, rotateLogs, isRotatingLogs, onRescan }) {
  const [activeSection, setActiveSection] = useState('db');
  const [expandedPluginId, setExpandedPluginId] = useState(null);
  const [expandedThemeId, setExpandedThemeId] = useState(null);
  const [expandedScanIds, setExpandedScanIds] = useState(new Set());
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const [expandedDomainRows, setExpandedDomainRows] = useState(new Set());
  const [pluginDraft, setPluginDraft] = useState({
    id: '',
    label: '',
    description: '',
    pluginUrl: '',
    namespaces: '',
    assetHints: ''
  });
  const [editingPluginId, setEditingPluginId] = useState(null);
  const [pluginValidationError, setPluginValidationError] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [unsupportedNamespacePrefix, setUnsupportedNamespacePrefix] = useState('');
  const [unsupportedSort, setUnsupportedSort] = useState('lastSeenDesc');
  const [domainsQuery, setDomainsQuery] = useState('');
  const [domainsSort, setDomainsSort] = useState('domainAsc');
  const [pluginCatalogQuery, setPluginCatalogQuery] = useState('');
  const [pluginCatalogSort, setPluginCatalogSort] = useState('labelAsc');
  const [themeCatalogQuery, setThemeCatalogQuery] = useState('');
  const [themeCatalogSort, setThemeCatalogSort] = useState('labelAsc');
  const snapshotQuery = useQuery({
    queryKey: ['dbSnapshot'],
    queryFn: () => fetchDbSnapshot(75),
    refetchOnWindowFocus: false
  });
  const pruneMutation = useMutation({
    mutationFn: pruneActivityLogs,
    onSuccess: () => {
      snapshotQuery.refetch();
    }
  });
  const maintenanceMutation = useMutation({
    mutationFn: runDbMaintenance,
    onSuccess: () => {
      snapshotQuery.refetch();
    }
  });
  const pluginsQuery = useQuery({
    queryKey: ['adminPlugins'],
    queryFn: fetchPlugins,
    enabled: activeSection === 'plugin-manager',
    refetchOnWindowFocus: false
  });
  const createPluginMutation = useMutation({
    mutationFn: createPlugin,
    onSuccess: () => {
      pluginsQuery.refetch();
      resetPluginDraft();
    }
  });
  const updatePluginMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePlugin(id, payload),
    onSuccess: () => {
      pluginsQuery.refetch();
      resetPluginDraft();
    }
  });
  const deletePluginMutation = useMutation({
    mutationFn: deletePlugin,
    onSuccess: () => {
      pluginsQuery.refetch();
      resetPluginDraft();
    }
  });
  const sortPluginsMutation = useMutation({
    mutationFn: sortPluginsApi,
    onSuccess: () => {
      pluginsQuery.refetch();
    }
  });
  const managedPlugins = useMemo(
    () => pluginsQuery.data?.plugins ?? [],
    [pluginsQuery.data]
  );

  const parseList = useCallback((value) => {
    return value
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }, []);

  const resetPluginDraft = useCallback(() => {
    setPluginDraft({
      id: '',
      label: '',
      description: '',
      pluginUrl: '',
      namespaces: '',
      assetHints: ''
    });
    setPluginValidationError('');
  }, []);

  const startEditing = useCallback((plugin) => {
    setEditingPluginId(plugin.id);
    setPluginValidationError('');
    setPluginDraft({
      id: plugin.id ?? '',
      label: plugin.label ?? '',
      description: plugin.description ?? '',
      pluginUrl: plugin.pluginUrl ?? '',
      namespaces: (plugin.namespaces ?? []).join('\n'),
      assetHints: (plugin.assetHints ?? []).join('\n')
    });
  }, []);

  useEffect(() => {
    if (pluginValidationError) {
      setPluginValidationError('');
    }
  }, [pluginDraft, editingPluginId, pluginValidationError]);

  const handlePluginSave = useCallback(() => {
    const payload = {
      id: pluginDraft.id.trim(),
      label: pluginDraft.label.trim(),
      description: pluginDraft.description.trim(),
      pluginUrl: pluginDraft.pluginUrl.trim(),
      namespaces: Array.from(new Set(parseList(pluginDraft.namespaces))),
      assetHints: Array.from(new Set(parseList(pluginDraft.assetHints)))
    };
    if (!payload.id) {
      setPluginValidationError('Plugin ID is required.');
      return;
    }
    if (!payload.label) {
      setPluginValidationError('Plugin label is required.');
      return;
    }
    if (!payload.namespaces.length) {
      setPluginValidationError('Add at least one namespace before saving.');
      return;
    }
    if (!editingPluginId && managedPlugins.some((plugin) => plugin.id === payload.id)) {
      setPluginValidationError(`Plugin ID "${payload.id}" already exists.`);
      return;
    }
    setPluginValidationError('');

    if (editingPluginId) {
      updatePluginMutation.mutate({ id: editingPluginId, payload });
    } else {
      createPluginMutation.mutate(payload);
    }
  }, [pluginDraft, editingPluginId, parseList, updatePluginMutation, createPluginMutation, managedPlugins]);

  const sidebarNav = useMemo(() => {
    const renderSectionAnchors = (sectionKey) => {
      if (activeSection !== sectionKey) return null;
      const anchors = ADMIN_SECTION_ANCHORS[sectionKey] ?? [];
      if (!anchors.length) return null;
      return (
        <ul className="sidebar__subnav">
          {anchors.map((anchor) => (
            <li key={`${sectionKey}-${anchor.id}`}>
              <a className="sidebar__sublink" href={`#${anchor.id}`}>
                {anchor.label}
              </a>
            </li>
          ))}
        </ul>
      );
    };

    return (
      <nav className="sidebar">
        <div className="sidebar__section">
          <p className="sidebar__title">Navigation</p>
          <ul className="sidebar__nav">
            <li>
              <button
                type="button"
                className="sidebar__link"
                onClick={() => onNavigate('scan')}
              >
                Go to current scan
              </button>
            </li>
            <li>
              <button
                type="button"
                className="sidebar__link is-active"
                onClick={() => onNavigate('admin')}
                aria-current="page"
              >
                Admin (current)
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'db' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('db')}
              >
                Data snapshot
              </button>
              {renderSectionAnchors('db')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'maintenance' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('maintenance')}
              >
                DB maintenance
              </button>
              {renderSectionAnchors('maintenance')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'unsupported' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('unsupported')}
              >
                Unsupported plugins
              </button>
              {renderSectionAnchors('unsupported')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'domains' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('domains')}
              >
                Domains tracked
              </button>
              {renderSectionAnchors('domains')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'logs' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('logs')}
              >
                Activity logs
              </button>
              {renderSectionAnchors('logs')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'heartbeat' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('heartbeat')}
              >
                Heartbeat
              </button>
              {renderSectionAnchors('heartbeat')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'plugins' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('plugins')}
              >
                Supported plugins
              </button>
              {renderSectionAnchors('plugins')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'plugin-manager' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('plugin-manager')}
              >
                Plugin manager
              </button>
              {renderSectionAnchors('plugin-manager')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'themes' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('themes')}
              >
                Supported themes
              </button>
              {renderSectionAnchors('themes')}
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'assets' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('assets')}
              >
                Homepage assets
              </button>
              {renderSectionAnchors('assets')}
            </li>
          </ul>
        </div>
        {activeSection === 'plugin-manager' ? (
          <div className="sidebar__section">
            <p className="sidebar__title">{editingPluginId ? `Edit ${editingPluginId}` : 'Add plugin'}</p>
            <form
              className="stacked-form stacked-form--sidebar"
              onSubmit={(e) => {
                e.preventDefault();
                handlePluginSave();
              }}
            >
              <label className="stacked-form__label">
                ID
                <input
                  type="text"
                  value={pluginDraft.id}
                  onChange={(e) => setPluginDraft((prev) => ({ ...prev, id: e.target.value }))}
                  disabled={Boolean(editingPluginId)}
                  required
                />
              </label>
              <label className="stacked-form__label">
                Label
                <input
                  type="text"
                  value={pluginDraft.label}
                  onChange={(e) => setPluginDraft((prev) => ({ ...prev, label: e.target.value }))}
                  required
                />
              </label>
              <label className="stacked-form__label">
                Description
                <textarea
                  value={pluginDraft.description}
                  onChange={(e) => setPluginDraft((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <label className="stacked-form__label">
                Plugin URL
                <input
                  type="url"
                  value={pluginDraft.pluginUrl}
                  onChange={(e) => setPluginDraft((prev) => ({ ...prev, pluginUrl: e.target.value }))}
                  placeholder="https://wordpress.org/plugins/…"
                />
              </label>
              <label className="stacked-form__label">
                Namespaces (comma or newline separated)
                <textarea
                  value={pluginDraft.namespaces}
                  onChange={(e) => setPluginDraft((prev) => ({ ...prev, namespaces: e.target.value }))}
                  placeholder="wc/v3\nwc/store/v1"
                />
              </label>
              <label className="stacked-form__label">
                Asset hints (comma or newline separated)
                <textarea
                  value={pluginDraft.assetHints}
                  onChange={(e) => setPluginDraft((prev) => ({ ...prev, assetHints: e.target.value }))}
                  placeholder="woocommerce\nwc-analytics"
                />
              </label>
              <div className="button-group" style={{ marginTop: '8px' }}>
                <Button type="submit" size="sm" variant="primary" disabled={createPluginMutation.isPending || updatePluginMutation.isPending}>
                  {editingPluginId ? 'Save changes' : 'Add plugin'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    resetPluginDraft();
                    setEditingPluginId(null);
                  }}
                >
                  Reset
                </Button>
              </div>
              {(createPluginMutation.isError || updatePluginMutation.isError) ? (
                <p className="card__meta">
                  {createPluginMutation.error?.message || updatePluginMutation.error?.message || 'Save failed.'}
                </p>
              ) : null}
              {pluginValidationError ? (
                <p className="card__meta admin-validation-error">
                  {pluginValidationError}
                </p>
              ) : null}
            </form>
          </div>
        ) : null}
      </nav>
    );
  }, [
    activeSection,
    onNavigate,
    editingPluginId,
    pluginDraft,
    createPluginMutation,
    updatePluginMutation,
    resetPluginDraft,
    handlePluginSave,
    pluginValidationError
  ]);

  const data = snapshotQuery.data;
  const isSnapshotBackedSection = ['domains', 'unsupported', 'logs', 'heartbeat', 'assets'].includes(activeSection);
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
    const base = deriveDomainsFromUnsupported(unsupportedEntries).filter((entry) => {
      if (!query) return true;
      return entry.domain.toLowerCase().includes(query);
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (domainsSort === 'namespacesDesc') {
        return b.namespaces.length - a.namespaces.length;
      }
      if (domainsSort === 'namespacesAsc') {
        return a.namespaces.length - b.namespaces.length;
      }
      return a.domain.localeCompare(b.domain);
    });
    return sorted;
  }, [unsupportedEntries, domainsQuery, domainsSort]);
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
    const base = SUPPORTED_PLUGINS.filter((plugin) => {
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
  }, [pluginCatalogQuery, pluginCatalogSort]);
  const filteredSupportedThemes = useMemo(() => {
    const query = themeCatalogQuery.trim().toLowerCase();
    const base = SUPPORTED_THEMES.filter((theme) => {
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
  }, [themeCatalogQuery, themeCatalogSort]);
  const sqliteFootprintBytes = sumFinite([
    data?.files?.db?.sizeBytes,
    data?.files?.wal?.sizeBytes,
    data?.files?.shm?.sizeBytes
  ]);

  return (
    <AppLayout
      title="Admin"
      subtitle="Inspect SQLite persistence for unsupported plugins and recent activity logs."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      {activeSection === 'maintenance' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-maintenance-main">Database maintenance</h2>
                <p className="card__meta">
                  Runs a WAL checkpoint (TRUNCATE), quick_check, and VACUUM to keep SQLite healthy. Includes last rotation/prune/maintenance markers when available.
                </p>
              </div>
              <div className="card__actions">
                <span className="tooltip">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => maintenanceMutation.mutate()}
                    disabled={maintenanceMutation.isPending}
                  >
                    {maintenanceMutation.isPending ? 'Maintaining…' : 'Run maintenance'}
                  </Button>
                  <span className="tooltip__content">
                    Checkpoint WAL, run integrity check, and vacuum SQLite.
                  </span>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="stat-grid">
                <div className="stat-grid__item">
                  <dt>Last log rotation</dt>
                  <dd>{data?.logs?.lastRotatedAt || '—'}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Last maintenance</dt>
                  <dd>{data?.logs?.lastMaintenanceAt || '—'}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Last prune</dt>
                  <dd>{data?.logs?.lastPrunedAt || '—'}</dd>
                </div>
              </div>

              {maintenanceMutation.isError ? (
                <div className="card card--error">
                  <div className="card__content">
                    <p>{maintenanceMutation.error?.message ?? 'Maintenance failed.'}</p>
                  </div>
                </div>
              ) : null}
              {maintenanceMutation.data ? (
                <div className="stat-grid">
                  <div className="stat-grid__item">
                    <dt>Size</dt>
                    <dd>
                      {formatBytes(maintenanceMutation.data.size?.beforeBytes)} →{' '}
                      {formatBytes(maintenanceMutation.data.size?.afterBytes)}
                    </dd>
                  </div>
                  <div className="stat-grid__item">
                    <dt>WAL checkpoint</dt>
                    <dd>{formatWalSummary(maintenanceMutation.data.walCheckpoint)}</dd>
                  </div>
                  <div className="stat-grid__item">
                    <dt>Integrity</dt>
                    <dd>
                      {maintenanceMutation.data.integrity?.ok
                        ? maintenanceMutation.data.integrity?.status ?? 'ok'
                        : `Error: ${maintenanceMutation.data.integrity?.error ?? 'unknown'}`}
                    </dd>
                  </div>
                  <div className="stat-grid__item">
                    <dt>Vacuum</dt>
                    <dd>{maintenanceMutation.data.vacuumRan ? 'Completed' : 'Skipped'}</dd>
                  </div>
                  <div className="stat-grid__item">
                    <dt>Run at</dt>
                    <dd>{maintenanceMutation.data.maintenanceAt || '—'}</dd>
                  </div>
                </div>
              ) : (
                <p className="card__meta">
                  No maintenance run yet. Trigger it to checkpoint WAL files, verify integrity, and compact the DB.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'db' && snapshotQuery.isLoading ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Loading database snapshot…</p>
          </div>
        </div>
      ) : null}
      {activeSection === 'db' && snapshotQuery.isError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{snapshotQuery.error?.message ?? 'Failed to load snapshot.'}</p>
          </div>
        </div>
      ) : null}

      {activeSection === 'db' && data ? (
        <>
          <section className="section">
            <div className="grid">
              <Card>
                <CardHeader>
                  <div>
                    <h2 id="admin-db-database">Database</h2>
                    <p className="card__meta">{data.dbPath}</p>
                    {pruneMutation.data ? (
                      <p className="card__meta">
                        Pruned {pruneMutation.data.prunedByAge + pruneMutation.data.prunedByCount} rows · Remaining: {pruneMutation.data.remaining}
                      </p>
                    ) : null}
                  </div>
                  <div className="card__actions">
                    <span className="tooltip">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => snapshotQuery.refetch()}
                        disabled={snapshotQuery.isFetching}
                      >
                        {snapshotQuery.isFetching ? 'Refreshing…' : 'Refresh snapshot'}
                      </Button>
                      <span className="tooltip__content">
                        Reload DB, logs, heartbeat, and asset summary data.
                      </span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="pill-list">
                    <li className="pill">
                      <button type="button" className="pill__link" onClick={() => setActiveSection('unsupported')}>
                        Unsupported plugins: {data.totals?.unsupportedPlugins ?? 0}
                      </button>
                    </li>
                    <li className="pill">
                      <button type="button" className="pill__link" onClick={() => setActiveSection('domains')}>
                        Domains tracked: {data.totals?.unsupportedPluginDomains ?? 0}
                      </button>
                    </li>
                    <li className="pill">
                      <button type="button" className="pill__link" onClick={() => setActiveSection('logs')}>
                        Activity logs: {data.totals?.activityLogs ?? 0}
                      </button>
                    </li>
                  </ul>
                  <div className="stat-grid">
                    <div className="stat-grid__item">
                      <dt>DB size</dt>
                      <dd>{formatBytes(data.files?.db?.sizeBytes)}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Activity log</dt>
                      <dd>{formatBytes(data.files?.activityLog?.sizeBytes)}</dd>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <h2 id="admin-db-health">Data health</h2>
                    <p className="card__meta">Storage footprint and recency markers.</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="stat-grid">
                    <div className="stat-grid__item">
                      <dt>SQLite footprint</dt>
                      <dd>{formatBytes(sqliteFootprintBytes)}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>DB / WAL / SHM</dt>
                      <dd>
                        {formatBytes(data.files?.db?.sizeBytes)} / {formatBytes(data.files?.wal?.sizeBytes)} / {formatBytes(data.files?.shm?.sizeBytes)}
                      </dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Activity log size</dt>
                      <dd>{formatBytes(data.files?.activityLog?.sizeBytes)}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Last heartbeat</dt>
                      <dd>{formatFullTimestamp(data.heartbeat?.latest?.timestamp) || '—'}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Last log rotation</dt>
                      <dd>{formatFullTimestamp(data.logs?.lastRotatedAt) || '—'}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Last prune</dt>
                      <dd>{formatFullTimestamp(data.logs?.lastPrunedAt) || '—'}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Last maintenance</dt>
                      <dd>{formatFullTimestamp(data.logs?.lastMaintenanceAt) || '—'}</dd>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="section">
            <Card>
              <CardHeader>
                <div>
                  <h2 id="admin-db-scans">Recent scans</h2>
                  <p className="card__meta">
                    Last 10 scan events from the activity log. Full snapshots are stored in log payloads.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {recentScans.length ? (
                  <div className="admin-table admin-table--scans">
                  <div className="admin-table__header">
                    <span>Domain</span>
                    <span>Timestamp</span>
                    <span>Namespaces</span>
                    <span>Plugins matched</span>
                    <span>Action</span>
                  </div>
                    {recentScans.map((log) => {
                      const key = `${log.id}:${log.payload?.domain}`;
                      const isExpanded = expandedScanIds.has(key);
                      const snapshot = log.payload?.snapshot ?? log.payload ?? {};

                      const toggleExpanded = () => {
                        setExpandedScanIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) {
                            next.delete(key);
                          } else {
                            next.add(key);
                          }
                          return next;
                        });
                      };

                      return (
                        <div key={key} className="admin-table__row admin-table__row--expandable">
                          <button
                            type="button"
                            className="admin-table__cell admin-table__cell--expand"
                            onClick={toggleExpanded}
                            aria-expanded={isExpanded}
                          >
                            {log.payload?.domain}
                          </button>
                          <span>{log.timestamp}</span>
                          <span>{log.payload?.metrics?.namespacesCount ?? '—'}</span>
                          <span>{log.payload?.metrics?.plugins?.matchedCount ?? '—'}</span>
                          <span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onRescan(log.payload?.domain)}
                              disabled={!log.payload?.domain}
                            >
                              Rescan
                            </Button>
                          </span>
                          {isExpanded ? (
                            <div className="admin-table__details">
                              <p>
                                <strong>Snapshot size:</strong>{' '}
                                {log.payload?.snapshotBytes ?? JSON.stringify(snapshot).length} bytes
                              </p>
                              <code className="code-block">
                                {JSON.stringify(snapshot, null, 2)}
                              </code>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="card__meta">No recent scans found.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="section">
            <Card>
              <CardHeader>
                <div>
                  <h2 id="admin-db-activity">Recent activity logs</h2>
                  <p className="card__meta">Most recent entries (up to 75).</p>
                </div>
              </CardHeader>
              <CardContent>
                {activityLogs.length ? (
                  <>
                    <div className="admin-filters">
                      <label className="admin-filter-field">
                        Type
                        <select
                          value={logTypeFilter}
                          onChange={(event) => setLogTypeFilter(event.target.value)}
                        >
                          <option value="all">All</option>
                          {logTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <ActivityLogsTable
                      logs={filteredActivityLogs}
                      expandedLogIds={expandedLogIds}
                      onToggle={(logId) => {
                        setExpandedLogIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(logId)) {
                            next.delete(logId);
                          } else {
                            next.add(logId);
                          }
                          return next;
                        });
                      }}
                    />
                  </>
                ) : (
                  <p className="card__meta">No log entries found.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      {isSnapshotBackedSection && snapshotQuery.isLoading ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Loading database snapshot…</p>
          </div>
        </div>
      ) : null}

      {isSnapshotBackedSection && snapshotQuery.isError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{snapshotQuery.error?.message ?? 'Failed to load snapshot.'}</p>
          </div>
        </div>
      ) : null}

      {activeSection === 'plugin-manager' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-plugin-manager-main">Plugin manager</h2>
                <p className="card__meta">
                  Add, edit, or remove plugins in the registry. Changes write directly to `frontend/src/config/plugins.js`.
                </p>
              </div>
              <div className="card__actions">
                <span className="tooltip">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => sortPluginsMutation.mutate()}
                    disabled={sortPluginsMutation.isPending || pluginsQuery.isLoading}
                  >
                    {sortPluginsMutation.isPending ? 'Sorting…' : 'Sort plugins'}
                  </Button>
                  <span className="tooltip__content">
                    Alphabetize plugin entries in `plugins.js` for cleaner diffs.
                  </span>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {pluginsQuery.isLoading ? (
                <p className="card__meta">Loading plugins…</p>
              ) : pluginsQuery.isError ? (
                <div className="card card--error">
                  <div className="card__content">
                    <p>{pluginsQuery.error?.message ?? 'Failed to load plugins.'}</p>
                  </div>
                </div>
              ) : (
                <div className="admin-table admin-table--plugins">
                  <div className="admin-table__header">
                    <span>Plugin</span>
                    <span>Namespaces</span>
                    <span>Asset hints</span>
                    <span>Actions</span>
                  </div>
                  {managedPlugins.map((plugin) => (
                    <div key={plugin.id} className="admin-table__row">
                      <span className="admin-table__cell admin-table__cell--expand">
                        <strong>{plugin.label}</strong>
                        <div className="muted">{plugin.id}</div>
                        {plugin.pluginUrl ? (
                          <div>
                            <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">
                              Docs
                            </a>
                          </div>
                        ) : null}
                        <div className="muted">{plugin.description || 'No description'}</div>
                      </span>
                      <span>{plugin.namespaces?.length ?? 0}</span>
                      <span>{plugin.assetHints?.length ?? 0}</span>
                      <span>
                        <div className="button-group">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(plugin)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete plugin "${plugin.label}"?`)) {
                                deletePluginMutation.mutate(plugin.id);
                              }
                            }}
                            disabled={deletePluginMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'domains' && data ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-domains-main">Domains tracked</h2>
                <p className="card__meta">
                  Unique domains observed across unsupported plugin records.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {unsupportedEntries.length ? (
                <>
                  <div className="admin-filters">
                    <label className="admin-filter-field">
                      Domain contains
                      <input
                        type="text"
                        value={domainsQuery}
                        onChange={(event) => setDomainsQuery(event.target.value)}
                        placeholder="example.com"
                      />
                    </label>
                    <label className="admin-filter-field">
                      Sort
                      <select
                        value={domainsSort}
                        onChange={(event) => setDomainsSort(event.target.value)}
                      >
                        <option value="domainAsc">Domain (A-Z)</option>
                        <option value="namespacesDesc">Namespaces (high-low)</option>
                        <option value="namespacesAsc">Namespaces (low-high)</option>
                      </select>
                    </label>
                  </div>
                  <div className="admin-table admin-table--domains">
                    <div className="admin-table__header">
                      <span>Domain</span>
                      <span>Plugins</span>
                      <span>Action</span>
                    </div>
                    {filteredDomainEntries.map((domainEntry) => {
                      const isExpanded = expandedDomainRows.has(domainEntry.domain);
                      return (
                        <div key={domainEntry.domain} className="admin-table__row admin-table__row--expandable">
                          <button
                            type="button"
                            className="admin-table__cell admin-table__cell--expand"
                            onClick={() => {
                              setExpandedDomainRows((prev) => {
                                const next = new Set(prev);
                                if (next.has(domainEntry.domain)) {
                                  next.delete(domainEntry.domain);
                                } else {
                                  next.add(domainEntry.domain);
                                }
                                return next;
                              });
                            }}
                            aria-expanded={isExpanded}
                          >
                            {domainEntry.domain}
                          </button>
                          <span>{domainEntry.namespaces.length}</span>
                          <span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onRescan(domainEntry.domain)}
                            >
                              Rescan
                            </Button>
                          </span>
                          {isExpanded ? (
                            <div className="admin-table__details">
                              <p>
                                <strong>Namespaces:</strong>{' '}
                                {domainEntry.namespaces.length
                                  ? domainEntry.namespaces.join(', ')
                                  : 'None'}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {!filteredDomainEntries.length ? (
                    <p className="card__meta">No domains match this filter.</p>
                  ) : null}
                </>
              ) : (
                <p className="card__meta">No domains recorded.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'unsupported' && data ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-unsupported-main">Unsupported plugins</h2>
                <p className="card__meta">Current registry with domains and timestamps.</p>
              </div>
            </CardHeader>
            <CardContent>
              {unsupportedEntries.length ? (
                <>
                  <div className="admin-filters">
                    <label className="admin-filter-field">
                      Namespace prefix
                      <input
                        type="text"
                        value={unsupportedNamespacePrefix}
                        onChange={(event) => setUnsupportedNamespacePrefix(event.target.value)}
                        placeholder="e.g. wc/"
                      />
                    </label>
                    <label className="admin-filter-field">
                      Sort
                      <select
                        value={unsupportedSort}
                        onChange={(event) => setUnsupportedSort(event.target.value)}
                      >
                        <option value="lastSeenDesc">Last seen (newest)</option>
                        <option value="domainsDesc">Most domains</option>
                        <option value="namespaceAsc">Namespace (A-Z)</option>
                      </select>
                    </label>
                  </div>
                  <div className="admin-table">
                  <div className="admin-table__header">
                    <span>Namespace</span>
                    <span>Domains</span>
                    <span>First seen</span>
                    <span>Last seen</span>
                  </div>
                  {filteredUnsupportedEntries.map((plugin) => (
                    <div key={plugin.namespace} className="admin-table__row">
                      <span>{plugin.namespace}</span>
                      <span>{plugin.domains?.length ?? 0}</span>
                      <span className="tooltip">
                        {formatShortDate(plugin.firstDetectedAt)}
                        <span className="tooltip__content">
                          {formatFullTimestamp(plugin.firstDetectedAt) || '—'}
                        </span>
                      </span>
                      <span className="tooltip">
                        {formatShortDate(plugin.lastDetectedAt)}
                        <span className="tooltip__content">
                          {formatFullTimestamp(plugin.lastDetectedAt) || '—'}
                        </span>
                      </span>
                    </div>
                  ))}
                  </div>
                  {!filteredUnsupportedEntries.length ? (
                    <p className="card__meta">No unsupported namespaces match this filter.</p>
                  ) : null}
                </>
              ) : (
                <p className="card__meta">No unsupported plugins recorded.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'logs' && data ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-logs-main">Activity logs</h2>
                <p className="card__meta">
                  Recent activity log rows (up to 75) with payloads.
                </p>
              </div>
              <div className="card__actions">
                <span className="tooltip">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={rotateLogs}
                    disabled={isRotatingLogs}
                  >
                    {isRotatingLogs ? 'Rotating…' : 'Rotate activity log'}
                  </Button>
                  <span className="tooltip__content">
                    Archive `activity.log` and clear persisted activity rows.
                  </span>
                </span>
                <span className="tooltip">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => pruneMutation.mutate()}
                    disabled={pruneMutation.isPending}
                  >
                    {pruneMutation.isPending ? 'Pruning…' : 'Prune activity log'}
                  </Button>
                  <span className="tooltip__content">
                    Remove old activity rows by age and keep recent history.
                  </span>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {activityLogs.length ? (
                <>
                  <div className="admin-filters">
                    <label className="admin-filter-field">
                      Type
                      <select
                        value={logTypeFilter}
                        onChange={(event) => setLogTypeFilter(event.target.value)}
                      >
                        <option value="all">All</option>
                        {logTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <ActivityLogsTable
                    logs={filteredActivityLogs}
                    expandedLogIds={expandedLogIds}
                    onToggle={(logId) => {
                      setExpandedLogIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(logId)) {
                          next.delete(logId);
                        } else {
                          next.add(logId);
                        }
                        return next;
                      });
                    }}
                  />
                </>
              ) : (
                <p className="card__meta">No log entries found.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'heartbeat' && data ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-heartbeat-overview">Heartbeat metrics</h2>
                <p className="card__meta">
                  Rolling metrics emitted every 10 completed scans (`metrics.heartbeat`).
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {data?.heartbeat?.latest ? (
                <>
                  <div className="stat-grid">
                    <div className="stat-grid__item">
                      <dt>Window</dt>
                      <dd>
                        {data.heartbeat.latest.payload?.window?.startedAt || '—'} →{' '}
                        {data.heartbeat.latest.payload?.window?.endedAt || '—'}
                      </dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Scans completed</dt>
                      <dd>{data.heartbeat.latest.payload?.scansCompleted ?? '—'}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Scan p50 / p95</dt>
                      <dd>
                        {formatMs(data.heartbeat.latest.payload?.scanDurationMs?.p50)} /{' '}
                        {formatMs(data.heartbeat.latest.payload?.scanDurationMs?.p95)}
                      </dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Error total</dt>
                      <dd>{data.heartbeat.latest.payload?.errors?.total ?? 0}</dd>
                    </div>
                  </div>
                  <div className="heartbeat-trends">
                    <TrendBadge
                      label="p95 latency trend"
                      values={heartbeatP95Series}
                      lowerIsBetter
                      formatValue={(value) => formatMs(value)}
                    />
                    <TrendBadge
                      label="Error total trend"
                      values={heartbeatErrorSeries}
                      lowerIsBetter
                      formatValue={(value) => String(Math.round(value))}
                    />
                  </div>

                  <h3 id="admin-heartbeat-errors" style={{ marginTop: '16px' }}>Errors by category</h3>
                  {data.heartbeat.latest.payload?.errors?.perCategory?.length ? (
                    <div className="admin-table admin-table--logs">
                      <div className="admin-table__header">
                        <span>Category</span>
                        <span>Count</span>
                        <span>Rate / scan</span>
                      </div>
                      {data.heartbeat.latest.payload.errors.perCategory.map((row) => (
                        <div key={`errcat-${row.category}`} className="admin-table__row">
                          <span>{row.category}</span>
                          <span>{row.count}</span>
                          <span>{row.ratePerScan}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="card__meta">No errors recorded in latest heartbeat window.</p>
                  )}

                  <h3 id="admin-heartbeat-failing-domains" style={{ marginTop: '16px' }}>Top failing domains</h3>
                  {data.heartbeat.latest.payload?.errors?.topFailingDomains?.length ? (
                    <div className="admin-table admin-table--logs">
                      <div className="admin-table__header">
                        <span>Domain</span>
                        <span>Count</span>
                      </div>
                      {data.heartbeat.latest.payload.errors.topFailingDomains.map((row) => (
                        <div key={`fail-domain-${row.domain}`} className="admin-table__row">
                          <span>{row.domain}</span>
                          <span>{row.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="card__meta">No failing domains in latest heartbeat window.</p>
                  )}

                  <h3 id="admin-heartbeat-unsupported" style={{ marginTop: '16px' }}>Top unsupported namespaces</h3>
                  {data.heartbeat.latest.payload?.unsupportedPlugins?.topNamespaces?.length ? (
                    <div className="admin-table admin-table--logs">
                      <div className="admin-table__header">
                        <span>Namespace</span>
                        <span>Count</span>
                      </div>
                      {data.heartbeat.latest.payload.unsupportedPlugins.topNamespaces.map((row) => (
                        <div key={`unsupported-ns-${row.namespace}`} className="admin-table__row">
                          <span>{row.namespace}</span>
                          <span>{row.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="card__meta">No unsupported namespace events in latest heartbeat window.</p>
                  )}
                </>
              ) : (
                <p className="card__meta">
                  No heartbeat events yet. Heartbeat emits after every 10 completed scans.
                </p>
              )}

              <h3 id="admin-heartbeat-recent" style={{ marginTop: '16px' }}>Recent heartbeat events</h3>
              {data?.heartbeat?.recent?.length ? (
                <div className="admin-table admin-table--logs">
                  <div className="admin-table__header">
                    <span>ID</span>
                    <span>Timestamp</span>
                    <span>Scans</span>
                    <span>p95</span>
                    <span>Error total</span>
                  </div>
                  {data.heartbeat.recent.map((heartbeat) => (
                    <div key={`heartbeat-${heartbeat.id}`} className="admin-table__row">
                      <span>{heartbeat.id}</span>
                      <span>{heartbeat.timestamp}</span>
                      <span>{heartbeat.payload?.scansCompleted ?? '—'}</span>
                      <span>{formatMs(heartbeat.payload?.scanDurationMs?.p95)}</span>
                      <span>{heartbeat.payload?.errors?.total ?? 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No heartbeat history yet.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'assets' && data ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-assets-overview">Homepage asset signals</h2>
                <p className="card__meta">
                  Aggregated asset paths from recent homepage scans, grouped by match status.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="muted" style={{ marginBottom: '12px' }}>
                <strong>{data?.homepageAssets?.totalPaths ?? 0}</strong> total paths ·{' '}
                <strong>{data?.homepageAssets?.unknownPaths ?? 0}</strong> unknown
              </div>

              <h3 id="admin-assets-unknown">Unknown assets</h3>
              {data?.homepageAssets?.unknown?.length ? (
                <div className="admin-table admin-table--logs">
                  <div className="admin-table__header">
                    <span>Path</span>
                    <span>Type</span>
                    <span>Occurrences</span>
                  </div>
                  {data.homepageAssets.unknown.map((asset) => (
                    <div key={`unknown-${asset.path}`} className="admin-table__row">
                      <span className="admin-table__cell admin-table__cell--expand">{asset.path}</span>
                      <span>{asset.type}</span>
                      <span>{asset.occurrences}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No unknown assets detected in recent scans.</p>
              )}

              <h3 id="admin-assets-all" style={{ marginTop: '16px' }}>All assets</h3>
              {data?.homepageAssets?.all?.length ? (
                <div className="admin-table admin-table--logs">
                  <div className="admin-table__header">
                    <span>Path</span>
                    <span>Type</span>
                    <span>Occurrences</span>
                    <span>Matches</span>
                  </div>
                  {data.homepageAssets.all.map((asset) => (
                    <div key={asset.path} className="admin-table__row admin-table__row--expandable">
                      <span className="admin-table__cell admin-table__cell--expand">{asset.path}</span>
                      <span>{asset.type}</span>
                      <span>{asset.occurrences}</span>
                      <span>
                        {asset.matches?.length ? (
                          <div className="tag-cloud tag-cloud--compact">
                            {asset.matches.map((match) => (
                              <span key={`${asset.path}:${match.id ?? match.slug ?? match.label}`} className="tag">
                                {match.label ?? match.id ?? match.slug}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">No matches</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No homepage asset data available.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'plugins' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-supported-plugins-main">Supported plugins</h2>
                <p className="card__meta">
                  {SUPPORTED_PLUGINS.length} plugin namespaces tracked in the registry.
                </p>
              </div>
            </CardHeader>
            <CardContent>
                <div className="admin-filters">
                  <label className="admin-filter-field">
                    Search
                    <input
                      type="text"
                      value={pluginCatalogQuery}
                      onChange={(event) => setPluginCatalogQuery(event.target.value)}
                      placeholder="Search plugin label or ID"
                    />
                  </label>
                  <label className="admin-filter-field">
                    Sort
                    <select
                      value={pluginCatalogSort}
                      onChange={(event) => setPluginCatalogSort(event.target.value)}
                    >
                      <option value="labelAsc">Label (A-Z)</option>
                      <option value="namespacesDesc">Namespaces (high-low)</option>
                      <option value="namespacesAsc">Namespaces (low-high)</option>
                    </select>
                  </label>
                </div>
                <div className="admin-table admin-table--plugins">
                  <div className="admin-table__header">
                    <span>Plugin</span>
                    <span>Namespaces</span>
                    <span>Docs</span>
                    <span>Description</span>
                  </div>
                  {filteredSupportedPlugins.map((plugin) => {
                    const isExpanded = expandedPluginId === plugin.id;
                    return (
                      <div key={plugin.id} className="admin-table__row admin-table__row--expandable">
                        <button
                          type="button"
                          className="admin-table__cell admin-table__cell--expand"
                          onClick={() => setExpandedPluginId(isExpanded ? null : plugin.id)}
                          aria-expanded={isExpanded}
                        >
                          {plugin.label}
                        </button>
                        <span>{plugin.namespaces?.length ?? 0}</span>
                        <span>
                          {plugin.pluginUrl ? (
                            <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">
                              Link
                            </a>
                          ) : (
                            '—'
                          )}
                        </span>
                        <span>{plugin.description}</span>
                        {isExpanded ? (
                          <div className="admin-table__details">
                            <p><strong>Namespaces:</strong> {plugin.namespaces?.length ? plugin.namespaces.join(', ') : 'None'}</p>
                            <p><strong>Asset hints:</strong> {plugin.assetHints?.length ? plugin.assetHints.join(', ') : 'None'}</p>
                            {plugin.pluginUrl ? (
                              <p><strong>Docs:</strong> <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">{plugin.pluginUrl}</a></p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
              {!filteredSupportedPlugins.length ? (
                <p className="card__meta">No supported plugins match this filter.</p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'themes' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-supported-themes-main">Supported themes</h2>
                <p className="card__meta">
                  {SUPPORTED_THEMES.length} popular themes tracked for detection signals.
                </p>
              </div>
            </CardHeader>
            <CardContent>
                <div className="admin-filters">
                  <label className="admin-filter-field">
                    Search
                    <input
                      type="text"
                      value={themeCatalogQuery}
                      onChange={(event) => setThemeCatalogQuery(event.target.value)}
                      placeholder="Search theme label or ID"
                    />
                  </label>
                  <label className="admin-filter-field">
                    Sort
                    <select
                      value={themeCatalogSort}
                      onChange={(event) => setThemeCatalogSort(event.target.value)}
                    >
                      <option value="labelAsc">Label (A-Z)</option>
                      <option value="pathsDesc">Paths (high-low)</option>
                      <option value="pathsAsc">Paths (low-high)</option>
                    </select>
                  </label>
                </div>
                <div className="admin-table admin-table--themes">
                  <div className="admin-table__header">
                    <span>Theme</span>
                    <span>Paths</span>
                    <span>Namespaces</span>
                    <span>Docs</span>
                    <span>Description</span>
                  </div>
                  {filteredSupportedThemes.map((theme) => {
                    const isExpanded = expandedThemeId === theme.id;
                    return (
                      <div key={theme.id} className="admin-table__row admin-table__row--expandable">
                        <button
                          type="button"
                          className="admin-table__cell admin-table__cell--expand"
                          onClick={() => setExpandedThemeId(isExpanded ? null : theme.id)}
                          aria-expanded={isExpanded}
                        >
                          {theme.label}
                        </button>
                        <span>{theme.pathSignals?.length ?? 0}</span>
                        <span>{theme.namespaceHints?.length ?? 0}</span>
                        <span>
                          {theme.themeUrl ? (
                            <a href={theme.themeUrl} target="_blank" rel="noreferrer">
                              Link
                            </a>
                          ) : (
                            '—'
                          )}
                        </span>
                        <span>{theme.description}</span>
                        {isExpanded ? (
                          <div className="admin-table__details">
                            <p><strong>Path signals:</strong> {theme.pathSignals?.length ? theme.pathSignals.join(', ') : 'None'}</p>
                            <p><strong>Namespace hints:</strong> {theme.namespaceHints?.length ? theme.namespaceHints.join(', ') : 'None'}</p>
                            {theme.themeUrl ? (
                              <p><strong>Docs:</strong> <a href={theme.themeUrl} target="_blank" rel="noreferrer">{theme.themeUrl}</a></p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
              {!filteredSupportedThemes.length ? (
                <p className="card__meta">No supported themes match this filter.</p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </AppLayout>
  );
}

AdminPage.propTypes = {
  headerActions: PropTypes.node,
  onNavigate: PropTypes.func.isRequired,
  rotateLogs: PropTypes.func.isRequired,
  isRotatingLogs: PropTypes.bool,
  onRescan: PropTypes.func.isRequired
};

AdminPage.defaultProps = {
  headerActions: null,
  isRotatingLogs: false
};

export default AdminPage;

function ActivityLogsTable({ logs, expandedLogIds, onToggle }) {
  return (
    <div className="admin-table admin-table--activity-logs">
      <div className="admin-table__header">
        <span>ID</span>
        <span>Timestamp</span>
        <span>Type</span>
        <span>Bytes</span>
        <span>Payload</span>
      </div>
      {logs.map((log) => {
        const payloadText = serializePayload(log.payload);
        const payloadBytes = getPayloadSize(payloadText);
        const isExpanded = expandedLogIds.has(log.id);
        return (
          <div key={log.id} className="admin-table__row admin-table__row--expandable">
            <span>{log.id}</span>
            <span>{log.timestamp}</span>
            <span>{log.type}</span>
            <span>{payloadBytes}</span>
            <span className="admin-log-preview">
              <code className="admin-table__code admin-table__code--inline">
                {isExpanded ? payloadText : truncateText(payloadText, 220)}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggle(log.id)}
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </span>
            {isExpanded ? (
              <div className="admin-table__details">
                <code className="code-block">{payloadText}</code>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

ActivityLogsTable.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    timestamp: PropTypes.string,
    type: PropTypes.string,
    payload: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.array])
  })),
  expandedLogIds: PropTypes.instanceOf(Set),
  onToggle: PropTypes.func.isRequired
};

ActivityLogsTable.defaultProps = {
  logs: [],
  expandedLogIds: new Set()
};

function serializePayload(payload) {
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload ?? {}, null, 2);
}

function getPayloadSize(text) {
  if (!text) return 0;
  try {
    return new Blob([text]).size;
  } catch {
    return text.length;
  }
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatMs(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)}ms`;
}

function formatShortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  });
}

function formatFullTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatWalSummary(walCheckpoint) {
  if (!walCheckpoint) return 'Not run';
  if (walCheckpoint.error) return `Error: ${walCheckpoint.error}`;
  const logPages = walCheckpoint.log ?? walCheckpoint.log_pages ?? walCheckpoint.logFrames ?? walCheckpoint.log_frames;
  const checkpointed = walCheckpoint.checkpointed ?? walCheckpoint.checkpointedFrames ?? walCheckpoint.frames;
  const busy = walCheckpoint.busy ?? walCheckpoint.blocked;
  return [
    Number.isFinite(logPages) ? `${logPages} log pages` : null,
    Number.isFinite(checkpointed) ? `${checkpointed} checkpointed` : null,
    Number.isFinite(busy) ? `${busy} busy` : null
  ]
    .filter(Boolean)
    .join(' · ') || 'Completed';
}

function sumFinite(values = []) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return null;
  return finiteValues.reduce((total, value) => total + value, 0);
}

function deriveDomainsFromUnsupported(unsupported = []) {
  const map = new Map();
  unsupported.forEach((entry) => {
    (entry.domains ?? []).forEach((domain) => {
      const record = map.get(domain) ?? { domain, namespaceSet: new Set() };
      if (entry.namespace) {
        record.namespaceSet.add(entry.namespace);
      }
      map.set(domain, record);
    });
  });
  return Array.from(map.values())
    .map((record) => ({
      domain: record.domain,
      namespaces: Array.from(record.namespaceSet).sort()
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

function deriveHeartbeatSeries(recent = [], getValue) {
  if (!recent.length) return [];
  return [...recent]
    .sort((a, b) => {
      const left = Date.parse(a?.timestamp ?? '');
      const right = Date.parse(b?.timestamp ?? '');
      if (Number.isNaN(left) || Number.isNaN(right)) return 0;
      return left - right;
    })
    .map((entry) => getValue(entry.payload ?? {}))
    .filter((value) => Number.isFinite(value));
}

function TrendBadge({ label, values, lowerIsBetter, formatValue }) {
  const lastValue = values.length ? values[values.length - 1] : null;
  const firstValue = values.length ? values[0] : null;
  const hasTrend = values.length >= 2 && Number.isFinite(lastValue) && Number.isFinite(firstValue);
  const delta = hasTrend ? lastValue - firstValue : 0;
  const pct = hasTrend && firstValue !== 0 ? (delta / firstValue) * 100 : null;
  const isFlat = !hasTrend || delta === 0;
  const improving = hasTrend
    ? (lowerIsBetter ? delta < 0 : delta > 0)
    : false;
  const toneClass = isFlat
    ? 'trend-badge--neutral'
    : improving
      ? 'trend-badge--good'
      : 'trend-badge--bad';
  const sparkline = buildSparkline(values);

  return (
    <div className={`trend-badge ${toneClass}`}>
      <div className="trend-badge__header">
        <span className="trend-badge__label">{label}</span>
        <span className="trend-badge__value">
          {lastValue !== null ? formatValue(lastValue) : '—'}
        </span>
      </div>
      <div className="trend-badge__meta">
        <span className="trend-badge__spark">{sparkline}</span>
        <span>
          {isFlat
            ? 'No trend yet'
            : `${delta > 0 ? '+' : ''}${formatDelta(delta, formatValue)}${pct !== null ? ` (${delta > 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}`}
        </span>
      </div>
    </div>
  );
}

TrendBadge.propTypes = {
  label: PropTypes.string.isRequired,
  values: PropTypes.arrayOf(PropTypes.number),
  lowerIsBetter: PropTypes.bool,
  formatValue: PropTypes.func
};

TrendBadge.defaultProps = {
  values: [],
  lowerIsBetter: true,
  formatValue: (value) => String(value)
};

function formatDelta(delta, formatValue) {
  return formatValue(Math.abs(delta));
}

function buildSparkline(values) {
  if (!values.length) return '------';
  if (values.length === 1) return '●';

  const ticks = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return values.map(() => '▅').join('');

  return values
    .map((value) => {
      const normalized = (value - min) / (max - min);
      const index = Math.max(0, Math.min(ticks.length - 1, Math.round(normalized * (ticks.length - 1))));
      return ticks[index];
    })
    .join('');
}
