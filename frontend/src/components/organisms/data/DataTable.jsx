import { useEffect, useId, useMemo, useState } from 'react';
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
import TextInput from '../../atoms/TextInput.jsx';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
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
  const [pageInputValue, setPageInputValue] = useState('1');
  const pageSizeSelectId = useId();

  const data = useMemo(() => rows ?? [], [rows]);

  // eslint-disable-next-line react-hooks/incompatible-library
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

  const totalRows = data.length;
  const pageCount = table.getPageCount();
  const safePageCount = Math.max(pageCount, 1);
  const { pageIndex, pageSize } = table.getState().pagination;
  const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = totalRows === 0 ? 0 : Math.min(totalRows, (pageIndex + 1) * pageSize);

  useEffect(() => {
    setPageInputValue(String(pageIndex + 1));
  }, [pageIndex]);

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
        <CardAction className="card__actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
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
        </CardAction>
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
          <Table aria-label={title}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const sortState = header.column.getIsSorted();
                        const columnMeta = header.column.columnDef.meta ?? {};
                        return (
                            <TableHead
                              key={header.id}
                              colSpan={header.colSpan}
                              className={clsx({
                                sortable: header.column.getCanSort(),
                                [columnMeta.headerClassName]: Boolean(columnMeta.headerClassName)
                              })}
                              aria-sort={
                              sortState === 'asc'
                                ? 'ascending'
                                : sortState === 'desc'
                                  ? 'descending'
                                  : 'none'
                            }
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
                                <span
                                  className="table__sort-indicator"
                                  aria-hidden="true"
                                >
                                  {sortState === 'asc'
                                    ? '▲'
                                    : sortState === 'desc'
                                      ? '▼'
                                      : '↕'}
                                </span>
                              </button>
                              )}
                            </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cell.column.columnDef.meta?.cellClassName}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
              {data.length === 0 ? (
                <div className="table__empty">No records found.</div>
              ) : null}
            </div>
            {data.length > 0 ? (
              <div className="table__footer">
                <div className="table__pagination">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="table__pagination-button"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    aria-label="Go to first page"
                  >
                    ⏮
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="table__pagination-button"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    aria-label="Go to previous page"
                  >
                    ◀
                  </Button>
                  <div className="table__page-jump">
                    <label htmlFor={`${datasetKey}-page-input`}>
                      Page
                    </label>
                    <TextInput
                      size="sm"
                      id={`${datasetKey}-page-input`}
                      type="number"
                      min={1}
                      max={safePageCount}
                      value={pageInputValue}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === '' || /^[0-9]+$/.test(nextValue)) {
                          setPageInputValue(nextValue);
                        }
                      }}
                      onBlur={() => {
                        if (pageInputValue === '') {
                          setPageInputValue(String(pageIndex + 1));
                          return;
                        }
                        const nextPage = Number(pageInputValue);
                        if (Number.isNaN(nextPage)) {
                          setPageInputValue(String(pageIndex + 1));
                          return;
                        }
                        const clamped = Math.min(Math.max(nextPage, 1), safePageCount);
                        table.setPageIndex(clamped - 1);
                        setPageInputValue(String(clamped));
                      }}
                    />
                    <span className="table__page-count">of {safePageCount}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="table__pagination-button"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    aria-label="Go to next page"
                  >
                    ▶
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="table__pagination-button"
                    onClick={() => table.setPageIndex(Math.max(pageCount - 1, 0))}
                    disabled={!table.getCanNextPage()}
                    aria-label="Go to last page"
                  >
                    ⏭
                  </Button>
                </div>
                <div>
                <div>
                  <label htmlFor={pageSizeSelectId}>
                    Rows per page
                    <select
                      className="select-input"
                      id={pageSizeSelectId}
                      value={pageSize}
                      onChange={(event) => {
                        table.setPageSize(Number(event.target.value));
                        table.setPageIndex(0);
                      }}
                    >
                      {[10, 20, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                </div>
                <div className="table__meta">
                  {totalRows === 0
                    ? 'No rows to display'
                    : `Showing ${startRow}–${endRow} of ${totalRows} rows`}
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
