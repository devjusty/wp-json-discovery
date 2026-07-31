import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import ExposurePanel from '../../organisms/panels/ExposurePanel.jsx';
import PerformancePanel from '../../organisms/panels/PerformancePanel.jsx';
import ContentOverviewPanel from '../../organisms/panels/ContentOverviewPanel.jsx';
import EmptyScanState from './sections/EmptyScanState.jsx';
import OverviewSection from './sections/OverviewSection.jsx';
import HomepageSection from './sections/HomepageSection.jsx';
import SitemapSection from './sections/SitemapSection.jsx';
import ReconSection from './sections/ReconSection.jsx';
import CoreDataSection from './sections/CoreDataSection.jsx';
import PluginsSection from './sections/PluginsSection.jsx';
import UnsupportedSection from './sections/UnsupportedSection.jsx';
import { CAPABILITY_IDS } from '../../../services/scanCapabilities.js';

const WORDPRESS_SECTION_TITLES = {
  overview: 'Overview',
  exposure: 'Exposure',
  performance: 'Performance',
  content: 'Content footprint',
  core: 'Core data',
  plugins: 'Plugins'
};

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
  const recon = session.capabilities[CAPABILITY_IDS.RECON] ?? { status: 'idle', result: null, error: null };
  const scanResult = wordpress?.result ?? null;
  const homepageResult = homepage.result;
  const sitemapSettings = scanSettings.options[CAPABILITY_IDS.SITEMAP] ?? { sitemapUrl: '', maxPages: 50 };
  if (!scanResult && WORDPRESS_SECTION_TITLES[activeSection]) {
    return (
      <WordPressCapabilityState
        title={WORDPRESS_SECTION_TITLES[activeSection]}
        capability={wordpress}
        onRun={() => onRunCapability(CAPABILITY_IDS.WORDPRESS)}
        onRetry={() => onRetryCapability(CAPABILITY_IDS.WORDPRESS)}
      />
    );
  }

  switch (activeSection) {
    case 'overview':
      return (
        <OverviewSection
          scanResult={scanResult}
          homepageDomain={session.domain}
          homepageResult={homepageResult}
          capabilities={session.capabilities}
          selectedCapabilityIds={session.selection.capabilityIds}
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
    case 'recon':
      return (
        <ReconSection
          domain={session.domain}
          capability={recon}
          onRun={() => onRunCapability(CAPABILITY_IDS.RECON)}
          onRetry={() => onRetryCapability(CAPABILITY_IDS.RECON)}
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

function WordPressCapabilityState({ title, capability, onRun, onRetry }) {
  const status = capability?.status ?? 'idle';
  const isRunning = ['queued', 'running'].includes(status);
  const hasFailed = ['failed', 'unavailable'].includes(status);

  return (
    <section className="section">
      <Card className={hasFailed ? 'card card--error' : 'card card--info'} role={hasFailed ? 'alert' : 'status'}>
        <CardHeader>
          <h2>{title}</h2>
        </CardHeader>
        <CardContent>
          {isRunning ? <p>WordPress API scan is running.</p> : null}
          {status === 'idle' ? <p>WordPress API scan has not run.</p> : null}
          {hasFailed ? <p>{capability?.error?.message ?? 'WordPress API scan failed.'}</p> : null}
          {status === 'idle' ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRun}>Run WordPress API scan</Button>
          ) : null}
          {status === 'failed' && capability?.error?.retryable ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry}>Retry WordPress API scan</Button>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

WordPressCapabilityState.propTypes = {
  title: PropTypes.string.isRequired,
  capability: PropTypes.shape({
    status: PropTypes.string,
    error: PropTypes.shape({ message: PropTypes.string, retryable: PropTypes.bool })
  }),
  onRun: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired
};

WordPressCapabilityState.defaultProps = {
  capability: null
};
