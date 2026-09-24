/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck Legacy JS admin sections expose incomplete prop declarations.

import {
  lazy,
  useCallback,
  useDeferredValue,
  useMemo,
  useState
} from 'react';
import AppLayout from '../templates/AppLayout';
import AdminSidebarNav from './admin/AdminSidebarNav.jsx';
import AdminSections from './admin/AdminSections.jsx';
import useAdminData from './admin/useAdminData.js';
import useAdminEditorState from './admin/useAdminEditorState.js';
import useAdminQueries from './admin/useAdminQueries.js';
import { buildAdminSectionsState } from './admin/sectionsState.js';
import { namespaceToSlug } from './admin/drafts.js';
import { AdminInbox, type AdminInboxItem } from '../../ui/admin/AdminInbox';

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

type AdminInboxActivityLog = Readonly<{
  type?: string;
  payload?: Readonly<{
    domain?: unknown;
    failureCategory?: unknown;
    message?: unknown;
  }>;
}>;

type AdminInboxUnsupportedEntry = Readonly<{
  namespace: string;
  domains?: ReadonlyArray<unknown>;
  lastDetectedAt?: string;
}>;

type AdminInboxAssetHint = Readonly<{
  slug: string;
  occurrences: number;
  pathCount: number;
}>;

type AdminInboxDomain = Readonly<{
  domain: string;
  lastStatus?: string;
  lastErrorCategory?: string;
}>;

type AdminInboxMaintenance = Readonly<{
  data?: Readonly<{ logs?: Readonly<{ lastMaintenanceAt?: string }> }>;
  mutation: Readonly<{
    isError?: boolean;
    error?: Readonly<{ message?: string }>;
    mutate: () => void;
  }>;
}>;

function buildAdminInboxItems({
  activityLogs,
  unsupportedEntries,
  unknownPluginAssetHints,
  domains,
  maintenance,
  onRescan,
  onCreatePluginFromAsset,
  onCreatePluginFromSuggestion
}: {
  activityLogs: ReadonlyArray<AdminInboxActivityLog>;
  unsupportedEntries: ReadonlyArray<AdminInboxUnsupportedEntry>;
  unknownPluginAssetHints: ReadonlyArray<AdminInboxAssetHint>;
  domains: ReadonlyArray<AdminInboxDomain>;
  maintenance: AdminInboxMaintenance;
  onRescan: (domain: string) => void;
  onCreatePluginFromAsset: (slug: string) => void;
  onCreatePluginFromSuggestion: (suggestion: { kind: string; namespace: string; slug: string }) => void;
}): AdminInboxItem[] {
  const failedScans = [
    ...activityLogs
      .filter((log): log is AdminInboxActivityLog & { payload: { domain: string } } => log.type === 'scan.error' && typeof log.payload?.domain === 'string')
      .map((log) => ({
        domain: log.payload.domain,
        evidence: typeof log.payload.failureCategory === 'string'
          ? log.payload.failureCategory
          : typeof log.payload.message === 'string' ? log.payload.message : 'Scan failed.'
      })),
    ...domains
      .filter((domain) => domain.lastStatus === 'failed' && typeof domain.domain === 'string')
      .map((domain) => ({
        domain: domain.domain,
        evidence: domain.lastErrorCategory || 'Latest scan failed.'
      }))
  ].filter((scan, index, scans) => scans.findIndex((candidate) => candidate.domain === scan.domain) === index);

  const items: AdminInboxItem[] = failedScans.map((scan) => ({
    id: `scan:failed:${scan.domain}`,
    kind: 'failed-scan',
    title: `Failed scan for ${scan.domain}`,
    status: 'failed',
    evidence: scan.evidence,
    action: { label: 'Rescan', onSelect: () => onRescan(scan.domain) },
    priority: 10
  }));

  const lastMaintenanceAt = maintenance.data?.logs?.lastMaintenanceAt;
  const hasMaintenanceError = Boolean(maintenance.mutation?.isError);
  if (!lastMaintenanceAt || hasMaintenanceError) {
    items.push({
      id: 'maintenance:database',
      kind: 'maintenance',
      title: 'Database maintenance due',
      status: hasMaintenanceError ? 'failed' : 'scheduled',
      evidence: hasMaintenanceError
        ? maintenance.mutation.error?.message ?? 'Latest maintenance run failed.'
        : 'No completed maintenance run is recorded.',
      action: { label: 'Run maintenance', onSelect: () => maintenance.mutation.mutate() },
      priority: hasMaintenanceError ? 15 : 40
    });
  }

  items.push(
    ...unsupportedEntries.map((entry) => ({
      id: `unsupported:${entry.namespace}`,
      kind: 'unsupported-namespace' as const,
      title: `Unsupported namespace ${entry.namespace}`,
      status: 'attention',
      evidence: `${entry.domains?.length ?? 0} domains; last seen ${entry.lastDetectedAt ?? 'unknown'}.`,
      action: {
        label: 'Promote',
        onSelect: () => onCreatePluginFromSuggestion({
          kind: 'namespace',
          namespace: entry.namespace,
          slug: namespaceToSlug(entry.namespace)
        })
      },
      priority: 30
    }))
  );

  items.push(
    ...unknownPluginAssetHints.map((asset) => ({
      id: `asset:${asset.slug}`,
      kind: 'discovered-asset' as const,
      title: `Unknown plugin asset ${asset.slug}`,
      status: 'review',
      evidence: `${asset.occurrences} occurrence${asset.occurrences === 1 ? '' : 's'} across ${asset.pathCount} path${asset.pathCount === 1 ? '' : 's'}.`,
      action: { label: 'Create plugin entry', onSelect: () => onCreatePluginFromAsset(asset.slug) },
      priority: 40
    }))
  );

  return items;
}

type AdminPageProps = {
  headerActions?: unknown;
  onNavigate: (page: string) => void;
  rotateLogs: () => void;
  isRotatingLogs?: boolean;
  onRescan: (domain: string) => void;
};

function AdminPage({ onNavigate, rotateLogs, isRotatingLogs, onRescan }: AdminPageProps) {
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
      handleCreatePluginFromAsset,
      handleCreatePluginFromSuggestion
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

  const adminInboxItems = useMemo(
    () => buildAdminInboxItems({
      activityLogs,
      unsupportedEntries,
      unknownPluginAssetHints,
      domains: domainsHistoryQuery.data?.items ?? [],
      maintenance: {
        data,
        mutation: maintenanceMutation
      },
      onRescan,
      onCreatePluginFromAsset: handleCreatePluginFromAsset,
      onCreatePluginFromSuggestion: handleCreatePluginFromSuggestion
    }),
    [
      activityLogs,
      data,
      domainsHistoryQuery.data,
      handleCreatePluginFromAsset,
      handleCreatePluginFromSuggestion,
      maintenanceMutation,
      onRescan,
      unknownPluginAssetHints,
      unsupportedEntries
    ]
  );

  return (
    <AppLayout
      embedded
    >
      <div className="app__body">
        <aside className="app__sidebar">{sidebarNav}</aside>
        <div className="app__main">
          {activeSection === 'db' ? <AdminInbox items={adminInboxItems} /> : null}
          <AdminSections state={adminSectionsState} />
        </div>
      </div>
    </AppLayout>
  );
}

export default AdminPage;
