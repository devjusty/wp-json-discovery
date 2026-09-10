import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import ScanSummary from '../../../organisms/summary/ScanSummary.jsx';
import ExposurePanel from '../../../organisms/panels/ExposurePanel.jsx';
import PerformancePanel from '../../../organisms/panels/PerformancePanel.jsx';
import ContentOverviewPanel from '../../../organisms/panels/ContentOverviewPanel.jsx';
import AdditionalScansPanel from '../AdditionalScansPanel.jsx';
import {
  evidenceLabel,
  evidenceReasons,
  evidenceSources,
  evidenceStatus,
  normalizeEvidence
} from '../../../../utils/evidence.js';

function OverviewSection({
  scanResult,
  homepageDomain,
  homepageResult,
  capabilities = {},
  selectedCapabilityIds = [],
  onRunCapability = () => {}
}) {
  if (!scanResult || typeof scanResult !== 'object') {
    const homepageState = capabilities.homepage;
    return (
      <>
        {homepageState?.status === 'unavailable' ? (
          <Card role="alert" className="card card--error">
            <CardHeader><CardTitle>Homepage source signals</CardTitle></CardHeader>
            <CardContent><p>Homepage scan is unavailable: {homepageState.error?.message ?? 'No runner available.'}</p></CardContent>
          </Card>
        ) : null}
        <AdditionalScansPanel selectedCapabilityIds={selectedCapabilityIds} capabilities={capabilities} onRunCapability={onRunCapability} />
      </>
    );
  }

  return (
    <>
      <IdentityLayer result={scanResult} />
      <section className="section">
        <div className="grid">
          <ExposurePanel
            exposure={scanResult.exposure}
            homepageSecurityHeaders={homepageResult?.securityHeaders}
          />
        </div>
      </section>
      <ActionableFindings findings={scanResult.findings} />
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
        capability={capabilities.homepage}
      />
      <AdditionalScansPanel
        selectedCapabilityIds={selectedCapabilityIds}
        capabilities={capabilities}
        onRunCapability={onRunCapability}
      />
      <section className="section">
        <div className="grid">
          <PerformancePanel performance={scanResult.performance} />
          <ContentOverviewPanel overview={scanResult.contentOverview} />
        </div>
      </section>
    </>
  );
}

function IdentityLayer({ result }) {
  const identity = result?.identity;
  const evidence = normalizeEvidence(identity?.evidence, identity);
  const hasValue = typeof identity?.value === 'string' && identity.value.trim().length > 0;
  const status = hasValue ? evidenceStatus(evidence.successful) : 'unavailable';
  const value = status === 'unavailable' ? 'Unavailable' : identity.value;
  const reason = evidenceReasons(evidence.unavailable) || identity?.reason || (status === 'unavailable'
    ? 'No identifying evidence was returned.'
    : 'WordPress REST response');

  return (
    <Card role="region" aria-label="Identity layer">
      <CardHeader>
        <CardTitle>Site profile</CardTitle>
        <CardDescription>What this site identifies itself as.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="evidence-row">
          <strong>{value}</strong>
          <EvidenceLabel
            status={status}
            source={evidenceSources([...evidence.successful, ...evidence.unavailable])}
            reason={reason}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ActionableFindings({ findings }) {
  const supportedFindings = [];
  const unavailableFindings = [];
  (findings ?? []).forEach((finding) => {
    const evidence = normalizeEvidence(finding?.evidence, finding);
    if (evidence.successful.length > 0) {
      supportedFindings.push({ finding, evidence });
    } else if (finding) {
      unavailableFindings.push({ finding, evidence: evidence.unavailable });
    }
  });

  return (
    <>
      {supportedFindings.length > 0 ? (
        <section className="section" aria-label="Actionable findings">
          <h2>Actionable findings</h2>
          <ul>
            {supportedFindings.map(({ finding, evidence }) => (
              <li key={finding.id}>
                <strong>{finding.title ?? finding.summary}</strong>{' '}
                 <EvidenceLabel
                   status={evidenceStatus(evidence.successful)}
                   source={evidenceSources([...evidence.successful, ...evidence.unavailable])}
                   reason={evidenceReasons(evidence.unavailable)}
                 />
                {evidence.unavailable.length > 0 ? (
                  <span className="card__meta"> Unavailable: {evidenceReasons(evidence.unavailable)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {unavailableFindings.length > 0 ? (
        <section className="section" aria-label="Unavailable findings">
          <h2>Unavailable findings</h2>
          <ul>
            {unavailableFindings.map(({ finding, evidence }) => (
              <li key={finding.id}>
                <strong>{finding.title ?? finding.summary}</strong>{' '}
                <EvidenceLabel status="unavailable" source={evidenceSources(evidence)} reason={evidenceReasons(evidence) || 'Successful evidence was not returned.'} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function EvidenceLabel({ status, source, reason }) {
  const label = evidenceLabel(status);
  return (
    <span className="card__meta">
      {label}{source ? ` · Source: ${source}` : ''}{reason ? ` · ${reason}` : ''}
    </span>
  );
}

OverviewSection.propTypes = {
  scanResult: PropTypes.object,
  homepageDomain: PropTypes.string,
  homepageResult: PropTypes.object,
  capabilities: PropTypes.object,
  selectedCapabilityIds: PropTypes.arrayOf(PropTypes.string),
  onRunCapability: PropTypes.func
};

OverviewSection.defaultProps = {
  homepageDomain: '',
  homepageResult: null,
  capabilities: {},
  selectedCapabilityIds: [],
  onRunCapability: () => {}
};

export default OverviewSection;

function HomepageOverviewCard({
  domain,
  result
  , capability
}) {
  return (
    <Card role="status" aria-label="Homepage source signals">
      <CardHeader>
        <div>
          <CardTitle className="cta-title">Homepage source signals</CardTitle>
          {result ? (
            <CardDescription>
              Status {result.source?.statusCode ?? '—'} · {formatBytes(result.source?.sizeBytes)} ·{' '}
              {result.insights?.meta?.length ?? 0} meta · {result.insights?.assets?.length ?? 0} assets ·{' '}
              {result.insights?.frameworks?.length ?? 0} frameworks
            </CardDescription>
          ) : capability?.status === 'unavailable' ? (
            <CardDescription>{capability.error?.message ?? 'Homepage scan is unavailable.'}</CardDescription>
          ) : (
            <CardDescription>
              Capture generator hints, builder clues, frameworks, and asset paths from the homepage HTML for {domain || 'this site'}.
            </CardDescription>
          )}
        </div>
        <CardAction>
          <span className="card__meta">
            {capability?.status === 'idle' ? 'Run when needed.' : capability?.status === 'failed' ? 'Scan failed.' : 'Runs with selected scans.'}
          </span>
        </CardAction>
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
