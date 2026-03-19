import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import Button from '../../../atoms/Button.jsx';
import { formatBytes, formatWalSummary } from '../utils.js';

function AdminMaintenanceSection({ data, maintenanceMutation }) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-maintenance-main">Database maintenance</h2>
            <p className="card__meta">
              Runs integrity checks and database health maintenance. Includes last rotation/prune/maintenance markers when available.
            </p>
          </div>
          <div className="card__actions">
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
                Run maintenance checks and storage cleanup.
              </span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="stat-grid">
            <div className="stat-grid__item">
              <dt>Last log rotation</dt>
              <dd>{data?.logs?.lastRotatedAt || '—'}</dd>
            </div>
            <div className="stat-grid__item">
              <dt>Last maintenance</dt>
              <dd>{data?.logs?.lastMaintenanceAt || '—'}</dd>
            </div>
            <div className="stat-grid__item">
              <dt>Last prune</dt>
              <dd>{data?.logs?.lastPrunedAt || '—'}</dd>
            </div>
          </div>

          {maintenanceMutation.isError ? (
            <div className="card card--error">
              <div className="card__content">
                <p>{maintenanceMutation.error?.message ?? 'Maintenance failed.'}</p>
              </div>
            </div>
          ) : null}

          {maintenanceMutation.data ? (
            <div className="stat-grid">
              <div className="stat-grid__item">
                <dt>Size</dt>
                <dd>
                  {formatBytes(maintenanceMutation.data.size?.beforeBytes)} →{' '}
                  {formatBytes(maintenanceMutation.data.size?.afterBytes)}
                </dd>
              </div>
              <div className="stat-grid__item">
                <dt>WAL checkpoint</dt>
                <dd>{formatWalSummary(maintenanceMutation.data.walCheckpoint)}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Integrity</dt>
                <dd>
                  {maintenanceMutation.data.integrity?.ok
                    ? maintenanceMutation.data.integrity?.status ?? 'ok'
                    : `Error: ${maintenanceMutation.data.integrity?.error ?? 'unknown'}`}
                </dd>
              </div>
              <div className="stat-grid__item">
                <dt>Vacuum</dt>
                <dd>{maintenanceMutation.data.vacuumRan ? 'Completed' : 'Skipped'}</dd>
              </div>
              <div className="stat-grid__item">
                <dt>Run at</dt>
                <dd>{maintenanceMutation.data.maintenanceAt || '—'}</dd>
              </div>
            </div>
          ) : (
            <p className="card__meta">
              No maintenance run yet. Trigger it to verify integrity and keep DB health in check.
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
