import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card.jsx';
import Button from '../../../atoms/Button.jsx';
import ActivityLogsTable from '../ActivityLogsTable.jsx';

function AdminLogsSection({
  activityLogs,
  logTypeFilter,
  setLogTypeFilter,
  logTypes,
  filteredActivityLogs,
  expandedLogIds,
  setExpandedLogIds,
  rotateLogs,
  isRotatingLogs,
  pruneMutation
}) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-logs-main">Activity logs</h2>
            <p className="card__meta">
              Recent activity log rows (up to 75) with payloads.
            </p>
          </div>
          <CardAction>
            <span className="tooltip">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={rotateLogs}
                disabled={isRotatingLogs}
              >
                {isRotatingLogs ? 'Rotating…' : 'Rotate activity log'}
              </Button>
              <span className="tooltip__content">
                Archive `activity.log` and clear persisted activity rows.
              </span>
            </span>
            <span className="tooltip">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => pruneMutation.mutate()}
                disabled={pruneMutation.isPending}
              >
                {pruneMutation.isPending ? 'Pruning…' : 'Prune activity log'}
              </Button>
              <span className="tooltip__content">
                Remove old activity rows by age and keep recent history.
              </span>
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          {activityLogs.length ? (
            <>
              <div className="admin-filters">
                <label className="admin-filter-field">
                  Type
                  <select
                    className="select-input"
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
  );
}

AdminLogsSection.propTypes = {
  activityLogs: PropTypes.array,
  logTypeFilter: PropTypes.string.isRequired,
  setLogTypeFilter: PropTypes.func.isRequired,
  logTypes: PropTypes.array,
  filteredActivityLogs: PropTypes.array,
  expandedLogIds: PropTypes.instanceOf(Set).isRequired,
  setExpandedLogIds: PropTypes.func.isRequired,
  rotateLogs: PropTypes.func.isRequired,
  isRotatingLogs: PropTypes.bool,
  pruneMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool
  }).isRequired
};

AdminLogsSection.defaultProps = {
  activityLogs: [],
  logTypes: [],
  filteredActivityLogs: [],
  isRotatingLogs: false
};

export default AdminLogsSection;
