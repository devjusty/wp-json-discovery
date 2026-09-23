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

    expect(result.capabilities[0]).toEqual(expect.objectContaining({ status: 'success', result: { title: 'Recovered' } }));
    expect(saved).toHaveLength(1);
  });
});
