import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import Button from '../../atoms/Button.jsx';
import {
  Card,
  CardActions,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';
import { exportToCsv } from '../../../utils/csv.js';
import { toCsvFilename } from '../../../utils/format.js';

function DataTable({
  domain,
  datasetKey,
  title,
  description,
  columns,
  rows,
  status,
  error,
  isCollapsed = false,
  isExpanded = false,
  onToggleCollapse,
  onToggleExpand
}) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10
  });

  const data = useMemo(() => rows ?? [], [rows]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  const handleExport = () => {
    exportToCsv({
      filename: toCsvFilename(domain, datasetKey),
      rows: data,
      columns
    });
  };

  return (
    <Card
      className={clsx({
        'card--collapsed': isCollapsed,
        'card--expanded': isExpanded
      })}
    >
      <CardHeader className={clsx({ 'card__header--compact': isCollapsed })}>
        <div>
          <h2>{title}</h2>
          {description ? <p className="card__meta">{description}</p> : null}
        </div>
        <CardActions>
          <Button
            type="button"
            variant="secondary"
            onClick={handleExport}
            disabled={!data || data.length === 0}
          >
            Export CSV
          </Button>
          {typeof onToggleExpand === 'function' ? (
            <Button
              type="button"
              variant={isExpanded ? 'ghost' : 'secondary'}
              size="sm"
              onClick={onToggleExpand}
            >
              {isExpanded ? 'Shrink width' : 'Expand width'}
            </Button>
          ) : null}
          {typeof onToggleCollapse === 'function' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
            >
              {isCollapsed ? 'Expand table' : 'Collapse'}
            </Button>
          ) : null}
        </CardActions>
      </CardHeader>
      <CardContent
        className={clsx({
          'card__content--collapsed': isCollapsed,
          'card__content--expanded': isExpanded
        })}
      >
        {isCollapsed ? (
          <p className="card__meta">Table collapsed. Expand to view rows.</p>
        ) : status === 'error' ? (
          <div className="card__error">
            <p>Failed to load this dataset.</p>
            <p className="card__meta">
              Status {error?.statusCode ?? ''}:{' '}
              {typeof error?.message === 'string' ? error.message : error}
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          className={clsx({
                            sortable: header.column.getCanSort()
                          })}
                        >
                          {header.isPlaceholder ? null : (
                            <button
                              type="button"
                              className="table__sort"
                              onClick={header.column.getToggleSortingHandler()}
                              disabled={!header.column.getCanSort()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {{
                                asc: ' ▲',
                                desc: ' ▼'
                              }[header.column.getIsSorted()] ?? ''}
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length === 0 ? (
                <div className="table__empty">No records found.</div>
              ) : null}
            </div>
            {data.length > 0 ? (
              <div className="table__footer">
                <div className="table__pagination">
                  <button
                    type="button"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    ⏮
                  </button>
                  <button
                    type="button"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    ◀
                  </button>
                  <span>
                    Page{' '}
                    <strong>
                      {table.getState().pagination.pageIndex + 1} of{' '}
                      {table.getPageCount()}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    ⏭
                  </button>
                </div>
                <div>
                  <label>
                    Rows per page:{' '}
                    <select
                      value={table.getState().pagination.pageSize}
                      onChange={(event) =>
                        table.setPageSize(Number(event.target.value))
                      }
                    >
                      {[10, 20, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="table__meta">
                  Showing {table.getRowModel().rows.length} of {data.length}{' '}
                  total rows
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

DataTable.propTypes = {
  domain: PropTypes.string.isRequired,
  datasetKey: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  columns: PropTypes.arrayOf(PropTypes.object).isRequired,
  rows: PropTypes.arrayOf(PropTypes.object),
  status: PropTypes.oneOf(['success', 'error']).isRequired,
  error: PropTypes.shape({
    statusCode: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    message: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
  }),
  isCollapsed: PropTypes.bool,
  isExpanded: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  onToggleExpand: PropTypes.func
};

export default DataTable;
