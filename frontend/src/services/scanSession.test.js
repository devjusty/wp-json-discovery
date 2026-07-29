import { describe, expect, it, vi } from 'vitest';

import {
  createScanSession,
  executeScanSession,
  normalizeScanError,
  retryCapability
} from './scanSession.js';

describe('scan session', () => {
  it('runs independent wordpress and homepage scans concurrently and keeps partial success', async () => {
    let releaseWordpress;
    let releaseHomepage;
    const wordpress = vi.fn(() => new Promise((resolve) => {
      releaseWordpress = resolve;
    }));
    const homepage = vi.fn(() => new Promise((resolve, reject) => {
      releaseHomepage = reject;
    }));
    const changes = [];
    const session = createScanSession('example.com', {
      capabilityIds: ['homepage', 'wordpress']
    });

    const execution = executeScanSession(session, { wordpress, homepage }, (next) => changes.push(next));

    await vi.waitFor(() => {
      expect(wordpress).toHaveBeenCalledOnce();
      expect(homepage).toHaveBeenCalledOnce();
    });
    releaseWordpress({ namespaces: ['wp/v2'] });
    releaseHomepage(new Error('Homepage unreachable'));

    const completed = await execution;

    expect(completed.overallStatus).toBe('incomplete');
    expect(completed.capabilities.wordpress).toMatchObject({
      status: 'success',
      result: { namespaces: ['wp/v2'] },
      error: null
    });
    expect(completed.capabilities.homepage).toMatchObject({
      status: 'failed',
      result: null,
      error: {
        code: 'scan_failed',
        message: 'Homepage unreachable',
        retryable: true
      }
    });
    expect(changes.some((next) => next.capabilities.wordpress.status === 'running')).toBe(true);
    expect(changes.some((next) => next.capabilities.homepage.status === 'running')).toBe(true);
  });

  it('records synchronous runner throws as failed capabilities', async () => {
    const session = createScanSession('example.com', { capabilityIds: ['homepage'] });

    const completed = await executeScanSession(session, {
      wordpress: vi.fn().mockImplementation(() => {
        throw new Error('Synchronous WordPress failure');
      }),
      homepage: vi.fn().mockResolvedValue({ assets: [] })
    });

    expect(completed.overallStatus).toBe('incomplete');
    expect(completed.capabilities.wordpress).toEqual({
      status: 'failed',
      result: null,
      error: {
        code: 'scan_failed',
        message: 'Synchronous WordPress failure',
        retryable: true
      }
    });
    expect(completed.capabilities.homepage.status).toBe('success');
  });

  it('marks missing runners as unavailable instead of throwing', async () => {
    const session = createScanSession('example.com', { capabilityIds: ['homepage'] });

    const completed = await executeScanSession(session, { wordpress: vi.fn() });

    expect(completed.capabilities.homepage).toMatchObject({
      status: 'unavailable',
      error: { code: 'runner_unavailable', retryable: false }
    });
  });

  it('marks sitemap unavailable when its selected dependency fails without calling its runner', async () => {
    const wordpress = vi.fn().mockRejectedValue(new Error('WordPress unavailable'));
    const sitemap = vi.fn();
    const session = createScanSession('example.com', {
      capabilityIds: ['sitemap']
    }, {
      sitemap: ['wordpress']
    });

    const completed = await executeScanSession(session, { wordpress, sitemap });

    expect(sitemap).not.toHaveBeenCalled();
    expect(completed.capabilities.sitemap).toEqual({
      status: 'unavailable',
      result: null,
      error: {
        code: 'dependency_failed',
        message: 'Required scan did not complete.',
        retryable: false
      }
    });
  });

  it('normalizes scan errors into retryable session errors by default', () => {
    expect(normalizeScanError({ code: 'timeout', message: 'Request timed out', retryable: false })).toEqual({
      code: 'timeout',
      message: 'Request timed out',
      retryable: false
    });
    expect(normalizeScanError()).toEqual({
      code: 'scan_failed',
      message: 'Scan failed. Try again.',
      retryable: true
    });
  });

  it('retries only failed homepage capability while preserving wordpress success', async () => {
    const wordpress = vi.fn().mockResolvedValue({ namespaces: ['wp/v2'] });
    const homepage = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ assets: [] });
    const session = createScanSession('example.com', {
      capabilityIds: ['homepage']
    });
    const failed = await executeScanSession(session, { wordpress, homepage });

    const retried = await retryCapability(failed, 'homepage', { wordpress, homepage });

    expect(wordpress).toHaveBeenCalledOnce();
    expect(homepage).toHaveBeenCalledTimes(2);
    expect(retried.overallStatus).toBe('complete');
    expect(retried.capabilities.wordpress).toEqual(failed.capabilities.wordpress);
    expect(retried.capabilities.homepage).toEqual({
      status: 'success',
      result: { assets: [] },
      error: null
    });
  });

  it('returns idle state without updates or runners for inactive tokens', async () => {
    const onChange = vi.fn();
    const wordpress = vi.fn().mockResolvedValue({});
    const homepage = vi.fn().mockResolvedValue({});
    const session = createScanSession('example.com', { capabilityIds: ['homepage'] });

    const completed = await executeScanSession(session, {
      wordpress,
      homepage
    }, onChange, { active: false });

    expect(onChange).not.toHaveBeenCalled();
    expect(wordpress).not.toHaveBeenCalled();
    expect(homepage).not.toHaveBeenCalled();
    expect(completed.overallStatus).toBe('idle');
  });

  it('does not schedule dependent runners after its token becomes inactive', async () => {
    let releaseWordpress;
    const wordpress = vi.fn(() => new Promise((resolve) => {
      releaseWordpress = resolve;
    }));
    const sitemap = vi.fn();
    const onChange = vi.fn();
    const token = { active: true };
    const session = createScanSession('example.com', {
      capabilityIds: ['sitemap']
    }, {
      sitemap: ['wordpress']
    });

    const execution = executeScanSession(session, { wordpress, sitemap }, onChange, token);

    await vi.waitFor(() => {
      expect(wordpress).toHaveBeenCalledOnce();
    });
    const publishedBeforeInvalidation = onChange.mock.calls.length;
    token.active = false;
    releaseWordpress({ namespaces: ['wp/v2'] });

    await execution;

    expect(sitemap).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(publishedBeforeInvalidation);
  });

  it('does not mutate prior session state during execution', async () => {
    const session = createScanSession('example.com', { capabilityIds: ['homepage'] });
    const original = structuredClone(session);

    const completed = await executeScanSession(session, {
      wordpress: vi.fn().mockResolvedValue({}),
      homepage: vi.fn().mockResolvedValue({})
    });

    expect(session).toEqual(original);
    expect(completed).not.toBe(session);
    expect(completed.capabilities).not.toBe(session.capabilities);
  });
});
