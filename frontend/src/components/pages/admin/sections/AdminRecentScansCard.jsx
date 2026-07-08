import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import Button from '../../../atoms/Button.jsx';
import { formatCompactTimestamp } from '../utils.js';

function AdminRecentScansCard({
  recentScans,
  expandedScanIds,
  setExpandedScanIds,
  onRescan,
  copiedSnapshotKey,
  onCopySnapshot
}) {
  return (
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
          {recentScans?.length ? (
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
                          <strong>Snapshot size:</strong> {' '}
                          {log.payload?.snapshotBytes ?? JSON.stringify(snapshot).length} bytes
                        </p>
                        <div className="button-group">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onCopySnapshot(key, snapshot)}
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
  );
}

AdminRecentScansCard.propTypes = {
  recentScans: PropTypes.array,
  expandedScanIds: PropTypes.instanceOf(Set).isRequired,
  setExpandedScanIds: PropTypes.func.isRequired,
  onRescan: PropTypes.func.isRequired,
  copiedSnapshotKey: PropTypes.string.isRequired,
  onCopySnapshot: PropTypes.func.isRequired
};

AdminRecentScansCard.defaultProps = {
  recentScans: []
};

export default AdminRecentScansCard;