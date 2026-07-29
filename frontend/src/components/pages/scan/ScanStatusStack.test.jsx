import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScanStatusStack from './ScanStatusStack.jsx';

describe('ScanStatusStack', () => {
  it('shows session and per-capability state while partial results are available', () => {
    render(
      <ScanStatusStack
        session={{
          domain: 'example.com',
          overallStatus: 'running',
          capabilities: {
            wordpress: { status: 'success', result: {}, error: null },
            homepage: { status: 'running', result: null, error: null },
            sitemap: { status: 'unavailable', result: null, error: { message: 'Sitemap dependency failed.' } },
            other: { status: 'idle', result: null, error: null }
          }
        }}
      />
    );

    expect(screen.getByText('Scanning example.com…')).toBeInTheDocument();
    expect(screen.getByText('WordPress API: Success')).toBeInTheDocument();
    expect(screen.getByText('Homepage: Running')).toBeInTheDocument();
    expect(screen.getByText('Sitemap: Unavailable')).toBeInTheDocument();
    expect(screen.getByText('other: Not run')).toBeInTheDocument();
  });

  it('renders auth hints when scan requires auth', () => {
    render(
      <ScanStatusStack
        session={{
          domain: 'example.com',
          overallStatus: 'incomplete',
          capabilities: {
            wordpress: {
              status: 'failed',
              result: null,
              error: { code: 'auth_required', message: 'Authentication required', retryable: true }
            }
          }
        }}
      />
    );

    expect(screen.getByText('Authentication required')).toBeInTheDocument();
    expect(screen.getByText(/requires application passwords/i)).toBeInTheDocument();
  });

  it('retries retryable capability failures', async () => {
    const retryCapability = vi.fn();
    const user = userEvent.setup();
    render(
      <ScanStatusStack
        session={{
          domain: 'example.com',
          overallStatus: 'incomplete',
          capabilities: {
            homepage: {
              status: 'failed',
              result: null,
              error: { message: 'Homepage request failed', retryable: true }
            }
          }
        }}
        onRetryCapability={retryCapability}
      />
    );

    expect(screen.getByText('Homepage request failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry Homepage' }));
    expect(retryCapability).toHaveBeenCalledWith('homepage');
  });
});
