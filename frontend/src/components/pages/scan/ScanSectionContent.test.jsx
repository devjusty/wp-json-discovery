import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScanSectionContent from './ScanSectionContent.jsx';

vi.mock('../../organisms/panels/ExposurePanel.jsx', () => ({
  default: () => <div>Exposure panel</div>
}));

vi.mock('../../organisms/panels/PerformancePanel.jsx', () => ({
  default: () => <div>Performance panel</div>
}));

vi.mock('../../organisms/panels/ContentOverviewPanel.jsx', () => ({
  default: () => <div>Content overview panel</div>
}));

vi.mock('./sections/OverviewSection.jsx', () => ({
  default: ({ scanResult }) => (
    <div>
      <div>Overview section</div>
      {scanResult?.identity?.evidence?.status ? <span>{scanResult.identity.evidence.status === 'unavailable' ? 'Unavailable' : scanResult.identity.evidence.status} {scanResult.identity.evidence.reason}</span> : null}
      {scanResult?.findings?.length ? <span>Actionable findings</span> : null}
      {scanResult?.findings?.map((finding) => <span key={finding.id}>{finding.title}</span>)}
    </div>
  )
}));

vi.mock('./sections/HomepageSection.jsx', () => ({
  default: () => <div>Homepage section</div>
}));

vi.mock('./sections/SitemapSection.jsx', () => ({
  default: ({ onRun, onRetry }) => (
    <div>
      <div>Sitemap section</div>
      <button type="button" onClick={() => onRun({ sitemapUrl: '', maxPages: 50 })}>Contextual sitemap run</button>
      <button type="button" onClick={onRetry}>Contextual sitemap retry</button>
    </div>
  )
}));

vi.mock('./sections/CoreDataSection.jsx', () => ({
  default: () => <div>Core data section</div>
}));

vi.mock('./sections/PluginsSection.jsx', () => ({
  default: () => <div>Plugins section</div>
}));

vi.mock('./sections/UnsupportedSection.jsx', () => ({
  default: () => <div>Unsupported section</div>
}));

function buildProps(overrides = {}) {
  return {
    activeSection: 'overview',
    session: {
      domain: 'example.com',
      selection: { capabilityIds: ['wordpress'], options: { wordpress: {} } },
      capabilities: {
        wordpress: {
          status: 'success',
          result: {
            domain: 'example.com',
            exposure: {},
            performance: {},
            contentOverview: {}
          },
          error: null
        }
      }
    },
    scanSettings: { capabilityIds: ['wordpress'], options: { wordpress: {} } },
    onScanSettingsChange: vi.fn(),
    onRunCapability: vi.fn(),
    onRetryCapability: vi.fn(),
    sitemapFilter: 'all',
    setSitemapFilter: vi.fn(),
    unsupportedPlugins: [],
    unsupportedIsLoading: false,
    onRefreshUnsupported: vi.fn(),
    ...overrides
  };
}

describe('ScanSectionContent', () => {
  it('renders empty state when no scan session is available', () => {
    render(<ScanSectionContent {...buildProps({ session: null })} />);

    expect(screen.getByText(/enter a domain to discover available rest endpoints/i)).toBeInTheDocument();
  });

  it('routes each section to the expected renderer', () => {
    const cases = [
      ['overview', 'Overview section'],
      ['exposure', 'Exposure panel'],
      ['performance', 'Performance panel'],
      ['content', 'Content overview panel'],
      ['homepage', 'Homepage section'],
      ['sitemap', 'Sitemap section'],
      ['core', 'Core data section'],
      ['plugins', 'Plugins section'],
      ['unsupported', 'Unsupported section']
    ];

    cases.forEach(([activeSection, expectedText]) => {
      const { unmount } = render(
        <ScanSectionContent {...buildProps({ activeSection })} />
      );
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    });
  });

  it('keeps successful WordPress content visible while homepage work runs', () => {
    const props = buildProps();
    render(
      <ScanSectionContent {...buildProps({
        session: {
          ...props.session,
          selection: { capabilityIds: ['homepage', 'wordpress'], options: { homepage: {}, wordpress: {} } },
          capabilities: {
            ...props.session.capabilities,
            homepage: { status: 'running', result: null, error: null }
          }
        }
      })} />
    );

    expect(screen.getByText('Overview section')).toBeInTheDocument();
  });

  it('renders layered evidence labels and actionable findings from successful records', () => {
    render(<ScanSectionContent {...buildProps({
      session: {
        ...buildProps().session,
        capabilities: {
          wordpress: {
            status: 'success',
            result: {
              domain: 'example.com',
              identity: { value: 'WordPress', evidence: { status: 'observed', source: 'wp-json' } },
              exposure: { records: [{ label: 'REST API', value: 'Public', evidence: { status: 'observed', source: 'wp-json' } }] },
              findings: [{ id: 'users-open', title: 'User enumeration open', evidence: { status: 'observed' } }]
            },
            error: null
          }
        }
      }
    })} />);

    expect(screen.getByText(/observed/i)).toBeInTheDocument();
    expect(screen.getByText(/action/i)).toBeInTheDocument();
    expect(screen.getByText('User enumeration open')).toBeInTheDocument();
  });

  it('shows unavailable evidence with its reason instead of an empty success state', () => {
    render(<ScanSectionContent {...buildProps({
      session: {
        ...buildProps().session,
        capabilities: {
          wordpress: {
            status: 'success',
            result: {
              domain: 'example.com',
              identity: { value: null, evidence: { status: 'unavailable', reason: 'No identifying response' } },
              exposure: { records: [] },
              findings: []
            },
            error: null
          }
        }
      }
    })} />);

    expect(screen.getByText(/Unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Unavailable.*No identifying response/)).toBeInTheDocument();
  });

  it.each([
    ['overview', 'Overview'],
    ['exposure', 'Exposure'],
    ['performance', 'Performance'],
    ['content', 'Content footprint'],
    ['core', 'Core data'],
    ['plugins', 'Plugins']
  ])('renders %s capability state while WordPress is running', (activeSection, heading) => {
    const props = buildProps();
    render(
      <ScanSectionContent {...buildProps({
        activeSection,
        session: {
          ...props.session,
          capabilities: {
            wordpress: { status: 'running', result: null, error: null }
          }
        }
      })} />
    );

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText('WordPress API scan is running.')).toBeInTheDocument();
  });

  it('retries a failed WordPress capability from overview', async () => {
    const onRetryCapability = vi.fn();
    const user = userEvent.setup();
    const props = buildProps();
    render(
      <ScanSectionContent {...buildProps({
        onRetryCapability,
        session: {
          ...props.session,
          capabilities: {
            wordpress: {
              status: 'failed',
              result: null,
              error: { message: 'REST API blocked', retryable: true }
            }
          }
        }
      })} />
    );

    expect(screen.getByText('REST API blocked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry WordPress API scan' }));
    expect(onRetryCapability).toHaveBeenCalledWith('wordpress');
  });

  it('routes contextual sitemap actions through supplied canonical handlers', async () => {
    const onRunCapability = vi.fn();
    const onRetryCapability = vi.fn();
    const user = userEvent.setup();
    render(<ScanSectionContent {...buildProps({ activeSection: 'sitemap', onRunCapability, onRetryCapability })} />);

    await user.click(screen.getByRole('button', { name: 'Contextual sitemap run' }));
    await user.click(screen.getByRole('button', { name: 'Contextual sitemap retry' }));

    expect(onRunCapability).toHaveBeenCalledWith('sitemap', { sitemapUrl: '', maxPages: 50 });
    expect(onRetryCapability).toHaveBeenCalledWith('sitemap');
  });
});
