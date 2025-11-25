import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function PluginSummaryPanel({ plugins }) {
  const matched = plugins?.matched ?? [];
  const unsupported = plugins?.unsupportedNamespaces ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Plugins detected</h2>
          <p className="card__meta">
            Supported plugins with route counts plus any unknown namespaces captured during the scan.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {matched.length === 0 ? (
          <p className="card__meta">No supported plugin namespaces detected.</p>
        ) : (
          <ul className="plugin-summary-list">
            {matched.map((match) => (
              <li key={match.plugin.id} className="plugin-summary-card">
                <div className="plugin-summary-card__top">
                  <div>
                    <div className="plugin-summary-card__label">{match.plugin.label}</div>
                    <div className="plugin-summary-card__namespaces">
                      {match.namespaces.join(', ')}
                    </div>
                    {match.plugin.pluginUrl ? (
                      <a
                        href={match.plugin.pluginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="external-link"
                      >
                        Plugin page ↗
                      </a>
                    ) : null}
                  </div>
                  <StatusBadge
                    label={`${match.routes.length} routes`}
                    tone="info"
                  />
                </div>
                <p className="plugin-summary-card__description">
                  {match.plugin.description}
                </p>
              </li>
            ))}
          </ul>
        )}

        {unsupported.length > 0 ? (
          <div className="unsupported-pill-row">
            <p className="card__meta">Unsupported namespaces logged:</p>
            <div className="pill-row">
              {unsupported.map((ns) => (
                <span key={ns} className="pill pill--neutral">{ns}</span>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

PluginSummaryPanel.propTypes = {
  plugins: PropTypes.shape({
    matched: PropTypes.arrayOf(
      PropTypes.shape({
        plugin: PropTypes.shape({
          id: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
          description: PropTypes.string
        }).isRequired,
        namespaces: PropTypes.arrayOf(PropTypes.string).isRequired,
        routes: PropTypes.arrayOf(PropTypes.object).isRequired
      })
    ),
    unsupportedNamespaces: PropTypes.arrayOf(PropTypes.string)
  })
};

PluginSummaryPanel.defaultProps = {
  plugins: {
    matched: [],
    unsupportedNamespaces: []
  }
};

export default PluginSummaryPanel;
