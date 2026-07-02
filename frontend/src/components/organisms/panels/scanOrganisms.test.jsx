import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScanSummary from '../summary/ScanSummary.jsx';
import HomepageSourcePanel from './HomepageSourcePanel.jsx';
import HomepageInsightsPanel from './HomepageInsightsPanel.jsx';
import PluginRoutesTable from '../data/PluginRoutesTable.jsx';

describe('scan organism panels', () => {
  it('labels the scan summary as a region', () => {
    render(
      <ScanSummary
        domain="example.com"
        fetchedAt="2026-07-01T10:00:00.000Z"
        summary={{ home: 'https://example.com' }}
        namespaces={['wp/v2']}
        metrics={{ durationMs: 125, namespacesCount: 1, versions: { wordpress: { version: '6.8.1' } } }}
        plugins={{ matched: [], unsupportedNamespaces: [] }}
        coreDatasets={[]}
      />
    );

    expect(screen.getByRole('region', { name: 'Scan summary' })).toBeInTheDocument();
    expect(screen.getByText('Core REST')).toHaveAttribute('data-slot', 'badge');
  });

  it('labels the homepage source fallback as a region', () => {
    render(<HomepageSourcePanel source={null} />);

    expect(screen.getByRole('region', { name: 'Homepage fetch' })).toBeInTheDocument();
  });

  it('labels the homepage insights panel as a region', () => {
    render(
      <HomepageInsightsPanel
        insights={{
          meta: [],
          comments: [],
          assets: [
            {
              path: '/wp-content/plugins/akismet/akismet.php',
              count: 1,
              type: 'plugin',
              slug: 'akismet',
              matches: []
            }
          ],
          scripts: [],
          frameworks: ['WordPress'],
          other: []
        }}
        htmlPreview="<html />"
      />
    );

    expect(screen.getByRole('region', { name: 'Frameworks & assets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HTML preview' })).toBeInTheDocument();
    expect(screen.getByText('plugin')).toHaveAttribute('data-slot', 'badge');
  });

  it('labels plugin routes as a table', () => {
    render(
      <PluginRoutesTable
        domain="example.com"
        pluginMatch={{
          plugin: { id: 'convertkit', label: 'ConvertKit', description: 'Email', namespaces: ['ck/v1'] },
          namespaces: ['ck/v1'],
          routes: [{ path: '/ck/v1/ping', methods: ['GET'], namespace: 'ck/v1', accepts: [], hasSchema: false }]
        }}
      />
    );

    expect(screen.getByRole('table', { name: 'ConvertKit routes' })).toBeInTheDocument();
  });
});
