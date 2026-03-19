import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import AdminSidebarNav from './admin/AdminSidebarNav.jsx';
import useAdminData from './admin/useAdminData.js';
import AdminMaintenanceSection from './admin/sections/AdminMaintenanceSection.jsx';
import AdminDbSection from './admin/sections/AdminDbSection.jsx';
import AdminLogsSection from './admin/sections/AdminLogsSection.jsx';
import AdminHeartbeatSection from './admin/sections/AdminHeartbeatSection.jsx';
import AdminPluginManagerSection from './admin/sections/AdminPluginManagerSection.jsx';
import AdminDomainsSection from './admin/sections/AdminDomainsSection.jsx';
import AdminUnsupportedSection from './admin/sections/AdminUnsupportedSection.jsx';
import AdminAssetsSection from './admin/sections/AdminAssetsSection.jsx';
import AdminSupportedPluginsSection from './admin/sections/AdminSupportedPluginsSection.jsx';
import AdminSupportedThemesSection from './admin/sections/AdminSupportedThemesSection.jsx';
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

  const sidebarNav = (
    <AdminSidebarNav
      activeSection={activeSection}
      onNavigate={onNavigate}
      onSetActiveSection={setActiveSection}
      editingPluginId={editingPluginId}
      pluginDraft={pluginDraft}
      setPluginDraft={setPluginDraft}
      createPluginPending={createPluginMutation.isPending}
      updatePluginPending={updatePluginMutation.isPending}
      onPluginSave={handlePluginSave}
      onPluginReset={() => {
        resetPluginDraft();
        setEditingPluginId(null);
      }}
      pluginValidationError={pluginValidationError}
      pluginSaveError={createPluginMutation.error?.message || updatePluginMutation.error?.message || ''}
    />
  );

  const data = snapshotQuery.data;
  const {
    isSnapshotBackedSection,
    activityLogs,
    logTypes,
    filteredActivityLogs,
    unsupportedEntries,
    filteredUnsupportedEntries,
    filteredDomainEntries,
    recentScans,
    heartbeatP95Series,
    heartbeatErrorSeries,
    filteredSupportedPlugins,
    filteredSupportedThemes,
    sqliteFootprintBytes
  } = useAdminData({
    data,
    activeSection,
    logTypeFilter,
    unsupportedNamespacePrefix,
    unsupportedSort,
    domainsQuery,
    domainsSort,
    pluginCatalogQuery,
    pluginCatalogSort,
    themeCatalogQuery,
    themeCatalogSort
  });

  return (
    <AppLayout
      title="Admin"
      subtitle="Inspect SQLite persistence for unsupported plugins and recent activity logs."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      {activeSection === 'maintenance' ? (
        <AdminMaintenanceSection
          data={data}
          maintenanceMutation={maintenanceMutation}
        />
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
        <AdminDbSection
          data={data}
          pruneMutation={pruneMutation}
          snapshotQuery={snapshotQuery}
          sqliteFootprintBytes={sqliteFootprintBytes}
          setActiveSection={setActiveSection}
          recentScans={recentScans}
          expandedScanIds={expandedScanIds}
          setExpandedScanIds={setExpandedScanIds}
          onRescan={onRescan}
          activityLogs={activityLogs}
          logTypeFilter={logTypeFilter}
          setLogTypeFilter={setLogTypeFilter}
          logTypes={logTypes}
          filteredActivityLogs={filteredActivityLogs}
          expandedLogIds={expandedLogIds}
          setExpandedLogIds={setExpandedLogIds}
        />
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
        <AdminPluginManagerSection
          sortPluginsMutation={sortPluginsMutation}
          pluginsQuery={pluginsQuery}
          managedPlugins={managedPlugins}
          startEditing={startEditing}
          deletePluginMutation={deletePluginMutation}
        />
      ) : null}

      {activeSection === 'domains' && data ? (
        <AdminDomainsSection
          unsupportedEntries={unsupportedEntries}
          domainsQuery={domainsQuery}
          setDomainsQuery={setDomainsQuery}
          domainsSort={domainsSort}
          setDomainsSort={setDomainsSort}
          filteredDomainEntries={filteredDomainEntries}
          expandedDomainRows={expandedDomainRows}
          setExpandedDomainRows={setExpandedDomainRows}
          onRescan={onRescan}
        />
      ) : null}

      {activeSection === 'unsupported' && data ? (
        <AdminUnsupportedSection
          unsupportedEntries={unsupportedEntries}
          unsupportedNamespacePrefix={unsupportedNamespacePrefix}
          setUnsupportedNamespacePrefix={setUnsupportedNamespacePrefix}
          unsupportedSort={unsupportedSort}
          setUnsupportedSort={setUnsupportedSort}
          filteredUnsupportedEntries={filteredUnsupportedEntries}
        />
      ) : null}

      {activeSection === 'logs' && data ? (
        <AdminLogsSection
          activityLogs={activityLogs}
          logTypeFilter={logTypeFilter}
          setLogTypeFilter={setLogTypeFilter}
          logTypes={logTypes}
          filteredActivityLogs={filteredActivityLogs}
          expandedLogIds={expandedLogIds}
          setExpandedLogIds={setExpandedLogIds}
          rotateLogs={rotateLogs}
          isRotatingLogs={isRotatingLogs}
          pruneMutation={pruneMutation}
        />
      ) : null}

      {activeSection === 'heartbeat' && data ? (
        <AdminHeartbeatSection
          data={data}
          heartbeatP95Series={heartbeatP95Series}
          heartbeatErrorSeries={heartbeatErrorSeries}
        />
      ) : null}

      {activeSection === 'assets' && data ? (
        <AdminAssetsSection data={data} />
      ) : null}

      {activeSection === 'plugins' ? (
        <AdminSupportedPluginsSection
          totalPlugins={SUPPORTED_PLUGINS.length}
          pluginCatalogQuery={pluginCatalogQuery}
          setPluginCatalogQuery={setPluginCatalogQuery}
          pluginCatalogSort={pluginCatalogSort}
          setPluginCatalogSort={setPluginCatalogSort}
          filteredSupportedPlugins={filteredSupportedPlugins}
          expandedPluginId={expandedPluginId}
          setExpandedPluginId={setExpandedPluginId}
        />
      ) : null}

      {activeSection === 'themes' ? (
        <AdminSupportedThemesSection
          totalThemes={SUPPORTED_THEMES.length}
          themeCatalogQuery={themeCatalogQuery}
          setThemeCatalogQuery={setThemeCatalogQuery}
          themeCatalogSort={themeCatalogSort}
          setThemeCatalogSort={setThemeCatalogSort}
          filteredSupportedThemes={filteredSupportedThemes}
          expandedThemeId={expandedThemeId}
          setExpandedThemeId={setExpandedThemeId}
        />
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
