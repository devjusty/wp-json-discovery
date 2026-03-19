import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import { getPayloadSize, serializePayload, truncateText } from './utils.js';

function ActivityLogsTable({ logs, expandedLogIds, onToggle }) {
  return (
    <div className="admin-table admin-table--activity-logs">
      <div className="admin-table__header">
        <span>ID</span>
        <span>Timestamp</span>
        <span>Type</span>
        <span>Bytes</span>
        <span>Payload</span>
      </div>
      {logs.map((log) => {
        const payloadText = serializePayload(log.payload);
        const payloadBytes = getPayloadSize(payloadText);
        const isExpanded = expandedLogIds.has(log.id);
        return (
          <div key={log.id} className="admin-table__row admin-table__row--expandable">
            <span>{log.id}</span>
            <span>{log.timestamp}</span>
            <span>{log.type}</span>
            <span>{payloadBytes}</span>
            <span className="admin-log-preview">
              <code className="admin-table__code admin-table__code--inline">
                {isExpanded ? payloadText : truncateText(payloadText, 220)}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggle(log.id)}
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </span>
            {isExpanded ? (
              <div className="admin-table__details">
                <code className="code-block">{payloadText}</code>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

ActivityLogsTable.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    timestamp: PropTypes.string,
    type: PropTypes.string,
    payload: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.array])
  })),
  expandedLogIds: PropTypes.instanceOf(Set),
  onToggle: PropTypes.func.isRequired
};

ActivityLogsTable.defaultProps = {
  logs: [],
  expandedLogIds: new Set()
};

export default ActivityLogsTable;
