// Builds the grouped state contract consumed by admin section renderers.
export function buildAdminSectionsState({
  activeSection,
  components,
  data,
  snapshotQuery,
  domainsHistoryQuery,
  isSnapshotBackedSection,
  maintenance,
  db,
  domains,
  unsupported,
  logs,
  heartbeat,
  pluginCatalog,
  themeCatalog,
  pluginManager,
  themeManager
}) {
  return {
    activeSection,
    components,
    data,
    snapshotQuery,
    domainsHistoryQuery,
    isSnapshotBackedSection,
    maintenance,
    db,
    domains,
    unsupported,
    logs,
    heartbeat,
    pluginCatalog,
    themeCatalog,
    pluginManager,
    themeManager
  };
}
