import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onWordpressSettled } from './wordpressCapabilityOutcome.js';

describe('onWordpressSettled', () => {
  const ports = {
    isAuthenticated: true,
    upsertUnsupportedPlugin: vi.fn(),
    invalidateQueries: vi.fn(),
    logEvent: vi.fn(),
    toastError: vi.fn(),
    isActive: vi.fn(() => true)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ports.isActive.mockReturnValue(true);
  });

  it('persists unsupported namespaces and invalidates queries on success', async () => {
    ports.upsertUnsupportedPlugin.mockResolvedValue({});
    const result = {
      domain: 'example.com',
      metrics: {},
      core: [],
      plugins: {
        matched: [],
        unsupportedNamespaces: ['acme/v1']
      }
    };

    await onWordpressSettled(
      { status: 'success', result, error: null },
      { domain: 'example.com' },
      ports
    );

    expect(ports.upsertUnsupportedPlugin).toHaveBeenCalledWith({
      namespace: 'acme/v1',
      domain: 'example.com'
    });
    expect(ports.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['unsupportedPlugins'] });
    expect(ports.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recentUserScans'] });
    expect(ports.logEvent).toHaveBeenCalledWith(
      'scan.complete',
      expect.objectContaining({ domain: 'example.com' })
    );
  });

  it('logs failures without persistence', async () => {
    await onWordpressSettled(
      {
        status: 'failed',
        result: null,
        error: { code: 'auth_required', message: 'locked' }
      },
      { domain: 'example.com' },
      ports
    );

    expect(ports.upsertUnsupportedPlugin).not.toHaveBeenCalled();
    expect(ports.logEvent).toHaveBeenCalledWith(
      'scan.error',
      expect.objectContaining({
        domain: 'example.com',
        code: 'auth_required',
        message: 'Authentication required: REST API access is restricted on this site.'
      })
    );
  });

  it('skips success side effects when the session is no longer active', async () => {
    let resolvePersist;
    ports.upsertUnsupportedPlugin.mockReturnValue(new Promise((resolve) => {
      resolvePersist = resolve;
    }));
    ports.isActive.mockReturnValue(false);

    const settlePromise = onWordpressSettled(
      {
        status: 'success',
        result: {
          domain: 'example.com',
          metrics: {},
          core: [],
          plugins: { matched: [], unsupportedNamespaces: ['acme/v1'] }
        },
        error: null
      },
      { domain: 'example.com' },
      ports
    );
    resolvePersist({});
    await settlePromise;

    expect(ports.invalidateQueries).not.toHaveBeenCalled();
    expect(ports.logEvent).not.toHaveBeenCalled();
  });
});
