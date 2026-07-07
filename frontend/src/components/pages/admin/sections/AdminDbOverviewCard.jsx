import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card.jsx';
import Button from '../../../atoms/Button.jsx';
import { formatBytes } from '../utils.js';

function AdminDbOverviewCard({
  data,
  isRemoteDb,
  hasActivityLogSize,
  snapshotQuery,
  onOpenSection
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 id="admin-db-database">Database</h2>
          <p className="card__meta">{data.dbPath}</p>
          <p className="card__meta">
            {isRemoteDb ? 'Turso database endpoint' : 'Local database path'}
          </p>
        </div>
        <CardAction>
          <span className="tooltip">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => snapshotQuery.refetch()}
              disabled={snapshotQuery.isFetching}
            >
              {snapshotQuery.isFetching ? 'Refreshing…' : 'Refresh snapshot'}
            </Button>
            <span className="tooltip__content">
              Reload DB, logs, heartbeat, and asset summary data.
            </span>
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="pill-list">
          <li className="pill">
            <button type="button" className="pill__link" onClick={() => onOpenSection('unsupported')}>
              Unsupported plugins: {data.totals?.unsupportedPlugins ?? 0}
            </button>
          </li>
          <li className="pill">
            <button type="button" className="pill__link" onClick={() => onOpenSection('domains')}>
              Domains tracked: {data.totals?.scanDomains ?? data.totals?.unsupportedPluginDomains ?? 0}
            </button>
          </li>
          <li className="pill">
            <button type="button" className="pill__link" onClick={() => onOpenSection('logs')}>
              Activity logs: {data.totals?.activityLogs ?? 0}
            </button>
          </li>
        </ul>
        <div className="stat-grid">
          {hasActivityLogSize ? (
            <div className="stat-grid__item">
              <dt>Activity log size</dt>
              <dd>{formatBytes(data.files?.activityLog?.sizeBytes)}</dd>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

AdminDbOverviewCard.propTypes = {
  data: PropTypes.object.isRequired,
  isRemoteDb: PropTypes.bool.isRequired,
  hasActivityLogSize: PropTypes.bool.isRequired,
  snapshotQuery: PropTypes.shape({
    refetch: PropTypes.func.isRequired,
    isFetching: PropTypes.bool
  }).isRequired,
  onOpenSection: PropTypes.func.isRequired
};

export default AdminDbOverviewCard;
