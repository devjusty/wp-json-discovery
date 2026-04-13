import PropTypes from 'prop-types';
import {
  renderAssetsSection,
  renderDbSection,
  renderDomainsSection,
  renderHeartbeatSection,
  renderLogsSection,
  renderMaintenanceSection,
  renderUnsupportedSection
} from './section-renderers/coreSections.jsx';
import {
  renderPluginCatalogSection,
  renderPluginManagerSection,
  renderThemeCatalogSection,
  renderThemeManagerSection
} from './section-renderers/catalogManagers.jsx';

// Delegates section-specific UI branches to focused renderer modules.

function AdminSectionContent({ state }) {
  const {
    activeSection,
    components,
    data,
    domainsHistoryQuery,
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
  } = state;

  const {
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
  } = components;

  return (
    renderMaintenanceSection({
      activeSection,
      AdminMaintenanceSection,
      data,
      maintenance
    }) ||
    renderDbSection({
      activeSection,
      AdminDbSection,
      data,
      snapshotQuery: state.snapshotQuery,
      db
    }) ||
    renderPluginManagerSection({
      activeSection,
      AdminPluginManagerSection,
      pluginManager
    }) ||
    renderDomainsSection({
      activeSection,
      AdminDomainsSection,
      domainsHistoryQuery,
      domains
    }) ||
    renderUnsupportedSection({
      activeSection,
      AdminUnsupportedSection,
      data,
      unsupported
    }) ||
    renderLogsSection({
      activeSection,
      AdminLogsSection,
      data,
      logs
    }) ||
    renderHeartbeatSection({
      activeSection,
      AdminHeartbeatSection,
      data,
      heartbeat
    }) ||
    renderAssetsSection({
      activeSection,
      AdminAssetsSection,
      data
    }) ||
    renderPluginCatalogSection({
      activeSection,
      AdminSupportedPluginsSection,
      pluginCatalog
    }) ||
    renderThemeCatalogSection({
      activeSection,
      AdminSupportedThemesSection,
      themeCatalog
    }) ||
    renderThemeManagerSection({
      activeSection,
      AdminThemeManagerSection,
      themeManager
    }) ||
    null
  );
}

AdminSectionContent.propTypes = {
  state: PropTypes.object.isRequired
};

export default AdminSectionContent;
