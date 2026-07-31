import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCapabilityDependencies: vi.fn(() => ({ wordpress: [], homepage: [] })),
  getCapabilityRunners: vi.fn(),
  logEvent: vi.fn(),
  onWordpressSettled: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: false })
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: mocks.toastError,
    success: mocks.toastSuccess
  }
}));

vi.mock('../api/client.js', () => ({
  upsertUnsupportedPlugin: vi.fn()
}));

vi.mock('../services/logger.js', () => ({
  logEvent: mocks.logEvent
}));

vi.mock('../services/scanCapabilities.js', () => ({
  getCapabilityDependencies: mocks.getCapabilityDependencies,
  getCapabilityRunners: mocks.getCapabilityRunners,
  normalizeSelection(selection = {}) {
    const capabilityIds = Array.from(new Set([
      ...(selection.capabilityIds ?? []),
      'wordpress'
    ])).sort();
    return {
      capabilityIds,
      options: Object.fromEntries(capabilityIds.map((id) => [id, selection.options?.[id] ?? {}]))
    };
  },
  getCapabilityById(id) {
    if (id === 'homepage') {
      return { id, availability: () => true };
    }
    if (id === 'wordpress') {
      return {
        id,
        availability: () => true,
        onSettled: mocks.onWordpressSettled
      };
    }
    return null;
  }
}));

