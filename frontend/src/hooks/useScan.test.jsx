import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCapabilityDependencies: vi.fn(() => ({ wordpress: [], homepage: [] })),
  getCapabilityRunners: vi.fn(),
  logEvent: vi.fn(),
  rotateActivityLog: vi.fn(),
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
  logEvent: mocks.logEvent,
  rotateActivityLog: mocks.rotateActivityLog
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
    return id === 'homepage' ? { id, availability: () => true } : null;
  }
}));

const { useScan } = await import('./useScan.js');

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
});
