import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function VersionPanel({ versions }) {
  if (!versions) {
    return null;
  }

  const wp = versions.wordpress ?? {};
  const pluginStatuses = versions.plugins ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Version & risk hints</h2>
          <p className="card__meta">
            Parsed from generator/headers; statuses are heuristic and best-effort.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="version-grid">
          <div className="version-card">
            <div className="version-card__header">
              <div>
                <div className="version-card__label">WordPress</div>
                <div className="version-card__meta">
                  Minimum {wp.minimum || '—'}
                </div>
              </div>
              <StatusBadge
                label={wp.version || 'Unknown'}
                tone={wp.status === 'outdated' ? 'warning' : 'success'}
              />
            </div>
            <div className="version-card__note">
              {wp.status === 'outdated'
                ? 'Version appears older than recommended. Confirm with an authenticated check before acting.'
                : 'No outdated signal detected.'}
            </div>
          </div>
          {pluginStatuses.map((plugin) => (
            <div key={plugin.id} className="version-card">
              <div className="version-card__header">
                <div>
                  <div className="version-card__label">{plugin.label}</div>
                  <div className="version-card__meta">
                    Minimum {plugin.minimum || '—'}
                  </div>
                </div>
                <StatusBadge
                  label={plugin.version || 'Unknown'}
                  tone={plugin.status === 'outdated' ? 'warning' : 'info'}
                />
              </div>
              <div className="version-card__note">
                {plugin.version
                  ? plugin.status === 'outdated'
                    ? 'Likely outdated based on headers. Verify in admin.'
                    : 'No outdated signal detected.'
                  : 'Version not exposed; unable to assess.'}
                {plugin.note ? ` ${plugin.note}` : ''}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

VersionPanel.propTypes = {
  versions: PropTypes.shape({
    wordpress: PropTypes.shape({
      version: PropTypes.string,
      status: PropTypes.string,
      minimum: PropTypes.string
    }),
    plugins: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        label: PropTypes.string,
        version: PropTypes.string,
        status: PropTypes.string,
        minimum: PropTypes.string,
        note: PropTypes.string
      })
    )
  })
};

VersionPanel.defaultProps = {
  versions: null
};

export default VersionPanel;
