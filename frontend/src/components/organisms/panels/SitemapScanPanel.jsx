import { useState } from 'react';
import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function SitemapScanPanel({ domain, onScan, isRunning, result }) {
  const [maxPages, setMaxPages] = useState(50);
  const [sitemapUrl, setSitemapUrl] = useState('');

  const pages = result?.pages ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Sitemap scan</h2>
          <p className="card__meta">
            Crawl sitemap.xml for pages and extract SEO/Schema info. Pages only for now.
          </p>
        </div>
        <div className="card__actions">
          <input
            type="number"
            min={1}
            max={200}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value) || 1)}
            className="text-input"
            style={{ width: '5.5rem' }}
            aria-label="Max pages"
          />
          <input
            type="text"
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder="Override sitemap URL (optional)"
            className="text-input"
            style={{ minWidth: '16rem' }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onScan({ domain, sitemapUrl: sitemapUrl || undefined, maxPages })}
            disabled={isRunning || !domain}
          >
            {isRunning ? 'Scanning…' : 'Run sitemap scan'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="sitemap-summary">
            <div className="stat-chip">
              <div className="stat-chip__top">
                <span className="stat-chip__label">Pages scanned</span>
                <StatusBadge label={pages.length} tone="info" />
              </div>
              <div className="stat-chip__hint">Total pages processed</div>
            </div>
            <div className="stat-chip">
              <div className="stat-chip__top">
                <span className="stat-chip__label">Invalid schema</span>
                <StatusBadge label={result.totals?.invalidSchema ?? 0} tone="warning" />
              </div>
              <div className="stat-chip__hint">Pages with schema parse/validation errors</div>
            </div>
            <div className="stat-chip">
              <div className="stat-chip__top">
                <span className="stat-chip__label">Noindex</span>
                <StatusBadge label={result.totals?.noindex ?? 0} tone="warning" />
              </div>
              <div className="stat-chip__hint">Pages marked noindex</div>
            </div>
          </div>
        ) : (
          <p className="card__meta">Run a sitemap scan to populate page details.</p>
        )}
      </CardContent>
    </Card>
  );
}

SitemapScanPanel.propTypes = {
  domain: PropTypes.string,
  onScan: PropTypes.func.isRequired,
  isRunning: PropTypes.bool,
  result: PropTypes.shape({
    pages: PropTypes.array,
    totals: PropTypes.object
  })
};

SitemapScanPanel.defaultProps = {
  domain: '',
  isRunning: false,
  result: null
};

export default SitemapScanPanel;
