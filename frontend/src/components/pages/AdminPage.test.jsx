import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from './AdminPage.jsx';
import {
  fetchDbSnapshot,
  fetchPlugins,
  fetchThemes
} from '../../api/admin.js';

vi.mock('../../api/admin.js', () => ({
  fetchDbSnapshot: vi.fn(),
  pruneActivityLogs: vi.fn(),
  runDbMaintenance: vi.fn(),
  fetchPlugins: vi.fn(),
  fetchThemes: vi.fn(),
  createPlugin: vi.fn(),
  updatePlugin: vi.fn(),
  deletePlugin: vi.fn(),
  sortPlugins: vi.fn(),
  createTheme: vi.fn(),
  updateTheme: vi.fn(),
  deleteTheme: vi.fn(),
  sortThemes: vi.fn()
}));

function renderPage(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPage
        headerActions={null}
        onNavigate={vi.fn()}
        rotateLogs={vi.fn()}
        isRotatingLogs={false}
        onRescan={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

function buildSnapshot() {
  return {
    dbPath: 'libsql://test-org.turso.io',
    totals: {
      unsupportedPlugins: 2,
      unsupportedPluginDomains: 3,
      activityLogs: 4
    },
    files: {
      db: { sizeBytes: 1024 },
      wal: { sizeBytes: 128 },
      shm: { sizeBytes: 64 },
      activityLog: { sizeBytes: 512 }
    },
    logs: {
      lastRotatedAt: '2026-03-19T10:00:00.000Z',
      lastPrunedAt: '2026-03-19T10:05:00.000Z',
      lastMaintenanceAt: '2026-03-19T10:10:00.000Z'
    },
    unsupportedPlugins: [
      {
        namespace: 'wc/v3',
        domains: ['example.com', 'shop.com'],
        firstDetectedAt: '2026-03-01T00:00:00.000Z',
        lastDetectedAt: '2026-03-19T00:00:00.000Z'
      },
      {
        namespace: 'yoast/v1',
        domains: ['example.com'],
        firstDetectedAt: '2026-03-02T00:00:00.000Z',
        lastDetectedAt: '2026-03-12T00:00:00.000Z'
      }
    ],
    activityLogs: [
      {
        id: 11,
        timestamp: '2026-03-19T11:00:00.000Z',
        type: 'scan.complete',
        payload: {
          domain: 'example.com',
          metrics: {
            namespacesCount: 3,
            plugins: { matchedCount: 1 }
          }
        }
      },
      {
        id: 12,
        timestamp: '2026-03-19T11:02:00.000Z',
        type: 'metrics.heartbeat',
        payload: {
          scanDurationMs: { p95: 950 },
          errors: { total: 1 }
        }
      }
    ],
    heartbeat: {
      latest: {
        timestamp: '2026-03-19T11:02:00.000Z',
        payload: {
          window: {
            startedAt: '2026-03-19T10:00:00.000Z',
            endedAt: '2026-03-19T11:00:00.000Z'
          },
          scansCompleted: 10,
          scanDurationMs: { p50: 350, p95: 950 },
          errors: {
            total: 1,
            perCategory: [{ category: 'timeout', count: 1, ratePerScan: 0.1 }],
            topFailingDomains: [{ domain: 'example.com', count: 1 }]
          },
          unsupportedPlugins: {
            topNamespaces: [{ namespace: 'wc/v3', count: 2 }]
          }
        }
      },
      recent: [
        {
          id: 1,
          timestamp: '2026-03-19T10:00:00.000Z',
          payload: {
            scansCompleted: 10,
            scanDurationMs: { p95: 900 },
            errors: { total: 0 }
          }
        },
        {
          id: 2,
          timestamp: '2026-03-19T11:00:00.000Z',
          payload: {
            scansCompleted: 10,
            scanDurationMs: { p95: 950 },
            errors: { total: 1 }
          }
        }
      ]
    },
    homepageAssets: {
      totalPaths: 4,
      unknownPaths: 1,
      unknown: [
        { path: '/wp-content/x.js', type: 'script', occurrences: 2 }
      ],
      all: [
        { path: '/wp-content/x.js', type: 'script', occurrences: 2, matches: [] }
      ]
    }
  };
}

describe('AdminPage integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchDbSnapshot.mockResolvedValue(buildSnapshot());
    fetchPlugins.mockResolvedValue({ plugins: [] });
    fetchThemes.mockResolvedValue({ themes: [] });
  });

  it('switches between major admin sections from the sidebar', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Database' });

    await userEvent.click(screen.getByRole('button', { name: 'DB maintenance' }));
    expect(await screen.findByRole('heading', { name: 'Database maintenance' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Activity logs' }));
    expect(await screen.findByRole('heading', { name: 'Activity logs' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Heartbeat' }));
    expect(await screen.findByRole('heading', { name: 'Heartbeat metrics' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Plugin manager' }));
    expect(await screen.findByRole('heading', { name: 'Plugin manager' })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchPlugins).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Supported themes' }));
    expect(await screen.findByRole('heading', { name: 'Supported themes' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Theme manager' }));
    expect(await screen.findByRole('heading', { name: 'Theme manager' })).toBeInTheDocument();
  });

  it('uses navigation action from sidebar', async () => {
    const onNavigate = vi.fn();
    renderPage({ onNavigate });

    await screen.findByRole('heading', { name: 'Database' });

    await userEvent.click(screen.getByRole('button', { name: 'Go to current scan' }));
    expect(onNavigate).toHaveBeenCalledWith('scan');
  });
});
