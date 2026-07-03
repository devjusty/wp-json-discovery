import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
