import { useState } from 'react';
import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select.jsx';
import Button from '../../../atoms/Button.jsx';
import AdminDbHealthCard from './AdminDbHealthCard.jsx';
import AdminDbOverviewCard from './AdminDbOverviewCard.jsx';
import ActivityLogsTable from '../ActivityLogsTable.jsx';
import {
  formatCompactTimestamp,
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
          <AdminDbOverviewCard
            data={data}
            isRemoteDb={isRemoteDb}
            hasActivityLogSize={hasActivityLogSize}
            snapshotQuery={snapshotQuery}
            onOpenSection={setActiveSection}
          />
          <AdminDbHealthCard
            data={data}
            isRemoteDb={isRemoteDb}
            turso={turso}
            tursoStats={tursoStats}
            tursoUsage={tursoUsage}
            tursoInstanceSummary={tursoInstanceSummary}
          />
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
              <CardAction>
                <label className="admin-filter-field admin-filter-field--compact">
                  Type
                  <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                    <SelectTrigger aria-label="Type">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {logTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </CardAction>
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
