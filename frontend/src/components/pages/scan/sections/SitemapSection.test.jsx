import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SitemapSection from './SitemapSection.jsx';

vi.mock('../../../organisms/panels/SitemapScanPanel.jsx', () => ({
  default: () => <div>Sitemap scan panel</div>
}));

vi.mock('../../../organisms/panels/SitemapPagesTable.jsx', () => ({
  default: () => <div>Sitemap pages table</div>
}));

describe('SitemapSection', () => {
  it('shows unavailable sitemap state without run or retry controls', () => {
    render(
      <SitemapSection
        domain="example.com"
        capability={{ status: 'unavailable', result: null, error: { message: 'Sitemap is unavailable.' } }}
        sitemapSettings={{ sitemapUrl: '', maxPages: 50 }}
        onRun={vi.fn()}
        onRetry={vi.fn()}
        sitemapFilter="all"
        setSitemapFilter={vi.fn()}
      />
    );

    expect(screen.getByText('Sitemap is unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sitemap/i })).not.toBeInTheDocument();
  });
});
