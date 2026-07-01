import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContentOverviewPanel from './ContentOverviewPanel.jsx';
import ExposurePanel from './ExposurePanel.jsx';
import PerformancePanel from './PerformancePanel.jsx';
import VersionPanel from './VersionPanel.jsx';

describe('scan panel cards', () => {
  it('exposes an accessible region for exposure checks', () => {
    render(
      <ExposurePanel
        exposure={{
          restApiAvailable: true,
          userEnumeration: { open: false, total: 0, statusCode: 200, sample: null },
          settingsExposed: { open: false, statusCode: 200 },
          xmlrpc: { enabled: false, statusCode: 200 },
          robotsTxt: { available: true, statusCode: 200 },
          sitemapXml: { available: true, statusCode: 200 },
          uploads: { indexable: false, statusCode: 200 }
        }}
        homepageSecurityHeaders={{
          items: [
            {
              key: 'content-security-policy',
              label: 'Content Security Policy',
              description: 'Homepage response header',
              present: true,
              rawValue: "default-src 'self'"
            }
          ]
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Exposure checks' })).toBeInTheDocument();
  });

  it('exposes an accessible region for performance snapshot', () => {
    render(
      <PerformancePanel
        performance={{
          home: { endpoint: '/', ok: true, statusCode: 200, durationMs: 100 },
          wpJson: { endpoint: '/wp-json/', ok: true, statusCode: 200, durationMs: 120 },
          xmlrpc: { endpoint: '/xmlrpc.php', ok: false, statusCode: 405, durationMs: 90 },
          sitemap: { endpoint: '/sitemap.xml', ok: true, statusCode: 200, durationMs: 80 },
          robots: { endpoint: '/robots.txt', ok: true, statusCode: 200, durationMs: 60 }
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Performance snapshot' })).toBeInTheDocument();
  });

  it('exposes an accessible region for content footprint', () => {
    render(
      <ContentOverviewPanel
        overview={{
          collections: [
            { key: 'posts', label: 'Posts', endpoint: '/wp-json/wp/v2/posts', count: 12, durationMs: 100, ok: true }
          ],
          mediaBreakdown: [{ type: 'image/jpeg', count: 3 }]
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Content footprint' })).toBeInTheDocument();
  });

  it('exposes an accessible region for version hints', () => {
    render(
      <VersionPanel
        versions={{
          wordpress: { version: '6.5.1', status: 'current', minimum: '6.5' },
          plugins: [{ id: 'acf', label: 'ACF', version: '6.3.0', status: 'current', minimum: '6.2' }]
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Version & risk hints' })).toBeInTheDocument();
  });
});
