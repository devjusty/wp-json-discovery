import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import Button from '../../../atoms/Button.jsx';
import ActivityLogsTable from '../ActivityLogsTable.jsx';
import { formatBytes, formatFullTimestamp } from '../utils.js';

function AdminDbSection({
  data,
  pruneMutation,
  snapshotQuery,
  sqliteFootprintBytes,
  setActiveSection,
  recentScans,
  expandedScanIds,
  setExpandedScanIds,
  onRescan,
  activityLogs,
  logTypeFilter,
  setLogTypeFilter,
  logTypes,
  filteredActivityLogs,
  expandedLogIds,
  setExpandedLogIds
}) {
  return (
    <>
      <section className="section">
        <div className="grid">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-db-database">Database</h2>
                <p className="card__meta">{data.dbPath}</p>
                {pruneMutation.data ? (
                  <p className="card__meta">
                    Pruned {pruneMutation.data.prunedByAge + pruneMutation.data.prunedByCount} rows · Remaining: {pruneMutation.data.remaining}
                  </p>
                ) : null}
              </div>
              <div className="card__actions">
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
              </div>
            </CardHeader>
            <CardContent>
              <ul className="pill-list">
                <li className="pill">
                  <button type="button" className="pill__link" onClick={() => setActiveSection('unsupported')}>
                    Unsupported plugins: {data.totals?.unsupportedPlugins ?? 0}
                  </button>
                </li>
                <li className="pill">
                  <button type="button" className="pill__link" onClick={() => setActiveSection('domains')}>
                    Domains tracked: {data.totals?.unsupportedPluginDomains ?? 0}
                  </button>
                </li>
                <li className="pill">
                  <button type="button" className="pill__link" onClick={() => setActiveSection('logs')}>
                    Activity logs: {data.totals?.activityLogs ?? 0}
                  </button>
                </li>
              </ul>
              <div className="stat-grid">
                <div className="stat-grid__item">
                  <dt>DB size</dt>
                  <dd>{formatBytes(data.files?.db?.sizeBytes)}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Activity log</dt>
                  <dd>{formatBytes(data.files?.activityLog?.sizeBytes)}</dd>
                </div>
              </div>
            </CardContent>
          </Card>

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
                  <dt>SQLite footprint</dt>
                  <dd>{formatBytes(sqliteFootprintBytes)}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>DB / WAL / SHM</dt>
                  <dd>
                    {formatBytes(data.files?.db?.sizeBytes)} / {formatBytes(data.files?.wal?.sizeBytes)} / {formatBytes(data.files?.shm?.sizeBytes)}
                  </dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Activity log size</dt>
                  <dd>{formatBytes(data.files?.activityLog?.sizeBytes)}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Last heartbeat</dt>
                  <dd>{formatFullTimestamp(data.heartbeat?.latest?.timestamp) || '—'}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Last log rotation</dt>
                  <dd>{formatFullTimestamp(data.logs?.lastRotatedAt) || '—'}</dd>
                </div>
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
        </div>
      </section>

      <section className="section">
        <Card>
          <CardHeader>
            <div>
              <h2 id="admin-db-scans">Recent scans</h2>
              <p className="card__meta">
                Last 10 scan events from the activity log. Full snapshots are stored in log payloads.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {recentScans.length ? (
              <div className="admin-table admin-table--scans">
                <div className="admin-table__header">
                  <span>Domain</span>
                  <span>Timestamp</span>
                  <span>Namespaces</span>
                  <span>Plugins matched</span>
                  <span>Action</span>
                </div>
                {recentScans.map((log) => {
                  const key = `${log.id}:${log.payload?.domain}`;
                  const isExpanded = expandedScanIds.has(key);
                  const snapshot = log.payload?.snapshot ?? log.payload ?? {};

                  const toggleExpanded = () => {
                    setExpandedScanIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) {
                        next.delete(key);
                      } else {
                        next.add(key);
                      }
                      return next;
                    });
                  };

                  return (
                    <div key={key} className="admin-table__row admin-table__row--expandable">
                      <button
                        type="button"
                        className="admin-table__cell admin-table__cell--expand"
                        onClick={toggleExpanded}
                        aria-expanded={isExpanded}
                      >
                        {log.payload?.domain}
                      </button>
                      <span>{log.timestamp}</span>
                      <span>{log.payload?.metrics?.namespacesCount ?? '—'}</span>
                      <span>{log.payload?.metrics?.plugins?.matchedCount ?? '—'}</span>
                      <span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onRescan(log.payload?.domain)}
                          disabled={!log.payload?.domain}
                        >
                          Rescan
                        </Button>
                      </span>
                      {isExpanded ? (
                        <div className="admin-table__details">
                          <p>
                            <strong>Snapshot size:</strong>{' '}
                            {log.payload?.snapshotBytes ?? JSON.stringify(snapshot).length} bytes
                          </p>
                          <code className="code-block">
                            {JSON.stringify(snapshot, null, 2)}
                          </code>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="card__meta">No recent scans found.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="section">
        <Card>
          <CardHeader>
            <div>
              <h2 id="admin-db-activity">Recent activity logs</h2>
              <p className="card__meta">Most recent entries (up to 75).</p>
            </div>
          </CardHeader>
          <CardContent>
            {activityLogs.length ? (
              <>
                <div className="admin-filters">
                  <label className="admin-filter-field">
                    Type
                    <select
                      value={logTypeFilter}
                      onChange={(event) => setLogTypeFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      {logTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <ActivityLogsTable
                  logs={filteredActivityLogs}
                  expandedLogIds={expandedLogIds}
                  onToggle={(logId) => {
                    setExpandedLogIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(logId)) {
                        next.delete(logId);
                      } else {
                        next.add(logId);
                      }
                      return next;
                    });
                  }}
                />
              </>
            ) : (
              <p className="card__meta">No log entries found.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

AdminDbSection.propTypes = {
  data: PropTypes.object.isRequired,
  pruneMutation: PropTypes.object.isRequired,
  snapshotQuery: PropTypes.object.isRequired,
  sqliteFootprintBytes: PropTypes.number,
  setActiveSection: PropTypes.func.isRequired,
  recentScans: PropTypes.array,
  expandedScanIds: PropTypes.instanceOf(Set).isRequired,
  setExpandedScanIds: PropTypes.func.isRequired,
  onRescan: PropTypes.func.isRequired,
  activityLogs: PropTypes.array,
  logTypeFilter: PropTypes.string.isRequired,
  setLogTypeFilter: PropTypes.func.isRequired,
  logTypes: PropTypes.array,
  filteredActivityLogs: PropTypes.array,
  expandedLogIds: PropTypes.instanceOf(Set).isRequired,
  setExpandedLogIds: PropTypes.func.isRequired
};

AdminDbSection.defaultProps = {
  sqliteFootprintBytes: null,
  recentScans: [],
  activityLogs: [],
  logTypes: [],
  filteredActivityLogs: []
};

export default AdminDbSection;
