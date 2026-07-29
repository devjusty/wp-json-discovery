import PropTypes from 'prop-types';
import Button from '../../../atoms/Button.jsx';
import SitemapScanPanel from '../../../organisms/panels/SitemapScanPanel.jsx';
import SitemapPagesTable from '../../../organisms/panels/SitemapPagesTable.jsx';

function SitemapSection({
  domain,
  capability,
  sitemapSettings,
  onSitemapSettingsChange,
  onRun,
  onRetry,
  sitemapProbe,
  sitemapExposure,
  sitemapFilter,
  setSitemapFilter
}) {
  const isSitemapRunning = ['queued', 'running'].includes(capability?.status);
  const sitemapResult = capability?.result ?? null;

  return (
    <section className="section">
      <div className="grid">
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
  sitemapProbe: null,
  sitemapExposure: null
};

export default SitemapSection;
