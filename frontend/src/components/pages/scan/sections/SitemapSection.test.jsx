import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SitemapSection from './SitemapSection.jsx';

vi.mock('../../../organisms/panels/SitemapScanPanel.jsx', () => ({
  default: () => <div>Sitemap scan panel</div>
}));

vi.mock('../../../organisms/panels/SitemapPagesTable.jsx', () => ({
  default: () => <div>Sitemap pages table</div>
}));

describe('SitemapSection', () => {
  it('offers sitemap as contextual action after baseline success without auto-running', () => {
    const onRun = vi.fn();
    render(
      <SitemapSection
        domain="example.com"
        capability={{ status: 'idle', result: null }}
        baselineAvailable
        sitemapSettings={{ sitemapUrl: '', maxPages: 50 }}
        onRun={onRun}
        onRetry={vi.fn()}
        sitemapFilter="all"
        setSitemapFilter={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Check sitemap' })).toBeInTheDocument();
    expect(screen.queryByText('Sitemap scan panel')).not.toBeInTheDocument();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('starts sitemap with current options when contextual action is clicked', async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    const settings = { sitemapUrl: 'https://example.com/map.xml', maxPages: 12 };
    render(<SitemapSection domain="example.com" capability={{ status: 'idle' }} baselineAvailable sitemapSettings={settings} onRun={onRun} sitemapFilter="all" setSitemapFilter={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Check sitemap' }));
    expect(onRun).toHaveBeenCalledWith(settings);
  });

  it.each([
    ['queued', 'Sitemap scan panel'],
    ['running', 'Sitemap scan panel'],
    ['success', 'Sitemap scan panel']
  ])('renders sitemap result state %s without replacing result panel', (status, label) => {
    render(<SitemapSection domain="example.com" capability={{ status, result: { pages: [{ url: '/one' }] } }} baselineAvailable sitemapFilter="all" setSitemapFilter={vi.fn()} onRun={vi.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows retry for retryable failure while preserving existing sitemap result', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<SitemapSection domain="example.com" capability={{ status: 'failed', result: { pages: [{ url: '/one' }] }, error: { message: 'Timed out', retryable: true } }} baselineAvailable sitemapFilter="all" setSitemapFilter={vi.fn()} onRun={vi.fn()} onRetry={onRetry} />);

    expect(screen.getByText('Sitemap pages table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry sitemap scan' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('uses neutral copy when baseline does not prove a sitemap surface', () => {
    render(<SitemapSection domain="example.com" capability={{ status: 'idle' }} baselineAvailable sitemapFilter="all" setSitemapFilter={vi.fn()} onRun={vi.fn()} />);

    expect(screen.getByText(/Check sitemap for page-level SEO signals/i)).toBeInTheDocument();
    expect(screen.queryByText(/found a sitemap surface/i)).not.toBeInTheDocument();
  });

  it('shows section retry for retryable unavailable sitemap state', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <SitemapSection
        domain="example.com"
         capability={{ status: 'unavailable', result: null, error: { message: 'Sitemap is unavailable.', retryable: true } }}
        sitemapSettings={{ sitemapUrl: '', maxPages: 50 }}
        onRun={vi.fn()}
         onRetry={onRetry}
        sitemapFilter="all"
        setSitemapFilter={vi.fn()}
      />
    );

    expect(screen.getByText('Sitemap is unavailable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry sitemap/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('only shows retry for retryable failures', () => {
    render(
      <SitemapSection
        domain="example.com"
        capability={{ status: 'failed', result: null, error: { message: 'Permanent failure', retryable: false } }}
        sitemapSettings={{ sitemapUrl: '', maxPages: 50 }}
        onRun={vi.fn()}
        onRetry={vi.fn()}
        sitemapFilter="all"
        setSitemapFilter={vi.fn()}
      />
    );

    expect(screen.getByText('Permanent failure')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry sitemap/i })).not.toBeInTheDocument();
  });
});
