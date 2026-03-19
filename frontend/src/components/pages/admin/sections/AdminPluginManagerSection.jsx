import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import Button from '../../../atoms/Button.jsx';

function AdminPluginManagerSection({
  sortPluginsMutation,
  pluginsQuery,
  managedPlugins,
  startEditing,
  deletePluginMutation
}) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-plugin-manager-main">Plugin manager</h2>
            <p className="card__meta">
              Add, edit, or remove plugins in the registry. Changes write directly to `frontend/src/config/plugins.js`.
            </p>
          </div>
          <div className="card__actions">
            <span className="tooltip">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => sortPluginsMutation.mutate()}
                disabled={sortPluginsMutation.isPending || pluginsQuery.isLoading}
              >
                {sortPluginsMutation.isPending ? 'Sorting…' : 'Sort plugins'}
              </Button>
              <span className="tooltip__content">
                Alphabetize plugin entries in `plugins.js` for cleaner diffs.
              </span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {pluginsQuery.isLoading ? (
            <p className="card__meta">Loading plugins…</p>
          ) : pluginsQuery.isError ? (
            <div className="card card--error">
              <div className="card__content">
                <p>{pluginsQuery.error?.message ?? 'Failed to load plugins.'}</p>
              </div>
            </div>
          ) : (
            <div className="admin-table admin-table--plugins">
              <div className="admin-table__header">
                <span>Plugin</span>
                <span>Namespaces</span>
                <span>Asset hints</span>
                <span>Actions</span>
              </div>
              {managedPlugins.map((plugin) => (
                <div key={plugin.id} className="admin-table__row">
                  <span className="admin-table__cell admin-table__cell--expand">
                    <strong>{plugin.label}</strong>
                    <div className="muted">{plugin.id}</div>
                    {plugin.pluginUrl ? (
                      <div>
                        <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">
                          Docs
                        </a>
                      </div>
                    ) : null}
                    <div className="muted">{plugin.description || 'No description'}</div>
                  </span>
                  <span>{plugin.namespaces?.length ?? 0}</span>
                  <span>{plugin.assetHints?.length ?? 0}</span>
                  <span>
                    <div className="button-group">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(plugin)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Delete plugin "${plugin.label}"?`)) {
                            deletePluginMutation.mutate(plugin.id);
                          }
                        }}
                        disabled={deletePluginMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminPluginManagerSection.propTypes = {
  sortPluginsMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool
  }).isRequired,
  pluginsQuery: PropTypes.shape({
    isLoading: PropTypes.bool,
    isError: PropTypes.bool,
    error: PropTypes.object
  }).isRequired,
  managedPlugins: PropTypes.array,
  startEditing: PropTypes.func.isRequired,
  deletePluginMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool
  }).isRequired
};

AdminPluginManagerSection.defaultProps = {
  managedPlugins: []
};

export default AdminPluginManagerSection;
