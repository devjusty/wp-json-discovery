import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HomepageSection from './HomepageSection.jsx';

describe('HomepageSection', () => {
  it('runs an idle homepage capability and retries failures', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <HomepageSection
        homepageDomain="example.com"
        capability={{ status: 'idle', result: null, error: null }}
        onRun={onRun}
        onRetry={onRetry}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Run homepage scan' }));
    expect(onRun).toHaveBeenCalledTimes(1);

    rerender(
      <HomepageSection
        homepageDomain="example.com"
        capability={{ status: 'failed', result: null, error: { message: 'Homepage request failed', retryable: true } }}
        onRun={onRun}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText('Homepage request failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry homepage scan' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('moves homepage summary details into the fetch section and keeps previews collapsed', async () => {
    render(
      <HomepageSection
        homepageDomain="example.com"
        capability={{
          status: 'success',
          result: {
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
          }
        }}
      />
    );

    expect(screen.getByRole('region', { name: 'Homepage fetch' })).toHaveTextContent('S200 · M1 · A1 · F1');

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
