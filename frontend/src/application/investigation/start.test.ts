import { describe, expect, it } from 'vitest';
import { startInvestigation } from './start';
import type { Investigation } from '../../domain/investigation/model';

const makeDeps = () => {
  const saved: Investigation[] = [];
  return {
    auth: { getUserId: () => null, getAccessToken: async () => null },
    runner: { run: async () => ({ findings: [] }) },
    localStore: {
      save: async (value: Investigation) => { saved.push(value); },
      get: async () => null, list: async () => saved, claim: async () => saved[0],
    },
    remoteStore: {
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

    expect(result.capabilities).toEqual([expect.objectContaining({
      name: 'homepage', status: 'success', result: { findings: [] },
    })]);
    expect(deps.saved).toHaveLength(2);
  });

  it('returns typed persistence failure for authenticated save errors', async () => {
    const deps = makeDeps();
    deps.auth.getUserId = () => 'user-1';
    deps.remoteStore.save = async () => { throw new Error('database down'); };

    await expect(startInvestigation({
      domain: { submittedUrl: 'example.com', normalizedUrl: 'https://example.com' },
      capabilities: [],
    }, deps)).rejects.toMatchObject({ code: 'persistence-failed' });
  });
});
