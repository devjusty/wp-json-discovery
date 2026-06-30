import { memo } from 'react';
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

function ScanSectionContent({
  activeSection,
  scanResult,
  homepageResult,
  homepageDomain,
  startSitemapScan,
  sitemapResult,
  isSitemapRunning,
  sitemapFilter,
  setSitemapFilter,
  unsupportedPlugins,
  unsupportedIsLoading,
  onRefreshUnsupported,
  showDomains
}) {
  if (!scanResult) {
    return <EmptyScanState />;
  }

  switch (activeSection) {
    case 'overview':
      return (
        <OverviewSection
          scanResult={scanResult}
          homepageDomain={homepageDomain}
          homepageResult={homepageResult}
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
          homepageResult={homepageResult}
          homepageDomain={homepageDomain}
        />
      );
    case 'sitemap':
      return (
        <SitemapSection
          domain={scanResult.domain}
          startSitemapScan={startSitemapScan}
          isSitemapRunning={isSitemapRunning}
          sitemapResult={sitemapResult}
          sitemapProbe={scanResult.performance?.sitemap}
          sitemapExposure={scanResult.exposure?.sitemapXml}
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
  scanResult: PropTypes.object,
  homepageResult: PropTypes.object,
  homepageDomain: PropTypes.string,
  startSitemapScan: PropTypes.func.isRequired,
  sitemapResult: PropTypes.object,
  isSitemapRunning: PropTypes.bool,
  sitemapFilter: PropTypes.string.isRequired,
  setSitemapFilter: PropTypes.func.isRequired,
  unsupportedPlugins: PropTypes.array,
  unsupportedIsLoading: PropTypes.bool,
  onRefreshUnsupported: PropTypes.func.isRequired,
  showDomains: PropTypes.bool
};

ScanSectionContent.defaultProps = {
  scanResult: null,
  homepageResult: null,
  homepageDomain: '',
  sitemapResult: null,
  isSitemapRunning: false,
  unsupportedPlugins: [],
  unsupportedIsLoading: false,
  showDomains: false
};

export default memo(ScanSectionContent);
