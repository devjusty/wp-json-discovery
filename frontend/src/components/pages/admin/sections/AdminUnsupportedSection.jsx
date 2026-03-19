import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import { formatFullTimestamp, formatShortDate } from '../utils.js';

function AdminUnsupportedSection({
  unsupportedEntries,
  unsupportedNamespacePrefix,
  setUnsupportedNamespacePrefix,
  unsupportedSort,
  setUnsupportedSort,
  filteredUnsupportedEntries
}) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-unsupported-main">Unsupported plugins</h2>
            <p className="card__meta">Current registry with domains and timestamps.</p>
          </div>
        </CardHeader>
        <CardContent>
          {unsupportedEntries.length ? (
            <>
              <div className="admin-filters">
                <label className="admin-filter-field">
                  Namespace prefix
                  <input
                    type="text"
                    value={unsupportedNamespacePrefix}
                    onChange={(event) => setUnsupportedNamespacePrefix(event.target.value)}
                    placeholder="e.g. wc/"
                  />
                </label>
                <label className="admin-filter-field">
                  Sort
                  <select
                    value={unsupportedSort}
                    onChange={(event) => setUnsupportedSort(event.target.value)}
                  >
                    <option value="lastSeenDesc">Last seen (newest)</option>
                    <option value="domainsDesc">Most domains</option>
                    <option value="namespaceAsc">Namespace (A-Z)</option>
                  </select>
                </label>
              </div>
              <div className="admin-table">
                <div className="admin-table__header">
                  <span>Namespace</span>
                  <span>Domains</span>
                  <span>First seen</span>
                  <span>Last seen</span>
                </div>
                {filteredUnsupportedEntries.map((plugin) => (
                  <div key={plugin.namespace} className="admin-table__row">
                    <span>{plugin.namespace}</span>
                    <span>{plugin.domains?.length ?? 0}</span>
                    <span className="tooltip">
                      {formatShortDate(plugin.firstDetectedAt)}
                      <span className="tooltip__content">
                        {formatFullTimestamp(plugin.firstDetectedAt) || '—'}
                      </span>
                    </span>
                    <span className="tooltip">
                      {formatShortDate(plugin.lastDetectedAt)}
                      <span className="tooltip__content">
                        {formatFullTimestamp(plugin.lastDetectedAt) || '—'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              {!filteredUnsupportedEntries.length ? (
                <p className="card__meta">No unsupported namespaces match this filter.</p>
              ) : null}
            </>
          ) : (
            <p className="card__meta">No unsupported plugins recorded.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminUnsupportedSection.propTypes = {
  unsupportedEntries: PropTypes.array,
  unsupportedNamespacePrefix: PropTypes.string.isRequired,
  setUnsupportedNamespacePrefix: PropTypes.func.isRequired,
  unsupportedSort: PropTypes.string.isRequired,
  setUnsupportedSort: PropTypes.func.isRequired,
  filteredUnsupportedEntries: PropTypes.array
};

AdminUnsupportedSection.defaultProps = {
  unsupportedEntries: [],
  filteredUnsupportedEntries: []
};

export default AdminUnsupportedSection;
