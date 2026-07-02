import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminDbSection from './AdminDbSection.jsx';

vi.mock('../ActivityLogsTable.jsx', () => ({
  default: () => <div data-testid="activity-logs-table" />
}));

const baseProps = {
  data: {
    dbPath: '/tmp/data.sqlite',
    totals: {},
    files: {},
    logs: {},
    heartbeat: {},
    turso: null
  },
  snapshotQuery: {
    refetch: vi.fn(),
    isFetching: false
  },
  setActiveSection: vi.fn(),
  recentScans: [],
  expandedScanIds: new Set(),
  setExpandedScanIds: vi.fn(),
  onRescan: vi.fn(),
  activityLogs: [
    {
      id: 'log-1',
      timestamp: '2026-07-02T12:00:00.000Z',
      payload: { domain: 'example.com', snapshot: { domain: 'example.com' }, metrics: {} }
    }
  ],
  logTypeFilter: 'all',
  setLogTypeFilter: vi.fn(),
  logTypes: ['scan'],
  filteredActivityLogs: [],
  expandedLogIds: new Set(),
  setExpandedLogIds: vi.fn()
};

describe('AdminDbSection', () => {
  it('renders the database header actions inside a shadcn card action slot', () => {
    render(<AdminDbSection {...baseProps} />);

    expect(screen.getByRole('button', { name: /refresh snapshot/i }).closest('[data-slot="card-action"]')).toBeInTheDocument();
  });

  it('renders the activity log header controls inside a shadcn card action slot', () => {
    render(<AdminDbSection {...baseProps} />);

    expect(screen.getByRole('combobox', { name: 'Type' }).closest('[data-slot="select-trigger"]')).toBeInTheDocument();
  });
});
