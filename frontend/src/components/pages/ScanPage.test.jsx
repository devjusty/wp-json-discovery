import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScanPage from './ScanPage.jsx';
import { clearUserRecentRuns } from '../../api/client.js';

const mocks = vi.hoisted(() => ({
  domainForm: vi.fn(() => null),
  updateScanSettings: vi.fn(),
  saveScanDefaults: vi.fn()
}));

vi.mock('../templates/AppLayout.jsx', () => ({
  default: ({ children, sidebar, title }) => (
    <div>
      <h1>{title}</h1>
      {sidebar}
      {children}
    </div>
  )
}));

vi.mock('../molecules/forms/DomainForm.jsx', () => ({
  default: mocks.domainForm
}));

vi.mock('../../hooks/useSitemapScan.js', () => ({
  useSitemapScan: () => ({
    startSitemapScan: vi.fn(),
    result: null,
    isRunning: false
  })
}));

vi.mock('../../context/ScanContext.jsx', () => ({
  useScanShellContext: () => ({
    domain: 'example.com',
    handleDomainChange: vi.fn(),
    setActivePage: vi.fn(),
    startScan: vi.fn(),
    activeDomain: 'example.com'
  }),
  useScanResultsContext: () => ({
    scanResult: null,
    isScanning: false,
    scanError: null,
    homepageResult: null,
    homepageIsRunning: false,
    homepageError: null,
    scanSettings: {
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    },
    updateScanSettings: mocks.updateScanSettings,
    saveScanDefaults: mocks.saveScanDefaults
  })
}));

vi.mock('./scan/ScanSidebarNav.jsx', () => ({
  default: ({ activeSection, onSectionChange }) => (
    <nav aria-label="Scan navigation">
      <span data-testid="active-section">{activeSection}</span>
      <button type="button" onClick={() => onSectionChange('unsupported')}>
        Unsupported
      </button>
    </nav>
  )
}));

vi.mock('./scan/RecentDomainsCard.jsx', () => ({
  default: ({ onClearRecentDomains }) => (
    <section aria-label="Recent scanned domains">
      Recent domains
      <button type="button" onClick={onClearRecentDomains}>Clear recent domains</button>
    </section>
  )
}));

vi.mock('./scan/ScanStatusStack.jsx', () => ({
  default: () => <div>Scan status stack</div>
}));

vi.mock('./scan/ScanSectionContent.jsx', () => ({
  default: () => <div>Scan section content</div>
}));

vi.mock('../../api/client.js', () => ({
  fetchUnsupportedPlugins: vi.fn().mockResolvedValue([]),
  fetchUserRecentRuns: vi.fn().mockResolvedValue({ items: [] }),
  request: vi.fn().mockResolvedValue({ ok: true, data: { domains: [] } }),
  clearUserRecentRuns: vi.fn().mockResolvedValue({ ok: true })
}));

vi.mock('../../utils/scanFeed.js', () => ({
  mergeRecentScans: vi.fn(() => [])
}));

describe('ScanPage', () => {
  beforeEach(() => {
    mocks.domainForm.mockClear();
    mocks.updateScanSettings.mockClear();
    mocks.saveScanDefaults.mockClear();
  });

  it('forwards live scan settings actions to the domain form', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAuthenticated />
      </QueryClientProvider>
    );

    expect(mocks.domainForm).toHaveBeenCalledWith(expect.objectContaining({
      scanSettings: {
        capabilityIds: ['homepage', 'wordpress'],
        options: { homepage: {}, wordpress: {} }
      },
      onScanSettingsChange: mocks.updateScanSettings,
      onSaveDefaults: mocks.saveScanDefaults
    }), undefined);
  });

  it('renders scan shell regions', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAuthenticated />
      </QueryClientProvider>
    );

    expect(screen.getByRole('navigation', { name: 'Scan navigation' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recent scanned domains' })).toBeInTheDocument();
  });

  it('clears the current user recent scans from the scan card', async () => {
    const user = userEvent.setup();

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAuthenticated />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /clear recent domains/i }));

    expect(clearUserRecentRuns).toHaveBeenCalledTimes(1);
  });

  it('shows overview when unsupported section loses admin access', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAdmin isAuthenticated />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Unsupported' }));
    expect(screen.getByTestId('active-section')).toHaveTextContent('unsupported');

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAdmin={false} isAuthenticated />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('active-section')).toHaveTextContent('overview');
  });
});
