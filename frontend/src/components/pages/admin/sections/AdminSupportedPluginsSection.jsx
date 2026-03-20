import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';

function AdminSupportedPluginsSection({
  totalPlugins,
  isLoading,
  isError,
  errorMessage,
  pluginCatalogQuery,
  setPluginCatalogQuery,
  pluginCatalogSort,
  setPluginCatalogSort,
  filteredSupportedPlugins,
  expandedPluginId,
  setExpandedPluginId
}) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-supported-plugins-main">Supported plugins</h2>
            <p className="card__meta">
              {totalPlugins} plugin namespaces tracked in the registry.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="card__meta">Loading supported plugins…</p>
          ) : null}
          {isError ? (
            <div className="card card--error">
              <div className="card__content">
                <p>{errorMessage || 'Unable to load supported plugins.'}</p>
              </div>
            </div>
          ) : null}
          {!isLoading && !isError ? (
            <>
          <div className="admin-filters">
            <label className="admin-filter-field">
              Search
              <input
                type="text"
                value={pluginCatalogQuery}
                onChange={(event) => setPluginCatalogQuery(event.target.value)}
                placeholder="Search plugin label or ID"
              />
            </label>
            <label className="admin-filter-field">
              Sort
              <select
                value={pluginCatalogSort}
                onChange={(event) => setPluginCatalogSort(event.target.value)}
              >
                <option value="labelAsc">Label (A-Z)</option>
                <option value="namespacesDesc">Namespaces (high-low)</option>
                <option value="namespacesAsc">Namespaces (low-high)</option>
              </select>
            </label>
          </div>
          <div className="admin-table admin-table--plugins">
            <div className="admin-table__header">
              <span>Plugin</span>
              <span>Namespaces</span>
              <span>Docs</span>
              <span>Description</span>
            </div>
            {filteredSupportedPlugins.map((plugin) => {
              const isExpanded = expandedPluginId === plugin.id;
              return (
                <div key={plugin.id} className="admin-table__row admin-table__row--expandable">
                  <button
                    type="button"
                    className="admin-table__cell admin-table__cell--expand"
                    onClick={() => setExpandedPluginId(isExpanded ? null : plugin.id)}
                    aria-expanded={isExpanded}
                  >
                    {plugin.label}
                  </button>
                  <span>{plugin.namespaces?.length ?? 0}</span>
                  <span>
                    {plugin.pluginUrl ? (
                      <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">
                        Link
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span>{plugin.description}</span>
                  {isExpanded ? (
                    <div className="admin-table__details">
                      <p><strong>Namespaces:</strong> {plugin.namespaces?.length ? plugin.namespaces.join(', ') : 'None'}</p>
                      <p><strong>Asset hints:</strong> {plugin.assetHints?.length ? plugin.assetHints.join(', ') : 'None'}</p>
                      {plugin.pluginUrl ? (
                        <p><strong>Docs:</strong> <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">{plugin.pluginUrl}</a></p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!filteredSupportedPlugins.length ? (
            <p className="card__meta">No supported plugins match this filter.</p>
          ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

AdminSupportedPluginsSection.propTypes = {
  totalPlugins: PropTypes.number,
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  errorMessage: PropTypes.string,
  pluginCatalogQuery: PropTypes.string.isRequired,
  setPluginCatalogQuery: PropTypes.func.isRequired,
  pluginCatalogSort: PropTypes.string.isRequired,
  setPluginCatalogSort: PropTypes.func.isRequired,
  filteredSupportedPlugins: PropTypes.array,
  expandedPluginId: PropTypes.string,
  setExpandedPluginId: PropTypes.func.isRequired
};

AdminSupportedPluginsSection.defaultProps = {
  totalPlugins: 0,
  isLoading: false,
  isError: false,
  errorMessage: '',
  filteredSupportedPlugins: [],
  expandedPluginId: null
};

export default AdminSupportedPluginsSection;
