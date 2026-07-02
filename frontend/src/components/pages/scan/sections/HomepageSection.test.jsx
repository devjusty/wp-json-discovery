import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import HomepageSection from './HomepageSection.jsx';

describe('HomepageSection', () => {
  it('moves homepage summary details into the fetch section and keeps previews collapsed', async () => {
    render(
      <HomepageSection
        homepageDomain="example.com"
        homepageSummary="S200 · M3 · A12 · F1"
        homepageResult={{
          source: {
            statusCode: 200,
            finalUrl: 'https://example.com/',
            contentType: 'text/html',
            sizeBytes: 2048,
            durationMs: 321,
            redirects: 0,
            truncated: false,
            ok: true
          },
          insights: {
            meta: ['generator'],
            comments: ['sample comment'],
            assets: [
              {
                path: '/wp-content/plugins/example/style.css',
                count: 1,
                type: 'plugin',
                slug: 'example',
                matches: []
              }
            ],
            scripts: [],
            frameworks: ['WordPress'],
            other: []
          },
          htmlPreview: '<html>preview</html>',
          securityHeaders: {}
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Homepage fetch' })).toHaveTextContent('S200 · M3 · A12 · F1');

    expect(screen.getByRole('button', { name: 'Raw JSON' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Raw JSON' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'HTML preview' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'HTML preview' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Raw JSON' }));
    expect(screen.getByRole('region', { name: 'Raw JSON' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'HTML preview' }));
    expect(screen.getByRole('region', { name: 'HTML preview' })).toBeInTheDocument();
  });
});
