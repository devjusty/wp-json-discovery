import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import Button from '../../../atoms/Button.jsx';
import TextInput from '../../../atoms/TextInput.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select.jsx';
import { formatFullTimestamp } from '../utils.js';

const DOMAIN_SORT_LABELS = {
  recent: 'Most recently scanned',
  domainAsc: 'Domain (A-Z)',
  status: 'Status (failed first)'
};

function AdminDomainsSection({
  totalDomainEntries,
  domainsQuery,
  setDomainsQuery,
  domainsSort,
  setDomainsSort,
  filteredDomainEntries,
  expandedDomainRows,
  setExpandedDomainRows,
  onRescan
}) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-domains-main">Domains tracked</h2>
            <p className="card__meta">
              All domains with at least one scan attempt (success or failure).
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="admin-filters">
            <label className="admin-filter-field">
              Domain contains
              <TextInput
                type="text"
                value={domainsQuery}
                onChange={(event) => setDomainsQuery(event.target.value)}
                placeholder="example.com"
              />
            </label>
            <label className="admin-filter-field">
              Sort
              <Select value={domainsSort} onValueChange={setDomainsSort}>
                <SelectTrigger>
                  <SelectValue>{DOMAIN_SORT_LABELS[domainsSort] ?? DOMAIN_SORT_LABELS.recent}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOMAIN_SORT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {totalDomainEntries > 0 ? (
            <>
              <div className="admin-table admin-table--domain-history">
                <div className="admin-table__header">
                  <span>Domain</span>
                  <span>Last status</span>
                  <span>Last scanned</span>
                  <span>Action</span>
                </div>
                {filteredDomainEntries.map((domainEntry) => {
                  const isExpanded = expandedDomainRows.has(domainEntry.domain);
                  return (
                    <div key={domainEntry.domain} className="admin-table__row admin-table__row--expandable">
                      <button
                        type="button"
                        className="admin-table__cell admin-table__cell--expand"
                        onClick={() => {
                          setExpandedDomainRows((prev) => {
                            const next = new Set(prev);
                            if (next.has(domainEntry.domain)) {
                              next.delete(domainEntry.domain);
                            } else {
                              next.add(domainEntry.domain);
                            }
                            return next;
                          });
                        }}
                        aria-expanded={isExpanded}
                      >
                        {domainEntry.domain}
                      </button>
                      <span>{domainEntry.lastStatus ?? '—'}</span>
                      <span>{formatFullTimestamp(domainEntry.lastScannedAt) || '—'}</span>
                      <span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onRescan(domainEntry.domain)}
                        >
                          Rescan
                        </Button>
                      </span>
                      {isExpanded ? (
                        <div className="admin-table__details">
                          <p>
                            <strong>First scanned:</strong>{' '}
                            {formatFullTimestamp(domainEntry.firstScannedAt) || '—'}
                          </p>
                          <p>
                            <strong>Last duration:</strong>{' '}
                            {Number.isFinite(domainEntry.lastDurationMs)
                              ? `${domainEntry.lastDurationMs} ms`
                              : '—'}
                          </p>
                          <p>
                            <strong>Last error category:</strong>{' '}
                            {domainEntry.lastErrorCategory || '—'}
                          </p>
                          <p>
                            <strong>Last unsupported namespaces:</strong>{' '}
                            {Number.isFinite(domainEntry.lastUnsupportedCount)
                              ? domainEntry.lastUnsupportedCount
                              : '—'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {!filteredDomainEntries.length ? (
                <p className="card__meta">No domains match this filter.</p>
              ) : null}
            </>
          ) : (
            <p className="card__meta">No scanned domains found.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminDomainsSection.propTypes = {
  totalDomainEntries: PropTypes.number,
  domainsQuery: PropTypes.string.isRequired,
  setDomainsQuery: PropTypes.func.isRequired,
  domainsSort: PropTypes.string.isRequired,
  setDomainsSort: PropTypes.func.isRequired,
  filteredDomainEntries: PropTypes.array,
  expandedDomainRows: PropTypes.instanceOf(Set).isRequired,
  setExpandedDomainRows: PropTypes.func.isRequired,
  onRescan: PropTypes.func.isRequired
};

AdminDomainsSection.defaultProps = {
  totalDomainEntries: 0,
  filteredDomainEntries: []
};

export default AdminDomainsSection;
