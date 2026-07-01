import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from './AdminPage.jsx';
import {
  fetchDbSnapshot,
  fetchPlugins,
  fetchThemes,
  createPlugin,
  updatePlugin
} from '../../api/admin.js';
import { fetchScanHistory } from '../../api/client.js';

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

vi.mock('../../api/client.js', () => ({
  fetchScanHistory: vi.fn()
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
      activityLogs: 4,
      scanDomains: 5
    },
    files: {
      db: { sizeBytes: 1024 },
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
        {
          path: '/wp-content/plugins/convertkit/assets/embed.js',
          type: 'plugin',
          occurrences: 2
        }
      ],
      all: [
        {
          path: '/wp-content/plugins/convertkit/assets/embed.js',
          type: 'plugin',
          occurrences: 2,
          matches: []
        }
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
    fetchScanHistory.mockResolvedValue({ items: [] });
    createPlugin.mockResolvedValue({ plugin: { id: 'convertkit' }, plugins: [] });
    updatePlugin.mockResolvedValue({
      plugin: {
        id: 'convertkit',
        label: 'ConvertKit Updated',
        namespaces: ['ck/v1'],
        assetHints: ['convertkit']
      },
      plugins: []
    });
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

  it('creates a plugin from asset-only signal without namespaces', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Database' });
    await userEvent.click(screen.getByRole('button', { name: 'Unsupported plugins' }));
    await screen.findByRole('heading', { name: 'Unsupported plugins' });

    await userEvent.click(screen.getByRole('button', { name: 'Create plugin entry' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add plugin' });
    expect(within(dialog).getByLabelText('ID')).toHaveValue('convertkit');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add plugin' }));

    await waitFor(() => {
      expect(createPlugin).toHaveBeenCalled();
    });

    expect(createPlugin.mock.calls[0][0]).toEqual(expect.objectContaining({
      id: 'convertkit',
      label: 'Convertkit',
      namespaces: [],
      assetHints: ['convertkit']
    }));

    await waitFor(() => {
      expect(fetchDbSnapshot.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('fills the whole plugin draft from a matching suggestion', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Database' });
    await userEvent.click(screen.getByRole('button', { name: 'Plugin manager' }));
    await screen.findByRole('heading', { name: 'Plugin manager' });
    await userEvent.click(screen.getByRole('button', { name: 'Add plugin' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add plugin' });
    const idInput = within(dialog).getByLabelText('ID');
    await userEvent.type(idInput, 'con');

    const suggestion = await within(dialog).findByRole('button', { name: 'convertkit' });
    await userEvent.click(suggestion);

    expect(within(dialog).getByLabelText('ID')).toHaveValue('convertkit');
    expect(within(dialog).getByLabelText('Label')).toHaveValue('Convertkit');
    expect(within(dialog).getByLabelText('Plugin URL')).toHaveValue('https://wordpress.org/plugins/convertkit/');
    expect(within(dialog).getByLabelText('Namespaces (comma or newline separated)')).toHaveValue('');
    expect(within(dialog).getByLabelText('Asset hints (comma or newline separated)')).toHaveValue('convertkit');
  });

  it('opens edit mode when asset-only slug already exists', async () => {
    fetchPlugins.mockResolvedValue({
      plugins: [{
        id: 'convertkit',
        label: 'ConvertKit',
        description: 'Existing plugin',
        pluginUrl: 'https://wordpress.org/plugins/convertkit/',
        namespaces: ['ck/v1'],
        assetHints: ['convertkit']
      }]
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Database' });
    await userEvent.click(screen.getByRole('button', { name: 'Unsupported plugins' }));
    await screen.findByRole('heading', { name: 'Unsupported plugins' });
    await userEvent.click(screen.getByRole('button', { name: 'Create plugin entry' }));

    expect(await screen.findByText('Editing convertkit')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Add plugin' })).not.toBeInTheDocument();
  });

  it('closes inline plugin editor after save succeeds', async () => {
    fetchPlugins.mockResolvedValue({
      plugins: [{
        id: 'convertkit',
        label: 'ConvertKit',
        description: 'Existing plugin',
        pluginUrl: 'https://wordpress.org/plugins/convertkit/',
        namespaces: ['ck/v1'],
        assetHints: ['convertkit']
      }]
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Database' });
    await userEvent.click(screen.getByRole('button', { name: 'Unsupported plugins' }));
    await screen.findByRole('heading', { name: 'Unsupported plugins' });
    await userEvent.click(screen.getByRole('button', { name: 'Create plugin entry' }));

    expect(await screen.findByText('Editing convertkit')).toBeInTheDocument();

    const labelInput = screen.getByLabelText('Label');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, 'ConvertKit Updated');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updatePlugin).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText('Editing convertkit')).not.toBeInTheDocument();
    });
  });
});
