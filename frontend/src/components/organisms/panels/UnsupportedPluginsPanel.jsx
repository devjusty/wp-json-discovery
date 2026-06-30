import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import {
  Card,
  CardActions,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function UnsupportedPluginsPanel({ plugins, isLoading, onRefresh, showDomains }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Unsupported plugins</h2>
          <p className="card__meta">
            Namespaces discovered without handlers. Add details to support these
            in future scans.
          </p>
        </div>
        <CardActions>
          <Button
            type="button"
            variant="secondary"
            onClick={onRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </CardActions>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading unsupported plugin list…</p>
        ) : plugins.length === 0 ? (
          <p className="card__meta">No unsupported plugins recorded yet.</p>
        ) : (
          <ul className="unsupported-list">
            {plugins.map((plugin) => (
              <li key={plugin.namespace}>
                <div className="unsupported-list__header">
                  <strong>{plugin.namespace}</strong>
                  <span>
                    First seen:{' '}
                    {plugin.firstDetectedAt
                      ? new Date(plugin.firstDetectedAt).toLocaleString()
                      : '—'}
                  </span>
                  <span>
                    Last seen:{' '}
                    {plugin.lastDetectedAt
                      ? new Date(plugin.lastDetectedAt).toLocaleString()
                      : '—'}
                  </span>
                </div>
                {showDomains && plugin.domains?.length ? (
                  <p className="card__meta">
                    Domains: {plugin.domains.join(', ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

UnsupportedPluginsPanel.propTypes = {
  plugins: PropTypes.arrayOf(
    PropTypes.shape({
      namespace: PropTypes.string.isRequired,
      firstDetectedAt: PropTypes.string,
      lastDetectedAt: PropTypes.string,
      domains: PropTypes.arrayOf(PropTypes.string)
    })
  ).isRequired,
  isLoading: PropTypes.bool,
  onRefresh: PropTypes.func,
  showDomains: PropTypes.bool
};

UnsupportedPluginsPanel.defaultProps = {
  isLoading: false,
  onRefresh: () => {},
  showDomains: false
};

export default UnsupportedPluginsPanel;
