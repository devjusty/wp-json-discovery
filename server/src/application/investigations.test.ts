import { describe, expect, it } from '@jest/globals';
import { createInvestigationApplication } from './investigations.ts';

const request = { domain: { submitted: 'example.com', normalized: 'example.com' }, selectedCapabilities: [] };

describe('investigation application', () => {
  it('authorizes before create mutation', async () => {
    let called = false;
    const app = createInvestigationApplication({ create: async () => { called = true; } });

    await expect(app.create(null, request)).rejects.toMatchObject({ code: 'auth-required' });
    expect(called).toBe(false);
  });

  it('validates input and maps repository not-found', async () => {
    const app = createInvestigationApplication({
      get: async () => null,
      create: async () => null,
    });

    await expect(app.create('user-1', { invalid: true })).rejects.toMatchObject({ code: 'validation-failed' });
    await expect(app.get('user-1', 'missing')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('maps persistence failures to stable application errors', async () => {
    const app = createInvestigationApplication({
      create: async () => { throw new Error('database down'); },
    });

    await expect(app.create('user-1', request)).rejects.toMatchObject({ code: 'persistence-failed' });
  });
});
