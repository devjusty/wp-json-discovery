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
  default: () => <section aria-label="Exposure checks">Exposure panel</section>
}));

vi.mock('../../../organisms/panels/PerformancePanel.jsx', () => ({
  default: () => <div>Performance panel</div>
}));

vi.mock('../../../organisms/panels/ContentOverviewPanel.jsx', () => ({
  default: () => <div>Content overview panel</div>
}));

describe('scan section cards', () => {
  it('orders overview layers as identity, exposure, then actionable findings', () => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {},
          identity: { value: 'WordPress', evidence: { status: 'observed', source: 'wp-json' } },
          exposure: {}, findings: [{ id: 'finding-1', summary: 'Open users', evidence: [{ status: 'observed' }] }]
        }}
      />
    );

    const regions = screen.getAllByRole('region');
    expect(regions.findIndex((region) => region.getAttribute('aria-label') === 'Identity layer'))
      .toBeLessThan(regions.findIndex((region) => region.getAttribute('aria-label') === 'Exposure checks'));
    expect(screen.getByRole('region', { name: 'Actionable findings' })).toBeInTheDocument();
  });

  it('marks identity unavailable when identity evidence is absent', () => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: { name: 'Requested name' }, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {}
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Identity layer' })).toHaveTextContent('Unavailable');
    expect(screen.getByRole('region', { name: 'Identity layer' })).toHaveTextContent(/identifying evidence/i);
  });

  it('does not coerce unknown identity status to observed', () => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          identity: { value: 'WordPress', evidence: { status: 'mystery', reason: 'Unrecognized source status' } }
        }}
      />
    );

    const identity = screen.getByRole('region', { name: 'Identity layer' });
    expect(identity).toHaveTextContent('Unavailable');
    expect(identity).toHaveTextContent('Unrecognized source status');
    expect(identity).not.toHaveTextContent('Observed');
  });

  it('labels corroborated identity evidence explicitly', () => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          identity: { value: 'WordPress', evidence: { status: 'corroborated', source: 'verified endpoint' } }
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Identity layer' })).toHaveTextContent('Corroborated');
  });

  it.each([
    [
      { status: 'unavailable', source: '/zulu', reason: 'Second identity probe failed' },
      { status: 'inferred', source: '/hint' },
      { status: 'observed', source: '/confirmed' },
      { status: 'unavailable', source: '/alpha', reason: 'First identity probe failed' },
      { status: 'unavailable', source: '/zulu', reason: 'Second identity probe failed' }
    ],
    [
      { status: 'unavailable', source: '/alpha', reason: 'First identity probe failed' },
      { status: 'observed', source: '/confirmed' },
      { status: 'unavailable', source: '/zulu', reason: 'Second identity probe failed' },
      { status: 'inferred', source: '/hint' }
    ]
  ])('canonicalizes identity sources and unavailable reasons independent of evidence order', (...evidence) => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          identity: {
            value: 'WordPress',
            evidence
          }
        }}
      />
    );

    const identity = screen.getByRole('region', { name: 'Identity layer' });
    expect(identity).toHaveTextContent('Observed');
    expect(identity).toHaveTextContent('/alpha, /confirmed, /hint, /zulu');
    expect(identity).toHaveTextContent('First identity probe failed');
    expect(identity).toHaveTextContent('Second identity probe failed');
  });

  it('includes unavailable source and reason in mixed actionable evidence', () => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          findings: [{
            id: 'finding-1',
            summary: 'Open users',
            evidence: [
              { status: 'observed', source: '/users' },
              { status: 'unavailable', source: '/users-alt', reason: 'Authentication required' }
            ]
          }]
        }}
      />
    );

    const actionable = screen.getByRole('region', { name: 'Actionable findings' });
    expect(actionable).toHaveTextContent('/users, /users-alt');
    expect(actionable).toHaveTextContent('Authentication required');
  });

  it.each([null, undefined])('preserves record-level identity metadata when evidence is %s', (evidence) => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          identity: { value: null, evidence, evidenceLevel: 'unavailable', source: '/identity', reason: 'Identity probe blocked' }
        }}
      />
    );

    const identity = screen.getByRole('region', { name: 'Identity layer' });
    expect(identity).toHaveTextContent('/identity');
    expect(identity).toHaveTextContent('Identity probe blocked');
  });

  it.each([null, undefined])('preserves record-level finding metadata when evidence is %s', (evidence) => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          findings: [{ id: 'finding-1', title: 'Users', evidence, evidenceLevel: 'unavailable', source: '/users', reason: 'Authentication required' }]
        }}
      />
    );

    const unavailable = screen.getByRole('region', { name: 'Unavailable findings' });
    expect(unavailable).toHaveTextContent('/users');
    expect(unavailable).toHaveTextContent('Authentication required');
  });

  it('keeps unavailable findings outside actionable findings', () => {
    render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          findings: [{ id: 'finding-1', summary: 'Unknown result', evidence: [{ status: 'unavailable', reason: 'Blocked' }] }]
        }}
      />
    );

    expect(screen.queryByRole('region', { name: 'Actionable findings' })).not.toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });

  it.each([null, []])('does not crash when recognized finding evidenceLevel has evidence %s', (evidence) => {
    expect(() => render(
      <OverviewSection
        scanResult={{
          domain: 'example.com', fetchedAt: '', summary: {}, namespaces: [], metrics: {},
          plugins: { matched: [], unsupportedNamespaces: [] }, core: [], performance: {}, contentOverview: {}, exposure: {},
          findings: [{ id: 'finding-1', summary: 'Incomplete result', evidenceLevel: 'observed', evidence }]
        }}
      />
    )).not.toThrow();

    expect(screen.queryByRole('region', { name: 'Actionable findings' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Unavailable findings' })).toBeInTheDocument();
  });

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
