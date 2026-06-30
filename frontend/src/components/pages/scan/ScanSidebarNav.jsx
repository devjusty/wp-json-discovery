import { memo } from 'react';
import PropTypes from 'prop-types';

const loadAdminPage = () => import('../AdminPage.jsx');
const loadHistoryPage = () => import('../HistoryPage.jsx');

const SCAN_SECTIONS = [
  { id: "overview", label: "Overview", requiresScan: true },
  { id: "homepage", label: "Homepage source", requiresScan: true },
  { id: "exposure", label: "Exposure", requiresScan: true },
  { id: "performance", label: "Performance", requiresScan: true },
  { id: "content", label: "Content footprint", requiresScan: true },
  { id: "sitemap", label: "Sitemap scan", requiresScan: true },
  { id: "core", label: "Core data", requiresScan: true },
  { id: "plugins", label: "Plugins", requiresScan: true },
  { id: "unsupported", label: "Unsupported", requiresScan: true },
];

function ScanSidebarNav({
  activeSection,
  hasScanResult,
  homepageNavSummary,
  onSectionChange,
  onOpenHistory,
  onOpenAdmin,
  isAdmin
}) {
  return (
    <nav className="sidebar">
      <div className="sidebar__section">
        <p className="sidebar__title">Navigation</p>
        <ul className="sidebar__nav">
          {SCAN_SECTIONS.filter((item) => item.id !== 'unsupported' || isAdmin).map((item) => {
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
          {onOpenHistory && (
            <li>
              <button
                type="button"
                className="sidebar__link"
                onClick={onOpenHistory}
                onMouseEnter={() => {
                  void loadHistoryPage();
                }}
                onFocus={() => {
                  void loadHistoryPage();
                }}
              >
                History view
              </button>
            </li>
          )}
          {onOpenAdmin && (
            <li>
              <button
                type="button"
                className="sidebar__link"
                onClick={onOpenAdmin}
                onMouseEnter={() => {
                  void loadAdminPage();
                }}
                onFocus={() => {
                  void loadAdminPage();
                }}
              >
                Admin view
              </button>
            </li>
          )}
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
  onOpenHistory: PropTypes.func,
  onOpenAdmin: PropTypes.func,
  isAdmin: PropTypes.bool
};

ScanSidebarNav.defaultProps = {
  hasScanResult: false,
  isAdmin: false
};

export default memo(ScanSidebarNav);
