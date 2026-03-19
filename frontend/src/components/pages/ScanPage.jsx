import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import Button from '../atoms/Button.jsx';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import ScanSummary from '../organisms/summary/ScanSummary.jsx';
import DataTable from '../organisms/data/DataTable.jsx';
import PluginRoutesTable from '../organisms/data/PluginRoutesTable.jsx';
import UnsupportedPluginsPanel from '../organisms/panels/UnsupportedPluginsPanel.jsx';
import ExposurePanel from '../organisms/panels/ExposurePanel.jsx';
import PerformancePanel from '../organisms/panels/PerformancePanel.jsx';
import ContentOverviewPanel from '../organisms/panels/ContentOverviewPanel.jsx';
import VersionPanel from '../organisms/panels/VersionPanel.jsx';
import SitemapScanPanel from '../organisms/panels/SitemapScanPanel.jsx';
import SitemapPagesTable from '../organisms/panels/SitemapPagesTable.jsx';
import PluginSummaryPanel from '../organisms/panels/PluginSummaryPanel.jsx';
import HomepageSourcePanel from '../organisms/panels/HomepageSourcePanel.jsx';
import HomepageInsightsPanel from '../organisms/panels/HomepageInsightsPanel.jsx';
import { fetchScanHistory, fetchUnsupportedPlugins } from '../../api/client.js';
import { useSitemapScan } from '../../hooks/useSitemapScan.js';
import { useScanContext } from '../../context/ScanContext.jsx';

const SECTIONS = [
  { id: 'overview', label: 'Overview', requiresScan: true },
  { id: 'exposure', label: 'Exposure', requiresScan: true },
  { id: 'performance', label: 'Performance', requiresScan: true },
  { id: 'content', label: 'Content footprint', requiresScan: true },
  { id: 'versions', label: 'Versions', requiresScan: true },
  { id: 'homepage', label: 'Homepage source', requiresScan: true },
  { id: 'sitemap', label: 'Sitemap scan', requiresScan: true },
  { id: 'core', label: 'Core data', requiresScan: true },
  { id: 'plugins', label: 'Plugins', requiresScan: true },
  { id: 'unsupported', label: 'Unsupported', requiresScan: false }
];

