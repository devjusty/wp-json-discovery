import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import AdminSidebarNav from './admin/AdminSidebarNav.jsx';
import useAdminData from './admin/useAdminData.js';
import {
  fetchDbSnapshot,
  pruneActivityLogs,
  runDbMaintenance,
  fetchPlugins,
  fetchThemes,
  createPlugin,
  updatePlugin,
  deletePlugin,
  sortPlugins as sortPluginsApi,
  createTheme,
  updateTheme,
  deleteTheme,
  sortThemes as sortThemesApi
} from '../../api/admin.js';

const loadAdminMaintenanceSection = () => import('./admin/sections/AdminMaintenanceSection.jsx');
const loadAdminDbSection = () => import('./admin/sections/AdminDbSection.jsx');
const loadAdminLogsSection = () => import('./admin/sections/AdminLogsSection.jsx');
const loadAdminHeartbeatSection = () => import('./admin/sections/AdminHeartbeatSection.jsx');
const loadAdminPluginManagerSection = () => import('./admin/sections/AdminPluginManagerSection.jsx');
const loadAdminDomainsSection = () => import('./admin/sections/AdminDomainsSection.jsx');
const loadAdminUnsupportedSection = () => import('./admin/sections/AdminUnsupportedSection.jsx');
const loadAdminAssetsSection = () => import('./admin/sections/AdminAssetsSection.jsx');
const loadAdminSupportedPluginsSection = () => import('./admin/sections/AdminSupportedPluginsSection.jsx');
const loadAdminSupportedThemesSection = () => import('./admin/sections/AdminSupportedThemesSection.jsx');
const loadAdminThemeManagerSection = () => import('./admin/sections/AdminThemeManagerSection.jsx');

