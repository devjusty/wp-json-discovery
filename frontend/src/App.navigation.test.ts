import { describe, expect, it, vi } from 'vitest';
import { navigateToTopLevelPage } from './ui/shell/investigatorNavigation';

describe('navigateToTopLevelPage', () => {
  it('resets investigator section before switching top-level page', () => {
    const setActivePage = vi.fn();
    const setActiveInvestigatorSection = vi.fn();

    navigateToTopLevelPage('scan', setActivePage, setActiveInvestigatorSection);

    expect(setActiveInvestigatorSection).toHaveBeenCalledWith('overview');
    expect(setActivePage).toHaveBeenCalledWith('scan');
    expect(setActiveInvestigatorSection.mock.invocationCallOrder[0])
      .toBeLessThan(setActivePage.mock.invocationCallOrder[0]);
  });
});
