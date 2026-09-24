export function resolveInvestigatorSectionPage(sectionId: string, isAdmin: boolean) {
  return sectionId === 'history' && isAdmin ? 'history' : 'scan';
}
