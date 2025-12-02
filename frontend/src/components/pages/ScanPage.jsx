import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
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
import Button from '../atoms/Button.jsx';
import { fetchUnsupportedPlugins } from '../../api/client.js';
import { useSitemapScan } from '../../hooks/useSitemapScan.js';
import { useScanContext } from '../../context/ScanContext.jsx';

const SECTIONS = [
  { id: 'overview', label: 'Overview', requiresScan: true },
  { id: 'exposure', label: 'Exposure', requiresScan: true },
  { id: 'performance', label: 'Performance', requiresScan: true },
  { id: 'content', label: 'Content footprint', requiresScan: true },
  { id: 'versions', label: 'Versions', requiresScan: true },
  { id: 'sitemap', label: 'Sitemap scan', requiresScan: true },
  { id: 'core', label: 'Core data', requiresScan: true },
  { id: 'plugins', label: 'Plugins', requiresScan: true },
  { id: 'unsupported', label: 'Unsupported', requiresScan: false }
];

function ScanPage() {
  const {
    headerActions,
    domain,
    handleDomainChange: onDomainChange,
    setActivePage: onNavigateHomepage,
    startScan,
    scanResult,
    isScanning,
    scanError,
    activeDomain,
    isRotatingLogs,
    rotateLogs,
    homepageResult,
    homepageIsRunning,
    startHomepageScan: onRunHomepage,
    autoHomepageEnabled: homepageAutoEnabled,
    setAutoHomepageEnabled: onToggleHomepageAuto
  } = useScanContext();
  const {
    startSitemapScan,
    result: sitemapResult,
    isRunning: isSitemapRunning
  } = useSitemapScan();
  const [sitemapFilter, setSitemapFilter] = useState('all');

  const [activeSection, setActiveSection] = useState('overview');
  const homepageDomain = domain || activeDomain;
  const homepageSummary = homepageResult
    ? `Status ${homepageResult.source?.statusCode ?? '-'} / ${homepageResult.insights?.meta?.length ?? 0} meta / ${homepageResult.insights?.assets?.length ?? 0} assets`
    : 'Capture generator hints, builder clues, and asset references from the homepage HTML.';

  const handleNavigateHomepage = () => onNavigateHomepage('homepage');

  const unsupportedQuery = useQuery({
    queryKey: ['unsupportedPlugins'],
    queryFn: fetchUnsupportedPlugins,
    initialData: []
  });

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
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="sidebar__section">
          <p className="sidebar__title">Homepage scan</p>
          <p className="card__meta">{homepageSummary}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="sidebar__action"
            onClick={() => homepageDomain && onRunHomepage(homepageDomain)}
            disabled={!homepageDomain || homepageIsRunning}
          >
            {homepageIsRunning ? 'Running homepage scan.' : 'Run homepage scan'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sidebar__action"
            onClick={handleNavigateHomepage}
          >
            View scan details
          </Button>
        </div>
        <div className="sidebar__section">
          <p className="sidebar__title">Actions</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={rotateLogs}
            disabled={isRotatingLogs}
            className="sidebar__action"
          >
            {isRotatingLogs ? 'Rotating logs…' : 'Rotate activity log'}
          </Button>
        </div>
      </nav>
    );
  }, [
    activeSection,
    scanResult,
    rotateLogs,
    isRotatingLogs,
    homepageSummary,
    homepageDomain,
    onRunHomepage,
    homepageIsRunning,
    handleNavigateHomepage
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
      subtitle="Scan a WordPress site and explore publicly accessible REST data."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      <DomainForm
        onSubmit={startScan}
        isScanning={isScanning}
        initialDomain={scanResult?.domain ?? activeDomain}
        domain={domain}
        onDomainChange={onDomainChange}
        showHomepageToggle
        homepageEnabled={homepageAutoEnabled}
        onToggleHomepage={onToggleHomepageAuto}
      />
      <div className="card">
        <div className="card__content card__content--cta">
          <div>
            <h3 className="cta-title">Need homepage signals?</h3>
            <p className="card__meta">
              Jump to the opt-in homepage source scan to extract generators, builder hints, and asset paths.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleNavigateHomepage}
            disabled={!domain && !activeDomain}
          >
            Open homepage source scan
          </Button>
        </div>
      </div>
      <HomepageSummaryCard
        domain={homepageDomain}
        result={homepageResult}
        isRunning={homepageIsRunning}
        onRunHomepage={() => onRunHomepage(homepageDomain)}
        onNavigateHomepage={handleNavigateHomepage}
      />

      {isScanning ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Scanning {activeDomain}…</p>
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

      {renderSectionContent()}
    </AppLayout>
  );
}



export default ScanPage;

function HomepageSummaryCard({
  domain,
  result,
  isRunning,
  onRunHomepage,
  onNavigateHomepage
}) {
  return (
    <div className="card">
      <div className="card__content card__content--cta">
        <div>
          <h3 className="cta-title">Homepage source snapshot</h3>
          {result ? (
            <p className="card__meta">
              Status {result.source?.statusCode ?? '—'} · {formatBytes(result.source?.sizeBytes)} ·{' '}
              {result.insights?.meta?.length ?? 0} meta · {result.insights?.assets?.length ?? 0} assets ·{' '}
              {result.insights?.frameworks?.length ?? 0} frameworks
            </p>
          ) : (
            <p className="card__meta">
              Run the homepage scan to capture generator hints, comments, assets, and frameworks for {domain || 'this site'}.
            </p>
          )}
        </div>
        <div className="cta-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNavigateHomepage}
            disabled={!domain}
          >
            View details
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRunHomepage}
            disabled={!domain || isRunning}
          >
            {isRunning ? 'Running…' : 'Run homepage scan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

HomepageSummaryCard.propTypes = {
  domain: PropTypes.string,
  result: PropTypes.object,
  isRunning: PropTypes.bool,
  onRunHomepage: PropTypes.func.isRequired,
  onNavigateHomepage: PropTypes.func.isRequired
};

HomepageSummaryCard.defaultProps = {
  domain: '',
  result: null,
  isRunning: false
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
