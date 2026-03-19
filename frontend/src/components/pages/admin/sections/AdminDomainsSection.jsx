import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import Button from '../../../atoms/Button.jsx';

function AdminDomainsSection({
  unsupportedEntries,
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
              Unique domains observed across unsupported plugin records.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {unsupportedEntries.length ? (
            <>
              <div className="admin-filters">
                <label className="admin-filter-field">
                  Domain contains
                  <input
                    type="text"
                    value={domainsQuery}
                    onChange={(event) => setDomainsQuery(event.target.value)}
                    placeholder="example.com"
                  />
                </label>
                <label className="admin-filter-field">
                  Sort
                  <select
                    value={domainsSort}
                    onChange={(event) => setDomainsSort(event.target.value)}
                  >
                    <option value="domainAsc">Domain (A-Z)</option>
                    <option value="namespacesDesc">Namespaces (high-low)</option>
                    <option value="namespacesAsc">Namespaces (low-high)</option>
                  </select>
                </label>
              </div>
              <div className="admin-table admin-table--domains">
                <div className="admin-table__header">
                  <span>Domain</span>
                  <span>Plugins</span>
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
                      <span>{domainEntry.namespaces.length}</span>
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
                            <strong>Namespaces:</strong>{' '}
                            {domainEntry.namespaces.length
                              ? domainEntry.namespaces.join(', ')
                              : 'None'}
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
            <p className="card__meta">No domains recorded.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminDomainsSection.propTypes = {
  unsupportedEntries: PropTypes.array,
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
  unsupportedEntries: [],
  filteredDomainEntries: []
};

export default AdminDomainsSection;
