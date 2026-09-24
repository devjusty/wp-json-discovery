/*
 * Task 5 boundary: legacy pages remain mounted for untouched scan/history/admin
 * behavior until Task 6 migrates their orchestration. Domain-owned shells and
 * report modules must not import legacy UI directly.
 */
export const loadScanPage = () => import('../components/pages/ScanPage');
export const loadAdminPage = () => import('../components/pages/AdminPage');
export const loadHistoryPage = () => import('../components/pages/HistoryPage');
export const loadInvestigationsPage = () => import('../components/pages/InvestigationsPage');
