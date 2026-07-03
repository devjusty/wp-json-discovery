import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import TextInput from '../../atoms/TextInput.jsx';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';

function useElapsedTime(isRunning) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      startRef.current = Date.now();
      const tick = () => {
        setElapsed(Date.now() - startRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setElapsed(0);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning]);

  return elapsed;
}

function StatChip({ label, hint, value, tone = 'info', hide = false }) {
  if (hide) return null;
  return (
    <div className="stat-chip">
      <div className="stat-chip__top">
        <span className="stat-chip__label">{label}</span>
        <StatusBadge label={value} tone={tone} />
      </div>
      <div className="stat-chip__hint">{hint}</div>
    </div>
  );
}

StatChip.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  tone: PropTypes.string,
  hide: PropTypes.bool,
};

StatChip.defaultProps = {
  tone: 'info',
  hide: false,
};

function SitemapScanPanel({ domain, onScan, isRunning, result, sitemapProbe, sitemapExposure }) {
  const [maxPages, setMaxPages] = useState(50);
  const [sitemapUrl, setSitemapUrl] = useState('');
  const elapsed = useElapsedTime(isRunning);

  const pages = result?.pages ?? [];
  const totals = result?.totals ?? {};

  const initialStatus = sitemapExposure?.available
    ? 'Available'
    : sitemapExposure
      ? 'Missing'
      : null;
  const initialStatusCode = sitemapExposure?.statusCode ?? sitemapProbe?.statusCode ?? null;
  const initialDuration = sitemapProbe?.durationMs ?? null;
  const primarySitemapUrl = sitemapProbe?.finalUrl ?? sitemapProbe?.endpoint ?? '/sitemap.xml';
  const sitemapRedirectCount = sitemapProbe?.redirectCount ?? 0;
  const sitemapRedirectSource = sitemapRedirectCount > 0 ? sitemapProbe?.endpoint ?? '/sitemap.xml' : null;
  const placeholderUrl = sitemapRedirectCount > 0 && sitemapProbe?.finalUrl ? sitemapProbe.finalUrl : '';

  const schemaTypesSummary =
    totals.schemaTypes?.length > 0
      ? totals.schemaTypes.join(', ')
      : null;

  return (
    <Card role="region" aria-label="Sitemap scan">
      <CardHeader>
        <div>
          <h2>Sitemap scan</h2>
          <p className="card__meta">
            Crawl sitemap.xml for pages and extract SEO and schema signals.
            {initialStatus
              ? ` Overview snapshot: ${initialStatus}${initialStatusCode ? ` (HTTP ${initialStatusCode})` : ''}.`
              : ''}
          </p>
        </div>
        <div className="sitemap-scan__controls">
          <div className="sitemap-scan__control-group">
            <label className="sitemap-scan__label" htmlFor="sitemap-max-pages">
              Max pages
            </label>
            <TextInput
              id="sitemap-max-pages"
              size="sm"
              type="number"
              min={1}
              max={200}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value) || 1)}
              className="sitemap-scan__max-pages"
              aria-label="Max pages"
            />
          </div>
          <div className="sitemap-scan__control-group sitemap-scan__control-group--url">
            <label className="sitemap-scan__label" htmlFor="sitemap-url-override">
              Sitemap URL override
            </label>
            <TextInput
              id="sitemap-url-override"
              type="text"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder={placeholderUrl || 'Default: /sitemap.xml'}
              className="sitemap-scan__url-input"
            />
          </div>
          <div className="sitemap-scan__control-group sitemap-scan__control-group--action">
            <span className="sitemap-scan__label" aria-hidden="true">&nbsp;</span>
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
        </div>
      </CardHeader>
      <CardContent>
        {primarySitemapUrl || (!result && !isRunning) ? (
          <div className="sitemap-scan__snapshot-row">
            {primarySitemapUrl ? (
              <div className="stat-chip sitemap-scan__detected-sitemap">
                <div className="stat-chip__top">
                  <span className="stat-chip__label">Detected sitemap</span>
                  <StatusBadge
                    label={sitemapRedirectCount > 0 ? 'Redirected' : 'Direct'}
                    tone={sitemapRedirectCount > 0 ? 'warning' : 'success'}
                  />
                </div>
                <div className="stat-chip__hint">
                  Primary URL: {primarySitemapUrl}
                  {sitemapRedirectSource
                    ? ` · Redirected from ${sitemapRedirectSource}${sitemapRedirectCount > 1 ? ` (${sitemapRedirectCount} hops)` : ''}`
                    : ' · No redirect detected'}
                </div>
              </div>
            ) : null}

            {!result && !isRunning ? (
              <div className="stat-chip sitemap-scan__overview-snapshot">
                <div className="stat-chip__top">
                  <span className="stat-chip__label">Overview snapshot</span>
                  <StatusBadge
                    label={initialStatusCode ? `HTTP ${initialStatusCode}` : initialStatus || 'Unknown'}
                    tone={initialStatus === 'Available' ? 'success' : 'warning'}
                  />
                </div>
                <div className="stat-chip__hint">
                  {primarySitemapUrl ? `Last checked: ${primarySitemapUrl}` : 'Sitemap availability from initial scan.'}
                  {initialDuration ? ` · ${initialDuration} ms` : ''}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {isRunning && (
          <div className="sitemap-scan__progress">
            <span className="sitemap-scan__progress-dot" aria-hidden="true" />
            <span className="sitemap-scan__progress-text">
              Scanning pages… {(elapsed / 1000).toFixed(1)}s
            </span>
          </div>
        )}

        {result ? (
          <div className="sitemap-summary">
            <StatChip
              label="Pages scanned"
              hint="Total pages processed from sitemap"
              value={pages.length}
              tone="info"
            />
            <StatChip
              label="Fetch errors"
              hint="Pages that could not be fetched"
              value={totals.fetchErrors ?? 0}
              tone={totals.fetchErrors > 0 ? 'danger' : 'success'}
              hide={!totals.fetchErrors}
            />
            <StatChip
              label="Invalid schema"
              hint="Pages with schema validation errors"
              value={totals.invalidSchema ?? 0}
              tone={totals.invalidSchema > 0 ? 'warning' : 'success'}
            />
            <StatChip
              label="Noindex"
              hint="Pages marked noindex in meta robots"
              value={totals.noindex ?? 0}
              tone={totals.noindex > 0 ? 'warning' : 'success'}
            />
            <StatChip
              label="Missing title"
              hint="Pages with no <title> tag"
              value={totals.missingTitle ?? 0}
              tone={totals.missingTitle > 0 ? 'warning' : 'success'}
              hide={!totals.missingTitle}
            />
            <StatChip
              label="Missing description"
              hint="Pages with no meta description"
              value={totals.missingDescription ?? 0}
              tone={totals.missingDescription > 0 ? 'warning' : 'success'}
              hide={!totals.missingDescription}
            />
            <StatChip
              label="Canonical mismatch"
              hint="Pages where canonical URL differs from scanned URL"
              value={totals.canonicalMismatch ?? 0}
              tone={totals.canonicalMismatch > 0 ? 'warning' : 'success'}
              hide={!totals.canonicalMismatch}
            />
            {schemaTypesSummary && (
              <div className="stat-chip stat-chip--wide">
                <div className="stat-chip__top">
                  <span className="stat-chip__label">Schema types</span>
                </div>
                <div className="stat-chip__hint sitemap-scan__schema-types">{schemaTypesSummary}</div>
              </div>
            )}
          </div>
        ) : null}
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
    endpoint: PropTypes.string,
    redirectCount: PropTypes.number
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
