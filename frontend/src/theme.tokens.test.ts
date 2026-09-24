import { describe, expect, it } from 'vitest';
import theme from './theme.css?raw';

describe('investigator semantic tokens', () => {
  it('defines required aliases for light and dark themes', () => {
    for (const token of [
      '--surface-app', '--surface-panel', '--surface-raised', '--text-primary', '--text-secondary',
      '--status-success', '--status-warning', '--status-danger', '--status-info',
      '--status-neutral', '--status-attention', '--status-risk', '--focus-ring',
      '--content-width', '--navigation-width', '--control-height',
    ]) {
      expect(theme.match(new RegExp(`${token}:`, 'g'))).toHaveLength(2);
    }
  });
});
