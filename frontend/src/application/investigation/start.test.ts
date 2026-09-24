import { describe, expect, it } from 'vitest';
import { startInvestigation } from './start';
import type { Investigation } from '../../domain/investigation/model';

const makeDeps = () => {
  const saved: Investigation[] = [];
  return {
    auth: { getUserId: () => null, getAccessToken: async () => null },
    runner: { run: async () => ({ findings: [] }) },
    localStore: {
      kind: 'local' as const,
      save: async (value: Investigation) => { saved.push(value); },
      get: async () => null, list: async () => saved, claim: async () => saved[0],
    },
    remoteStore: {
      kind: 'remote' as const,
      save: async () => { throw new Error('remote should not be used'); },
      get: async () => null, list: async () => [], claim: async () => { throw new Error('unused'); },
    },
    saved,
  };
};

describe('startInvestigation', () => {
  it('uses anonymous local persistence and returns completed domain state', async () => {
    const deps = makeDeps();

    const result = await startInvestigation({
      domain: { submittedUrl: 'example.com', normalizedUrl: 'https://example.com' },
      capabilities: [{ name: 'homepage' }],
    }, deps);

    expect(result.investigation.capabilities).toEqual([expect.objectContaining({
      name: 'homepage', status: 'success', result: { findings: [] },
    })]);
    expect(deps.saved).toHaveLength(4);
  });

  it('preserves contextual capabilities through command execution', async () => {
    const deps = makeDeps();
    const result = await startInvestigation({
      domain: { submittedUrl: 'example.com', normalizedUrl: 'https://example.com' },
      capabilities: [
        { name: 'wordpress' },
        { name: 'sitemap', dependencies: ['wordpress'], options: { sitemapUrl: '/sitemap.xml' } },
      ],
    }, deps);

    expect(result.investigation.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'sitemap', status: 'success' }),
    ]));
  });

  it('returns typed persistence failure for authenticated save errors', async () => {
    const deps = makeDeps();
    deps.auth.getUserId = () => 'user-1';
    deps.remoteStore.save = async () => { throw new Error('database down'); };
    deps.localStore.save = async () => { throw new Error('offline storage down'); };

    await expect(startInvestigation({
      domain: { submittedUrl: 'example.com', normalizedUrl: 'https://example.com' },
      capabilities: [],
    }, deps)).rejects.toMatchObject({ code: 'persistence-failed' });
  });

  it('falls back to local persistence and returns remote failure metadata', async () => {
    const deps = makeDeps();
    deps.auth.getUserId = () => 'user-1';
    const remoteFailure = new Error('remote unavailable');
    deps.remoteStore.save = async () => { throw remoteFailure; };

    const result = await startInvestigation({
      domain: { submittedUrl: 'example.com', normalizedUrl: 'https://example.com' },
      capabilities: [],
    }, deps);

    expect(result.investigation.id).toBeTruthy();
    expect(result.persistence).toEqual({
      remote: { code: 'persistence-failed', message: 'Unable to save investigation.' },
      local: 'saved',
    });
    expect(deps.saved).toHaveLength(1);
  });

  it('does not classify an authenticated local store failure as a remote failure', async () => {
    const deps = makeDeps();
    deps.auth.getUserId = () => 'user-1';
    deps.localStore.kind = 'local';
    deps.remoteStore = deps.localStore as unknown as typeof deps.remoteStore;
    deps.localStore.save = async () => { throw new Error('local storage down'); };

    await expect(startInvestigation({
      domain: { submittedUrl: 'example.com', normalizedUrl: 'https://example.com' },
      capabilities: [],
    }, deps)).rejects.toMatchObject({ code: 'persistence-failed' });
  });

  it('runs independent capabilities in parallel and blocks failed dependents', async () => {
    const deps = makeDeps();
    const started: string[] = [];
    let releaseIndependent!: () => void;
    const independent = new Promise<void>(resolve => { releaseIndependent = resolve; });
    (deps.runner as { run: (input: { capability: string }) => Promise<unknown> }).run = async ({ capability }) => {
      started.push(capability);
      if (capability === 'prerequisite') {
        throw Object.assign(new Error('blocked'), { code: 'blocked', retryable: true });
      }
      if (capability === 'independent') await independent;
      return { capability };
    };

    const pending = startInvestigation({
      domain: { submittedUrl: 'example.com', normalizedUrl: 'https://example.com' },
      capabilities: [
        { name: 'prerequisite' },
        { name: 'dependent', dependencies: ['prerequisite'] },
        { name: 'independent' },
      ],
    }, deps);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(started).toEqual(expect.arrayContaining(['prerequisite', 'independent']));
    expect(started).not.toContain('dependent');
    releaseIndependent();
    const result = await pending;

    expect(result.investigation.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'dependent', status: 'unavailable' }),
      expect.objectContaining({ name: 'independent', status: 'success' }),
    ]));
  });
});
