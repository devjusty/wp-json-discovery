import PropTypes from 'prop-types';
import Button from '../../../atoms/Button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import SitemapScanPanel from '../../../organisms/panels/SitemapScanPanel.jsx';
import SitemapPagesTable from '../../../organisms/panels/SitemapPagesTable.jsx';

function SitemapSection({
  domain,
  capability,
  sitemapSettings,
  onSitemapSettingsChange,
  onRun,
  onRetry,
  baselineAvailable,
  sitemapProbe,
  sitemapExposure,
  sitemapFilter,
  setSitemapFilter
}) {
  const isSitemapRunning = ['queued', 'running'].includes(capability?.status);
  const isUnavailable = capability?.status === 'unavailable';
  const sitemapResult = capability?.result ?? null;
  const isIdle = !capability?.status || capability.status === 'idle';

  return (
    <section className="section">
      <div className="grid">
        {isIdle && baselineAvailable ? (
          <Card role="region" aria-label="Sitemap action">
            <CardHeader><h2>Check sitemap</h2></CardHeader>
            <CardContent>
              <p>Check sitemap for page-level SEO signals when you need them.</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => onRun(sitemapSettings)}>
                Check sitemap
              </Button>
            </CardContent>
          </Card>
        ) : isUnavailable ? (
          <Card role="alert" className="card card--error">
            <CardHeader><h2>Sitemap scan</h2></CardHeader>
            <CardContent>
              <p>{capability.error?.message ?? 'Sitemap scan is unavailable.'}</p>
              {capability.error?.retryable ? <Button type="button" variant="secondary" size="sm" onClick={onRetry}>Retry sitemap scan</Button> : null}
            </CardContent>
          </Card>
        ) : !isIdle ? (
          <SitemapScanPanel
            domain={domain}
            onScan={onRun}
            isRunning={isSitemapRunning}
            result={sitemapResult}
            sitemapProbe={sitemapProbe}
            sitemapExposure={sitemapExposure}
            settings={sitemapSettings}
            onSettingsChange={onSitemapSettingsChange}
          />
        ) : (
          <Card role="status" aria-label="Sitemap action">
            <CardHeader><h2>Check sitemap</h2></CardHeader>
            <CardContent><p>Run WordPress baseline scan before checking sitemap.</p></CardContent>
          </Card>
        )}
        {capability?.status === 'failed' ? (
          <p role="alert">
            {capability.error?.message ?? 'Sitemap scan failed.'}
            {capability.error?.retryable ? <Button type="button" variant="secondary" size="sm" onClick={onRetry}>Retry sitemap scan</Button> : null}
          </p>
        ) : null}
        <SitemapPagesTable
          pages={sitemapResult?.pages ?? []}
          filterValue={sitemapFilter}
          onFilterChange={setSitemapFilter}
        />
      </div>
    </section>
  );
}

SitemapSection.propTypes = {
  domain: PropTypes.string.isRequired,
  capability: PropTypes.object,
  sitemapSettings: PropTypes.shape({ sitemapUrl: PropTypes.string, maxPages: PropTypes.number }),
  onSitemapSettingsChange: PropTypes.func,
  onRun: PropTypes.func.isRequired,
  onRetry: PropTypes.func,
  baselineAvailable: PropTypes.bool,
  sitemapProbe: PropTypes.object,
  sitemapExposure: PropTypes.object,
  sitemapFilter: PropTypes.string.isRequired,
  setSitemapFilter: PropTypes.func.isRequired
};

SitemapSection.defaultProps = {
  capability: null,
  sitemapSettings: { sitemapUrl: '', maxPages: 50 },
  onSitemapSettingsChange: () => {},
  onRetry: () => {},
  baselineAvailable: false,
  sitemapProbe: null,
  sitemapExposure: null
};

export default SitemapSection;
