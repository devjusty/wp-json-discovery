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
    scanResult: {
      domain: 'example.com',
      exposure: {},
      performance: {},
      contentOverview: {},
    },
    homepageResult: null,
    homepageDomain: 'example.com',
    startSitemapScan: vi.fn(),
    sitemapResult: null,
    isSitemapRunning: false,
    sitemapFilter: 'all',
    setSitemapFilter: vi.fn(),
    unsupportedPlugins: [],
    unsupportedIsLoading: false,
    onRefreshUnsupported: vi.fn(),
    ...overrides
  };
}

describe('ScanSectionContent', () => {
  it('renders empty state when no scan result is available', () => {
    render(<ScanSectionContent {...buildProps({ scanResult: null })} />);

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
});
