import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import ScanSummary from '../../../organisms/summary/ScanSummary.jsx';
import ExposurePanel from '../../../organisms/panels/ExposurePanel.jsx';
import PerformancePanel from '../../../organisms/panels/PerformancePanel.jsx';
import ContentOverviewPanel from '../../../organisms/panels/ContentOverviewPanel.jsx';
import AdditionalScansPanel from '../AdditionalScansPanel.jsx';

function OverviewSection({
  scanResult,
  homepageDomain,
  homepageResult,
  capabilities = {},
  selectedCapabilityIds = [],
  onRunCapability = () => {}
}) {
  if (!scanResult || typeof scanResult !== 'object') {
    const homepageState = capabilities.homepage;
    return (
      <>
        {homepageState?.status === 'unavailable' ? (
          <Card role="alert" className="card card--error">
            <CardHeader><CardTitle>Homepage source signals</CardTitle></CardHeader>
            <CardContent><p>Homepage scan is unavailable: {homepageState.error?.message ?? 'No runner available.'}</p></CardContent>
          </Card>
        ) : null}
        <AdditionalScansPanel selectedCapabilityIds={selectedCapabilityIds} capabilities={capabilities} onRunCapability={onRunCapability} />
      </>
    );
  }

  return (
    <>
      <ScanSummary
        domain={scanResult.domain}
        fetchedAt={scanResult.fetchedAt}
        summary={scanResult.summary}
        namespaces={scanResult.namespaces}
        metrics={scanResult.metrics}
        plugins={scanResult.plugins}
        coreDatasets={scanResult.core}
      />
      <HomepageOverviewCard
        domain={homepageDomain}
        result={homepageResult}
        capability={capabilities.homepage}
      />
      <AdditionalScansPanel
        selectedCapabilityIds={selectedCapabilityIds}
        capabilities={capabilities}
        onRunCapability={onRunCapability}
      />
      <section className="section">
        <div className="grid">
          <PerformancePanel performance={scanResult.performance} />
          <ContentOverviewPanel overview={scanResult.contentOverview} />
          <ExposurePanel
            exposure={scanResult.exposure}
            homepageSecurityHeaders={homepageResult?.securityHeaders}
          />
        </div>
      </section>
    </>
  );
}

OverviewSection.propTypes = {
  scanResult: PropTypes.object.isRequired,
  homepageDomain: PropTypes.string,
  homepageResult: PropTypes.object,
  capabilities: PropTypes.object,
  selectedCapabilityIds: PropTypes.arrayOf(PropTypes.string),
  onRunCapability: PropTypes.func
};

OverviewSection.defaultProps = {
  homepageDomain: '',
  homepageResult: null,
  capabilities: {},
  selectedCapabilityIds: [],
  onRunCapability: () => {}
};

export default OverviewSection;

function HomepageOverviewCard({
  domain,
  result
  , capability
}) {
  return (
    <Card role="status" aria-label="Homepage source signals">
      <CardHeader>
        <div>
          <CardTitle className="cta-title">Homepage source signals</CardTitle>
          {result ? (
            <CardDescription>
              Status {result.source?.statusCode ?? '—'} · {formatBytes(result.source?.sizeBytes)} ·{' '}
              {result.insights?.meta?.length ?? 0} meta · {result.insights?.assets?.length ?? 0} assets ·{' '}
              {result.insights?.frameworks?.length ?? 0} frameworks
            </CardDescription>
          ) : capability?.status === 'unavailable' ? (
            <CardDescription>{capability.error?.message ?? 'Homepage scan is unavailable.'}</CardDescription>
          ) : (
            <CardDescription>
              Capture generator hints, builder clues, frameworks, and asset paths from the homepage HTML for {domain || 'this site'}.
            </CardDescription>
          )}
        </div>
        <CardAction>
          <span className="card__meta">
            {capability?.status === 'idle' ? 'Run when needed.' : capability?.status === 'failed' ? 'Scan failed.' : 'Runs with selected scans.'}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent />
    </Card>
  );
}

HomepageOverviewCard.propTypes = {
  domain: PropTypes.string,
  result: PropTypes.object
};

HomepageOverviewCard.defaultProps = {
  domain: '',
  result: null
};

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
