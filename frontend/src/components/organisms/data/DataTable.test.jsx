import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DataTable from './DataTable.jsx';

vi.mock('../../../utils/csv.js', () => ({
  exportToCsv: vi.fn()
}));

describe('DataTable', () => {
  it('uses the shadcn card action slot for header actions', () => {
    render(
      <DataTable
        domain="example.com"
        datasetKey="pages"
        title="Pages"
        description="Published pages"
        columns={[
          {
            accessorKey: 'title',
            header: 'Title',
            cell: ({ getValue }) => getValue()
          }
        ]}
        rows={[{ title: 'About' }]}
        status="success"
        error={null}
        isCollapsed={false}
        isExpanded={false}
        onToggleCollapse={vi.fn()}
        onToggleExpand={vi.fn()}
      />
    );

    const card = screen.getByRole('heading', { name: 'Pages' }).closest('[data-slot="card"]');

    expect(card?.querySelector('[data-slot="card-action"]')).toBeInTheDocument();
  });

  it('renders the rows-per-page control with the shadcn select trigger slot', () => {
    render(
      <DataTable
        domain="example.com"
        datasetKey="pages"
        title="Pages"
        description="Published pages"
        columns={[
          {
            accessorKey: 'title',
            header: 'Title',
            cell: ({ getValue }) => getValue()
          }
        ]}
        rows={[{ title: 'About' }]}
        status="success"
        error={null}
        isCollapsed={false}
        isExpanded={false}
        onToggleCollapse={vi.fn()}
        onToggleExpand={vi.fn()}
      />
    );

    expect(screen.getByText('Rows per page').closest('label')?.querySelector('[data-slot="select-trigger"]')).toBeInTheDocument();
  });
});
