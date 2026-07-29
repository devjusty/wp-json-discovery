import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmptyScanState from './EmptyScanState.jsx';
import HomepageSection from './HomepageSection.jsx';
import OverviewSection from './OverviewSection.jsx';
import PluginsSection from './PluginsSection.jsx';

vi.mock('../../../organisms/panels/HomepageSourcePanel.jsx', () => ({
  default: () => <div>Homepage source panel</div>
}));

vi.mock('../../../organisms/panels/HomepageInsightsPanel.jsx', () => ({
  default: () => <div>Homepage insights panel</div>
}));

vi.mock('../../../organisms/panels/PluginSummaryPanel.jsx', () => ({
  default: () => <div>Plugin summary panel</div>
}));

vi.mock('../../../organisms/data/PluginRoutesTable.jsx', () => ({
  default: () => <div>Plugin routes table</div>
}));

vi.mock('../../../organisms/summary/ScanSummary.jsx', () => ({
  default: () => <div>Scan summary panel</div>
}));

vi.mock('../../../organisms/panels/ExposurePanel.jsx', () => ({
  default: () => <div>Exposure panel</div>
}));

vi.mock('../../../organisms/panels/PerformancePanel.jsx', () => ({
  default: () => <div>Performance panel</div>
}));

vi.mock('../../../organisms/panels/ContentOverviewPanel.jsx', () => ({
  default: () => <div>Content overview panel</div>
}));

describe('scan section cards', () => {
  it('labels the empty scan prompt as a status region', () => {
    render(<EmptyScanState />);

    expect(screen.getByRole('status', { name: 'Scan prompt' })).toBeInTheDocument();
  });

  it('keeps the raw JSON panel collapsed by default', () => {
    render(<HomepageSection homepageDomain="example.com" capability={{ status: 'idle', result: null, error: null }} />);

    expect(screen.getByRole('status', { name: 'Homepage source signals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Raw JSON' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Raw JSON' })).not.toBeInTheDocument();
  });

  it('labels the overview homepage tile as a status region', () => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com',
          fetchedAt: '2026-07-01T10:00:00.000Z',
          summary: {},
          namespaces: [],
          metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] },
          core: [],
          performance: {},
          contentOverview: {},
          exposure: {}
        }}
        homepageDomain="example.com"
        homepageResult={null}
      />
    );

    expect(screen.getByRole('status', { name: 'Homepage source signals' })).toBeInTheDocument();
  });

  it('does not crash or claim automatic homepage work when scan result is malformed', () => {
    render(<OverviewSection scanResult={null} homepageDomain="example.com" capabilities={{ homepage: { status: 'unavailable', error: { message: 'Not available' } } }} />);

    expect(screen.getByText(/homepage scan is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/runs automatically/i)).not.toBeInTheDocument();
  });

  it('uses a shadcn card action slot for the overview homepage tile', () => {
    const { container } = render(
      <OverviewSection
        scanResult={{
          domain: 'example.com',
          fetchedAt: '2026-07-01T10:00:00.000Z',
          summary: {},
          namespaces: [],
          metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] },
          core: [],
          performance: {},
          contentOverview: {},
          exposure: {}
        }}
        homepageDomain="example.com"
        homepageResult={null}
      />
    );

    const homepageTile = screen.getByRole('status', { name: 'Homepage source signals' });
    expect(homepageTile).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card-action"]')).toBeInTheDocument();
  });

  it('runs additional capabilities from overview', async () => {
    const onRunCapability = vi.fn();
    const user = userEvent.setup();
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {}
        }}
        capabilities={{ homepage: { status: 'idle' }, sitemap: { status: 'idle' } }}
        selectedCapabilityIds={['wordpress']}
        onRunCapability={onRunCapability}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Run Sitemap' }));
    expect(onRunCapability).toHaveBeenCalledWith('sitemap', { sitemapUrl: '', maxPages: 50 });
  });

  it('labels the plugins empty and unsupported notices as cards', () => {
    render(
      <PluginsSection
        scanResult={{
          domain: 'example.com',
          plugins: {
            matched: [],
            unsupportedNamespaces: ['wc/v3']
          }
        }}
      />
    );

    expect(screen.getByRole('status', { name: 'Plugin routes' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Unsupported namespace notice' })).toBeInTheDocument();
  });
});
