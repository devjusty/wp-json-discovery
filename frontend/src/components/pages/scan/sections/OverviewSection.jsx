import PropTypes from 'prop-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import ScanSummary from '../../../organisms/summary/ScanSummary.jsx';
import ExposurePanel from '../../../organisms/panels/ExposurePanel.jsx';
import PerformancePanel from '../../../organisms/panels/PerformancePanel.jsx';
import ContentOverviewPanel from '../../../organisms/panels/ContentOverviewPanel.jsx';

function OverviewSection({ scanResult, homepageDomain, homepageResult }) {
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
      <HomepageOverviewCard domain={homepageDomain} result={homepageResult} />
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
  homepageResult: PropTypes.object
};

OverviewSection.defaultProps = {
  homepageDomain: '',
  homepageResult: null
};

export default OverviewSection;

function HomepageOverviewCard({
  domain,
  result
}) {
  return (
    <Card role="status" aria-label="Homepage source signals">
      <CardHeader className="card__content card__content--cta">
        <div>
          <CardTitle className="cta-title">Homepage source signals</CardTitle>
          {result ? (
            <CardDescription>
              Status {result.source?.statusCode ?? '—'} · {formatBytes(result.source?.sizeBytes)} ·{' '}
              {result.insights?.meta?.length ?? 0} meta · {result.insights?.assets?.length ?? 0} assets ·{' '}
              {result.insights?.frameworks?.length ?? 0} frameworks
            </CardDescription>
          ) : (
            <CardDescription>
              Capture generator hints, builder clues, frameworks, and asset paths from the homepage HTML for {domain || 'this site'}.
            </CardDescription>
          )}
        </div>
        <div className="cta-actions">
          <span className="card__meta">Runs automatically with each new scan.</span>
        </div>
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
