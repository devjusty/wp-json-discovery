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
      />
    );

    expect(screen.getByRole('table', { name: 'Sitemap pages' })).toBeInTheDocument();
  });
});
