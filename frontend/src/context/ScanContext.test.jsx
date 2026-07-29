import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ScanProvider,
  useScanResultsContext,
  useScanShellContext
} from './ScanContext.jsx';

const mocks = vi.hoisted(() => ({
  loadScanPreferences: vi.fn(),
  saveScanPreferences: vi.fn((selection) => selection),
  startHomepageScan: vi.fn(),
  useHomepageScan: vi.fn(),
  useScan: vi.fn()
}));

vi.mock('../hooks/useScan.js', () => ({
  useScan: mocks.useScan
}));

vi.mock('../hooks/useHomepageScan.js', () => ({
  useHomepageScan: mocks.useHomepageScan
}));

vi.mock('../services/scanPreferences.js', () => ({
  loadScanPreferences: mocks.loadScanPreferences,
  saveScanPreferences: mocks.saveScanPreferences
}));

function createCoordinator(overrides = {}) {
  return {
    activeDomain: '',
    isRotatingLogs: false,
    rotateLogs: vi.fn(),
    runCapability: vi.fn(),
    retryCapability: vi.fn(),
    session: null,
    startScan: vi.fn(),
    ...overrides
  };
}

function wrapper({ children }) {
  return <ScanProvider>{children}</ScanProvider>;
}

function useScanContext() {
  return {
    results: useScanResultsContext(),
    shell: useScanShellContext()
  };
}

describe('ScanProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadScanPreferences.mockReturnValue({
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    });
    mocks.useHomepageScan.mockReturnValue({ startHomepageScan: mocks.startHomepageScan });
    mocks.useScan.mockReturnValue(createCoordinator());
  });

  it.each([
    ['recommended fallback', {
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    }],
    ['stored settings', {
      capabilityIds: ['sitemap', 'wordpress'],
      options: { sitemap: { sitemapUrl: '/site.xml', maxPages: 10 }, wordpress: {} }
    }]
  ])('initializes editable settings from %s', (_source, selection) => {
    mocks.loadScanPreferences.mockReturnValue(selection);

    const { result } = renderHook(useScanContext, { wrapper });

    expect(result.current.results.scanSettings).toEqual(selection);
  });

  it('normalizes editable settings before saving defaults', () => {
    const { result } = renderHook(useScanContext, { wrapper });

    act(() => {
      result.current.results.updateScanSettings((current) => ({
        ...current,
        capabilityIds: ['sitemap', 'unknown'],
        options: {
          sitemap: { sitemapUrl: ' /site.xml ', maxPages: 99 }
        }
      }));
    });
    act(() => {
      result.current.results.saveScanDefaults();
    });

    expect(mocks.saveScanPreferences).toHaveBeenCalledWith({
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        sitemap: { sitemapUrl: '/site.xml', maxPages: 50 },
        wordpress: {}
      }
    });
    expect(result.current.results.scanSettings).toEqual({
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        sitemap: { sitemapUrl: '/site.xml', maxPages: 50 },
        wordpress: {}
      }
    });
  });

  it('starts coordinator with a settings snapshot without legacy homepage automation', () => {
    const coordinator = createCoordinator();
    mocks.useScan.mockReturnValue(coordinator);
    const { result } = renderHook(useScanContext, { wrapper });

    act(() => {
      result.current.shell.startScan('example.com');
    });

    expect(coordinator.startScan).toHaveBeenCalledWith('example.com', {
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    });
    expect(mocks.useHomepageScan).not.toHaveBeenCalled();
    expect(mocks.startHomepageScan).not.toHaveBeenCalled();
  });

  it('derives legacy core and homepage values from the current session', () => {
    const wordpressError = { message: 'WordPress failed' };
    const homepageError = { message: 'Homepage failed' };
    const session = {
      domain: 'example.com',
      overallStatus: 'running',
      capabilities: {
        wordpress: { status: 'running', result: { summary: {} }, error: wordpressError },
        homepage: { status: 'queued', result: { insights: {} }, error: homepageError }
      }
    };
    mocks.useScan.mockReturnValue(createCoordinator({ activeDomain: 'example.com', session }));

    const { result } = renderHook(useScanContext, { wrapper });

    expect(result.current.results).toMatchObject({
      session,
      scanResult: { summary: {} },
      isScanning: true,
      scanError: wordpressError,
      homepageResult: { insights: {} },
      homepageIsRunning: true,
      homepageError
    });
    expect(result.current.shell.activeDomain).toBe('example.com');
  });

  it('keeps the legacy scan busy while homepage work is still running', () => {
    const session = {
      domain: 'example.com',
      overallStatus: 'running',
      capabilities: {
        wordpress: { status: 'success', result: { summary: {} }, error: null },
        homepage: { status: 'running', result: null, error: null }
      }
    };
    mocks.useScan.mockReturnValue(createCoordinator({ activeDomain: 'example.com', session }));

    const { result } = renderHook(useScanContext, { wrapper });

    expect(result.current.results.isScanning).toBe(true);
  });
});
