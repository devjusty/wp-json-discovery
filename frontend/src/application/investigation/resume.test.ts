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

    expect(result.capabilities[0]).toEqual(expect.objectContaining({ status: 'success', result: { ok: true } }));
  });

  it('returns typed not-found error', async () => {
    await expect(resumeInvestigation('missing', {
      store: { get: async () => null, save: async () => {}, list: async () => [], claim: async () => { throw new Error(); } },
      runner: { run: async () => null },
    })).rejects.toMatchObject({ code: 'not-found' });
  });
});
