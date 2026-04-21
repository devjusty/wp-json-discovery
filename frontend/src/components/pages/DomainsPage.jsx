import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import AppLayout from '../templates/AppLayout.jsx';
import Button from '../atoms/Button.jsx';
import TextInput from '../atoms/TextInput.jsx';
import { useScanShellContext } from '../../context/ScanContext.jsx';
import { useDomainTrust } from '../../hooks/useDomainTrust.js';
import { useSitemapScan } from '../../hooks/useSitemapScan.js';

function DomainsPage({ headerActions }) {
  const { activeDomain, setDomain, startScan, setActivePage } = useScanShellContext();
  const [domainInput, setDomainInput] = useState(activeDomain ?? '');
  const [selectedDomain, setSelectedDomain] = useState(activeDomain ?? '');
  const [maxPagesInput, setMaxPagesInput] = useState('25');
  const { trust, isLoading, isUpdating, error, updateWarningStatus } = useDomainTrust(selectedDomain);
  const { startSitemapScan, result: deepAuditResult, isRunning: isDeepAuditRunning } = useSitemapScan();

  useEffect(() => {
    if (!activeDomain) {
      return;
    }
    setDomainInput(activeDomain);
    setSelectedDomain(activeDomain);
  }, [activeDomain]);

  const trustLabel = useMemo(() => {
    if (trust.status === 'blocked') return 'Blocked';
    if (trust.status === 'warning') return 'Needs review';
    if (trust.status === 'pass') return 'Trusted';
    return 'No trust snapshot';
  }, [trust.status]);

  const unresolvedWarnings = trust.warnings.filter((warning) => warning.status === 'open');

  return (
    <AppLayout
      title="Domains"
      subtitle="Review trust status, resolve consistency warnings, and run deep content audits."
      headerActions={headerActions}
    >
      <section className="card">
        <div className="card__header card__header--row">
          <div>
            <h2>Domain trust workspace</h2>
            <p className="card__meta">Choose a domain to inspect trust and warning remediation.</p>
          </div>
          <div className="button-group">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!selectedDomain) return;
                setDomain(selectedDomain);
                setActivePage('scan');
              }}
            >
              Open in scanner
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!selectedDomain) return;
                setDomain(selectedDomain);
                startScan(selectedDomain);
                setActivePage('scan');
              }}
            >
              Re-scan now
            </Button>
          </div>
        </div>
        <div className="card__content">
          <div className="domain-form__controls">
            <TextInput
              type="text"
              className="domain-form__input"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              placeholder="example.com"
            />
            <Button
              type="button"
              onClick={() => {
                const nextDomain = domainInput.trim();
                if (!nextDomain) return;
                setSelectedDomain(nextDomain);
                setDomain(nextDomain);
              }}
            >
              Load trust
            </Button>
          </div>
          {selectedDomain ? (
            <p className="card__meta domains-trust__status-line">
              {isLoading ? 'Loading trust snapshot…' : `Status: ${trustLabel}`}
              {trust.envelope?.scannedAt ? ` · Last scan: ${new Date(trust.envelope.scannedAt).toLocaleString()}` : ''}
              {trust.unresolvedCount ? ` · Open warnings: ${trust.unresolvedCount}` : ''}
            </p>
          ) : (
            <p className="card__meta">Enter a domain to view trust details.</p>
          )}
          {error ? <p className="card__meta admin-validation-error">{error.message}</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Consistency warnings</h2>
            <p className="card__meta">Resolve or ignore warnings to track reconciliation progress.</p>
          </div>
        </div>
        <div className="card__content">
          {!selectedDomain ? (
            <p className="card__meta">Load a domain to inspect warnings.</p>
          ) : unresolvedWarnings.length === 0 ? (
            <p className="card__meta">No open warnings for this domain.</p>
          ) : (
            <div className="admin-table admin-table--trust-warnings">
              <div className="admin-table__header">
                <span>Rule</span>
                <span>Severity</span>
                <span>Reason</span>
                <span>Actions</span>
              </div>
              {unresolvedWarnings.map((warning) => (
                <div key={`trust-warning-${warning.id}`} className="admin-table__row">
                  <span>{warning.ruleCode}</span>
                  <span>{warning.severity}</span>
                  <span>{warning.reason}</span>
                  <span className="button-group">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isUpdating}
                      onClick={() => updateWarningStatus({ id: warning.id, status: 'resolved' })}
                    >
                      Resolve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isUpdating}
                      onClick={() => updateWarningStatus({ id: warning.id, status: 'ignored' })}
                    >
                      Ignore
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div>
            <h2>Deep content audit</h2>
            <p className="card__meta">Queue an async sitemap crawl and review per-page content findings.</p>
          </div>
        </div>
        <div className="card__content">
          <div className="domain-form__controls">
            <TextInput
              type="number"
              min="1"
              max="250"
              className="domain-form__input"
              value={maxPagesInput}
              onChange={(event) => setMaxPagesInput(event.target.value)}
            />
            <Button
              type="button"
              disabled={!selectedDomain || isDeepAuditRunning}
              onClick={() => {
                const parsedPages = Number.parseInt(maxPagesInput, 10);
                startSitemapScan({
                  domain: selectedDomain,
                  sitemapUrl: `https://${selectedDomain}/sitemap.xml`,
                  maxPages: Number.isFinite(parsedPages) ? parsedPages : 25,
                });
              }}
            >
              {isDeepAuditRunning ? 'Running audit…' : 'Run deep audit'}
            </Button>
          </div>
          {deepAuditResult ? (
            <p className="card__meta">
              Audit complete. Pages: {deepAuditResult.pages?.length ?? 0} · Indexed:
              {' '}
              {deepAuditResult.totals?.indexedCount ?? '—'}
            </p>
          ) : (
            <p className="card__meta">No deep audit run in this session.</p>
          )}
        </div>
      </section>
    </AppLayout>
  );
}

DomainsPage.propTypes = {
  headerActions: PropTypes.node,
};

DomainsPage.defaultProps = {
  headerActions: null,
};

export default DomainsPage;
