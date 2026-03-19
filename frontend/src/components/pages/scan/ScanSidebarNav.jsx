import PropTypes from 'prop-types';

const SCAN_SECTIONS = [
  { id: 'overview', label: 'Overview', requiresScan: true },
  { id: 'exposure', label: 'Exposure', requiresScan: true },
  { id: 'performance', label: 'Performance', requiresScan: true },
  { id: 'content', label: 'Content footprint', requiresScan: true },
  { id: 'versions', label: 'Versions', requiresScan: true },
  { id: 'homepage', label: 'Homepage source', requiresScan: true },
  { id: 'sitemap', label: 'Sitemap scan', requiresScan: true },
  { id: 'core', label: 'Core data', requiresScan: true },
  { id: 'plugins', label: 'Plugins', requiresScan: true },
  { id: 'unsupported', label: 'Unsupported', requiresScan: false }
];

function ScanSidebarNav({
  activeSection,
  hasScanResult,
  homepageNavSummary,
  onSectionChange,
  onOpenHistory,
  onOpenAdmin
}) {
  return (
    <nav className="sidebar">
      <div className="sidebar__section">
        <p className="sidebar__title">Navigation</p>
        <ul className="sidebar__nav">
          {SCAN_SECTIONS.map((item) => {
            const disabled = item.requiresScan && !hasScanResult;
            const isActive = activeSection === item.id;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sidebar__link ${isActive ? 'is-active' : ''}`}
                  onClick={() => !disabled && onSectionChange(item.id)}
                  disabled={disabled}
                >
                  {item.id === 'homepage' ? (
                    <span className="sidebar__link-content">
                      <span>{item.label}</span>
                      <span className="sidebar__link-meta">{homepageNavSummary}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className="sidebar__link" onClick={onOpenHistory}>
              History view
            </button>
          </li>
          <li>
            <button type="button" className="sidebar__link" onClick={onOpenAdmin}>
              Admin view
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

ScanSidebarNav.propTypes = {
  activeSection: PropTypes.string.isRequired,
  hasScanResult: PropTypes.bool,
  homepageNavSummary: PropTypes.string.isRequired,
  onSectionChange: PropTypes.func.isRequired,
  onOpenHistory: PropTypes.func.isRequired,
  onOpenAdmin: PropTypes.func.isRequired
};

ScanSidebarNav.defaultProps = {
  hasScanResult: false
};

export default ScanSidebarNav;
