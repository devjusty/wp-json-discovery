import { describe, expect, it, vi } from 'vitest';
import { scanSessionSchema } from '@wp-json-discovery/contracts';
import { createInvestigation } from '../domain/investigation/model.ts';
import { loadAuthenticatedInvestigationId } from './anonymousInvestigations.js';

import {
  createInvestigationSession,
  addInvestigationCapability,
  getContextualCapabilityIds,
  getInvestigatorSelection,
  recoverInvestigationSession,
  retryInvestigationCapability,
  runInvestigationSession,
  createInvestigatorWorkflow
} from './investigationSession.js';

const session = createInvestigationSession({
  investigationId: 'inv-1',
  domain: { submitted: 'Example.com', normalized: 'https://example.com' },
  selection: { capabilityIds: ['wordpress', 'homepage'] }
});

const runners = {
  wordpress: vi.fn().mockResolvedValue({ exposure: { status: 'observed' } }),
  homepage: vi.fn().mockResolvedValue({ assets: [] })
};

describe('investigation session', () => {
  it('normalizes submitted identity while retaining domain and redirects in workflow read model', async () => {
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => null, getAccessToken: async () => null },
      runner: { run: async () => ({ findings: [] }) },
      localStore: memoryStore(),
      remoteStore: memoryStore(),
      normalize: () => 'https://example.com',
      redirectChain: ['https://example.com/start', 'https://example.com'],
    });

    const result = await workflow.start(' Example.com/start ');

    expect(result.investigation).toMatchObject({
      submittedUrl: ' Example.com/start ',
      normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com/start', 'https://example.com'],
    });
  });

  it('maps URL-shaped authenticated input to one submitted and normalized identity', async () => {
    const remoteStart = vi.fn(async (domain) => createInvestigation({
      id: 'auth-url',
      submittedUrl: domain.submitted,
      normalizedUrl: domain.normalized,
      redirectChain: [domain.normalized],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [],
    }));
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: memoryStore(),
      remoteStore: memoryStore(),
      remoteStart,
    });

    const result = await workflow.start('https://www.Example.com/');

    expect(remoteStart).toHaveBeenCalledWith({
      submitted: 'https://www.Example.com/',
      normalized: 'example.com',
    }, expect.any(Array), ['example.com']);
    expect(result.investigation).toMatchObject({
      submittedUrl: 'https://www.Example.com/',
      normalizedUrl: 'example.com',
    });
  });

  it.each([
    'https://www.Example.com/wp-json/?context=view',
    'http://WWW.Example.com/path?query=value',
  ])('normalizes URL-shaped authenticated identity to hostname for %s', async (submittedUrl) => {
    const remoteStart = vi.fn(async (domain) => createInvestigation({
      id: 'auth-url-with-path',
      submittedUrl: domain.submitted,
      normalizedUrl: domain.normalized,
      redirectChain: [domain.normalized],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [],
    }));
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: memoryStore(),
      remoteStore: memoryStore(),
      remoteStart,
    });

    const result = await workflow.start(submittedUrl);

    expect(remoteStart).toHaveBeenCalledWith({
      submitted: submittedUrl,
      normalized: 'example.com',
    }, expect.any(Array), ['example.com']);
    expect(result.investigation).toMatchObject({
      submittedUrl,
      normalizedUrl: 'example.com',
      redirectChain: ['example.com'],
    });
  });

  it('rejects malformed URL-shaped authenticated input before remote allocation', async () => {
    const remoteStart = vi.fn();
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: memoryStore(),
      remoteStore: memoryStore(),
      remoteStart,
    });

    await expect(workflow.start('https://[malformed')).rejects.toMatchObject({ code: 'invalid-command' });
    expect(remoteStart).not.toHaveBeenCalled();
  });

  it('exposes command callbacks and read model without leaking persistence details', async () => {
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => null, getAccessToken: async () => null },
      runner: { run: async ({ capability }) => ({ capability, findings: [] }) },
      localStore: memoryStore(),
      remoteStore: memoryStore(),
    });

    const started = await workflow.start('example.com');

    expect(started.readModel.investigation.submittedUrl).toBe('example.com');
    expect(started.commands).toEqual(expect.objectContaining({
      retry: expect.any(Function),
      resume: expect.any(Function),
      claim: expect.any(Function),
    }));
  });

  it('persists authenticated workflow results remotely and claims local work after sign-in', async () => {
    localStorage.clear();
    const local = memoryStore();
    const remote = memoryStore();
    const investigation = createInvestigation({
      id: 'remote-inv', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'wordpress', status: 'queued' }],
    });
    let remoteSaves = 0;
    const originalRemoteSave = remote.save;
    remote.save = async (value) => { remoteSaves += 1; return originalRemoteSave(value); };
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: local,
      remoteStore: remote,
      remoteStart: async () => investigation,
    });

    await workflow.start('example.com');
    expect(remoteSaves).toBeGreaterThan(0);
    expect(loadAuthenticatedInvestigationId()).toBe('remote-inv');
    expect(await local.list()).toHaveLength(0);

    const claimed = createInvestigation({ ...investigation, id: 'claim-inv', capabilities: [] });
    await local.save(claimed);
    const claimWorkflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      localStore: local,
      remoteStore: { ...remote, claim: async () => claimed },
    });
    await expect(claimWorkflow.claim('claim-inv')).resolves.toMatchObject({ investigation: claimed });
    expect(loadAuthenticatedInvestigationId()).toBe('claim-inv');
  });

  it('resumes selected local work from local persistence while authenticated', async () => {
    const local = memoryStore();
    const investigation = createInvestigation({
      id: 'local-inv', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'queued' }],
    });
    await local.save(investigation);
    const remoteGet = vi.fn(async () => { throw new Error('remote get should not run'); });
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: local,
      remoteStore: { ...memoryStore(), get: remoteGet },
    });

    await expect(workflow.resume('local-inv')).resolves.toMatchObject({ investigation: { id: 'local-inv' } });
    expect(remoteGet).not.toHaveBeenCalled();
  });

  it('falls back to remote resume when local affinity probe fails', async () => {
    const investigation = createInvestigation({
      id: 'remote-after-probe', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [],
    });
    const remoteGet = vi.fn().mockResolvedValue(investigation);
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: { ...memoryStore(), get: vi.fn(async () => { throw new Error('local storage unavailable'); }) },
      remoteStore: { ...memoryStore(), get: remoteGet },
    });

    await expect(workflow.resume('remote-after-probe')).resolves.toMatchObject({ investigation: { id: 'remote-after-probe' } });
    expect(remoteGet).toHaveBeenCalledWith('remote-after-probe');
  });

  it('reports typed persistence error when probe and remote resume both fail', async () => {
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: { ...memoryStore(), get: vi.fn(async () => { throw new Error('local storage unavailable'); }) },
      remoteStore: { ...memoryStore(), get: vi.fn().mockResolvedValue(null) },
    });

    await expect(workflow.resume('missing-after-probe')).rejects.toMatchObject({
      code: 'persistence-failed',
      message: 'Unable to load investigation.',
    });
  });

  it('preserves local affinity for retry and contextual persistence', async () => {
    const local = memoryStore();
    const localSaves = [];
    const originalLocalSave = local.save;
    local.save = async (value) => { localSaves.push(value); return originalLocalSave(value); };
    const remoteSave = vi.fn(async () => { throw new Error('remote store should not be used'); });
    const investigation = createInvestigation({
      id: 'local-affinity', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'failed', error: { code: 'failed', message: 'Failed', retryable: true } }],
    });
    await local.save(investigation);
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: local,
      remoteStore: { ...memoryStore(), save: remoteSave },
    });

    const resumed = await workflow.resume('local-affinity');
    await resumed.commands.retry('homepage');
    await workflow.run(createInvestigation({
      ...investigation,
      capabilities: [{ name: 'sitemap', status: 'queued' }],
    }));

    expect(localSaves.length).toBeGreaterThan(1);
    expect(remoteSave).not.toHaveBeenCalled();
  });

  it('reruns completed capabilities while preserving completed siblings', async () => {
    const completed = await runInvestigationSession(session, {
      wordpress: vi.fn().mockResolvedValue({ identity: 'WordPress' }),
      homepage: vi.fn().mockResolvedValue({ html: '<html />' }),
    });
    const rerun = addInvestigationCapability(completed, 'homepage');
    const homepage = vi.fn().mockResolvedValue({ html: '<html />' });

    await runInvestigationSession(rerun, { wordpress: vi.fn(), homepage });

    expect(homepage).toHaveBeenCalledTimes(1);
    expect(rerun.capabilityStates.wordpress.status).toBe('success');
  });

  it('forwards supplied options when rerunning an existing capability', async () => {
    const sitemap = createInvestigationSession({
      investigationId: 'sitemap-rerun',
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      selection: { capabilityIds: ['wordpress', 'sitemap'], options: { sitemap: { sitemapUrl: '/old.xml', maxPages: 1 } } },
    });
    const completed = await runInvestigationSession(sitemap, {
      wordpress: vi.fn().mockResolvedValue({ findings: [] }),
      sitemap: vi.fn().mockResolvedValue({ findings: [] }),
    });
    const rerun = addInvestigationCapability(completed, 'sitemap', { sitemapUrl: '/new.xml', maxPages: 25 });
    const sitemapRunner = vi.fn().mockResolvedValue({ findings: [] });

    await runInvestigationSession(rerun, { sitemap: sitemapRunner });

    expect(sitemapRunner).toHaveBeenCalledWith(expect.objectContaining({
      options: { sitemapUrl: '/new.xml', maxPages: 25 },
    }));
  });

  it('records local affinity after remote fallback for resume and retry', async () => {
    const local = memoryStore();
    const remoteSave = vi.fn(async () => { throw new Error('remote unavailable'); });
    const remoteGet = vi.fn(async () => { throw new Error('remote get should not run'); });
    let attempts = 0;
    const investigation = createInvestigation({
      id: 'fallback-affinity', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'queued' }],
    });
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => { attempts += 1; if (attempts === 1) throw new Error('first attempt'); return { findings: [] }; } },
      localStore: local,
      remoteStore: { ...memoryStore(), save: remoteSave, get: remoteGet },
    });

    const result = await workflow.run(investigation);
    await result.commands.retry('homepage');
    await workflow.resume('fallback-affinity');

    expect(remoteGet).not.toHaveBeenCalled();
    expect(remoteSave).toHaveBeenCalled();
  });

  it('updates start affinity after remote fallback before retry and resume', async () => {
    const local = memoryStore();
    const remoteSave = vi.fn(async () => { throw new Error('remote unavailable'); });
    const remoteGet = vi.fn(async () => { throw new Error('remote get should not run'); });
    let attempts = 0;
    const investigation = createInvestigation({
      id: 'start-fallback-affinity', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'queued' }],
    });
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => { attempts += 1; if (attempts === 1) throw new Error('first attempt'); return { findings: [] }; } },
      localStore: local,
      remoteStore: { ...memoryStore(), save: remoteSave, get: remoteGet },
      remoteStart: async () => investigation,
    });

    const result = await workflow.start('example.com');
    await result.commands.retry('homepage');
    await result.commands.resume();

    expect(remoteGet).not.toHaveBeenCalled();
    expect(remoteSave).toHaveBeenCalled();
  });

  it('updates resume affinity after remote fallback before the next resume', async () => {
    const local = memoryStore();
    const investigation = createInvestigation({
      id: 'resume-fallback-affinity', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'queued' }],
    });
    const remoteGet = vi.fn(async () => investigation);
    const remoteSave = vi.fn(async () => { throw new Error('remote unavailable'); });
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: local,
      remoteStore: { ...memoryStore(), get: remoteGet, save: remoteSave },
    });

    const result = await workflow.resume('resume-fallback-affinity');
    await result.commands.resume();

    expect(remoteGet).toHaveBeenCalledTimes(1);
    expect(remoteSave).toHaveBeenCalled();
  });

  it('derives local affinity from active investigation across workflow recreation', async () => {
    const local = memoryStore();
    const investigation = createInvestigation({
      id: 'transition-affinity', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'queued' }],
    });
    const anonymous = createInvestigatorWorkflow({
      auth: { getUserId: () => null, getAccessToken: async () => null },
      runner: { run: async () => ({ findings: [] }) },
      localStore: local,
      remoteStore: memoryStore(),
    });
    const active = await anonymous.run(investigation);
    const remoteSave = vi.fn(async () => { throw new Error('remote store should not be used'); });
    const authenticated = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => ({ findings: [] }) },
      localStore: local,
      remoteStore: { ...memoryStore(), save: remoteSave },
    });

    await authenticated.run(active.session.investigationState);

    expect(remoteSave).not.toHaveBeenCalled();
  });

  it('persists authenticated ID before capability execution begins', async () => {
    localStorage.clear();
    const investigation = createInvestigation({
      id: 'early-inv', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'wordpress', status: 'queued' }],
    });
    let idAtExecution = null;
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async () => {
        idAtExecution = loadAuthenticatedInvestigationId();
        throw new Error('interrupted');
      } },
      localStore: memoryStore(),
      remoteStore: memoryStore(),
      remoteStart: async () => investigation,
    });

    await workflow.start('example.com');

    expect(idAtExecution).toBe('early-inv');
  });

  it('continues contextual execution through local fallback when authenticated save fails', async () => {
    const local = memoryStore();
    const remote = memoryStore();
    remote.save = async () => { throw new Error('remote unavailable'); };
    const investigation = createInvestigation({
      id: 'contextual-run', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: ['https://example.com'], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [
        { name: 'wordpress', status: 'success', result: { findings: [] } },
        { name: 'sitemap', status: 'queued', dependencies: ['wordpress'], options: { sitemapUrl: '/custom.xml' } },
      ],
    });
    const workflow = createInvestigatorWorkflow({
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      runner: { run: async ({ capability }) => ({ capability, findings: [] }) },
      localStore: local,
      remoteStore: remote,
    });

    const result = await workflow.run(investigation);

    expect(result.investigation.capabilities).toContainEqual(expect.objectContaining({ name: 'sitemap', status: 'success' }));
    expect(result.persistence).toMatchObject({
      remote: { code: 'persistence-failed' },
      local: 'saved',
    });
    expect(await local.get('contextual-run')).toEqual(expect.objectContaining({
      capabilities: expect.arrayContaining([expect.objectContaining({ name: 'sitemap', status: 'success' })]),
    }));
  });

  it('emits identity and capability progress before final completion', async () => {
    const changes = [];
    const result = await runInvestigationSession(session, runners, (next) => changes.push(next), { active: true });

    changes.forEach((next) => {
      const validation = scanSessionSchema.safeParse(next);
      expect(validation.success, JSON.stringify(validation.error?.issues)).toBe(true);
    });
    const resultValidation = scanSessionSchema.safeParse(result);
    expect(resultValidation.success, JSON.stringify(resultValidation.error?.issues)).toBe(true);
    const sessionStatuses = changes.map((next) => next.status);
    expect(sessionStatuses).toContain('queued');
    expect(sessionStatuses).toContain('running');
    expect(sessionStatuses.indexOf('queued')).toBeLessThan(sessionStatuses.indexOf('running'));
    expect(changes.find((next) => next.status === 'queued')).toMatchObject({
      startedAt: null,
      completedAt: null
    });
    expect(changes.find((next) => next.status === 'running').startedAt).toEqual(expect.any(String));
    expect(result.startedAt).toEqual(expect.any(String));
    expect(result.completedAt).toEqual(expect.any(String));
    const wordpressStatuses = changes.map((next) => next.capabilityStates.wordpress.status);
    expect(wordpressStatuses).toContain('queued');
    expect(wordpressStatuses).toContain('running');
    expect(result.capabilityStates.wordpress.status).toBe('success');
    expect(wordpressStatuses.indexOf('queued')).toBeLessThan(wordpressStatuses.indexOf('running'));
    expect(result.status).toBe('completed');
    expect(changes.some((next) => next.capabilityStates.wordpress.status === 'running')).toBe(true);
    expect(result.overall.status).toBe('complete');
    expect(result.capabilityStates.wordpress.outcome).toEqual({
      status: 'success',
      result: { exposure: { status: 'observed' } },
      error: null
    });
  });

  it('forwards canonical domain identity to capability runners', async () => {
    const wordpress = vi.fn().mockResolvedValue({});
    const runSession = createInvestigationSession({
      investigationId: 'inv-identity',
      domain: { submitted: 'https://Example.com/', normalized: 'example.com' },
      selection: { capabilityIds: ['wordpress'] }
    });

    await runInvestigationSession(runSession, { wordpress });

    expect(wordpress).toHaveBeenCalledWith({
      domain: 'example.com',
      domainIdentity: { submitted: 'https://Example.com/', normalized: 'example.com' },
      options: {}
    });
  });

  it('preserves normalized sitemap options in selected session capabilities and runners', async () => {
    const sitemap = vi.fn().mockResolvedValue({ urls: [] });
    const runSession = createInvestigationSession({
      investigationId: 'inv-sitemap-options',
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      selection: {
        capabilityIds: ['sitemap'],
        options: { sitemap: { sitemapUrl: ' /custom.xml ', maxPages: 2 } }
      }
    });

    expect(runSession.selectedCapabilities).toContainEqual({
      id: 'sitemap',
      dependencies: ['wordpress'],
      options: { sitemapUrl: '/custom.xml', maxPages: 2 }
    });
    await runInvestigationSession(runSession, { wordpress: vi.fn().mockResolvedValue({}), sitemap });
    expect(sitemap).toHaveBeenCalledWith(expect.objectContaining({
      options: { sitemapUrl: '/custom.xml', maxPages: 2 }
    }));
  });

  it('preserves explicit dependency graph when cloning a session', async () => {
    const homepage = vi.fn().mockResolvedValue({ title: 'Should not run' });
    const explicit = createInvestigationSession({
      investigationId: 'inv-explicit-dependency',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress', 'homepage'] }
    });
    explicit.selectedCapabilities.push({ id: 'deliberate-prerequisite', dependencies: [] });
    explicit.capabilityStates['deliberate-prerequisite'] = {
      status: 'idle',
      retry: { status: 'not-retryable' },
    };
    explicit.selectedCapabilities.find(({ id }) => id === 'homepage').dependencies = ['deliberate-prerequisite'];

    const result = await runInvestigationSession(explicit, {
      wordpress: async () => { throw new Error('prerequisite failed'); },
      homepage,
    });

    expect(homepage).not.toHaveBeenCalled();
    expect(result.capabilityStates.wordpress.status).toBe('failed');
    expect(result.capabilityStates.homepage).toMatchObject({
      status: 'unavailable',
      outcome: { error: { code: 'dependency_failed' } },
    });
  });

  it('keeps successful evidence while another capability fails', async () => {
    const result = await runInvestigationSession(session, {
      wordpress: async () => ({ exposure: { status: 'observed' } }),
      homepage: async () => { throw Object.assign(new Error('blocked'), { code: 'blocked' }); }
    });

    expectValidSession(result);
    expect(result.capabilityStates.wordpress.outcome.status).toBe('success');
    expect(result.capabilityStates.homepage.outcome.status).toBe('failed');
    expect(result.status).toBe('completed');
    expect(result.overall.status).toBe('partial');
  });

  it('persists failed aggregate when no selected capability succeeds', async () => {
    const result = await runInvestigationSession(session, {
      wordpress: async () => { throw new Error('WordPress failed'); },
      homepage: async () => { throw new Error('Homepage failed'); }
    });

    expectValidSession(result);
    expect(result.status).toBe('failed');
    expect(result.overall.status).toBe('failed');
  });

  it('maps missing runners to unavailable outcomes', async () => {
    const result = await runInvestigationSession(session, { wordpress: runners.wordpress });

    expectValidSession(result);
    expect(result.capabilityStates.homepage).toMatchObject({
      status: 'unavailable',
      outcome: { status: 'unavailable', error: { code: 'runner_unavailable', retryable: false } }
    });
  });

  it('recovers interrupted capabilities without discarding successful evidence', () => {
    const interrupted = createInvestigationSession({
      investigationId: 'inv-interrupted',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress', 'homepage'] }
    });
    interrupted.status = 'running';
    interrupted.startedAt = '2026-09-10T12:00:00.000Z';
    interrupted.capabilityStates.wordpress = {
      status: 'success',
      outcome: { status: 'success', result: { exposure: { status: 'observed' } }, error: null },
      retry: { status: 'not-retryable' }
    };
    interrupted.capabilityStates.homepage = {
      status: 'running',
      retry: { status: 'not-retryable' }
    };

    const recovered = recoverInvestigationSession(interrupted);

    expectValidSession(recovered);
    expect(recovered).not.toBe(interrupted);
    expect(recovered.status).toBe('completed');
    expect(recovered.overall).toEqual({ status: 'partial' });
    expect(recovered.capabilityStates.wordpress).toEqual(interrupted.capabilityStates.wordpress);
    expect(recovered.capabilityStates.homepage).toMatchObject({
      status: 'failed',
      outcome: {
        status: 'failed',
        result: null,
        error: { code: 'interrupted', retryable: true }
      }
    });
  });

  it('recovers queued snapshots with valid terminal timestamps', () => {
    const queued = createInvestigationSession({
      investigationId: 'inv-queued-interrupted',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress'] }
    });
    queued.status = 'queued';
    queued.capabilityStates.wordpress = { status: 'queued', retry: { status: 'not-retryable' } };

    const recovered = recoverInvestigationSession(queued);

    expectValidSession(recovered);
    expect(recovered.status).toBe('failed');
    expect(recovered.startedAt).toEqual(expect.any(String));
    expect(recovered.completedAt).toEqual(expect.any(String));
  });

  it('finalizes active snapshots even when no capability is active', () => {
    const stale = createInvestigationSession({
      investigationId: 'inv-stale-active',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress'] }
    });
    stale.status = 'running';
    stale.startedAt = '2026-09-10T12:00:00.000Z';
    stale.capabilityStates.wordpress = {
      status: 'success',
      outcome: { status: 'success', result: { exposure: { status: 'observed' } }, error: null },
      retry: { status: 'not-retryable' }
    };

    const recovered = recoverInvestigationSession(stale);

    expectValidSession(recovered);
    expect(recovered.status).toBe('completed');
    expect(recovered.overall).toEqual({ status: 'complete' });
  });

  it('leaves terminal sessions unchanged during recovery', () => {
    const terminal = createTerminalSession();

    expect(recoverInvestigationSession(terminal)).toEqual(terminal);
  });

  it('propagates failed dependencies without running dependents', async () => {
    const dependentSession = createInvestigationSession({
      investigationId: 'inv-1',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress', 'sitemap'] }
    });
    const sitemap = vi.fn();
    const result = await runInvestigationSession(dependentSession, {
      wordpress: vi.fn().mockRejectedValue(new Error('blocked')), sitemap
    });

    expectValidSession(result);
    expect(sitemap).not.toHaveBeenCalled();
    expect(result.capabilityStates.sitemap).toMatchObject({
      status: 'unavailable',
      dependency: {
        status: 'failed',
        dependencyId: 'wordpress',
        error: { code: 'dependency_failed', retryable: false }
      },
      outcome: { status: 'unavailable', error: { code: 'dependency_failed', retryable: false } }
    });
    expect(result.capabilityStates.wordpress).toMatchObject({
      status: 'failed',
      outcome: { error: { code: 'scan_failed', retryable: true } }
    });
  });

  it('marks capabilities unavailable when dependencies cannot become runnable', async () => {
    const cyclicSession = createInvestigationSession({
      investigationId: 'inv-cycle',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress', 'homepage'] }
    });
    cyclicSession.selectedCapabilities = [
      { id: 'cycle-a', dependencies: ['cycle-b'] },
      { id: 'cycle-b', dependencies: ['cycle-a'] }
    ];
    cyclicSession.capabilityStates = {
      'cycle-a': { status: 'idle', retry: { status: 'not-retryable' } },
      'cycle-b': { status: 'idle', retry: { status: 'not-retryable' } }
    };

    const result = await runInvestigationSession(cyclicSession, {});

    expectValidSession(result);
    expect(result.capabilityStates['cycle-a']).toMatchObject({
      status: 'unavailable',
      outcome: { status: 'unavailable', error: { code: 'dependency_failed', retryable: false } }
    });
    expect(result.capabilityStates['cycle-b']).toMatchObject({
      status: 'unavailable',
      outcome: { status: 'unavailable', error: { code: 'dependency_failed', retryable: false } }
    });
  });

  it('suppresses work and later callbacks after cancellation', async () => {
    const onChange = vi.fn();
    const token = { active: false };
    const cancelledRunners = {
      wordpress: vi.fn(),
      homepage: vi.fn()
    };
    const result = await runInvestigationSession(session, cancelledRunners, onChange, token);

    expectValidSession(result);
    expect(result.status).toBe('idle');
    expect(onChange).not.toHaveBeenCalled();
    expect(cancelledRunners.wordpress).not.toHaveBeenCalled();
  });

  it('suppresses callbacks when cancellation happens during a runner', async () => {
    let release;
    const onChange = vi.fn();
    const token = { active: true };
    const pending = new Promise((resolve) => { release = resolve; });
    const execution = runInvestigationSession(session, {
      wordpress: () => pending,
      homepage: vi.fn().mockResolvedValue({ assets: [] })
    }, onChange, token);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    token.active = false;
    release({ exposure: { status: 'observed' } });
    const result = await execution;

    expectValidSession(result);
    expect(result.capabilityStates.wordpress.status).toBe('success');
    expect(result.capabilityStates.homepage.status).toBe('success');
    expect(onChange.mock.calls.every(([next]) => next.capabilityStates.wordpress.status !== 'success')).toBe(true);
  });

  it('retries only failed capability and preserves other outcomes', async () => {
    const failed = await runInvestigationSession(session, {
      wordpress: vi.fn().mockResolvedValue({ ok: true }),
      homepage: vi.fn().mockRejectedValue(new Error('temporary'))
    });
    const wordpress = vi.fn().mockResolvedValue({ ok: true });
    const homepage = vi.fn().mockResolvedValue({ assets: [] });
    const retried = await retryInvestigationCapability(failed, 'homepage', { wordpress, homepage });

    expectValidSession(retried);
    expect(homepage).toHaveBeenCalledOnce();
    expect(wordpress).not.toHaveBeenCalled();
    expect(retried.capabilityStates.wordpress.outcome.result).toEqual({ ok: true });
    expect(retried.capabilityStates.homepage.outcome.status).toBe('success');
  });

  it('does not retry unavailable capability when its runner becomes available', async () => {
    const wordpress = vi.fn().mockResolvedValue({ ok: true });
    const unavailable = await runInvestigationSession(session, { wordpress });
    const homepage = vi.fn().mockResolvedValue({ assets: [] });

    expect(unavailable.capabilityStates.homepage.status).toBe('unavailable');
    const retried = await retryInvestigationCapability(unavailable, 'homepage', { wordpress, homepage });

    expectValidSession(retried);
    expect(homepage).not.toHaveBeenCalled();
    expect(wordpress).toHaveBeenCalledOnce();
    expect(retried.capabilityStates.wordpress.outcome.result).toEqual({ ok: true });
    expect(retried.capabilityStates.homepage.status).toBe('unavailable');
  });

  it('preserves settled retry evidence after cancellation without notifying success', async () => {
    let release;
    const token = { active: true };
    const changes = [];
    const failed = await runInvestigationSession(session, {
      wordpress: vi.fn().mockResolvedValue({ ok: true }),
      homepage: vi.fn().mockRejectedValue(new Error('temporary'))
    });
    const retried = retryInvestigationCapability(failed, 'homepage', {
      homepage: () => new Promise((resolve) => { release = resolve; })
    }, (next) => changes.push(next), token);

    await vi.waitFor(() => expect(changes.some((next) => next.capabilityStates.homepage.status === 'running')).toBe(true));
    token.active = false;
    release({ assets: [] });
    const result = await retried;

    expectValidSession(result);
    expect(result.capabilityStates.homepage.outcome).toEqual({ status: 'success', result: { assets: [] }, error: null });
    expect(changes.some((next) => next.capabilityStates.homepage.outcome?.status === 'success')).toBe(false);
  });

  it('keeps sitemap contextual across wordpress states and excludes selected sitemap', () => {
    expect(getInvestigatorSelection()).toEqual({ capabilityIds: ['homepage', 'wordpress'], options: { homepage: {}, wordpress: {} } });
    expect(getContextualCapabilityIds(session)).toEqual(['sitemap']);

    for (const status of ['idle', 'success', 'failed']) {
      const wordpressSession = createInvestigationSession({
        investigationId: `inv-${status}`,
        domain: sessionDomain(),
        selection: { capabilityIds: ['wordpress'] }
      });
      wordpressSession.capabilityStates.wordpress = status === 'idle'
        ? wordpressSession.capabilityStates.wordpress
        : status === 'success'
          ? { status, outcome: { status, result: {}, error: null }, retry: { status: 'not-retryable' } }
          : { status, outcome: { status, result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } }, retry: { status: 'not-retryable' } };
      expect(getContextualCapabilityIds(wordpressSession)).toEqual(['sitemap']);
    }

    const selectedSitemap = createInvestigationSession({
      investigationId: 'inv-sitemap',
      domain: sessionDomain(),
      selection: { capabilityIds: ['wordpress', 'sitemap'] }
    });
    expect(getContextualCapabilityIds(selectedSitemap)).toEqual([]);
  });

  it('adds contextual sitemap with normalized options for execution', async () => {
    const contextual = addInvestigationCapability(session, 'sitemap', { sitemapUrl: '/sitemap.xml' });

    expect(contextual.selectedCapabilities).toContainEqual({
      id: 'sitemap',
      dependencies: ['wordpress'],
      options: { sitemapUrl: '/sitemap.xml', maxPages: 50 },
    });
    const sitemap = vi.fn().mockResolvedValue({ urls: [] });
    await runInvestigationSession(contextual, {
      wordpress: vi.fn().mockResolvedValue({}),
      homepage: vi.fn().mockResolvedValue({}),
      sitemap,
    });
    expect(sitemap).toHaveBeenCalledWith(expect.objectContaining({
      options: { sitemapUrl: '/sitemap.xml', maxPages: 50 },
    }));
  });

  it('updates investigatorState when adding contextual capability', () => {
    const contextual = addInvestigationCapability(session, 'sitemap', { sitemapUrl: '/sitemap.xml' });

    expect(contextual.investigationState.capabilities).toContainEqual(expect.objectContaining({
      name: 'sitemap',
      status: 'queued',
      dependencies: ['wordpress'],
      options: { sitemapUrl: '/sitemap.xml', maxPages: 50 },
    }));
  });

  it('does not retry sitemap after its failed WordPress dependency is recovered', async () => {
    const dependentSession = addInvestigationCapability(
      createInvestigationSession({
        investigationId: 'inv-retry-dependency',
        domain: sessionDomain(),
        selection: { capabilityIds: ['wordpress'] }
      }),
      'sitemap'
    );
    const failed = await runInvestigationSession(dependentSession, {
      wordpress: vi.fn().mockRejectedValue(new Error('blocked')),
      sitemap: vi.fn()
    });

    expect(failed.selectedCapabilities).toContainEqual({ id: 'sitemap', dependencies: ['wordpress'] });
    expect(failed.capabilityStates.sitemap.outcome.error.retryable).toBe(false);
    const recovered = await retryInvestigationCapability(failed, 'wordpress', {
      wordpress: vi.fn().mockResolvedValue({ identity: { value: 'WordPress', evidenceLevel: 'observed' } })
    });
    const retried = await retryInvestigationCapability(recovered, 'sitemap', {
      sitemap: vi.fn().mockResolvedValue({ pages: [] })
    });

    expect(retried.capabilityStates.sitemap.status).toBe('unavailable');
  });

  it('preserves persisted sitemap dependency metadata before retry', async () => {
    const persisted = addInvestigationCapability(
      createInvestigationSession({
        investigationId: 'inv-persisted-dependency',
        domain: sessionDomain(),
        selection: { capabilityIds: ['wordpress'] }
      }),
      'sitemap'
    );
    persisted.selectedCapabilities.find(({ id }) => id === 'sitemap').dependencies = [];
    persisted.capabilityStates.wordpress = {
      status: 'success',
      outcome: { status: 'success', result: {}, error: null },
      retry: { status: 'not-retryable' }
    };
    persisted.capabilityStates.sitemap = {
      status: 'failed',
      outcome: { status: 'failed', result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } },
      retry: { status: 'not-retryable' }
    };

    const retried = await retryInvestigationCapability(persisted, 'sitemap', {
      sitemap: vi.fn().mockResolvedValue({ pages: [] })
    });

    expect(retried.selectedCapabilities).toContainEqual({ id: 'sitemap', dependencies: [] });
  });
});

function sessionDomain() {
  return { submitted: 'Example.com', normalized: 'https://example.com' };
}

function createTerminalSession() {
  const terminal = createInvestigationSession({
    investigationId: 'inv-terminal',
    domain: sessionDomain(),
    selection: { capabilityIds: ['wordpress'] }
  });
  terminal.status = 'completed';
  terminal.startedAt = '2026-09-10T12:00:00.000Z';
  terminal.completedAt = '2026-09-10T12:01:00.000Z';
  terminal.capabilityStates.wordpress = {
    status: 'success',
    outcome: { status: 'success', result: { ok: true }, error: null },
    retry: { status: 'not-retryable' }
  };
  terminal.overall = { status: 'complete' };
  return terminal;
}

function expectValidSession(value) {
  const validation = scanSessionSchema.safeParse(value);
  expect(validation.success, JSON.stringify(validation.error?.issues)).toBe(true);
}

function memoryStore() {
  let value = null;
  return {
    async save(next) { value = next; },
    async get(id) { return value?.id === id ? value : null; },
    async list() { return value ? [value] : []; },
    async claim(id) { return value?.id === id ? value : null; },
  };
}
