import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';

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

function AdminSidebarNav({
  activeSection,
  onNavigate,
  onSetActiveSection,
  editingPluginId,
  pluginDraft,
  setPluginDraft,
  createPluginPending,
  updatePluginPending,
  onPluginSave,
  onPluginReset,
  pluginValidationError,
  pluginSaveError
}) {
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

          {[
            ['db', 'Data snapshot'],
            ['maintenance', 'DB maintenance'],
            ['unsupported', 'Unsupported plugins'],
            ['domains', 'Domains tracked'],
            ['logs', 'Activity logs'],
            ['heartbeat', 'Heartbeat'],
            ['plugins', 'Supported plugins'],
            ['plugin-manager', 'Plugin manager'],
            ['themes', 'Supported themes'],
            ['assets', 'Homepage assets']
          ].map(([sectionKey, label]) => (
            <li key={sectionKey}>
              <button
                type="button"
                className={`sidebar__link ${activeSection === sectionKey ? 'is-active' : ''}`}
                onClick={() => onSetActiveSection(sectionKey)}
              >
                {label}
              </button>
              {renderSectionAnchors(sectionKey)}
            </li>
          ))}
        </ul>
      </div>

      {activeSection === 'plugin-manager' ? (
        <div className="sidebar__section">
          <p className="sidebar__title">{editingPluginId ? `Edit ${editingPluginId}` : 'Add plugin'}</p>
          <form
            className="stacked-form stacked-form--sidebar"
            onSubmit={(event) => {
              event.preventDefault();
              onPluginSave();
            }}
          >
            <label className="stacked-form__label">
              ID
              <input
                type="text"
                value={pluginDraft.id}
                onChange={(event) => setPluginDraft((prev) => ({ ...prev, id: event.target.value }))}
                disabled={Boolean(editingPluginId)}
                required
              />
            </label>
            <label className="stacked-form__label">
              Label
              <input
                type="text"
                value={pluginDraft.label}
                onChange={(event) => setPluginDraft((prev) => ({ ...prev, label: event.target.value }))}
                required
              />
            </label>
            <label className="stacked-form__label">
              Description
              <textarea
                value={pluginDraft.description}
                onChange={(event) => setPluginDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <label className="stacked-form__label">
              Plugin URL
              <input
                type="url"
                value={pluginDraft.pluginUrl}
                onChange={(event) => setPluginDraft((prev) => ({ ...prev, pluginUrl: event.target.value }))}
                placeholder="https://wordpress.org/plugins/…"
              />
            </label>
            <label className="stacked-form__label">
              Namespaces (comma or newline separated)
              <textarea
                value={pluginDraft.namespaces}
                onChange={(event) => setPluginDraft((prev) => ({ ...prev, namespaces: event.target.value }))}
                placeholder="wc/v3\nwc/store/v1"
              />
            </label>
            <label className="stacked-form__label">
              Asset hints (comma or newline separated)
              <textarea
                value={pluginDraft.assetHints}
                onChange={(event) => setPluginDraft((prev) => ({ ...prev, assetHints: event.target.value }))}
                placeholder="woocommerce\nwc-analytics"
              />
            </label>
            <div className="button-group" style={{ marginTop: '8px' }}>
              <Button type="submit" size="sm" variant="primary" disabled={createPluginPending || updatePluginPending}>
                {editingPluginId ? 'Save changes' : 'Add plugin'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onPluginReset}
              >
                Reset
              </Button>
            </div>
            {pluginSaveError ? (
              <p className="card__meta">{pluginSaveError}</p>
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
}

AdminSidebarNav.propTypes = {
  activeSection: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onSetActiveSection: PropTypes.func.isRequired,
  editingPluginId: PropTypes.string,
  pluginDraft: PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    description: PropTypes.string,
    pluginUrl: PropTypes.string,
    namespaces: PropTypes.string,
    assetHints: PropTypes.string
  }).isRequired,
  setPluginDraft: PropTypes.func.isRequired,
  createPluginPending: PropTypes.bool,
  updatePluginPending: PropTypes.bool,
  onPluginSave: PropTypes.func.isRequired,
  onPluginReset: PropTypes.func.isRequired,
  pluginValidationError: PropTypes.string,
  pluginSaveError: PropTypes.string
};

AdminSidebarNav.defaultProps = {
  editingPluginId: null,
  createPluginPending: false,
  updatePluginPending: false,
  pluginValidationError: '',
  pluginSaveError: ''
};

export default AdminSidebarNav;
