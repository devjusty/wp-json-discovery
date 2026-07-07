import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomepageInsightsPanel from './HomepageInsightsPanel.jsx';

describe('HomepageInsightsPanel', () => {
  it('renders empty-state copy and hides the HTML preview toggle when no insights exist', () => {
    render(
      <HomepageInsightsPanel
        insights={{
          meta: [],
          comments: [],
          assets: [],
          scripts: [],
          frameworks: [],
          other: []
        }}
      />
    );

    expect(screen.getByText('No framework hints detected.')).toBeInTheDocument();
    expect(screen.getByText('No plugin or theme asset paths detected.')).toBeInTheDocument();
    expect(screen.getByText('No meta tags captured from the homepage.')).toBeInTheDocument();
    expect(screen.getByText('No HTML comments detected.')).toBeInTheDocument();
    expect(screen.getByText('No script hints detected.')).toBeInTheDocument();
    expect(screen.getByText('No additional signals detected.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'HTML preview' })).not.toBeInTheDocument();
  });

  it('renders asset matches and the HTML preview toggle when signals exist', () => {
    render(
      <HomepageInsightsPanel
        insights={{
          meta: [{ name: 'generator', content: 'WordPress 6.8.1' }],
          comments: ['Cached by edge service'],
          assets: [
            {
              path: '/wp-content/plugins/akismet/akismet.php',
              count: 2,
              type: 'plugin',
              slug: 'akismet',
              matches: [
                {
                  id: 'akismet',
                  label: 'Akismet',
                  type: 'plugin',
                  slug: 'akismet'
                }
              ]
            }
          ],
          scripts: ['webpackJsonp'],
          frameworks: ['WordPress'],
          other: ['Cloudflare']
        }}
        htmlPreview="<html><body>preview</body></html>"
      />
    );

    expect(screen.getByText('WordPress')).toBeInTheDocument();
    expect(screen.getByText('/wp-content/plugins/akismet/akismet.php')).toBeInTheDocument();
    expect(screen.getByText('Akismet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HTML preview' })).toBeInTheDocument();
  });
});
