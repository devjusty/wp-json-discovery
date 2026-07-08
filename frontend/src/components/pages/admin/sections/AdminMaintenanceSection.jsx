import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card.jsx';
import Button from '../../../atoms/Button.jsx';
import { formatBytes, formatFullTimestamp, formatWalSummary } from '../utils.js';

function StatItem({ label, children }) {
  return (
    <div className="stat-grid__item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

StatItem.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node
};

StatItem.defaultProps = {
  children: null
};

function renderIntegrityStatus(integrity) {
  if (integrity?.ok) {
    return integrity?.status ?? 'ok';
  }

  return `Error: ${integrity?.error ?? 'unknown'}`;
}

function MaintenanceResultStats({ isRemoteDb, maintenanceData }) {
  if (isRemoteDb) {
    return <StatItem label="Mode">{maintenanceData.mode || 'turso'}</StatItem>;
  }

  return (
    <>
      <StatItem label="Size">
        {formatBytes(maintenanceData.size?.beforeBytes)} → {formatBytes(maintenanceData.size?.afterBytes)}
      </StatItem>
      <StatItem label="WAL checkpoint">{formatWalSummary(maintenanceData.walCheckpoint)}</StatItem>
      <StatItem label="Vacuum">{maintenanceData.vacuumRan ? 'Completed' : 'Skipped'}</StatItem>
    </>
  );
}

MaintenanceResultStats.propTypes = {
  isRemoteDb: PropTypes.bool.isRequired,
  maintenanceData: PropTypes.object
};

MaintenanceResultStats.defaultProps = {
  maintenanceData: null
};

function AdminMaintenanceSection({ data, maintenanceMutation }) {
  const isRemoteDb = /^(libsql|https?|wss?):\/\//i.test(data?.dbPath ?? '');
  const maintenanceData = maintenanceMutation.data;
  const hasRotationMarker = Boolean(data?.logs?.lastRotatedAt);

  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-maintenance-main">Database maintenance</h2>
            <p className="card__meta">
              Runs integrity checks and records maintenance markers for the active storage mode.
            </p>
          </div>
          <CardAction>
            <span className="tooltip">
              <Button
                type="button"
                size="sm"
                onClick={() => maintenanceMutation.mutate()}
                disabled={maintenanceMutation.isPending}
              >
                {maintenanceMutation.isPending ? 'Maintaining…' : 'Run maintenance'}
              </Button>
              <span className="tooltip__content">
                Run maintenance checks and write the latest maintenance marker.
              </span>
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="stat-grid">
            {hasRotationMarker ? (
              <StatItem label="Last log rotation">{formatFullTimestamp(data?.logs?.lastRotatedAt) || '—'}</StatItem>
            ) : null}
            <StatItem label="Last maintenance">{formatFullTimestamp(data?.logs?.lastMaintenanceAt) || '—'}</StatItem>
            <StatItem label="Last prune">{formatFullTimestamp(data?.logs?.lastPrunedAt) || '—'}</StatItem>
          </div>

          {maintenanceMutation.isError ? (
            <Card className="card--error">
              <CardContent>
                <p>{maintenanceMutation.error?.message ?? 'Maintenance failed.'}</p>
              </CardContent>
            </Card>
          ) : null}

          {maintenanceData ? (
            <div className="stat-grid">
              <MaintenanceResultStats isRemoteDb={isRemoteDb} maintenanceData={maintenanceData} />
              <StatItem label="Integrity">{renderIntegrityStatus(maintenanceData.integrity)}</StatItem>
              <StatItem label="Run at">{formatFullTimestamp(maintenanceData.maintenanceAt) || '—'}</StatItem>
            </div>
          ) : (
            <p className="card__meta">
              No maintenance run yet. Trigger it to verify integrity and update maintenance markers.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminMaintenanceSection.propTypes = {
  data: PropTypes.object,
  maintenanceMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool,
    isError: PropTypes.bool,
    error: PropTypes.object,
    data: PropTypes.object
  }).isRequired
};

AdminMaintenanceSection.defaultProps = {
  data: null
};

export default AdminMaintenanceSection;
