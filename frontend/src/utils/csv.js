import Papa from 'papaparse';

export function exportToCsv({ filename, rows, columns }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const flatRows = rows.map((row) => buildRow(row, columns));
  const csv = Papa.unparse(flatRows);

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const href = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}

function buildRow(row, columns) {
  return columns.reduce((acc, column) => {
    const headerText = getHeaderLabel(column);

    if (!headerText) {
      return acc;
    }

    if (typeof column.accessorFn === 'function') {
      acc[headerText] = safeAccessor(() => column.accessorFn(row));
      return acc;
    }

    if (column.accessorKey) {
      acc[headerText] = safeAccessor(() => row[column.accessorKey]);
      return acc;
    }

    if (column.id) {
      acc[headerText] = safeAccessor(() => row[column.id]);
      return acc;
    }

    return acc;
  }, {});
}

function safeAccessor(fn) {
  try {
    const value = fn();
    if (value == null) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  } catch (error) {
    console.error('Failed to read column value', error);
    return '';
  }
}

function getHeaderLabel(column) {
  if (typeof column.header === 'string') {
    return column.header;
  }

  if (typeof column.id === 'string') {
    return column.id;
  }

  return null;
}
