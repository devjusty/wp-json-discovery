export function resolveInvestigatorSectionPage(sectionId: string, isAdmin: boolean) {
  return sectionId === 'history' && isAdmin ? 'history' : 'scan';
}

export function navigateToTopLevelPage(
  page: string,
  setActivePage: (page: string) => void,
  setActiveInvestigatorSection: (section: string) => void,
) {
  setActiveInvestigatorSection('overview');
  setActivePage(page);
}
