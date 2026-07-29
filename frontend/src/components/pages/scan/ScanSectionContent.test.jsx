import { render, screen } from '@testing-library/react';
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
  default: () => <div>Overview section</div>
}));

vi.mock('./sections/HomepageSection.jsx', () => ({
  default: () => <div>Homepage section</div>
}));

vi.mock('./sections/SitemapSection.jsx', () => ({
  default: () => <div>Sitemap section</div>
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
});
