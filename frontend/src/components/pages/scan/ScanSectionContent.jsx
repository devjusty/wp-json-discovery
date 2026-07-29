import PropTypes from 'prop-types';
import ExposurePanel from '../../organisms/panels/ExposurePanel.jsx';
import PerformancePanel from '../../organisms/panels/PerformancePanel.jsx';
import ContentOverviewPanel from '../../organisms/panels/ContentOverviewPanel.jsx';
import EmptyScanState from './sections/EmptyScanState.jsx';
import OverviewSection from './sections/OverviewSection.jsx';
import HomepageSection from './sections/HomepageSection.jsx';
import SitemapSection from './sections/SitemapSection.jsx';
import CoreDataSection from './sections/CoreDataSection.jsx';
import PluginsSection from './sections/PluginsSection.jsx';
import UnsupportedSection from './sections/UnsupportedSection.jsx';
import { CAPABILITY_IDS, SCAN_CAPABILITIES } from '../../../services/scanCapabilities.js';

function ScanSectionContent({
  activeSection,
  session,
  scanSettings,
  onScanSettingsChange,
  onRunCapability,
  onRetryCapability,
  sitemapFilter,
  setSitemapFilter,
  unsupportedPlugins,
  unsupportedIsLoading,
  onRefreshUnsupported,
  showDomains
}) {
  if (!session) {
    return <EmptyScanState />;
  }

  const wordpress = session.capabilities[CAPABILITY_IDS.WORDPRESS];
  const homepage = session.capabilities[CAPABILITY_IDS.HOMEPAGE] ?? { status: 'idle', result: null, error: null };
  const sitemap = session.capabilities[CAPABILITY_IDS.SITEMAP] ?? { status: 'idle', result: null, error: null };
  const scanResult = wordpress?.result ?? null;
  const homepageResult = homepage.result;
  const sitemapSettings = scanSettings.options[CAPABILITY_IDS.SITEMAP] ?? { sitemapUrl: '', maxPages: 50 };
  const additionalCapabilityIds = SCAN_CAPABILITIES
    .map(({ id }) => id)
    .filter((id) => id !== CAPABILITY_IDS.WORDPRESS && !session.selection.capabilityIds.includes(id));

  if (!scanResult && !['homepage', 'sitemap'].includes(activeSection)) {
    return <EmptyScanState />;
  }

  switch (activeSection) {
    case 'overview':
      return (
        <OverviewSection
          scanResult={scanResult}
          homepageDomain={session.domain}
          homepageResult={homepageResult}
          additionalCapabilityIds={additionalCapabilityIds}
          onRunCapability={onRunCapability}
        />
      );
    case 'exposure':
      return (
        <section className="section">
          <ExposurePanel
            exposure={scanResult.exposure}
            homepageSecurityHeaders={homepageResult?.securityHeaders}
          />
        </section>
      );
    case 'performance':
      return (
        <section className="section">
          <PerformancePanel performance={scanResult.performance} />
        </section>
      );
    case 'content':
      return (
        <section className="section">
          <ContentOverviewPanel overview={scanResult.contentOverview} />
        </section>
      );
    case 'homepage':
      return (
        <HomepageSection
          homepageDomain={session.domain}
          capability={homepage}
          onRun={() => onRunCapability(CAPABILITY_IDS.HOMEPAGE)}
          onRetry={() => onRetryCapability(CAPABILITY_IDS.HOMEPAGE)}
        />
      );
    case 'sitemap':
      return (
        <SitemapSection
          domain={session.domain}
          capability={sitemap}
          sitemapSettings={sitemapSettings}
          onSitemapSettingsChange={(settings) => onScanSettingsChange((current) => ({
            ...current,
            capabilityIds: Array.from(new Set([...current.capabilityIds, CAPABILITY_IDS.SITEMAP])),
            options: { ...current.options, [CAPABILITY_IDS.SITEMAP]: settings }
          }))}
          onRun={(options) => onRunCapability(CAPABILITY_IDS.SITEMAP, options)}
          onRetry={() => onRetryCapability(CAPABILITY_IDS.SITEMAP)}
          sitemapProbe={scanResult?.performance?.sitemap}
          sitemapExposure={scanResult?.exposure?.sitemapXml}
          sitemapFilter={sitemapFilter}
          setSitemapFilter={setSitemapFilter}
        />
      );
    case 'core':
      return <CoreDataSection scanResult={scanResult} />;
    case 'plugins':
      return <PluginsSection scanResult={scanResult} />;
    case 'unsupported':
      return (
        <UnsupportedSection
          unsupportedPlugins={unsupportedPlugins}
          unsupportedIsLoading={unsupportedIsLoading}
          onRefreshUnsupported={onRefreshUnsupported}
          showDomains={showDomains}
        />
      );
    default:
      return null;
  }
}

ScanSectionContent.propTypes = {
  activeSection: PropTypes.string.isRequired,
  session: PropTypes.object,
  scanSettings: PropTypes.object.isRequired,
  onScanSettingsChange: PropTypes.func.isRequired,
  onRunCapability: PropTypes.func.isRequired,
  onRetryCapability: PropTypes.func.isRequired,
  sitemapFilter: PropTypes.string.isRequired,
  setSitemapFilter: PropTypes.func.isRequired,
  unsupportedPlugins: PropTypes.array,
  unsupportedIsLoading: PropTypes.bool,
  onRefreshUnsupported: PropTypes.func.isRequired,
  showDomains: PropTypes.bool
};

ScanSectionContent.defaultProps = {
  session: null,
  unsupportedPlugins: [],
  unsupportedIsLoading: false,
  showDomains: false
};

export default ScanSectionContent;
