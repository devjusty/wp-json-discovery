import { describe, expect, it } from '@jest/globals';
import { deriveFailureCategory } from '../logger.js';

describe('deriveFailureCategory', () => {
  it('classifies homepage fetch failures as network_failure', () => {
    expect(
      deriveFailureCategory({
        message: 'Failed to fetch homepage: fetch failed',
        status: 502
      })
    ).toBe('network_failure');
  });

  it('classifies access denied 403s as auth_required', () => {
    expect(
      deriveFailureCategory({
        message: 'Forbidden - access denied',
        status: 403
      })
    ).toBe('auth_required');
  });
});
