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
    },
    {
      name: 'non-WordPress result',
      capabilityStates: {
        wordpress: { status: 'failed', outcome: { status: 'failed', result: null, error: { message: 'Not WordPress' } } },
        homepage: { status: 'success', outcome: { status: 'success', result: {}, error: null } }
      }
    }
  ])('renders compact progress for $name', ({ capabilityStates }) => {
    render(<ScanStatusStack session={{ domain: { normalized: 'example.com' }, status: 'completed', capabilityStates }} />);

    expect(screen.getByRole('heading', { name: 'Scan progress' })).toBeInTheDocument();
    expect(screen.getByText('Identity')).toBeInTheDocument();
  });

  it('derives WordPress progress from capability state', () => {
    render(<ScanStatusStack session={{
      domain: { normalized: 'example.com' },
      status: 'completed',
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: {
            status: 'success',
            result: {
              identity: {
                value: 'WordPress',
                evidence: [{ id: 'wordpress-identity', capabilityId: 'wordpress', locator: '/wp-json/' }],
                evidenceLevel: 'observed'
              }
            },
            error: null
          }
        }
      }
    }} />);

    expect(screen.getAllByText('Complete')).toHaveLength(3);
  });

  it('keeps identity neutral when recognized identity metadata has no evidence references', () => {
    render(<ScanStatusStack session={{
      domain: { normalized: 'example.com' },
      status: 'completed',
      capabilityStates: {
        wordpress: {
          status: 'success',
          outcome: {
            status: 'success',
            result: { identity: { value: 'WordPress', evidenceLevel: 'observed', evidence: [] } },
            error: null
          }
        }
      }
    }} />);

    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('3 of 4 complete');
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

  it('uses stable investigator labels and retries runner-unavailable capabilities', () => {
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

    expect(screen.getByText('WordPress API')).toBeInTheDocument();
    expect(screen.getByText('Homepage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry homepage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry homepage/i })).toBeDisabled();
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

  it('retries retryable unavailable investigator capabilities', async () => {
    const retryCapability = vi.fn();
    const user = userEvent.setup();
    render(
      <ScanStatusStack
        session={{
          domain: { normalized: 'example.com' },
          status: 'completed',
          capabilityStates: {
            sitemap: { status: 'unavailable', outcome: { status: 'unavailable', result: null, error: { code: 'temporary', message: 'Try again', retryable: true } }, retry: { status: 'retryable' } }
          }
        }}
        onRetryCapability={retryCapability}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Retry Sitemap' }));
    expect(retryCapability).toHaveBeenCalledWith('sitemap');
  });
});
