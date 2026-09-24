import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScanStatusStack from './ScanStatusStack';

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

  it.each([
    {
      name: 'homepage-only success',
      capabilityStates: {
        homepage: { status: 'success', outcome: { status: 'success', result: {}, error: null } }
      }
    },
    {
      name: 'wordpress success without identity',
      capabilityStates: {
        wordpress: { status: 'success', outcome: { status: 'success', result: {}, error: null } }
      }
    }
  ])('does not render progress for successful-only $name (progress lives in DomainForm)', ({ capabilityStates }) => {
    const { container } = render(<ScanStatusStack session={{ domain: { normalized: 'example.com' }, status: 'completed', capabilityStates }} />);

    expect(screen.queryByRole('heading', { name: 'Scan progress' })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('ignores malformed canonical capability state data', () => {
    expect(() => render(<ScanStatusStack session={{ domain: { normalized: 'example.com' }, capabilityStates: { broken: null, invalid: 'state' } }} />)).not.toThrow();
    expect(screen.queryByRole('heading', { name: 'Scan progress' })).not.toBeInTheDocument();
  });

  it('surfaces failed capability alerts without embedding progress', () => {
    render(<ScanStatusStack session={{
      domain: { normalized: 'example.com' },
      status: 'completed',
      capabilityStates: {
        wordpress: {
          status: 'failed',
          outcome: {
            status: 'failed',
            result: null,
            error: { message: 'Not WordPress', retryable: false }
          }
        }
      }
    }} />);

    expect(screen.queryByRole('heading', { name: 'Scan progress' })).not.toBeInTheDocument();
    expect(screen.getByText(/WordPress API: Failed/i)).toBeInTheDocument();
    expect(screen.getByText('Not WordPress')).toBeInTheDocument();
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

  it('does not retry legacy failures with malformed retryable metadata', () => {
    render(
      <ScanStatusStack
        session={{
          domain: 'example.com',
          overallStatus: 'incomplete',
          capabilities: {
            homepage: {
              status: 'failed',
              result: null,
              error: { message: 'Malformed retry metadata', retryable: 'true' }
            }
          }
        }}
      />
    );

    expect(screen.queryByRole('button', { name: 'Retry Homepage' })).not.toBeInTheDocument();
  });

  it('uses stable investigator labels without retrying unavailable capabilities', () => {
    render(
      <ScanStatusStack
        session={{
          domain: { normalized: 'example.com' },
          status: 'completed',
          capabilityStates: {
            wordpress: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } },
            homepage: { status: 'unavailable', outcome: { status: 'unavailable', result: null, error: { code: 'runner_unavailable', message: 'No homepage runner', retryable: true } }, retry: { status: 'not-retryable' } }
          }
        }}
        retryingCapabilityId="homepage"
      />
    );

    expect(screen.getByText(/Homepage: Unavailable/i)).toBeInTheDocument();
    expect(screen.getByText('No homepage runner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry homepage/i })).not.toBeInTheDocument();
  });

  it('does not infer retryability from unavailable status', () => {
    render(
      <ScanStatusStack
        session={{
          domain: { normalized: 'example.com' },
          status: 'completed',
          capabilityStates: {
            sitemap: { status: 'unavailable', outcome: { status: 'unavailable', result: null, error: { code: 'dependency_unavailable', message: 'Dependency unavailable', retryable: false } }, retry: { status: 'not-retryable' } }
          }
        }}
      />
    );

    expect(screen.queryByRole('button', { name: /retry sitemap/i })).not.toBeInTheDocument();
  });

  it('requires retryable metadata to be the canonical boolean true', () => {
    render(
      <ScanStatusStack
        session={{
          domain: { normalized: 'example.com' },
          status: 'completed',
          capabilityStates: {
            homepage: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'malformed', message: 'Malformed retry metadata', retryable: 'true' } }, retry: { status: 'not-retryable' } }
          }
        }}
      />
    );

    expect(screen.queryByRole('button', { name: /retry homepage/i })).not.toBeInTheDocument();
  });

  it('does not retry unavailable investigator capabilities even with retryable error metadata', () => {
    render(
      <ScanStatusStack
        session={{
          domain: { normalized: 'example.com' },
          status: 'completed',
          capabilityStates: {
            sitemap: { status: 'unavailable', outcome: { status: 'unavailable', result: null, error: { code: 'temporary', message: 'Try again', retryable: true } }, retry: { status: 'retryable' } }
          }
        }}
      />
    );

    expect(screen.queryByRole('button', { name: 'Retry Sitemap' })).not.toBeInTheDocument();
  });
});
