import {
  lazy,
  useCallback,
  useDeferredValue,
  useMemo,
  useState
} from 'react';
import PropTypes from 'prop-types';
import AppLayout from '../templates/AppLayout.jsx';
import AdminSidebarNav from './admin/AdminSidebarNav.jsx';
import AdminSections from './admin/AdminSections.jsx';
import useAdminData from './admin/useAdminData.js';
import useAdminEditorState from './admin/useAdminEditorState.js';
import useAdminQueries from './admin/useAdminQueries.js';
import { buildAdminSectionsState } from './admin/sectionsState.js';

// Admin page layering notes live in ./admin/README.md.

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
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [unsupportedNamespacePrefix, setUnsupportedNamespacePrefix] = useState('');
  const [unsupportedSort, setUnsupportedSort] = useState('lastSeenDesc');
  const [domainsQuery, setDomainsQuery] = useState('');
  const [domainsSort, setDomainsSort] = useState('recent');
  const [pluginCatalogQuery, setPluginCatalogQuery] = useState('');
  const [pluginCatalogSort, setPluginCatalogSort] = useState('labelAsc');
  const [themeCatalogQuery, setThemeCatalogQuery] = useState('');
  const [themeCatalogSort, setThemeCatalogSort] = useState('labelAsc');
  // Defer expensive client-side catalog filtering while users type.
  const deferredDomainsQuery = useDeferredValue(domainsQuery);
  const deferredPluginCatalogQuery = useDeferredValue(pluginCatalogQuery);
  const deferredThemeCatalogQuery = useDeferredValue(themeCatalogQuery);
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
    activeSection
  });

  const managedPlugins = useMemo(
    () => pluginsQuery.data?.plugins ?? [],
    [pluginsQuery.data]
  );
  const managedThemes = useMemo(
    () => themesQuery.data?.themes ?? [],
    [themesQuery.data]
  );

  const {
    pluginDraft,
    setPluginDraft,
    editingPluginId,
    pluginValidationError,
    showCreatePluginModal,
    startEditing,
    handlePluginSave,
    cancelPluginEdit,
    handleOpenCreatePluginModal,
    handleCloseCreatePluginModal,
    handleCreatePluginFromAsset,
    handleCreatePluginFromSuggestion,
    themeDraft,
    setThemeDraft,
    editingThemeId,
    themeValidationError,
    showCreateThemeModal,
    startEditingTheme,
    handleThemeSave,
    cancelThemeEdit,
    handleOpenCreateThemeModal,
    handleCloseCreateThemeModal
  } = useAdminEditorState({
    managedPlugins,
    managedThemes,
    pluginsQuery,
    createPluginMutation,
    updatePluginMutation,
    createThemeMutation,
    updateThemeMutation,
    setActiveSection
  });

  const sidebarNav = (
    <AdminSidebarNav
      activeSection={activeSection}
      onNavigate={onNavigate}
      onSetActiveSection={setActiveSection}
      onPrefetchSection={prefetchAdminSection}
    />
  );

  const sectionComponents = useMemo(() => ({
    AdminMaintenanceSection,
    AdminDbSection,
    AdminPluginManagerSection,
    AdminDomainsSection,
    AdminUnsupportedSection,
    AdminLogsSection,
    AdminHeartbeatSection,
    AdminAssetsSection,
    AdminSupportedPluginsSection,
    AdminSupportedThemesSection,
    AdminThemeManagerSection
  }), []);

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
    unknownPluginAssetHints,
    pluginSuggestions
  } = useAdminData({
    data,
    activeSection,
    logTypeFilter,
    unsupportedNamespacePrefix,
    unsupportedSort,
    domainHistoryItems: domainsHistoryQuery.data?.items ?? [],
    domainsQuery: deferredDomainsQuery,
    domainsSort,
    pluginCatalogQuery: deferredPluginCatalogQuery,
    pluginCatalogSort,
    supportedPlugins: managedPlugins,
    themeCatalogQuery: deferredThemeCatalogQuery,
    themeCatalogSort,
    supportedThemes: managedThemes
  });

  const adminSectionsState = buildAdminSectionsState({
    activeSection,
    components: sectionComponents,
    data,
    snapshotQuery,
    domainsHistoryQuery,
    isSnapshotBackedSection,
    maintenance: {
      maintenanceMutation
    },
    db: {
      setActiveSection,
      recentScans,
      expandedScanIds,
      setExpandedScanIds,
      onRescan,
      activityLogs,
      logTypeFilter,
      setLogTypeFilter,
      logTypes,
      filteredActivityLogs,
      expandedLogIds,
      setExpandedLogIds
    },
    domains: {
      onRescan,
      filteredDomainEntries,
      domainsQuery,
      setDomainsQuery,
      domainsSort,
      setDomainsSort,
      expandedDomainRows,
      setExpandedDomainRows
    },
    unsupported: {
      unsupportedEntries,
      unsupportedNamespacePrefix,
      setUnsupportedNamespacePrefix,
      unsupportedSort,
      setUnsupportedSort,
      filteredUnsupportedEntries,
      unknownPluginAssetHints,
      handleCreatePluginFromAsset
    },
    logs: {
      activityLogs,
      logTypeFilter,
      setLogTypeFilter,
      logTypes,
      filteredActivityLogs,
      expandedLogIds,
      setExpandedLogIds,
      rotateLogs,
      isRotatingLogs,
      pruneMutation
    },
    heartbeat: {
      heartbeatP95Series,
      heartbeatErrorSeries
    },
    pluginCatalog: {
      managedPlugins,
      pluginsQuery,
      pluginCatalogQuery,
      setPluginCatalogQuery,
      pluginCatalogSort,
      setPluginCatalogSort,
      filteredSupportedPlugins,
      expandedPluginId,
      setExpandedPluginId
    },
    themeCatalog: {
      managedThemes,
      themesQuery,
      themeCatalogQuery,
      setThemeCatalogQuery,
      themeCatalogSort,
      setThemeCatalogSort,
      filteredSupportedThemes,
      expandedThemeId,
      setExpandedThemeId
    },
    pluginManager: {
      sortPluginsMutation,
      pluginsQuery,
      managedPlugins,
      pluginDraft,
      setPluginDraft,
      editingPluginId,
      createPluginMutation,
      updatePluginMutation,
      handlePluginSave,
      cancelPluginEdit,
      pluginValidationError,
      handleOpenCreatePluginModal,
      handleCloseCreatePluginModal,
      showCreatePluginModal,
      startEditing,
      deletePluginMutation,
      handleCreatePluginFromSuggestion,
      pluginSuggestions
    },
    themeManager: {
      sortThemesMutation,
      themesQuery,
      managedThemes,
      themeDraft,
      setThemeDraft,
      editingThemeId,
      createThemeMutation,
      updateThemeMutation,
      handleThemeSave,
      cancelThemeEdit,
      themeValidationError,
      handleOpenCreateThemeModal,
      handleCloseCreateThemeModal,
      showCreateThemeModal,
      startEditingTheme,
      deleteThemeMutation
    }
  });

  return (
    <AppLayout
      title="Admin"
      subtitle="Inspect Turso-backed scan data, registries, unsupported namespaces, and activity logs."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      <AdminSections state={adminSectionsState} />
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
