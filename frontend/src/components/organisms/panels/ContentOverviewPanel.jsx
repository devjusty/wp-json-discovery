import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function ContentOverviewPanel({ overview }) {
  if (!overview) {
    return null;
  }

  const collections = overview.collections ?? [];
  const mediaBreakdown = overview.mediaBreakdown ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Content footprint</h2>
          <p className="card__meta">
            Totals from REST headers (X-WP-Total) plus a quick media breakdown.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="stat-grid">
          {collections.map((item) => (
            <div key={item.key} className="stat-chip">
              <div className="stat-chip__top">
                <span className="stat-chip__label">{item.label}</span>
                <StatusBadge
                  label={formatStatusLabel(item)}
                  tone={item.ok ? 'success' : 'warning'}
                />
              </div>
              <div className="stat-chip__value">
                {formatCount(item.count)}
              </div>
              <div className="stat-chip__hint">
                {formatDuration(item.durationMs)} · {item.endpoint}
              </div>
            </div>
          ))}
        </div>

        {mediaBreakdown.length > 0 ? (
          <div className="media-breakdown">
            <h3>Recent media types</h3>
            <ul className="pill-list">
              {mediaBreakdown.map((item) => (
                <li key={item.type} className="pill">
                  <span className="pill__label">{item.type}</span>
                  <span className="pill__value">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatStatusLabel(item) {
  if (item.statusCode) {
    return `HTTP ${item.statusCode}`;
  }
  return item.ok ? 'OK' : 'Check';
}

function formatCount(value) {
  if (value === 0) {
    return '0';
  }
  if (!value && value !== 0) {
    return '—';
  }
  return value.toLocaleString();
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

ContentOverviewPanel.propTypes = {
  overview: PropTypes.shape({
    collections: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string,
        label: PropTypes.string,
        endpoint: PropTypes.string,
        count: PropTypes.number,
        durationMs: PropTypes.number,
        statusCode: PropTypes.number,
        ok: PropTypes.bool
      })
    ),
    mediaBreakdown: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
        count: PropTypes.number
      })
    )
  })
};

ContentOverviewPanel.defaultProps = {
  overview: null
};

export default ContentOverviewPanel;
