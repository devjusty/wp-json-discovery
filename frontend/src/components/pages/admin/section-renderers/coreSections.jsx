import { createElement } from 'react';
import { SectionSuspense } from '../AdminSectionPrimitives.jsx';

// Core admin section renderers keep non-catalog branches isolated.
export function renderMaintenanceSection({ activeSection, AdminMaintenanceSection: MaintenanceSection, data, maintenance }) {
  if (activeSection !== 'maintenance') {
    return null;
  }

  return (
    <SectionSuspense label="Loading maintenance...">
      {createElement(MaintenanceSection, {
        data,
        maintenanceMutation: maintenance.maintenanceMutation
      })}
    </SectionSuspense>
  );
}

export function renderDbSection({ activeSection, AdminDbSection: DbSection, data, snapshotQuery, db }) {
  if (activeSection !== 'db' || !data) {
    return null;
  }

  return (
    <SectionSuspense label="Loading data snapshot...">
      {createElement(DbSection, {
        data,
        snapshotQuery,
        setActiveSection: db.setActiveSection,
        recentScans: db.recentScans,
        expandedScanIds: db.expandedScanIds,
        setExpandedScanIds: db.setExpandedScanIds,
        onRescan: db.onRescan,
        activityLogs: db.activityLogs,
        logTypeFilter: db.logTypeFilter,
        setLogTypeFilter: db.setLogTypeFilter,
        logTypes: db.logTypes,
        filteredActivityLogs: db.filteredActivityLogs,
        expandedLogIds: db.expandedLogIds,
        setExpandedLogIds: db.setExpandedLogIds
      })}
    </SectionSuspense>
  );
}

export function renderDomainsSection({ activeSection, AdminDomainsSection: DomainsSection, domainsHistoryQuery, domains }) {
  if (activeSection !== 'domains' || !domainsHistoryQuery.data) {
    return null;
  }

  return (
    <SectionSuspense label="Loading tracked domains...">
      {createElement(DomainsSection, {
        totalDomainEntries: domainsHistoryQuery.data?.items?.length ?? 0,
        domainsQuery: domains.domainsQuery,
        setDomainsQuery: domains.setDomainsQuery,
        domainsSort: domains.domainsSort,
        setDomainsSort: domains.setDomainsSort,
        filteredDomainEntries: domains.filteredDomainEntries,
        expandedDomainRows: domains.expandedDomainRows,
        setExpandedDomainRows: domains.setExpandedDomainRows,
        onRescan: domains.onRescan
      })}
    </SectionSuspense>
  );
}

export function renderUnsupportedSection({ activeSection, AdminUnsupportedSection: UnsupportedSection, data, unsupported }) {
  if (activeSection !== 'unsupported' || !data) {
    return null;
  }

  return (
    <SectionSuspense label="Loading unsupported namespaces...">
      {createElement(UnsupportedSection, {
        unsupportedEntries: unsupported.unsupportedEntries,
        unsupportedNamespacePrefix: unsupported.unsupportedNamespacePrefix,
        setUnsupportedNamespacePrefix: unsupported.setUnsupportedNamespacePrefix,
        unsupportedSort: unsupported.unsupportedSort,
        setUnsupportedSort: unsupported.setUnsupportedSort,
        filteredUnsupportedEntries: unsupported.filteredUnsupportedEntries,
        unknownPluginAssetHints: unsupported.unknownPluginAssetHints,
        onCreatePluginFromAsset: unsupported.handleCreatePluginFromAsset,
        onCreatePluginFromSuggestion: unsupported.handleCreatePluginFromSuggestion
      })}
    </SectionSuspense>
  );
}

export function renderLogsSection({ activeSection, AdminLogsSection: LogsSection, data, logs }) {
  if (activeSection !== 'logs' || !data) {
    return null;
  }

  return (
    <SectionSuspense label="Loading activity logs...">
      {createElement(LogsSection, {
        activityLogs: logs.activityLogs,
        logTypeFilter: logs.logTypeFilter,
        setLogTypeFilter: logs.setLogTypeFilter,
        logTypes: logs.logTypes,
        filteredActivityLogs: logs.filteredActivityLogs,
        expandedLogIds: logs.expandedLogIds,
        setExpandedLogIds: logs.setExpandedLogIds,
        rotateLogs: logs.rotateLogs,
        isRotatingLogs: logs.isRotatingLogs,
        pruneMutation: logs.pruneMutation
      })}
    </SectionSuspense>
  );
}

export function renderHeartbeatSection({ activeSection, AdminHeartbeatSection: HeartbeatSection, data, heartbeat }) {
  if (activeSection !== 'heartbeat' || !data) {
    return null;
  }

  return (
    <SectionSuspense label="Loading heartbeat analytics...">
      {createElement(HeartbeatSection, {
        data,
        heartbeatP95Series: heartbeat.heartbeatP95Series,
        heartbeatErrorSeries: heartbeat.heartbeatErrorSeries
      })}
    </SectionSuspense>
  );
}

export function renderAssetsSection({ activeSection, AdminAssetsSection: AssetsSection, data }) {
  if (activeSection !== 'assets' || !data) {
    return null;
  }

  return (
    <SectionSuspense label="Loading homepage assets...">
      {createElement(AssetsSection, { data })}
    </SectionSuspense>
  );
}
