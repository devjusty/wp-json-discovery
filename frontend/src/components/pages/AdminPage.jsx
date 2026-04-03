import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import AppLayout from '../templates/AppLayout.jsx';
import AdminSidebarNav from './admin/AdminSidebarNav.jsx';
import useAdminData from './admin/useAdminData.js';
import useAdminQueries from './admin/useAdminQueries.js';

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
  const [domainsSort, setDomainsSort] = useState('recent');
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

  const cancelPluginEdit = useCallback(() => {
    resetPluginDraft();
    setEditingPluginId(null);
  }, [resetPluginDraft]);

  const resetThemeDraft = useCallback(() => {
    setThemeDraft({
      id: '',
      label: '',
      description: '',
      themeUrl: '',
      namespaceHints: '',
      pathSignals: ''
    });
    setThemeValidationError('');
  }, []);

  const cancelThemeEdit = useCallback(() => {
    resetThemeDraft();
    setEditingThemeId(null);
  }, [resetThemeDraft]);

  const {
    snapshotQuery,
    pruneMutation,
    maintenanceMutation,
    pluginsQuery,
    themesQuery,
    domainsHistoryQuery,
    createPluginMutation,
    updatePluginMutation,
    deletePluginMutation,
    sortPluginsMutation,
    createThemeMutation,
    updateThemeMutation,
    deleteThemeMutation,
    sortThemesMutation
  } = useAdminQueries({
    activeSection,
    onPluginCreated: () => {
      resetPluginDraft();
      setShowCreatePluginModal(false);
    },
    onPluginSaved: () => {
      resetPluginDraft();
      setEditingPluginId(null);
    },
    onThemeCreated: () => {
      resetThemeDraft();
      setShowCreateThemeModal(false);
    },
    onThemeSaved: () => {
      resetThemeDraft();
      setEditingThemeId(null);
    }
  });

  const resetPluginMutationErrors = useCallback(() => {
    createPluginMutation.reset();
    updatePluginMutation.reset();
  }, [createPluginMutation, updatePluginMutation]);

  const managedPlugins = useMemo(
    () => pluginsQuery.data?.plugins ?? [],
    [pluginsQuery.data]
  );
  const managedThemes = useMemo(
    () => themesQuery.data?.themes ?? [],
    [themesQuery.data]
  );

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

  const handleCreatePluginFromAsset = useCallback(async (slug) => {
    const normalizedSlug = String(slug ?? '').trim().toLowerCase();
    if (!normalizedSlug) {
      return;
    }

    setActiveSection('plugin-manager');

    let plugins = managedPlugins;
    if (!plugins.length) {
      const fetchResult = await pluginsQuery.refetch();
      plugins = fetchResult?.data?.plugins ?? pluginsQuery.data?.plugins ?? [];
    }

    const existing = plugins.find((plugin) => plugin.id === normalizedSlug);
    resetPluginMutationErrors();

    if (existing) {
      setShowCreatePluginModal(false);
      startEditing(existing);
      return;
    }

    cancelPluginEdit();
    setPluginDraft({
      id: normalizedSlug,
      label: slugToLabel(normalizedSlug),
      description: 'Detected from homepage asset path signal.',
      pluginUrl: `https://wordpress.org/plugins/${normalizedSlug}/`,
      namespaces: '',
      assetHints: normalizedSlug
    });
    setShowCreatePluginModal(true);
  }, [
    managedPlugins,
    pluginsQuery,
    startEditing,
    cancelPluginEdit,
    setPluginDraft,
    setShowCreatePluginModal,
    setActiveSection,
    resetPluginMutationErrors
  ]);

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
    unknownPluginAssetHints
  } = useAdminData({
    data,
    activeSection,
    logTypeFilter,
    unsupportedNamespacePrefix,
    unsupportedSort,
    domainHistoryItems: domainsHistoryQuery.data?.items ?? [],
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
            snapshotQuery={snapshotQuery}
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

      {activeSection === 'domains' && domainsHistoryQuery.isLoading ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Loading tracked domains…</p>
          </div>
        </div>
      ) : null}

      {activeSection === 'domains' && domainsHistoryQuery.isError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{domainsHistoryQuery.error?.message ?? 'Failed to load tracked domains.'}</p>
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
              resetPluginMutationErrors();
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

      {activeSection === 'domains' && domainsHistoryQuery.data ? (
        <Suspense fallback={<SectionLoadingState label="Loading tracked domains..." />}>
          <AdminDomainsSection
            totalDomainEntries={domainsHistoryQuery.data?.items?.length ?? 0}
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
            unknownPluginAssetHints={unknownPluginAssetHints}
            onCreatePluginFromAsset={handleCreatePluginFromAsset}
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

function slugToLabel(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

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
