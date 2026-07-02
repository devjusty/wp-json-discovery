import { memo } from 'react';
import PropTypes from 'prop-types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  BrickWallShieldIcon,
  DashboardSquare01Icon,
  Database01Icon,
  File01Icon,
  FileCodeIcon,
  FileSearchIcon,
  HistoryIcon,
  Home01Icon,
  Shield01Icon
} from '@hugeicons/core-free-icons';
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

const SCAN_SECTION_ICONS = {
  overview: DashboardSquare01Icon,
  homepage: Home01Icon,
  exposure: Shield01Icon,
  performance: DashboardSquare01Icon,
  content: File01Icon,
  sitemap: FileSearchIcon,
  core: Database01Icon,
  plugins: FileCodeIcon,
  unsupported: BrickWallShieldIcon,
  history: HistoryIcon,
  admin: DashboardSquare01Icon
};

function ScanSidebarNav({
  activeSection,
  hasScanResult,
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
                  <HugeiconsIcon aria-hidden="true" icon={SCAN_SECTION_ICONS[item.id]} className="sidebar__link-icon" />
                  <span className="sidebar__link-label">{item.label}</span>
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
                <HugeiconsIcon aria-hidden="true" icon={SCAN_SECTION_ICONS.history} className="sidebar__link-icon" />
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
                <HugeiconsIcon aria-hidden="true" icon={SCAN_SECTION_ICONS.admin} className="sidebar__link-icon" />
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
