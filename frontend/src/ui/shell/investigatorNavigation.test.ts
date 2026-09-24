import { describe, expect, it } from 'vitest';
import { resolveInvestigatorSectionPage } from './investigatorNavigation';

describe('resolveInvestigatorSectionPage', () => {
  it('keeps non-admin History inside current scan shell', () => {
    expect(resolveInvestigatorSectionPage('history', false)).toBe('scan');
  });

  it('preserves admin History route authorization boundary', () => {
    expect(resolveInvestigatorSectionPage('history', true)).toBe('history');
  });
});