const AdminMaintenanceSection = lazy(loadAdminMaintenanceSection);
const AdminDbSection = lazy(loadAdminDbSection);
const AdminLogsSection = lazy(loadAdminLogsSection);
const AdminHeartbeatSection = lazy(loadAdminHeartbeatSection);
const AdminPluginManagerSection = lazy(loadAdminPluginManagerSection);
const AdminDomainsSection = lazy(loadAdminDomainsSection);
const AdminUnsupportedSection = lazy(loadAdminUnsupportedSection);
const AdminAssetsSection = lazy(loadAdminAssetsSection);
const AdminSupportedPluginsSection = lazy(loadAdminSupportedPluginsSection);
const AdminSupportedThemesSection = lazy(loadAdminSupportedThemesSection);
const AdminThemeManagerSection = lazy(loadAdminThemeManagerSection);

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
  const [showCreatePluginModal, setShowCreatePluginModal] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [unsupportedNamespacePrefix, setUnsupportedNamespacePrefix] = useState('');
  const [unsupportedSort, setUnsupportedSort] = useState('lastSeenDesc');
  const [domainsQuery, setDomainsQuery] = useState('');
  const [domainsSort, setDomainsSort] = useState('domainAsc');
  const [pluginCatalogQuery, setPluginCatalogQuery] = useState('');
  const [pluginCatalogSort, setPluginCatalogSort] = useState('labelAsc');
  const [themeCatalogQuery, setThemeCatalogQuery] = useState('');
  const [themeCatalogSort, setThemeCatalogSort] = useState('labelAsc');
  const [themeDraft, setThemeDraft] = useState({
    id: '',
    label: '',
    description: '',
    themeUrl: '',
    namespaceHints: '',
    pathSignals: ''
  });
  const [editingThemeId, setEditingThemeId] = useState(null);
  const [themeValidationError, setThemeValidationError] = useState('');
  const [showCreateThemeModal, setShowCreateThemeModal] = useState(false);
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
    enabled: activeSection === 'plugin-manager' || activeSection === 'plugins',
    refetchOnWindowFocus: false
  });
  const themesQuery = useQuery({
    queryKey: ['adminThemes'],
    queryFn: fetchThemes,
    enabled: activeSection === 'themes' || activeSection === 'theme-manager',
    refetchOnWindowFocus: false
  });
  const createPluginMutation = useMutation({
    mutationFn: createPlugin,
    onSuccess: () => {
      pluginsQuery.refetch();
      resetPluginDraft();
      setShowCreatePluginModal(false);
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
  const createThemeMutation = useMutation({
    mutationFn: createTheme,
    onSuccess: () => {
      themesQuery.refetch();
      resetThemeDraft();
      setShowCreateThemeModal(false);
    }
  });
  const updateThemeMutation = useMutation({
    mutationFn: ({ id, payload }) => updateTheme(id, payload),
    onSuccess: () => {
      themesQuery.refetch();
      resetThemeDraft();
    }
  });
  const deleteThemeMutation = useMutation({
    mutationFn: deleteTheme,
    onSuccess: () => {
      themesQuery.refetch();
      resetThemeDraft();
    }
  });
  const sortThemesMutation = useMutation({
    mutationFn: sortThemesApi,
    onSuccess: () => {
      themesQuery.refetch();
    }
  });
  const managedPlugins = useMemo(
    () => pluginsQuery.data?.plugins ?? [],
    [pluginsQuery.data]
  );
  const managedThemes = useMemo(
    () => themesQuery.data?.themes ?? [],
    [themesQuery.data]
  );

  const parseList = useCallback((value) => {
    return value
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }, []);

  const prefetchAdminSection = useCallback((sectionKey) => {
    switch (sectionKey) {
      case 'db':
        void loadAdminDbSection();
        break;
      case 'maintenance':
        void loadAdminMaintenanceSection();
        break;
      case 'unsupported':
        void loadAdminUnsupportedSection();
        break;
      case 'domains':
        void loadAdminDomainsSection();
        break;
      case 'logs':
        void loadAdminLogsSection();
        break;
      case 'heartbeat':
        void loadAdminHeartbeatSection();
        break;
      case 'plugins':
        void loadAdminSupportedPluginsSection();
        break;
      case 'plugin-manager':
        void loadAdminPluginManagerSection();
        break;
      case 'themes':
        void loadAdminSupportedThemesSection();
        break;
      case 'theme-manager':
        void loadAdminThemeManagerSection();
        break;
      case 'assets':
        void loadAdminAssetsSection();
        break;
      default:
        break;
    }
  }, []);

  const resetPluginDraft = () => {
    setPluginDraft({
      id: '',
      label: '',
      description: '',
      pluginUrl: '',
      namespaces: '',
      assetHints: ''
    });
    setPluginValidationError('');
  };

  const cancelPluginEdit = () => {
    resetPluginDraft();
    setEditingPluginId(null);
  };

  const resetThemeDraft = () => {
    setThemeDraft({
      id: '',
      label: '',
      description: '',
      themeUrl: '',
      namespaceHints: '',
      pathSignals: ''
    });
    setThemeValidationError('');
  };

  const cancelThemeEdit = () => {
    resetThemeDraft();
    setEditingThemeId(null);
  };

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

  const startEditingTheme = useCallback((theme) => {
    setEditingThemeId(theme.id);
    setThemeValidationError('');
    setThemeDraft({
      id: theme.id ?? '',
      label: theme.label ?? '',
      description: theme.description ?? '',
      themeUrl: theme.themeUrl ?? '',
      namespaceHints: (theme.namespaceHints ?? []).join('\n'),
      pathSignals: (theme.pathSignals ?? []).join('\n')
    });
  }, []);

  useEffect(() => {
    if (pluginValidationError) {
      setPluginValidationError('');
    }
  }, [pluginDraft, editingPluginId, pluginValidationError]);

  useEffect(() => {
    if (themeValidationError) {
      setThemeValidationError('');
    }
  }, [themeDraft, editingThemeId, themeValidationError]);

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

  const handleThemeSave = useCallback(() => {
    const payload = {
      id: themeDraft.id.trim(),
      label: themeDraft.label.trim(),
      description: themeDraft.description.trim(),
      themeUrl: themeDraft.themeUrl.trim(),
      namespaceHints: Array.from(new Set(parseList(themeDraft.namespaceHints))),
      pathSignals: Array.from(new Set(parseList(themeDraft.pathSignals)))
    };

    if (!payload.id) {
      setThemeValidationError('Theme ID is required.');
      return;
    }
    if (!payload.label) {
      setThemeValidationError('Theme label is required.');
      return;
    }
    if (!payload.pathSignals.length) {
      setThemeValidationError('Add at least one path signal before saving.');
      return;
    }
    if (!editingThemeId && managedThemes.some((theme) => theme.id === payload.id)) {
      setThemeValidationError(`Theme ID "${payload.id}" already exists.`);
      return;
    }

    setThemeValidationError('');
    if (editingThemeId) {
      updateThemeMutation.mutate({ id: editingThemeId, payload });
    } else {
      createThemeMutation.mutate(payload);
    }
  }, [themeDraft, editingThemeId, parseList, updateThemeMutation, createThemeMutation, managedThemes]);

  const sidebarNav = (
    <AdminSidebarNav
      activeSection={activeSection}
      onNavigate={onNavigate}
      onSetActiveSection={setActiveSection}
      onPrefetchSection={prefetchAdminSection}
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
    supportedPlugins: managedPlugins,
    themeCatalogQuery,
    themeCatalogSort,
    supportedThemes: managedThemes
  });

  return (
    <AppLayout
      title="Admin"
      subtitle="Inspect Turso-backed scan data, registries, unsupported namespaces, and activity logs."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      {activeSection === 'maintenance' ? (
        <Suspense fallback={<SectionLoadingState label="Loading maintenance..." />}>
          <AdminMaintenanceSection
            data={data}
            maintenanceMutation={maintenanceMutation}
          />
        </Suspense>
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
        <Suspense fallback={<SectionLoadingState label="Loading data snapshot..." />}>
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
        </Suspense>
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
        <Suspense fallback={<SectionLoadingState label="Loading plugin manager..." />}>
          <AdminPluginManagerSection
            sortPluginsMutation={sortPluginsMutation}
            pluginsQuery={pluginsQuery}
            managedPlugins={managedPlugins}
            pluginDraft={pluginDraft}
            setPluginDraft={setPluginDraft}
            editingPluginId={editingPluginId}
            createPluginPending={createPluginMutation.isPending}
            updatePluginPending={updatePluginMutation.isPending}
            onPluginSave={handlePluginSave}
            onPluginReset={cancelPluginEdit}
            pluginValidationError={pluginValidationError}
            pluginSaveError={createPluginMutation.error?.message || updatePluginMutation.error?.message || ''}
            onOpenCreateModal={() => {
              cancelPluginEdit();
              setShowCreatePluginModal(true);
            }}
            showCreateModal={showCreatePluginModal}
            onCloseCreateModal={() => {
              setShowCreatePluginModal(false);
              cancelPluginEdit();
            }}
            startEditing={startEditing}
            deletePluginMutation={deletePluginMutation}
          />
        </Suspense>
      ) : null}

      {activeSection === 'domains' && data ? (
        <Suspense fallback={<SectionLoadingState label="Loading tracked domains..." />}>
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
        </Suspense>
      ) : null}

      {activeSection === 'unsupported' && data ? (
        <Suspense fallback={<SectionLoadingState label="Loading unsupported namespaces..." />}>
          <AdminUnsupportedSection
            unsupportedEntries={unsupportedEntries}
            unsupportedNamespacePrefix={unsupportedNamespacePrefix}
            setUnsupportedNamespacePrefix={setUnsupportedNamespacePrefix}
            unsupportedSort={unsupportedSort}
            setUnsupportedSort={setUnsupportedSort}
            filteredUnsupportedEntries={filteredUnsupportedEntries}
          />
        </Suspense>
      ) : null}

      {activeSection === 'logs' && data ? (
        <Suspense fallback={<SectionLoadingState label="Loading activity logs..." />}>
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
        </Suspense>
      ) : null}

      {activeSection === 'heartbeat' && data ? (
        <Suspense fallback={<SectionLoadingState label="Loading heartbeat analytics..." />}>
          <AdminHeartbeatSection
            data={data}
            heartbeatP95Series={heartbeatP95Series}
            heartbeatErrorSeries={heartbeatErrorSeries}
          />
        </Suspense>
      ) : null}

      {activeSection === 'assets' && data ? (
        <Suspense fallback={<SectionLoadingState label="Loading homepage assets..." />}>
          <AdminAssetsSection data={data} />
        </Suspense>
      ) : null}

      {activeSection === 'plugins' ? (
        <Suspense fallback={<SectionLoadingState label="Loading supported plugins..." />}>
          <AdminSupportedPluginsSection
            totalPlugins={managedPlugins.length}
            isLoading={pluginsQuery.isLoading}
            isError={pluginsQuery.isError}
            errorMessage={pluginsQuery.error?.message || ''}
            pluginCatalogQuery={pluginCatalogQuery}
            setPluginCatalogQuery={setPluginCatalogQuery}
            pluginCatalogSort={pluginCatalogSort}
            setPluginCatalogSort={setPluginCatalogSort}
            filteredSupportedPlugins={filteredSupportedPlugins}
            expandedPluginId={expandedPluginId}
            setExpandedPluginId={setExpandedPluginId}
          />
        </Suspense>
      ) : null}

      {activeSection === 'themes' ? (
        <Suspense fallback={<SectionLoadingState label="Loading supported themes..." />}>
          <AdminSupportedThemesSection
            totalThemes={managedThemes.length}
            isLoading={themesQuery.isLoading}
            isError={themesQuery.isError}
            errorMessage={themesQuery.error?.message || ''}
            themeCatalogQuery={themeCatalogQuery}
            setThemeCatalogQuery={setThemeCatalogQuery}
            themeCatalogSort={themeCatalogSort}
            setThemeCatalogSort={setThemeCatalogSort}
            filteredSupportedThemes={filteredSupportedThemes}
            expandedThemeId={expandedThemeId}
            setExpandedThemeId={setExpandedThemeId}
          />
        </Suspense>
      ) : null}

      {activeSection === 'theme-manager' ? (
        <Suspense fallback={<SectionLoadingState label="Loading theme manager..." />}>
          <AdminThemeManagerSection
            sortThemesMutation={sortThemesMutation}
            themesQuery={themesQuery}
            managedThemes={managedThemes}
            themeDraft={themeDraft}
            setThemeDraft={setThemeDraft}
            editingThemeId={editingThemeId}
            createThemePending={createThemeMutation.isPending}
            updateThemePending={updateThemeMutation.isPending}
            onThemeSave={handleThemeSave}
            onThemeReset={cancelThemeEdit}
            themeValidationError={themeValidationError}
            themeSaveError={createThemeMutation.error?.message || updateThemeMutation.error?.message || ''}
            onOpenCreateModal={() => {
              cancelThemeEdit();
              setShowCreateThemeModal(true);
            }}
            showCreateModal={showCreateThemeModal}
            onCloseCreateModal={() => {
              setShowCreateThemeModal(false);
              cancelThemeEdit();
            }}
            startEditingTheme={startEditingTheme}
            deleteThemeMutation={deleteThemeMutation}
          />
        </Suspense>
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

function SectionLoadingState({ label }) {
  return (
    <div className="card card--info">
      <div className="card__content">
        <p>{label}</p>
      </div>
    </div>
  );
}

SectionLoadingState.propTypes = {
  label: PropTypes.string.isRequired
};
