import { describe, expect, it } from 'vitest';
import { resumeInvestigation } from './resume';
import { createInvestigation } from '../../domain/investigation/model';

describe('resumeInvestigation', () => {
  it('loads investigation and runs pending capabilities', async () => {
    const investigation = createInvestigation({
      id: 'inv-1', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'queued' }],
    });
    const result = await resumeInvestigation('inv-1', {
      store: { get: async () => investigation, save: async () => {}, list: async () => [], claim: async () => investigation },
      runner: { run: async () => ({ ok: true }) },
    });

    expect(result.investigation.capabilities[0]).toEqual(expect.objectContaining({ status: 'success', result: { ok: true } }));
  });

  it('returns typed not-found error', async () => {
    await expect(resumeInvestigation('missing', {
      store: { get: async () => null, save: async () => {}, list: async () => [], claim: async () => { throw new Error(); } },
      runner: { run: async () => null },
    })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('does not rerun or rewrite terminal capability outcomes', async () => {
    const investigation = createInvestigation({
      id: 'inv-complete', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [
        { name: 'homepage', status: 'success', result: { title: 'Known' } },
        { name: 'sitemap', status: 'unavailable', error: { code: 'blocked', message: 'Blocked', retryable: false } },
      ],
    });
    const run = async () => { throw new Error('terminal capability was replayed'); };
    let saves = 0;
    const result = await resumeInvestigation('inv-complete', {
      store: { get: async () => investigation, save: async () => { saves += 1; }, list: async () => [], claim: async () => investigation },
      runner: { run },
    });

    expect(result.investigation).toEqual(investigation);
    expect(saves).toBe(0);
  });

  it('recovers interrupted running capabilities into retryable failures', async () => {
    const investigation = createInvestigation({
      id: 'inv-interrupted', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'running' }],
    });
    let runnerCalls = 0;

    let persisted = investigation;
    const store = {
      get: async () => persisted,
      save: async value => { persisted = value; },
      list: async () => [],
      claim: async () => persisted,
    };
    const result = await resumeInvestigation('inv-interrupted', {
      store,
      runner: { run: async () => { runnerCalls += 1; return { ok: true }; } },
    });

    expect(runnerCalls).toBe(0);
    expect((await store.get()).capabilities[0]).toEqual(expect.objectContaining({ status: 'failed' }));
    expect(result.investigation.capabilities[0]).toEqual(expect.objectContaining({
      status: 'failed',
      error: expect.objectContaining({ code: 'interrupted', retryable: true }),
    }));
  });

  it('falls back to local persistence when authenticated remote save fails', async () => {
    const investigation = createInvestigation({
      id: 'inv-offline', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z', capabilities: [{ name: 'homepage', status: 'queued' }],
    });
    const localSaves = [];
    const result = await resumeInvestigation('inv-offline', {
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      store: { get: async () => investigation, save: async () => { throw new Error('offline'); }, list: async () => [], claim: async () => investigation },
      localStore: { save: async value => { localSaves.push(value); }, get: async () => investigation, list: async () => [], claim: async () => investigation },
      runner: { run: async () => ({ ok: true }) },
    });

    expect(result.persistence.remote).toEqual({ code: 'persistence-failed', message: 'Unable to save investigation.' });
    expect(result.persistence.local).toBe('saved');
    expect(localSaves).toHaveLength(3);
  });
});
