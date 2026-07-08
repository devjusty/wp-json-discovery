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

function getTursoHealthLabel(turso) {
  if (turso?.health?.ok) return 'Healthy';
  if (turso?.health?.error) return `Unavailable (${turso.health.error})`;
  return 'Unavailable';
}

function buildRemoteStats(turso, tursoStats, tursoUsage, tursoInstanceSummary) {
  return [
    { label: 'Turso health', value: getTursoHealthLabel(turso) },
    { label: 'Active connections', value: formatNumber(tursoStats?.active_connections) },
    { label: 'Queries / second', value: formatRate(tursoStats?.queries_per_second) },
    { label: 'Rows read / second', value: formatRate(tursoStats?.rows_read_per_second) },
    { label: 'Rows written / second', value: formatRate(tursoStats?.rows_written_per_second) },
    { label: 'Turso storage', value: formatBytes(tursoStats?.storage_bytes) },
    {
      label: `Org requests (${tursoUsage?.period || 'period'})`,
      value: formatNumber(tursoUsage?.total_requests)
    },
    { label: 'Org DB bytes', value: formatBytes(tursoUsage?.database_bytes) },
    { label: 'Org DB rows', value: formatNumber(tursoUsage?.database_rows) },
    { label: 'Instances', value: formatNumber(tursoInstanceSummary?.total) },
    { label: 'Primary region', value: tursoInstanceSummary?.primaryRegion || '—' },
    {
      label: 'Replica regions',
      value: formatRegionList(tursoInstanceSummary?.replicaRegions)
    }
  ];
}

function buildHealthStats(data, isRemoteDb, turso, tursoStats, tursoUsage, tursoInstanceSummary) {
  return [
    {
      label: isRemoteDb ? 'Turso endpoint' : 'Database file',
      value: data.dbPath || '—'
    },
    ...(isRemoteDb ? buildRemoteStats(turso, tursoStats, tursoUsage, tursoInstanceSummary) : []),
    {
      label: 'Last heartbeat',
      value: formatFullTimestamp(data.heartbeat?.latest?.timestamp) || '—'
    },
    ...(data.logs?.lastRotatedAt
      ? [
          {
            label: 'Last log rotation',
            value: formatFullTimestamp(data.logs.lastRotatedAt) || '—'
          }
        ]
      : []),
    {
      label: 'Last prune',
      value: formatFullTimestamp(data.logs?.lastPrunedAt) || '—'
    },
    {
      label: 'Last maintenance',
      value: formatFullTimestamp(data.logs?.lastMaintenanceAt) || '—'
    }
  ];
}

function StatGridItem({ label, value }) {
  return (
    <div className="stat-grid__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AdminDbHealthCard({ data, isRemoteDb, turso, tursoStats, tursoUsage, tursoInstanceSummary }) {
  const stats = buildHealthStats(
    data,
    isRemoteDb,
    turso,
    tursoStats,
    tursoUsage,
    tursoInstanceSummary
  );

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
          {stats.map((stat) => (
            <StatGridItem key={stat.label} label={stat.label} value={stat.value} />
          ))}
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

StatGridItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired
};

export default AdminDbHealthCard;
