import PropTypes from 'prop-types';
import SitemapScanPanel from '../../../organisms/panels/SitemapScanPanel.jsx';
import SitemapPagesTable from '../../../organisms/panels/SitemapPagesTable.jsx';

function SitemapSection({
  domain,
  startSitemapScan,
  isSitemapRunning,
  sitemapResult,
  sitemapProbe,
  sitemapExposure,
  sitemapFilter,
  setSitemapFilter
}) {
  return (
    <section className="section">
      <div className="grid">
        <SitemapScanPanel
          domain={domain}
          onScan={startSitemapScan}
          isRunning={isSitemapRunning}
          result={sitemapResult}
          sitemapProbe={sitemapProbe}
          sitemapExposure={sitemapExposure}
        />
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
  startSitemapScan: PropTypes.func.isRequired,
  isSitemapRunning: PropTypes.bool,
  sitemapResult: PropTypes.object,
  sitemapProbe: PropTypes.object,
  sitemapExposure: PropTypes.object,
  sitemapFilter: PropTypes.string.isRequired,
  setSitemapFilter: PropTypes.func.isRequired
};

SitemapSection.defaultProps = {
  isSitemapRunning: false,
  sitemapResult: null,
  sitemapProbe: null,
  sitemapExposure: null
};

export default SitemapSection;
