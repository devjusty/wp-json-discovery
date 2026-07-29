import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SitemapScanPanel from './SitemapScanPanel.jsx';
import PluginSummaryPanel from './PluginSummaryPanel.jsx';
import UnsupportedPluginsPanel from './UnsupportedPluginsPanel.jsx';
import SitemapPagesTable from './SitemapPagesTable.jsx';

describe('scan panel details', () => {
  it('labels the sitemap scan card as a region', () => {
    render(
      <SitemapScanPanel
        domain="example.com"
        onScan={() => {}}
        isRunning={false}
        result={null}
        sitemapProbe={null}
        sitemapExposure={null}
      />
    );

    expect(screen.getByRole('region', { name: 'Sitemap scan' })).toBeInTheDocument();
  });

  it('uses session-controlled sitemap settings for initial scans and reruns', async () => {
    const onScan = vi.fn();
    const onSettingsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SitemapScanPanel
        domain="example.com"
        onScan={onScan}
        isRunning={false}
        result={null}
        sitemapProbe={null}
        sitemapExposure={null}
        settings={{ sitemapUrl: '/news-sitemap.xml', maxPages: 25 }}
        onSettingsChange={onSettingsChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Scan sitemap' }));
    expect(onScan).toHaveBeenCalledWith({ sitemapUrl: '/news-sitemap.xml', maxPages: 25 });

    onScan.mockClear();
    render(
      <SitemapScanPanel
        domain="example.com"
        onScan={onScan}
        isRunning={false}
        result={{ pages: [], totals: {} }}
        sitemapProbe={null}
        sitemapExposure={null}
        settings={{ sitemapUrl: '/news-sitemap.xml', maxPages: 25 }}
        onSettingsChange={onSettingsChange}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Rerun sitemap' }));
    expect(onScan).toHaveBeenCalledWith({ sitemapUrl: '/news-sitemap.xml', maxPages: 25 });
  });

  it('clamps typed sitemap page limits to the server maximum', async () => {
    const onSettingsChange = vi.fn();
    const onScan = vi.fn();
    const user = userEvent.setup();
    render(
      <SitemapScanPanel
        domain="example.com"
        onScan={onScan}
        isRunning={false}
        result={null}
        sitemapProbe={null}
        sitemapExposure={null}
        settings={{ sitemapUrl: '', maxPages: 25 }}
        onSettingsChange={onSettingsChange}
      />
    );

    const maxPages = screen.getByRole('spinbutton', { name: 'Max pages' });
    await user.clear(maxPages);
    await user.type(maxPages, '99');

    expect(maxPages).toHaveAttribute('max', '50');
    expect(onSettingsChange).toHaveBeenLastCalledWith({ sitemapUrl: '', maxPages: 50 });

    onSettingsChange.mockImplementation((nextSettings) => {
      maxPages.value = nextSettings.maxPages;
    });
    await user.click(screen.getByRole('button', { name: 'Scan sitemap' }));
    expect(onScan).toHaveBeenCalledWith({ sitemapUrl: '', maxPages: 25 });
  });

  it('labels plugin summary and unsupported plugin cards as regions', () => {
    render(
      <>
        <PluginSummaryPanel plugins={{ matched: [], unsupportedNamespaces: [] }} />
        <UnsupportedPluginsPanel plugins={[]} onRefresh={() => {}} isLoading={false} showDomains={false} />
      </>
    );

    expect(screen.getByRole('region', { name: 'Plugin summary' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Unsupported plugins' })).toBeInTheDocument();
  });

  it('labels the sitemap pages table with an accessible table name', () => {
    render(
      <SitemapPagesTable
        pages={[
          {
            url: 'https://example.com/',
            finalUrl: 'https://example.com/',
            statusCode: 200,
            ok: true,
            seo: { title: 'Home' },
            schema: { types: ['WebPage'] },
            flags: []
          }
        ]}
        filterValue="all"
      />
    );

    expect(screen.getByRole('table', { name: 'Sitemap pages' })).toBeInTheDocument();
  });

  it('allows long sitemap paths to wrap in the path column', () => {
    render(
      <SitemapPagesTable
        pages={[
          {
            url: 'https://example.com/articles/this-is-a-very-long-path-that-should-wrap/and-not-overflow/under-the-status-column',
            finalUrl: 'https://example.com/articles/this-is-a-very-long-path-that-should-wrap/and-not-overflow/under-the-status-column',
            statusCode: 200,
            ok: true,
            seo: { title: 'Long page' },
            schema: { types: ['WebPage'] },
            flags: []
          }
        ]}
        filterValue="all"
      />
    );

    expect(
      screen.getByRole('link', {
        name: '/articles/this-is-a-very-long-path-that-should-wrap/and-not-overflow/under-the-status-column'
      }).closest('[data-slot="table-cell"]')
    ).toHaveClass('!whitespace-normal');

    expect(
      screen.getByRole('link', {
        name: '/articles/this-is-a-very-long-path-that-should-wrap/and-not-overflow/under-the-status-column'
      })
    ).not.toHaveAttribute('title');
  });

  it('shows the detected sitemap url and redirect information in the sitemap scan panel', () => {
    render(
      <SitemapScanPanel
        domain="example.com"
        onScan={() => {}}
        isRunning={false}
        result={null}
        sitemapProbe={{
          endpoint: '/sitemap.xml',
          finalUrl: '/sitemap_index.xml',
          redirectCount: 1,
          statusCode: 200,
          durationMs: 80
        }}
        sitemapExposure={{ available: true, statusCode: 200 }}
      />
    );

    expect(screen.getByText('Detected sitemap')).toBeInTheDocument();
    expect(screen.getByText('Primary URL: /sitemap_index.xml · Redirected from /sitemap.xml')).toBeInTheDocument();
  });

  it('keeps the detected sitemap and overview snapshot in the same row', () => {
    render(
      <SitemapScanPanel
        domain="example.com"
        onScan={() => {}}
        isRunning={false}
        result={null}
        sitemapProbe={{
          endpoint: '/sitemap.xml',
          finalUrl: '/sitemap_index.xml',
          redirectCount: 1,
          statusCode: 200,
          durationMs: 80
        }}
        sitemapExposure={{ available: true, statusCode: 200 }}
      />
    );

    const detectedSitemap = screen.getByText('Detected sitemap');
    const overviewSnapshot = screen.getByText('Overview snapshot');

    expect(detectedSitemap.closest('.sitemap-scan__snapshot-row')).toBe(overviewSnapshot.closest('.sitemap-scan__snapshot-row'));
    expect(detectedSitemap.closest('.sitemap-scan__snapshot-row')).toHaveClass('sitemap-scan__snapshot-row');
  });
});
