import { useState } from 'react';
import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import Button from '../../../atoms/Button.jsx';
import ActivityLogsTable from '../ActivityLogsTable.jsx';
import {
  formatBytes,
  formatCompactTimestamp,
  formatFullTimestamp
} from '../utils.js';

function AdminDbSection({
  data,
  snapshotQuery,
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
  const [copiedSnapshotKey, setCopiedSnapshotKey] = useState('');
  const isRemoteDb = /^(libsql|https?|wss?):\/\//i.test(data.dbPath ?? '');
  const hasActivityLogSize = Number.isFinite(data.files?.activityLog?.sizeBytes);
  const turso = data.turso;
  const tursoStats = turso?.stats?.data;
  const tursoUsage = turso?.orgUsage?.data;
  const tursoInstanceSummary = turso?.instances?.summary;

  const handleCopySnapshot = async (key, snapshot) => {
    if (!navigator?.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopiedSnapshotKey(key);
      window.setTimeout(() => {
        setCopiedSnapshotKey((current) => (current === key ? '' : current));
      }, 1500);
    } catch {
      setCopiedSnapshotKey('');
    }
  };

  return (
    <>
      <section className="section">
        <div className="grid">
          <Card>
            <CardHeader>
              <div>
                <h2 id="admin-db-database">Database</h2>
                <p className="card__meta">{data.dbPath}</p>
                <p className="card__meta">
                  {isRemoteDb ? 'Turso database endpoint' : 'Local database path'}
                </p>
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
                    Domains tracked: {data.totals?.scanDomains ?? data.totals?.unsupportedPluginDomains ?? 0}
                  </button>
                </li>
                <li className="pill">
                  <button type="button" className="pill__link" onClick={() => setActiveSection('logs')}>
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
        </div>
      </section>

      <section className="section">
        <Card>
          <CardHeader>
            <div>
              <h2 id="admin-db-scans">Recent scans</h2>
              <p className="card__meta">
                Last 10 scan events from the activity log. Compact scan snapshots are retained for quick inspection.
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
                      <span>{formatCompactTimestamp(log.timestamp) || '—'}</span>
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
                          <div className="button-group">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopySnapshot(key, snapshot)}
                            >
                              {copiedSnapshotKey === key ? 'Copied' : 'Copy JSON'}
                            </Button>
                          </div>
                          <code className="code-block admin-table__details-code">
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
          <CardHeader className="card__header--row">
            <div>
              <h2 id="admin-db-activity">Recent activity logs</h2>
              <p className="card__meta">Most recent entries (up to 75).</p>
            </div>
            {activityLogs.length ? (
              <div className="card__actions">
                <label className="admin-filter-field admin-filter-field--compact">
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
            ) : null}
          </CardHeader>
          <CardContent>
            {activityLogs.length ? (
              <>
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

AdminDbSection.propTypes = {
  data: PropTypes.object.isRequired,
  snapshotQuery: PropTypes.object.isRequired,
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
  recentScans: [],
  activityLogs: [],
  logTypes: [],
  filteredActivityLogs: []
};

export default AdminDbSection;
