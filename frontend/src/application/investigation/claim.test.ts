import { describe, expect, it } from 'vitest';
import { claimInvestigation } from './claim';
import { createInvestigation } from '../../domain/investigation/model';

describe('claimInvestigation', () => {
  it('claims anonymous investigation into authenticated store', async () => {
    const investigation = createInvestigation({
      id: 'inv-1', submittedUrl: 'example.com', normalizedUrl: 'https://example.com',
      redirectChain: [], createdAt: '2026-09-23T12:00:00.000Z', capabilities: [],
    });
    let claimed = false;
    let loaded = false;
    const result = await claimInvestigation('inv-1', {
      auth: { getUserId: () => 'user-1', getAccessToken: async () => 'token' },
      localStore: { save: async () => {}, get: async () => { loaded = true; return investigation; }, list: async () => [investigation], claim: async () => investigation },
      remoteStore: { save: async () => {}, get: async () => null, list: async () => [], claim: async () => { claimed = true; return investigation; } },
    });

    expect(loaded).toBe(true);
    expect(claimed).toBe(true);
    expect(result).toEqual({ investigation, persistence: { local: 'not-needed' } });
  });
});
