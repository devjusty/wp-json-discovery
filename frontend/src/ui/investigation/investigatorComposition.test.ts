import { describe, expect, it } from 'vitest';
import shellSource from '../shell/InvestigatorShell.tsx?raw';
import panelsSource from './InvestigatorSectionPanels.tsx?raw';

describe('investigator composition boundary', () => {
  it('does not import legacy atomic UI modules', () => {
    expect(`${shellSource}\n${panelsSource}`).not.toMatch(/components\/(atoms|molecules|organisms|templates|pages)/);
  });
});
