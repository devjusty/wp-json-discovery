import { describe, expect, it } from 'vitest';
import { retryCapability } from './retry';
import { createInvestigation } from '../../domain/investigation/model';

const failed = createInvestigation({
  id: 'inv-1', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
  redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z',
  capabilities: [{ name: 'homepage', status: 'failed', error: { code: 'timeout', message: 'Timed out', retryable: true } }],
});

describe('retryCapability', () => {
  it('retries only retryable capability and persists new result', async () => {
    const saved = [];
    const result = await retryCapability({ investigation: failed, capability: 'homepage' }, {
      runner: { run: async () => ({ title: 'Recovered' }) },
      store: { save: async (value) => { saved.push(value); }, get: async () => failed, list: async () => [], claim: async () => failed },
    });

    expect(result.investigation.capabilities[0]).toEqual(expect.objectContaining({ status: 'success', result: { title: 'Recovered' } }));
    expect(saved).toHaveLength(3);
  });

  it('preserves successful siblings while retrying only target capability', async () => {
    const investigation = createInvestigation({
      id: 'inv-1', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [
        { name: 'homepage', status: 'success', result: { title: 'Known' } },
        { name: 'sitemap', status: 'failed', error: { code: 'timeout', message: 'Timed out', retryable: true } },
      ],
    });
    const calls: string[] = [];
    const result = await retryCapability({ investigation, capability: 'sitemap' }, {
      runner: { run: async ({ capability }) => { calls.push(capability); return { urls: [] }; } },
      store: { save: async () => {}, get: async () => investigation, list: async () => [], claim: async () => investigation },
    });

    expect(calls).toEqual(['sitemap']);
    expect(result.investigation.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'homepage', status: 'success', result: { title: 'Known' } }),
      expect.objectContaining({ name: 'sitemap', status: 'success', result: { urls: [] } }),
    ]));
  });

  it('falls back to local persistence when authenticated remote save fails', async () => {
    const investigation = createInvestigation({
      id: 'inv-offline', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [{ name: 'homepage', status: 'failed', error: { code: 'timeout', message: 'Timed out', retryable: true } }],
    });
    const localSaves = [];
    const result = await retryCapability({ investigation, capability: 'homepage' }, {
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      store: { save: async () => { throw new Error('offline'); }, get: async () => investigation, list: async () => [], claim: async () => investigation },
      localStore: { save: async value => { localSaves.push(value); }, get: async () => investigation, list: async () => [], claim: async () => investigation },
      runner: { run: async () => ({ recovered: true }) },
    });

    expect(result.persistence.local).toBe('saved');
    expect(result.persistence.remote).toEqual({ code: 'persistence-failed', message: 'Unable to save investigation.' });
    expect(localSaves).toHaveLength(3);
  });
});