function ScanPage({ headerActions }) {
  const {
    domain,
    handleDomainChange: onDomainChange,
    setActivePage,
    startScan,
    scanResult,
    isScanning,
    scanError,
    activeDomain,
    homepageResult,
    homepageIsRunning,
    homepageError
  } = useScanContext();
  const {
    startSitemapScan,
    result: sitemapResult,
    isRunning: isSitemapRunning
  } = useSitemapScan();
  const [sitemapFilter, setSitemapFilter] = useState('all');

  const [activeSection, setActiveSection] = useState('overview');
  const homepageDomain = domain || activeDomain;
  const homepageNavSummary = useMemo(() => {
    if (homepageIsRunning) {
      return 'Analyzing…';
    }
    if (!homepageResult) {
      return 'No signals yet';
    }
    return `S${homepageResult.source?.statusCode ?? '—'} · M${homepageResult.insights?.meta?.length ?? 0} · A${homepageResult.insights?.assets?.length ?? 0} · F${homepageResult.insights?.frameworks?.length ?? 0}`;
  }, [homepageIsRunning, homepageResult]);

  const unsupportedQuery = useQuery({
    queryKey: ['unsupportedPlugins'],
    queryFn: fetchUnsupportedPlugins,
    initialData: []
  });

  const recentHistoryQuery = useQuery({
    queryKey: ['scanHistoryRecent'],
    queryFn: () => fetchScanHistory({ limit: 8, includeFailed: false }),
    staleTime: 30000
  });
  const recentItems = recentHistoryQuery.data?.items ?? [];

  useEffect(() => {
    if (scanResult) {
      setActiveSection('overview');
    }
  }, [scanResult]);

  const sidebarNav = useMemo(() => {
    return (
      <nav className="sidebar">
        <div className="sidebar__section">
          <p className="sidebar__title">Navigation</p>
          <ul className="sidebar__nav">
            {SECTIONS.map((item) => {
              const disabled = item.requiresScan && !scanResult;
              const isActive = activeSection === item.id;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`sidebar__link ${isActive ? 'is-active' : ''}`}
                    onClick={() => !disabled && setActiveSection(item.id)}
                    disabled={disabled}
                  >
                    {item.id === 'homepage' ? (
                      <span className="sidebar__link-content">
                        <span>{item.label}</span>
                        <span className="sidebar__link-meta">{homepageNavSummary}</span>
                      </span>
                    ) : (
                      item.label
                    )}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                className="sidebar__link"
                onClick={() => setActivePage('history')}
              >
                History view
              </button>
            </li>
            <li>
              <button
                type="button"
                className="sidebar__link"
                onClick={() => setActivePage('admin')}
              >
                Admin view
              </button>
            </li>
          </ul>
        </div>
      </nav>
    );
  }, [
    activeSection,
    homepageNavSummary,
    scanResult,
    setActivePage
  ]);

  const renderSectionContent = () => {
    if (!scanResult) {
      return (
        <div className="card card--info">
          <div className="card__content">
            <p>
              Enter a domain to discover available REST endpoints, review core
              content, and track unsupported plugin namespaces.
            </p>
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case 'overview':
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
            />
            <section className="section">
              <div className="grid">
                <ExposurePanel exposure={scanResult.exposure} />
                <PerformancePanel performance={scanResult.performance} />
                <ContentOverviewPanel overview={scanResult.contentOverview} />
                <VersionPanel versions={scanResult.versions} />
              </div>
            </section>
          </>
        );
      case 'exposure':
        return (
          <section className="section">
            <ExposurePanel exposure={scanResult.exposure} />
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
      case 'versions':
        return (
          <section className="section">
            <VersionPanel versions={scanResult.versions} />
          </section>
        );
      case 'sitemap': {
        const domain = scanResult.domain;
        return (
          <section className="section">
            <div className="grid">
              <SitemapScanPanel
                domain={domain}
                onScan={startSitemapScan}
                isRunning={isSitemapRunning}
                result={sitemapResult}
                sitemapProbe={scanResult.performance?.sitemap}
                sitemapExposure={scanResult.exposure?.sitemapXml}
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
      case 'homepage':
        return (
          <section className="section">
            <div className="grid">
              <HomepageSourcePanel source={homepageResult?.source} />
              <HomepageJsonPreview data={homepageResult} />
            </div>
            {homepageResult ? (
              <HomepageInsightsPanel
                insights={homepageResult.insights}
                htmlPreview={homepageResult.htmlPreview}
              />
            ) : (
              <div className="card card--info">
                <div className="card__content">
                  <p>
                    Homepage source signals appear here after a scan completes for{' '}
                    {homepageDomain || 'the selected domain'}.
                  </p>
                </div>
              </div>
            )}
          </section>
        );
      case 'core':
        return (
          <section className="section">
            <h2>Core data</h2>
            <div className="grid">
              {scanResult.core.map((dataset) => (
                <DataTable
                  key={dataset.key}
                  domain={scanResult.domain}
                  datasetKey={dataset.key}
                  title={dataset.label}
                  description={dataset.description}
                  columns={dataset.columns}
                  rows={dataset.rows}
                  status={dataset.status}
                  error={dataset.error}
                />
              ))}
            </div>
          </section>
        );
      case 'plugins':
        return (
          <section className="section">
            <h2>Plugin routes</h2>
            <div className="grid">
              <PluginSummaryPanel plugins={scanResult.plugins} />
            </div>
            <div className="grid">
              {scanResult.plugins.matched.length > 0 ? (
                scanResult.plugins.matched.map((plugin) => (
                  <PluginRoutesTable
                    key={plugin.plugin.id}
                    domain={scanResult.domain}
                    pluginMatch={plugin}
                  />
                ))
              ) : (
                <div className="card">
                  <div className="card__content">
                    <p>No supported plugin namespaces detected.</p>
                  </div>
                </div>
              )}
            </div>
            {scanResult.plugins.unsupportedNamespaces.length > 0 ? (
              <div className="card card--info">
                <div className="card__content">
                  <p>
                    Unsupported namespaces recorded:{' '}
                    {scanResult.plugins.unsupportedNamespaces.join(', ')}.
                    They&apos;ve been added to the persistent tracking list
                    under the Unsupported tab.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        );
      case 'unsupported':
        return (
          <section className="section">
            <UnsupportedPluginsPanel
              plugins={unsupportedQuery.data ?? []}
              isLoading={unsupportedQuery.isLoading}
              onRefresh={() => unsupportedQuery.refetch()}
            />
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout
      title="WP JSON Discovery"
      subtitle="Scan a WordPress site and review REST exposure plus homepage source signals."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      <DomainForm
        onSubmit={startScan}
        isScanning={isScanning}
        initialDomain={scanResult?.domain ?? activeDomain}
        domain={domain}
        onDomainChange={onDomainChange}
      />

      <div className="card">
        <div className="card__content card__content--cta">
          <div>
            <h3 className="cta-title">Recent scanned domains</h3>
            <p className="card__meta">
              Re-run a previous successful scan instantly, or open full history for filters.
            </p>
          </div>
          <div className="cta-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => setActivePage('history')}>
              Open history
            </Button>
          </div>
        </div>
        <div className="card__content">
          {recentHistoryQuery.isLoading ? (
            <p className="card__meta">Loading recent domains…</p>
          ) : recentItems.length === 0 ? (
            <p className="card__meta">No successful scans recorded yet.</p>
          ) : (
            <ul className="recent-domains-list">
              {recentItems.map((item) => (
                <li key={item.domain}>
                  <button
                    type="button"
                    className="recent-domains-list__item"
                    onClick={() => startScan(item.domain)}
                    disabled={isScanning}
                  >
                    <span className="recent-domains-list__domain">{item.domain}</span>
                    <span className="recent-domains-list__meta">{item.lastScannedAt ? new Date(item.lastScannedAt).toLocaleString() : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isScanning ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Scanning {activeDomain}…</p>
          </div>
        </div>
      ) : null}

      {homepageIsRunning ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Analyzing homepage source signals for {activeDomain}…</p>
          </div>
        </div>
      ) : null}

      {scanError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{scanError?.message ?? 'Scan failed.'}</p>
            {scanError?.code === 'auth_required' ? (
              <ul className="error-hints">
                <li>
                  Confirm if the site blocks anonymous REST API access or
                  requires application passwords.
                </li>
                <li>
                  If you have credentials, sign in or create an application
                  password before retrying.
                </li>
                <li>Otherwise, remove this domain from the scan list.</li>
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {homepageError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{homepageError?.message ?? 'Homepage source analysis failed.'}</p>
          </div>
        </div>
      ) : null}

      {renderSectionContent()}
    </AppLayout>
  );
}



export default ScanPage;

ScanPage.propTypes = {
  headerActions: PropTypes.node
};

ScanPage.defaultProps = {
  headerActions: null
};

function HomepageOverviewCard({
  domain,
  result
}) {
  return (
    <div className="card">
      <div className="card__content card__content--cta">
        <div>
          <h3 className="cta-title">Homepage source signals</h3>
          {result ? (
            <p className="card__meta">
              Status {result.source?.statusCode ?? '—'} · {formatBytes(result.source?.sizeBytes)} ·{' '}
              {result.insights?.meta?.length ?? 0} meta · {result.insights?.assets?.length ?? 0} assets ·{' '}
              {result.insights?.frameworks?.length ?? 0} frameworks
            </p>
          ) : (
            <p className="card__meta">
              Capture generator hints, builder clues, frameworks, and asset paths from the homepage HTML for {domain || 'this site'}.
            </p>
          )}
        </div>
        <div className="cta-actions">
          <span className="card__meta">
            Runs automatically with each new scan.
          </span>
        </div>
      </div>
    </div>
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

function HomepageJsonPreview({ data }) {
  if (!data) {
    return (
      <div className="card">
        <div className="card__content">
          <h3>Raw JSON</h3>
          <p className="card__meta">
            Run a scan to view the full homepage source payload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__content">
        <h3>Raw JSON</h3>
        <p className="card__meta">
          Full homepage source response for debugging and integrations.
        </p>
        <pre className="code-block" aria-label="Homepage source JSON">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

HomepageJsonPreview.propTypes = {
  data: PropTypes.object
};

HomepageJsonPreview.defaultProps = {
  data: null
};
