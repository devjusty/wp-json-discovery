import { memo } from 'react';
import PropTypes from 'prop-types';
import DataTable from './DataTable.jsx';

const columns = [
  {
    id: 'path',
    header: 'Route',
    accessorKey: 'path',
    meta: {
      cellClassName: 'whitespace-normal break-all align-top'
    }
  },
  {
    id: 'methods',
    header: 'Methods',
    accessorFn: (row) => (row.methods ?? []).join(', '),
    cell: (info) => info.getValue()
  },
  {
    id: 'namespace',
    header: 'Namespace',
    accessorKey: 'namespace'
  },
  {
    id: 'accepts',
    header: 'Arguments',
    accessorFn: (row) => (row.accepts ?? []).join(', ') || '—',
    cell: (info) => info.getValue(),
    meta: {
      cellClassName: 'whitespace-normal break-words'
    }
  },
  {
    id: 'hasSchema',
    header: 'Schema',
    accessorFn: (row) => (row.hasSchema ? 'Yes' : 'No'),
    cell: (info) => info.getValue()
  }
];

function PluginRoutesTable({
  domain,
  pluginMatch,
  isCollapsed,
  isExpanded,
  onToggleCollapse,
  onToggleExpand
}) {
  return (
    <DataTable
      domain={domain}
      datasetKey={`plugin-${pluginMatch.plugin.id}`}
      title={`${pluginMatch.plugin.label} routes`}
      description={`${pluginMatch.plugin.description} · Namespaces: ${pluginMatch.namespaces.join(', ')}`}
      columns={columns}
      rows={pluginMatch.routes}
      status="success"
      error={null}
      isCollapsed={isCollapsed}
      isExpanded={isExpanded}
      onToggleCollapse={onToggleCollapse}
      onToggleExpand={onToggleExpand}
    />
  );
}

PluginRoutesTable.propTypes = {
  domain: PropTypes.string.isRequired,
  pluginMatch: PropTypes.shape({
    plugin: PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      namespaces: PropTypes.arrayOf(PropTypes.string).isRequired
    }).isRequired,
    namespaces: PropTypes.arrayOf(PropTypes.string).isRequired,
    routes: PropTypes.arrayOf(PropTypes.object).isRequired
  }).isRequired,
  isCollapsed: PropTypes.bool,
  isExpanded: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  onToggleExpand: PropTypes.func
};

export default memo(PluginRoutesTable);
