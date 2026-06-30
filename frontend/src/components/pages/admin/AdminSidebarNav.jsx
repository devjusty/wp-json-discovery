import { memo } from 'react';
import PropTypes from 'prop-types';

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
  'theme-manager': [
    { id: 'admin-theme-manager-main', label: 'Theme manager' }
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
  onPrefetchSection
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
              className="sidebar__link"
              onClick={() => onNavigate('history')}
            >
              View scan history
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
            ['theme-manager', 'Theme manager'],
            ['assets', 'Homepage assets']
          ].map(([sectionKey, label]) => (
            <li key={sectionKey}>
              <button
                type="button"
                className={`sidebar__link ${activeSection === sectionKey ? 'is-active' : ''}`}
                onClick={() => onSetActiveSection(sectionKey)}
                onMouseEnter={() => onPrefetchSection(sectionKey)}
                onFocus={() => onPrefetchSection(sectionKey)}
              >
                {label}
              </button>
              {renderSectionAnchors(sectionKey)}
            </li>
          ))}
        </ul>
      </div>

    </nav>
  );
}

AdminSidebarNav.propTypes = {
  activeSection: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onSetActiveSection: PropTypes.func.isRequired,
  onPrefetchSection: PropTypes.func
};

AdminSidebarNav.defaultProps = {
  onPrefetchSection: () => {}
};

export default memo(AdminSidebarNav);
