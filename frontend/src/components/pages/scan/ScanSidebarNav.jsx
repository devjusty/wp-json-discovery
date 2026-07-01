import { memo } from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';

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
    <nav className="sidebar" aria-label="Scan navigation">
      <div className="sidebar__section">
        <p className="sidebar__title">Navigation</p>
        <ul className="sidebar__nav">
          {SCAN_SECTIONS.filter((item) => item.id !== 'unsupported' || isAdmin).map((item) => {
            const disabled = item.requiresScan && !hasScanResult;
            const isActive = activeSection === item.id;

            return (
              <li key={item.id}>
                <Button
                  type="button"
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="sidebar__link justify-start"
                  onClick={() => !disabled && onSectionChange(item.id)}
                  disabled={disabled}
                >
                  {item.id === 'homepage' ? (
                    <span className="sidebar__link-content">
                      <span>{item.label}</span>
                      <Badge variant="secondary" className="sidebar__link-meta">
                        {homepageNavSummary}
                      </Badge>
                    </span>
                  ) : (
                    item.label
                  )}
                </Button>
              </li>
            );
          })}
          <li>
            <Separator />
          </li>
          {onOpenHistory && (
            <li>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="sidebar__link justify-start"
                onClick={onOpenHistory}
                onMouseEnter={() => {
                  void loadHistoryPage();
                }}
                onFocus={() => {
                  void loadHistoryPage();
                }}
              >
                History view
              </Button>
            </li>
          )}
          {onOpenAdmin && (
            <li>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="sidebar__link justify-start"
                onClick={onOpenAdmin}
                onMouseEnter={() => {
                  void loadAdminPage();
                }}
                onFocus={() => {
                  void loadAdminPage();
                }}
              >
                Admin view
              </Button>
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
