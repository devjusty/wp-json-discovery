import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function HomepageSourcePanel({ source }) {
  if (!source) {
    return (
      <Card>
        <CardHeader>
          <div>
            <h2>Homepage fetch</h2>
            <p className="card__meta">
              Run a new scan to see response status, size, redirects, and MIME type.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="card__meta">No homepage source data has been captured for this domain yet.</p>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    { label: 'Status', value: source.statusCode },
    { label: 'Final URL', value: source.finalUrl },
    { label: 'Content-Type', value: source.contentType || 'unknown' },
    { label: 'Size', value: formatBytes(source.sizeBytes) },
    { label: 'Duration', value: `${source.durationMs ?? 0} ms` },
    { label: 'Redirects', value: source.redirects ?? 0 },
    { label: 'Truncated', value: source.truncated ? 'Yes' : 'No' }
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Homepage fetch</h2>
          <p className="card__meta">
            Single GET to the homepage with a 500 KB HTML cap. No sub-resources are fetched.
          </p>
        </div>
        <StatusBadge label={source.ok ? 'OK' : 'Check'} tone={source.ok ? 'success' : 'warning'} />
      </CardHeader>
      <CardContent>
        <dl className="stat-grid stat-grid--homepage-fetch">
          {rows.map((row) => (
            <div key={row.label} className="stat-grid__item">
              <dt>{row.label}</dt>
              <dd>{row.value || '—'}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

HomepageSourcePanel.propTypes = {
  source: PropTypes.shape({
    statusCode: PropTypes.number,
    finalUrl: PropTypes.string,
    contentType: PropTypes.string,
    sizeBytes: PropTypes.number,
    durationMs: PropTypes.number,
    redirects: PropTypes.number,
    truncated: PropTypes.bool,
    ok: PropTypes.bool
  })
};

HomepageSourcePanel.defaultProps = {
  source: null
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

export default HomepageSourcePanel;
