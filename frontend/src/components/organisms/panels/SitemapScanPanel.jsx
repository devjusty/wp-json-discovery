import { useState } from 'react';
import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function SitemapScanPanel({ domain, onScan, isRunning, result, sitemapProbe, sitemapExposure }) {
  const [maxPages, setMaxPages] = useState(50);
  const [sitemapUrl, setSitemapUrl] = useState('');

  const pages = result?.pages ?? [];
  const initialStatus = sitemapExposure?.available
    ? 'Available'
    : sitemapExposure
      ? 'Missing'
      : null;
  const initialStatusCode = sitemapExposure?.statusCode ?? sitemapProbe?.statusCode ?? null;
  const initialDuration = sitemapProbe?.durationMs ?? null;
  const initialUrl = sitemapProbe?.finalUrl ?? sitemapProbe?.endpoint ?? '/sitemap.xml';
  const placeholderUrl =
    sitemapProbe?.redirectCount > 0 && sitemapProbe?.finalUrl
      ? sitemapProbe.finalUrl
      : '';

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Sitemap scan</h2>
          <p className="card__meta">
            Crawl sitemap.xml for pages and extract SEO/Schema info. Pages only for now.
            {initialStatus ? ` Seen in overview: ${initialStatus}${initialStatusCode ? ` (HTTP ${initialStatusCode})` : ''}.` : ''}
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
            placeholder={
              placeholderUrl || 'Override sitemap URL (optional)'
            }
            className="text-input"
            style={{ minWidth: '28rem' }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onScan({ domain, sitemapUrl: sitemapUrl || undefined, maxPages })}
            disabled={isRunning || !domain}
          >
            {isRunning ? 'Scanning…' : 'Scan sitemap'}
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
          <div className="stat-chip">
            <div className="stat-chip__top">
              <span className="stat-chip__label">Overview snapshot</span>
              <StatusBadge
                label={initialStatusCode ? `HTTP ${initialStatusCode}` : initialStatus || 'Unknown'}
                tone={initialStatus === 'Available' ? 'success' : 'warning'}
              />
            </div>
            <div className="stat-chip__hint">
              {initialUrl ? `Last checked: ${initialUrl}` : 'Sitemap availability pulled from initial scan.'}
              {initialDuration ? ` · ${initialDuration} ms` : ''}
            </div>
          </div>
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
  }),
  sitemapProbe: PropTypes.shape({
    statusCode: PropTypes.number,
    durationMs: PropTypes.number,
    finalUrl: PropTypes.string,
    endpoint: PropTypes.string
  }),
  sitemapExposure: PropTypes.shape({
    available: PropTypes.bool,
    statusCode: PropTypes.number
  })
};

SitemapScanPanel.defaultProps = {
  domain: '',
  isRunning: false,
  result: null,
  sitemapProbe: null,
  sitemapExposure: null
};

export default SitemapScanPanel;
