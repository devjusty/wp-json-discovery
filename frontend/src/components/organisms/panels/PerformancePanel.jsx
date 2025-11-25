import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function PerformancePanel({ performance }) {
  if (!performance) {
    return null;
  }

  const rows = [
    { key: 'home', label: 'Home', data: performance.home },
    { key: 'wpJson', label: '/wp-json/', data: performance.wpJson },
    { key: 'xmlrpc', label: '/xmlrpc.php', data: performance.xmlrpc },
    { key: 'sitemap', label: '/sitemap.xml', data: performance.sitemap },
    { key: 'robots', label: '/robots.txt', data: performance.robots }
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Performance snapshot</h2>
          <p className="card__meta">
            Simple latency + status checks for common touchpoints.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="perf-grid">
          {rows.map((row) => (
            <div key={row.key} className="perf-card">
              <div className="perf-card__header">
                <div>
                  <div className="perf-card__label">{row.label}</div>
                  <div className="perf-card__endpoint">{row.data?.endpoint}</div>
                </div>
                <div className="perf-card__badges">
                  {row.data?.redirected ? (
                    <StatusBadge
                      label={`Redirected${row.data.redirectCount ? ` (${row.data.redirectCount})` : ''}`}
                      tone="info"
                    />
                  ) : null}
                  <StatusBadge
                    label={row.data?.statusCode ? `HTTP ${row.data.statusCode}` : 'Unknown'}
                    tone={row.data?.ok ? 'success' : 'warning'}
                  />
                </div>
              </div>
              <div className="perf-card__metrics">
                <div>
                  <div className="perf-card__metric-label">Latency</div>
                  <div className="perf-card__metric-value">
                    {formatDuration(row.data?.durationMs)}
                  </div>
                </div>
                <div>
                  <div className="perf-card__metric-label">Server</div>
                  <div className="perf-card__metric-value">
                    {row.data?.server || '—'}
                  </div>
                </div>
                <div>
                  <div className="perf-card__metric-label">Cache</div>
                  <div className="perf-card__metric-value">
                    {row.data?.cache || '—'}
                  </div>
                </div>
                <div>
                  <div className="perf-card__metric-label">Compression</div>
                  <div className="perf-card__metric-value">
                    {row.data?.compression || '—'}
                  </div>
                </div>
                <div>
                  <div className="perf-card__metric-label">HSTS</div>
                  <div className="perf-card__metric-value">
                    {row.data?.hsts ? 'Enabled' : '—'}
                  </div>
                </div>
                {row.key === 'sitemap' || row.key === 'robots' ? (
                  <div>
                    <div className="perf-card__metric-label">Link</div>
                    <div className="perf-card__metric-value">
                      {row.data?.finalUrl ? (
                        <a
                          href={row.data.finalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="external-link"
                        >
                          Open {row.key === 'sitemap' ? 'sitemap' : 'robots'} ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(durationMs) {
  if (!durationMs && durationMs !== 0) {
    return '—';
  }
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${durationMs}ms`;
}

PerformancePanel.propTypes = {
  performance: PropTypes.shape({
    home: PropTypes.object,
    wpJson: PropTypes.object,
    xmlrpc: PropTypes.object,
    sitemap: PropTypes.object,
    robots: PropTypes.object
  })
};

PerformancePanel.defaultProps = {
  performance: null
};

export default PerformancePanel;
