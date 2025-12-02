import { useMemo } from 'react';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import HomepageSourcePanel from '../organisms/panels/HomepageSourcePanel.jsx';
import HomepageInsightsPanel from '../organisms/panels/HomepageInsightsPanel.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../atoms/Card.jsx';
import Button from '../atoms/Button.jsx';
import PropTypes from 'prop-types';
import { useScanContext } from '../../context/ScanContext.jsx';

function HomepageScanPage() {
  const {
    headerActions,
    domain,
    handleDomainChange: onDomainChange,
    startHomepageScan,
    homepageResult: result,
    homepageIsRunning: isRunning,
    homepageError: error,
    setActivePage,
    scanResult,
    activeDomain
  } = useScanContext();

  const sidebarNav = useMemo(() => {
    const currentDomain = domain || result?.domain || activeDomain;
    return (
      <nav className="sidebar">
        <div className="sidebar__section">
          <p className="sidebar__title">Navigation</p>
          <ul className="sidebar__nav">
            <li>
              <button
                type="button"
                className="sidebar__link"
                onClick={() => setActivePage('scan')}
              >
                ← Back to overview
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
        <div className="sidebar__section">
          <p className="sidebar__title">Homepage scan</p>
          <p className="card__meta">
            {result
              ? `Status ${result.source?.statusCode ?? '—'} · ${result.insights?.meta?.length ?? 0} meta · ${result.insights?.assets?.length ?? 0} assets`
              : 'Run the opt-in homepage scan to extract builder and framework hints.'}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="sidebar__action"
            onClick={() => currentDomain && startHomepageScan(currentDomain)}
            disabled={!currentDomain || isRunning}
          >
            {isRunning ? 'Running homepage scan…' : 'Run homepage scan'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="sidebar__action"
            onClick={() => setActivePage('scan')}
          >
            View REST overview
          </Button>
        </div>
        <div className="sidebar__section">
          <p className="sidebar__title">Latest REST scan</p>
          <p className="card__meta">
            {scanResult?.domain
              ? `${scanResult.domain} · ${scanResult.metrics?.namespacesCount ?? 0} namespaces`
              : 'No REST scan yet'}
          </p>
        </div>
      </nav>
    );
  }, [activeDomain, domain, isRunning, result, scanResult, setActivePage, startHomepageScan]);

  return (
    <AppLayout
      title="Homepage Source Scan"
      subtitle="Opt-in HTML fetch of the homepage to surface meta tags, builder hints, and asset paths without crawling."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      <DomainForm
        onSubmit={startHomepageScan}
        isScanning={isRunning}
        initialDomain={result?.domain}
        domain={domain}
        onDomainChange={onDomainChange}
      />

      <div className="homepage-hero">
        <div className="homepage-hero__grid">
          <div>
            <p className="eyebrow">Opt-in analysis</p>
            <h2>Read the homepage source without crawling</h2>
            <p className="hero-lede">
              Fetch the first 1 MB of the homepage HTML, then extract generators, builders,
              asset paths, and script hints. Single request, no sub-resources.
            </p>
            <ul className="hero-points">
              <li>1 MB cap with truncated preview</li>
              <li>Framework + builder hints from scripts and comments</li>
              <li>Plugin/theme asset roots surfaced for quick mapping</li>
            </ul>
          </div>
          <div className="hero-stats">
            <div className="hero-pill">
              <div className="hero-pill__label">Request profile</div>
              <div className="hero-pill__value">1 GET · No assets</div>
              <p className="hero-pill__hint">Respects domain normalization and redirects.</p>
            </div>
            <div className="hero-pill">
              <div className="hero-pill__label">Safety</div>
              <div className="hero-pill__value">Text-only parse</div>
              <p className="hero-pill__hint">No script execution; HTML is parsed as plain text.</p>
            </div>
            <div className="hero-pill">
              <div className="hero-pill__label">What you get</div>
              <div className="hero-pill__value">Meta · Comments · Assets · Frameworks</div>
              <p className="hero-pill__hint">Signals logged for future parser improvements.</p>
            </div>
          </div>
        </div>
      </div>

      {isRunning ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Fetching homepage HTML…</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{error?.message ?? 'Homepage scan failed.'}</p>
          </div>
        </div>
      ) : null}

      {result ? (
        <section className="section">
          <div className="grid">
            <HomepageSourcePanel source={result.source} />
            <HomepageInsightsPanel
              insights={result.insights}
              htmlPreview={result.htmlPreview}
            />
            <JsonSchemaPreview data={result} />
          </div>
        </section>
      ) : null}
    </AppLayout>
  );
}



function JsonSchemaPreview({ data }) {
  if (!data) return null;
  const preview = JSON.stringify(data, null, 2);

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>JSON schema preview</h2>
          <p className="card__meta">
            Raw response from the homepage scan endpoint for troubleshooting and integrations.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="code-block" aria-label="Homepage scan JSON">
          {preview}
        </pre>
      </CardContent>
    </Card>
  );
}

JsonSchemaPreview.propTypes = {
  data: PropTypes.object
};

export default HomepageScanPage;
