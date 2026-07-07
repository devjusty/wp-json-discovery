import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDbSection from './AdminDbSection.jsx';

const activityLogsTableMock = vi.fn(({ logs }) => (
  <div data-testid="activity-logs-table">Rendered {logs.length} logs</div>
));

vi.mock('../ActivityLogsTable.jsx', () => ({
  default: (props) => activityLogsTableMock(props)
}));

function buildProps(overrides = {}) {
  return {
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
        type: 'scan',
        timestamp: '2026-07-02T12:00:00.000Z',
        payload: { domain: 'example.com', snapshot: { domain: 'example.com' }, metrics: {} }
      }
    ],
    logTypeFilter: 'all',
    setLogTypeFilter: vi.fn(),
    logTypes: ['scan'],
    filteredActivityLogs: [],
    expandedLogIds: new Set(),
    setExpandedLogIds: vi.fn(),
    ...overrides
  };
}

function getStatValue(label) {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling;
}

describe('AdminDbSection', () => {
  let clipboardWriteText;
  let setTimeoutMock;
  let originalClipboard;

  beforeEach(() => {
    activityLogsTableMock.mockClear();
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    setTimeoutMock = vi.fn(() => 1);
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText
      }
    });
    vi.spyOn(window, 'setTimeout').mockImplementation(setTimeoutMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard
    });
  });

  it('renders overview summary actions and stable anchor ids', async () => {
    const setActiveSection = vi.fn();

    render(
      <AdminDbSection
        {...buildProps({
          setActiveSection,
          data: {
            dbPath: '/tmp/data.sqlite',
            totals: {
              unsupportedPlugins: 3,
              scanDomains: 7,
              activityLogs: 11
            },
            files: {
              activityLog: {
                sizeBytes: 4096
              }
            },
            logs: {},
            heartbeat: {},
            turso: null
          }
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Database' })).toHaveAttribute('id', 'admin-db-database');
    expect(screen.getByRole('heading', { name: 'Data health' })).toHaveAttribute('id', 'admin-db-health');
    expect(screen.getByRole('heading', { name: 'Recent scans' })).toHaveAttribute('id', 'admin-db-scans');
    expect(screen.getByRole('heading', { name: 'Recent activity logs' })).toHaveAttribute('id', 'admin-db-activity');
    expect(screen.getByText('Local database path')).toBeInTheDocument();
    expect(screen.getByText('Activity log size')).toBeInTheDocument();
    expect(screen.getByText('4.0 KB')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unsupported plugins: 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Domains tracked: 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activity logs: 11' }));

    expect(setActiveSection).toHaveBeenNthCalledWith(1, 'unsupported');
    expect(setActiveSection).toHaveBeenNthCalledWith(2, 'domains');
    expect(setActiveSection).toHaveBeenNthCalledWith(3, 'logs');
  });

  it('renders remote Turso health details when using a remote database', () => {
    render(
      <AdminDbSection
        {...buildProps({
          data: {
            dbPath: 'libsql://demo-db.turso.io',
            totals: {},
            files: {},
            logs: {
              lastRotatedAt: '2026-07-03T14:00:00.000Z',
              lastPrunedAt: '2026-07-03T15:00:00.000Z',
              lastMaintenanceAt: '2026-07-03T16:00:00.000Z'
            },
            heartbeat: {
              latest: {
                timestamp: '2026-07-03T13:00:00.000Z'
              }
            },
            turso: {
              health: { ok: true },
              stats: {
                data: {
                  active_connections: 23,
                  queries_per_second: 4.5,
                  rows_read_per_second: 88,
                  rows_written_per_second: 9,
                  storage_bytes: 10240
                }
              },
              orgUsage: {
                data: {
                  period: '30d',
                  total_requests: 321,
                  database_bytes: 2048,
                  database_rows: 654
                }
              },
              instances: {
                summary: {
                  total: 3,
                  primaryRegion: 'iad',
                  replicaRegions: ['ord', 'syd']
                }
              }
            }
          }
        })}
      />
    );

    expect(screen.getByText('Turso database endpoint')).toBeInTheDocument();
    expect(getStatValue('Turso health')).toHaveTextContent('Healthy');
    expect(getStatValue('Active connections')).toHaveTextContent('23');
    expect(getStatValue('Queries / second')).toHaveTextContent('4.5');
    expect(getStatValue('Rows read / second')).toHaveTextContent('88');
    expect(getStatValue('Rows written / second')).toHaveTextContent('9');
    expect(getStatValue('Turso storage')).toHaveTextContent('10 KB');
    expect(getStatValue('Org requests (30d)')).toHaveTextContent('321');
    expect(getStatValue('Org DB bytes')).toHaveTextContent('2.0 KB');
    expect(getStatValue('Org DB rows')).toHaveTextContent('654');
    expect(getStatValue('Instances')).toHaveTextContent('3');
    expect(getStatValue('Primary region')).toHaveTextContent('iad');
    expect(getStatValue('Replica regions')).toHaveTextContent('ord, syd');
  });

  it('shows recent scan details and handles expand, copy, and rescan actions', async () => {
    const setExpandedScanIds = vi.fn();
    const onRescan = vi.fn();
    const scan = {
      id: 'scan-1',
      timestamp: '2026-07-02T18:30:00.000Z',
      payload: {
        domain: 'alpha.test',
        metrics: {
          namespacesCount: 6,
          plugins: {
            matchedCount: 2
          }
        },
        snapshot: {
          domain: 'alpha.test',
          namespaces: ['wp/v2']
        },
        snapshotBytes: 321
      }
    };

    render(
      <AdminDbSection
        {...buildProps({
          recentScans: [scan],
          expandedScanIds: new Set(['scan-1:alpha.test']),
          setExpandedScanIds,
          onRescan
        })}
      />
    );

    expect(screen.getByText('Snapshot size:')).toBeInTheDocument();
    expect(screen.getByText(/321 bytes/)).toBeInTheDocument();
    expect(screen.getByText(/"alpha\.test"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'alpha.test' }));
    expect(setExpandedScanIds).toHaveBeenCalledTimes(1);
    const toggleExpanded = setExpandedScanIds.mock.calls[0][0];
    const collapsedIds = toggleExpanded(new Set(['scan-1:alpha.test']));
    expect(collapsedIds.has('scan-1:alpha.test')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Rescan' }));
    expect(onRescan).toHaveBeenCalledWith('alpha.test');

    fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith(JSON.stringify(scan.payload.snapshot, null, 2));
    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 1500);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    const [resetCopiedLabel] = setTimeoutMock.mock.calls[0];
    await act(async () => {
      resetCopiedLabel();
    });

    expect(screen.getByRole('button', { name: 'Copy JSON' })).toBeInTheDocument();
  });

  it('renders the activity log filter and passes table props through the wrapper', () => {
    const filteredActivityLogs = [
      {
        id: 'log-2',
        type: 'scan',
        timestamp: '2026-07-02T12:00:00.000Z',
        payload: { domain: 'example.com' }
      }
    ];
    const setExpandedLogIds = vi.fn();

    render(
      <AdminDbSection
        {...buildProps({
          activityLogs: filteredActivityLogs,
          filteredActivityLogs,
          logTypes: ['scan', 'heartbeat'],
          setExpandedLogIds
        })}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Type' }).closest('[data-slot="select-trigger"]')).toBeInTheDocument();
    expect(screen.getByTestId('activity-logs-table')).toHaveTextContent('Rendered 1 logs');
    const [tableProps] = activityLogsTableMock.mock.calls[0];
    expect(tableProps.logs).toEqual(filteredActivityLogs);
    expect(tableProps.expandedLogIds).toEqual(new Set());
    expect(tableProps.onToggle).toEqual(expect.any(Function));

    tableProps.onToggle('log-2');
    expect(setExpandedLogIds).toHaveBeenCalledTimes(1);
    const updateExpandedLogIds = setExpandedLogIds.mock.calls[0][0];
    expect(updateExpandedLogIds(new Set()).has('log-2')).toBe(true);
  });
});
