import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card.jsx';
import Button from '../../../atoms/Button.jsx';
import { formatBytes, formatFullTimestamp, formatWalSummary } from '../utils.js';

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
              <div className="stat-grid__item">
                <dt>Last log rotation</dt>
                <dd>{formatFullTimestamp(data?.logs?.lastRotatedAt) || '—'}</dd>
              </div>
            ) : null}
            <div className="stat-grid__item">
              <dt>Last maintenance</dt>
              <dd>{formatFullTimestamp(data?.logs?.lastMaintenanceAt) || '—'}</dd>
            </div>
            <div className="stat-grid__item">
              <dt>Last prune</dt>
              <dd>{formatFullTimestamp(data?.logs?.lastPrunedAt) || '—'}</dd>
            </div>
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
              {!isRemoteDb ? (
                <>
                  <div className="stat-grid__item">
                    <dt>Size</dt>
                    <dd>
                      {formatBytes(maintenanceData.size?.beforeBytes)} →{' '}
                      {formatBytes(maintenanceData.size?.afterBytes)}
                    </dd>
                  </div>
                  <div className="stat-grid__item">
                    <dt>WAL checkpoint</dt>
                    <dd>{formatWalSummary(maintenanceData.walCheckpoint)}</dd>
                  </div>
                  <div className="stat-grid__item">
                    <dt>Vacuum</dt>
                    <dd>{maintenanceData.vacuumRan ? 'Completed' : 'Skipped'}</dd>
                  </div>
                </>
              ) : (
                <div className="stat-grid__item">
                  <dt>Mode</dt>
                  <dd>{maintenanceData.mode || 'turso'}</dd>
                </div>
              )}
              <div className="stat-grid__item">
                <dt>Integrity</dt>
                <dd>
                  {maintenanceData.integrity?.ok
                    ? maintenanceData.integrity?.status ?? 'ok'
                    : `Error: ${maintenanceData.integrity?.error ?? 'unknown'}`}
                </dd>
              </div>
              <div className="stat-grid__item">
                <dt>Run at</dt>
                <dd>{formatFullTimestamp(maintenanceData.maintenanceAt) || '—'}</dd>
              </div>
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
