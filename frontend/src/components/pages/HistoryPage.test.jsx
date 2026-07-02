import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import HistoryPage from './HistoryPage.jsx';
import {
  fetchDomainScanHistory,
  fetchScanHistory
} from '../../api/client.js';

vi.mock('../../api/client.js', () => ({
  fetchScanHistory: vi.fn(),
  fetchDomainScanHistory: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

function buildHistoryResponse({
  items = [],
  total = items.length
} = {}) {
  return {
    items,
    pagination: {
      total,
      limit: 20,
      offset: 0
    }
  };
}

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
      <HistoryPage
        headerActions={null}
        onRescan={vi.fn()}
        onUseDomain={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, '', '/');
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('loads history and supports rescan/use/copy actions', async () => {
    const onRescan = vi.fn();
    const onUseDomain = vi.fn();

    fetchScanHistory.mockResolvedValueOnce(buildHistoryResponse({
      items: [
        {
          domain: 'example.com',
          lastScannedAt: '2026-03-19T10:00:00.000Z',
          lastStatus: 'success',
          lastDurationMs: 950,
          lastUnsupportedCount: 2,
          lastErrorCategory: null
        }
      ],
      total: 1
    }));
    fetchDomainScanHistory.mockResolvedValueOnce({ runs: [] });

    renderPage({ onRescan, onUseDomain });

    expect(screen.getByRole('table', { name: 'Scan history' })).toBeInTheDocument();
    expect(screen.getByText('Search domains').closest('[data-slot="card"]')).toBeInTheDocument();

    await screen.findByText('example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Use in scanner' }));
    expect(onUseDomain).toHaveBeenCalledWith('example.com');

    await userEvent.click(screen.getByRole('button', { name: 'View runs' }));

    await screen.findByText(/Recent runs for example.com/i);
    expect(screen.getByText(/Recent runs for example.com/i).closest('[data-slot="card"]')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Re-scan' }));
    expect(onRescan).toHaveBeenCalledWith('example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Copy domain' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('example.com');
  });

  it('toggles include-failed filter and requests failed scans', async () => {
    fetchScanHistory
      .mockResolvedValueOnce(buildHistoryResponse({
        items: [
          {
            domain: 'healthy.com',
            lastScannedAt: '2026-03-19T10:00:00.000Z',
            lastStatus: 'success',
            lastDurationMs: 500,
            lastUnsupportedCount: 0,
            lastErrorCategory: null
          }
        ],
        total: 1
      }))
      .mockResolvedValueOnce(buildHistoryResponse({
        items: [
          {
            domain: 'healthy.com',
            lastScannedAt: '2026-03-19T10:00:00.000Z',
            lastStatus: 'success',
            lastDurationMs: 500,
            lastUnsupportedCount: 0,
            lastErrorCategory: null
          },
          {
            domain: 'failed.com',
            lastScannedAt: '2026-03-19T10:05:00.000Z',
            lastStatus: 'failed',
            lastDurationMs: null,
            lastUnsupportedCount: 0,
            lastErrorCategory: 'timeout'
          }
        ],
        total: 2
      }));

    renderPage();
    await screen.findByText('healthy.com');

    await userEvent.click(screen.getByLabelText('Include failed scans'));

    await waitFor(() => {
      expect(fetchScanHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ includeFailed: true })
      );
    });

    await screen.findByText('failed.com');
  });

  it('supports pagination and loads domain runs panel', async () => {
    fetchScanHistory
      .mockResolvedValueOnce(buildHistoryResponse({
        items: [
          {
            domain: 'page-one.com',
            lastScannedAt: '2026-03-19T10:00:00.000Z',
            lastStatus: 'success',
            lastDurationMs: 700,
            lastUnsupportedCount: 1,
            lastErrorCategory: null
          }
        ],
        total: 25
      }))
      .mockResolvedValueOnce(buildHistoryResponse({
        items: [
          {
            domain: 'page-two.com',
            lastScannedAt: '2026-03-19T11:00:00.000Z',
            lastStatus: 'success',
            lastDurationMs: 610,
            lastUnsupportedCount: 0,
            lastErrorCategory: null
          }
        ],
        total: 25
      }));

    fetchDomainScanHistory.mockResolvedValueOnce({
      runs: [
        {
          id: 10,
          scannedAt: '2026-03-19T09:59:00.000Z',
          status: 'success',
          durationMs: 701,
          unsupportedCount: 1,
          errorCategory: null,
          errorMessage: null
        }
      ]
    });

    renderPage();
    await screen.findByText('page-one.com');

    await userEvent.click(screen.getByRole('button', { name: 'View runs' }));

    await waitFor(() => {
      expect(fetchDomainScanHistory).toHaveBeenCalledWith(
        'page-one.com',
        expect.objectContaining({ includeFailed: false, limit: 10 })
      );
    });

    await screen.findByText(/Recent runs for page-one.com/i);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Page 2 of 2');

    await waitFor(() => {
      expect(fetchScanHistory).toHaveBeenCalledTimes(2);
    });
  });
});
