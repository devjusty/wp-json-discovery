import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { formatBytes, formatFullTimestamp } from '../utils.js';

function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatRate(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatRegionList(value = []) {
  if (!Array.isArray(value) || value.length === 0) return '—';
  return value.join(', ');
}

function AdminDbHealthCard({ data, isRemoteDb, turso, tursoStats, tursoUsage, tursoInstanceSummary }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h2 id="admin-db-health">Data health</h2>
          <p className="card__meta">Storage footprint and recency markers.</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="stat-grid">
          <div className="stat-grid__item">
            <dt>{isRemoteDb ? 'Turso endpoint' : 'Database file'}</dt>
            <dd>{data.dbPath || '—'}</dd>
          </div>
          {isRemoteDb ? (
            <>
              <div className="stat-grid__item">
                <dt>Turso health</dt>
                <dd>
                  {turso?.health?.ok
                    ? 'Healthy'
                    : turso?.health?.error
                      ? `Unavailable (${turso.health.error})`
                      : 'Unavailable'}
                </dd>
              </div>
              <div className="stat-grid__item">
                <dt>Active connections</dt>
                <dd>{formatNumber(tursoStats?.active_connections)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Queries / second</dt>
                <dd>{formatRate(tursoStats?.queries_per_second)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Rows read / second</dt>
                <dd>{formatRate(tursoStats?.rows_read_per_second)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Rows written / second</dt>
                <dd>{formatRate(tursoStats?.rows_written_per_second)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Turso storage</dt>
                <dd>{formatBytes(tursoStats?.storage_bytes)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Org requests ({tursoUsage?.period || 'period'})</dt>
                <dd>{formatNumber(tursoUsage?.total_requests)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Org DB bytes</dt>
                <dd>{formatBytes(tursoUsage?.database_bytes)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Org DB rows</dt>
                <dd>{formatNumber(tursoUsage?.database_rows)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Instances</dt>
                <dd>{formatNumber(tursoInstanceSummary?.total)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Primary region</dt>
                <dd>{tursoInstanceSummary?.primaryRegion || '—'}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Replica regions</dt>
                <dd>{formatRegionList(tursoInstanceSummary?.replicaRegions)}</dd>
              </div>
            </>
          ) : null}
          <div className="stat-grid__item">
            <dt>Last heartbeat</dt>
            <dd>{formatFullTimestamp(data.heartbeat?.latest?.timestamp) || '—'}</dd>
          </div>
          {data.logs?.lastRotatedAt ? (
            <div className="stat-grid__item">
              <dt>Last log rotation</dt>
              <dd>{formatFullTimestamp(data.logs?.lastRotatedAt) || '—'}</dd>
            </div>
          ) : null}
          <div className="stat-grid__item">
            <dt>Last prune</dt>
            <dd>{formatFullTimestamp(data.logs?.lastPrunedAt) || '—'}</dd>
          </div>
          <div className="stat-grid__item">
            <dt>Last maintenance</dt>
            <dd>{formatFullTimestamp(data.logs?.lastMaintenanceAt) || '—'}</dd>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

AdminDbHealthCard.propTypes = {
  data: PropTypes.object.isRequired,
  isRemoteDb: PropTypes.bool.isRequired,
  turso: PropTypes.object,
  tursoStats: PropTypes.object,
  tursoUsage: PropTypes.object,
  tursoInstanceSummary: PropTypes.object
};

AdminDbHealthCard.defaultProps = {
  turso: null,
  tursoStats: null,
  tursoUsage: null,
  tursoInstanceSummary: null
};

export default AdminDbHealthCard;