const { mergeSession, useScan } = await import('./useScan.js');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('useScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCapabilityDependencies.mockReturnValue({ wordpress: [], homepage: [] });
  });

  it('coordinates selected independent wordpress and homepage results into a complete session', async () => {
    const wordpress = vi.fn().mockResolvedValue({ site: 'wordpress' });
    const homepage = vi.fn().mockResolvedValue({ assets: ['app.js'] });
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['wordpress', 'homepage'] });
    });

    await waitFor(() => {
      expect(result.current.session?.overallStatus).toBe('complete');
    });

    expect(wordpress).toHaveBeenCalledWith({ domain: 'example.com', options: {} });
    expect(homepage).toHaveBeenCalledWith({ domain: 'example.com', options: {} });
    expect(result.current.session.capabilities).toMatchObject({
      wordpress: { status: 'success', result: { site: 'wordpress' } },
      homepage: { status: 'success', result: { assets: ['app.js'] } }
    });
    for (const key of ['scanResult', 'scanError']) {
      expect(result.current).not.toHaveProperty(key);
    }
  });

  it('does not let a late prior-domain session overwrite a newer session', async () => {
    const firstWordpress = createDeferred();
    const firstHomepage = createDeferred();
    const secondWordpress = createDeferred();
    const secondHomepage = createDeferred();
    const wordpress = vi.fn(({ domain }) => (
      domain === 'first.example' ? firstWordpress.promise : secondWordpress.promise
    ));
    const homepage = vi.fn(({ domain }) => (
      domain === 'first.example' ? firstHomepage.promise : secondHomepage.promise
    ));
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('first.example', { capabilityIds: ['wordpress', 'homepage'] });
      result.current.startScan('second.example', { capabilityIds: ['wordpress', 'homepage'] });
    });

    await waitFor(() => {
      expect(wordpress).toHaveBeenCalledTimes(2);
      expect(homepage).toHaveBeenCalledTimes(2);
    });
    secondWordpress.resolve({ domain: 'second.example', source: 'wordpress' });
    secondHomepage.resolve({ domain: 'second.example', source: 'homepage' });

    await waitFor(() => {
      expect(result.current.session?.overallStatus).toBe('complete');
    });
    firstWordpress.resolve({ domain: 'first.example', source: 'wordpress' });
    firstHomepage.resolve({ domain: 'first.example', source: 'homepage' });

    await waitFor(() => {
      expect(result.current.session.domain).toBe('second.example');
    });
    expect(result.current.session.capabilities.wordpress.result).toEqual({
      domain: 'second.example',
      source: 'wordpress'
    });
  });

  it('keeps a sibling completion when a targeted capability finishes later', async () => {
    const wordpressDeferred = createDeferred();
    const homepageDeferred = createDeferred();
    const wordpress = vi.fn().mockReturnValue(wordpressDeferred.promise);
    const homepage = vi.fn().mockReturnValue(homepageDeferred.promise);
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['wordpress'] });
    });
    await waitFor(() => {
      expect(wordpress).toHaveBeenCalledOnce();
    });

    act(() => {
      result.current.runCapability('homepage');
    });
    await waitFor(() => {
      expect(homepage).toHaveBeenCalledOnce();
    });

    wordpressDeferred.resolve({ source: 'wordpress' });
    await waitFor(() => {
      expect(result.current.session.capabilities.wordpress).toMatchObject({
        status: 'success',
        result: { source: 'wordpress' }
      });
    });
    homepageDeferred.resolve({ source: 'homepage' });

    await waitFor(() => {
      expect(result.current.session.capabilities.homepage).toMatchObject({
        status: 'success',
        result: { source: 'homepage' }
      });
    });
    expect(result.current.session.capabilities.wordpress).toMatchObject({
      status: 'success',
      result: { source: 'wordpress' }
    });
    expect(result.current.session.capabilities.homepage).toMatchObject({
      status: 'success',
      result: { source: 'homepage' }
    });
  });

  it('replaces same-domain optional capability state on a new scan selection', async () => {
    const wordpress = vi.fn().mockResolvedValue({ source: 'wordpress' });
    const homepage = vi.fn().mockResolvedValue({ source: 'homepage' });
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['wordpress', 'homepage'] });
    });
    await waitFor(() => {
      expect(result.current.session?.overallStatus).toBe('complete');
    });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['wordpress'] });
    });
    await waitFor(() => {
      expect(result.current.session?.selection.capabilityIds).toEqual(['wordpress']);
    });
    expect(result.current.session.capabilities.homepage).toBeUndefined();

    act(() => {
      result.current.runCapability('homepage');
    });
    await waitFor(() => {
      expect(homepage).toHaveBeenCalledTimes(2);
    });
  });

  it('reruns a completed selected capability with updated options', async () => {
    const wordpress = vi.fn().mockResolvedValue({ source: 'wordpress' });
    const homepage = vi.fn().mockResolvedValue({ source: 'homepage' });
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['wordpress', 'homepage'] });
    });
    await waitFor(() => {
      expect(result.current.session?.capabilities.homepage.status).toBe('success');
    });

    act(() => {
      result.current.runCapability('homepage', { refresh: true });
    });
    await waitFor(() => {
      expect(homepage).toHaveBeenCalledTimes(2);
    });
    expect(homepage).toHaveBeenLastCalledWith({ domain: 'example.com', options: { refresh: true } });
  });

  it('preserves running and successful siblings while rerunning one capability', async () => {
    const homepage = vi.fn().mockResolvedValue({ source: 'homepage' });
    const wordpress = vi.fn().mockResolvedValue({ source: 'wordpress' });
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['homepage', 'wordpress'] });
    });
    await waitFor(() => expect(result.current.session?.capabilities.homepage.status).toBe('success'));

    const sibling = result.current.session.capabilities.wordpress;
    sibling.status = 'running';

    act(() => {
      result.current.runCapability('homepage');
    });
    await waitFor(() => expect(result.current.session?.capabilities.homepage.status).toBe('success'));
    expect(result.current.session.capabilities.wordpress).toMatchObject({ status: 'running' });
    expect(result.current.session.capabilities.homepage).toMatchObject({
      status: 'success',
      result: { source: 'homepage' }
    });
  });

  it('keeps a running sibling during an overlapping stale execution completion', () => {
    const current = {
      domain: 'example.com',
      selection: { capabilityIds: ['homepage', 'wordpress'], options: {} },
      capabilities: {
        wordpress: { status: 'running', result: null, error: null },
        homepage: { status: 'running', result: null, error: null }
      }
    };
    const staleWordpressCompletion = {
      ...current,
      capabilities: {
        wordpress: { status: 'success', result: { source: 'wordpress' }, error: null },
        homepage: { status: 'idle', result: null, error: null }
      }
    };

    const afterWordpress = mergeSession(current, staleWordpressCompletion, ['wordpress']);

    expect(afterWordpress.capabilities.homepage).toEqual({
      status: 'running',
      result: null,
      error: null
    });
    const homepageCompletion = {
      ...staleWordpressCompletion,
      capabilities: {
        ...staleWordpressCompletion.capabilities,
        homepage: { status: 'success', result: { source: 'homepage' }, error: null }
      }
    };

    expect(mergeSession(afterWordpress, homepageCompletion, ['homepage']).capabilities.homepage).toEqual({
      status: 'success',
      result: { source: 'homepage' },
      error: null
    });
  });

  it('invokes Capability Outcomes with injected ports when a Capability settles', async () => {
    const wordpress = vi.fn().mockResolvedValue({
      domain: 'example.com',
      plugins: { matched: [], unsupportedNamespaces: [] }
    });
    const homepage = vi.fn().mockResolvedValue({ assets: [] });
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    mocks.onWordpressSettled.mockResolvedValue(undefined);
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['wordpress', 'homepage'] });
    });

    await waitFor(() => {
      expect(result.current.session?.overallStatus).toBe('complete');
    });

    await waitFor(() => {
      expect(mocks.onWordpressSettled).toHaveBeenCalledTimes(1);
    });

    const [state, settledSession, ports] = mocks.onWordpressSettled.mock.calls[0];
    expect(state).toMatchObject({
      status: 'success',
      result: { domain: 'example.com' }
    });
    expect(settledSession.domain).toBe('example.com');
    expect(ports).toEqual(expect.objectContaining({
      isAuthenticated: false,
      upsertUnsupportedPlugin: expect.any(Function),
      invalidateQueries: expect.any(Function),
      logEvent: mocks.logEvent,
      toastError: expect.any(Function),
      isActive: expect.any(Function)
    }));
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Scan complete for example.com');
  });

  it('fires one Session completion notice per execute batch and suppresses superseded batches', async () => {
    const firstWordpress = createDeferred();
    const secondWordpress = createDeferred();
    const wordpress = vi.fn(({ domain }) => (
      domain === 'first.example' ? firstWordpress.promise : secondWordpress.promise
    ));
    const homepage = vi.fn().mockResolvedValue({ assets: [] });
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('first.example', { capabilityIds: ['wordpress', 'homepage'] });
      result.current.startScan('second.example', { capabilityIds: ['wordpress', 'homepage'] });
    });

    secondWordpress.resolve({ domain: 'second.example', plugins: { matched: [], unsupportedNamespaces: [] } });
    await waitFor(() => {
      expect(result.current.session?.domain).toBe('second.example');
      expect(result.current.session?.overallStatus).toBe('complete');
    });

    firstWordpress.resolve({ domain: 'first.example', plugins: { matched: [], unsupportedNamespaces: [] } });
    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Scan complete for second.example');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('summarizes failed Capabilities in the Session completion notice', async () => {
    const wordpress = vi.fn().mockRejectedValue({
      code: 'auth_required',
      message: 'locked'
    });
    const homepage = vi.fn().mockResolvedValue({ assets: [] });
    mocks.getCapabilityRunners.mockReturnValue({ wordpress, homepage });
    const { result } = renderHook(() => useScan(), { wrapper: createWrapper() });

    act(() => {
      result.current.startScan('example.com', { capabilityIds: ['wordpress', 'homepage'] });
    });

    await waitFor(() => {
      expect(result.current.session?.overallStatus).toBe('incomplete');
    });
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Authentication required: REST API access is restricted on this site.'
      );
    });
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
