import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import ScanPage from './ScanPage.jsx';

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
  default: () => <div>Domain form</div>
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
    scanResult: {
      domain: 'example.com',
      exposure: {},
      performance: {},
      contentOverview: {}
    },
    isScanning: false,
    scanError: null,
    homepageResult: null,
    homepageIsRunning: false,
    homepageError: null
  })
}));

vi.mock('./scan/ScanSidebarNav.jsx', () => ({
  default: () => <nav aria-label="Scan navigation">Scan navigation</nav>
}));

vi.mock('./scan/RecentDomainsCard.jsx', () => ({
  default: () => <section aria-label="Recent scanned domains">Recent domains</section>
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
  request: vi.fn().mockResolvedValue({ ok: true, data: { domains: [] } })
}));

vi.mock('../../utils/scanFeed.js', () => ({
  mergeRecentScans: vi.fn(() => [])
}));

describe('ScanPage', () => {
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
});
