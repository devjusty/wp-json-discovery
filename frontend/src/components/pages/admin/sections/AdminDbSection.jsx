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
import AdminRecentScansCard from './AdminRecentScansCard.jsx';
import ActivityLogsTable from '../ActivityLogsTable.jsx';


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

      <AdminRecentScansCard
        recentScans={recentScans}
        expandedScanIds={expandedScanIds}
        setExpandedScanIds={setExpandedScanIds}
        onRescan={onRescan}
        copiedSnapshotKey={copiedSnapshotKey}
        onCopySnapshot={handleCopySnapshot}
      />

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
