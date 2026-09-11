import { describe, expect, it, vi } from 'vitest';

import {
  createScanSession,
  executeScanSession,
  normalizeScanError,
  retryCapability,
  validateSessionSnapshot
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

  it('passes execution-only domain identity to runners without changing session shape', async () => {
    const wordpress = vi.fn().mockResolvedValue({ namespaces: ['wp/v2'] });
    const domainIdentity = {
      submitted: 'https://Example.com/path',
      normalized: 'example.com'
    };
    const session = createScanSession('example.com', { capabilityIds: ['wordpress'] }, {}, domainIdentity);

    await executeScanSession(session, { wordpress });

    expect(wordpress).toHaveBeenCalledWith({
      domain: 'example.com',
      domainIdentity,
      options: {}
    });
    expect(Object.keys(session)).not.toContain('domainIdentity');
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

  it('retries an unavailable capability when its runner becomes available', async () => {
    const session = createScanSession('example.com', { capabilityIds: ['homepage'] });
    const unavailable = await executeScanSession(session, {});
    const retried = await retryCapability(unavailable, 'homepage', {
      homepage: vi.fn().mockResolvedValue({ assets: [] })
    });

    expect(retried.capabilities.homepage).toMatchObject({
      status: 'success',
      result: { assets: [] },
      error: null
    });
  });

  it('marks sitemap unavailable when its selected dependency fails without calling its runner', async () => {
    const wordpress = vi.fn().mockRejectedValue(new Error('WordPress unavailable'));
    const sitemap = vi.fn();
    const session = createScanSession('example.com', {
      capabilityIds: ['sitemap', 'wordpress']
    }, {
      sitemap: ['wordpress']
    });

    const completed = await executeScanSession(session, { wordpress, sitemap });

    expect(wordpress).toHaveBeenCalledOnce();
    expect(completed.capabilities.wordpress).toMatchObject({
      status: 'failed',
      error: {
        code: 'scan_failed',
        message: 'WordPress unavailable',
        retryable: true
      }
    });
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

  it('recovers failed dependency before retrying unavailable capability', async () => {
    const wordpress = vi.fn()
      .mockRejectedValueOnce(new Error('WordPress unavailable'))
      .mockResolvedValueOnce({ namespaces: ['wp/v2'] });
    const sitemap = vi.fn().mockResolvedValue({ urls: ['/'] });
    const session = createScanSession('example.com', {
      capabilityIds: ['sitemap', 'wordpress']
    }, {
      sitemap: ['wordpress']
    });
    const failed = await executeScanSession(session, { wordpress, sitemap });

    expect(failed.capabilities.wordpress).toMatchObject({
      status: 'failed',
      error: { message: 'WordPress unavailable' }
    });
    expect(failed.capabilities.sitemap).toMatchObject({
      status: 'unavailable',
      error: { code: 'dependency_failed', retryable: false }
    });

    const recovered = await retryCapability(failed, 'wordpress', { wordpress, sitemap });
    const retried = await retryCapability(recovered, 'sitemap', { wordpress, sitemap });

    expect(wordpress).toHaveBeenCalledTimes(2);
    expect(sitemap).toHaveBeenCalledOnce();
    expect(retried.capabilities.sitemap).toMatchObject({
      status: 'success',
      result: { urls: ['/'] },
      error: null
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

  it('reports malformed contract data instead of treating legacy session data as valid', () => {
    const validation = validateSessionSnapshot({ status: 'running' });

    expect(validation.success).toBe(false);
    expect(validation.error).toBeInstanceOf(Error);
  });

  it('validates redesigned snapshots at the migration boundary', () => {
    const validation = validateSessionSnapshot({
      id: 'session-1',
      investigationId: 'investigation-1',
      status: 'completed',
      startedAt: '2026-09-09T12:00:00.000Z',
      completedAt: '2026-09-09T12:00:00.000Z',
      selectedCapabilities: [],
      capabilityStates: {},
      overall: { status: 'complete' }
    });

    expect(validation).toMatchObject({ success: true, format: 'contract' });
  });

  it('rejects malformed contract data at session execution boundary', async () => {
    await expect(executeScanSession({ status: 'running' }, {})).rejects.toMatchObject({
      code: 'invalid_session_snapshot'
    });
  });

  it('accepts stale result and error payloads on running legacy capabilities', async () => {
    const session = createScanSession('example.com', { capabilityIds: ['homepage'] });
    session.overallStatus = 'running';
    session.capabilities.homepage = {
      status: 'running',
      result: { stale: true },
      error: { code: 'stale', message: 'Stale error', retryable: true }
    };
    session.capabilities.wordpress = {
      status: 'success',
      result: { namespaces: [] },
      error: null
    };

    const validation = validateSessionSnapshot(session);
    const accepted = await executeScanSession(session, {});

    expect(validation).toMatchObject({ success: true, format: 'legacy' });
    expect(accepted.capabilities.homepage).toEqual(session.capabilities.homepage);
  });

  it('rejects malformed legacy snapshots with explicit validation failure', async () => {
    const malformedSession = {
      domain: 'example.com',
      selection: { capabilityIds: ['homepage'], options: {} },
      dependencies: {},
      overallStatus: 'idle',
      capabilities: { homepage: { status: 'idle' } }
    };

    const validation = validateSessionSnapshot(malformedSession);

    expect(validation.success).toBe(false);
    expect(validation.error).toBeInstanceOf(Error);
    await expect(executeScanSession(malformedSession, {})).rejects.toMatchObject({
      code: 'invalid_session_snapshot'
    });
  });

  it.each([
    ['numeric capability IDs', 42],
    ['object capability IDs', {}],
  ])('rejects %s with explicit invalid session failure', async (_label, capabilityIds) => {
    const malformedSession = {
      domain: 'example.com',
      selection: { capabilityIds, options: {} },
      dependencies: {},
      overallStatus: 'idle',
      capabilities: {}
    };

    const validation = validateSessionSnapshot(malformedSession);

    expect(validation.success).toBe(false);
    expect(validation.error).toBeInstanceOf(Error);
    await expect(executeScanSession(malformedSession, {})).rejects.toMatchObject({
      code: 'invalid_session_snapshot'
    });
  });

  it.each([
    ['idle capability with result and error', (session) => {
      session.capabilities.homepage = {
        status: 'idle',
        result: { stale: true },
        error: { code: 'stale', message: 'Stale error', retryable: true }
      };
    }],
    ['failed capability with null error', (session) => {
      session.capabilities.homepage = { status: 'failed', result: null, error: null };
    }],
    ['dependency outside selected capabilities', (session) => {
      session.dependencies.sitemap = ['recon'];
    }],
    ['extra capability key', (session) => {
      session.capabilities.recon = { status: 'idle', result: null, error: null };
    }],
    ['extra dependency key', (session) => {
      session.dependencies.recon = [];
    }]
  ])('rejects %s with explicit invalid session failure', async (_label, mutate) => {
    const malformedSession = createScanSession('example.com', {
      capabilityIds: ['homepage'],
      options: {}
    }, {
      sitemap: ['wordpress']
    });
    mutate(malformedSession);

    const validation = validateSessionSnapshot(malformedSession);

    expect(validation.success).toBe(false);
    await expect(executeScanSession(malformedSession, {})).rejects.toMatchObject({
      code: 'invalid_session_snapshot'
    });
  });
});
