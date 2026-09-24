import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import './App.css';
import { ScanProvider, useScanResultsContext, useScanShellContext } from './context/ScanContext';
import { useActivityLog } from './hooks/useActivityLog.js';
import { setTokenProvider, setAuthUserProvider, fetchUserProfile } from './api/client.js';
import { setScanCapabilityContext } from './services/scanCapabilities.js';
import { AdminShell } from './ui/shell/AdminShell';
import { InvestigatorShell } from './ui/shell/InvestigatorShell';
import { PageLoadingState } from './ui/shell/PageLoadingState';
import { navigateToTopLevelPage, resolveInvestigatorSectionPage } from './ui/shell/investigatorNavigation';
import { createInvestigatorReadModel } from './adapters/investigatorReadModel';
import { loadAdminPage, loadHistoryPage, loadInvestigationsPage, loadScanPage } from './adapters/legacyPageAdapters';

const ScanPage = lazy(loadScanPage);
const AdminPage = lazy(loadAdminPage);
const HistoryPage = lazy(loadHistoryPage);
const InvestigationsPage = lazy(loadInvestigationsPage);

const prefetchPage = (page) => {
  if (page === 'scan') {
    void loadScanPage();
    return;
  }
  if (page === 'investigations') {
    void loadInvestigationsPage();
    return;
  }
  if (page === 'history') {
    void loadHistoryPage();
    return;
  }
  if (page === 'admin') {
    void loadAdminPage();
  }
};

function AppContent({ authSession }) {
  const {
    activePage,
    setActivePage,
    setDomain,
    startScan,
    currentScanDomain,
    setSelectedInvestigationId
  } = useScanShellContext();
  const { retryInvestigatorCapability, investigatorSession } = useScanResultsContext();
  const { isRotatingLogs, rotateLogs } = useActivityLog();
  const { isAuthenticated } = useAuth0();
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: fetchUserProfile,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000
  });
  const isAdmin = userProfile?.user?.role === 'admin';
  const [activeInvestigatorSection, setActiveInvestigatorSection] = useState('overview');
  const navigateTopLevel = (page: string) => navigateToTopLevelPage(page, setActivePage, setActiveInvestigatorSection);
  const handleInvestigatorSectionChange = (sectionId: string) => {
    setActiveInvestigatorSection(sectionId);
    setActivePage(resolveInvestigatorSectionPage(sectionId, isAdmin));
  };
  const investigatorReadModel = useMemo(
    () => createInvestigatorReadModel(investigatorSession, isAdmin, currentScanDomain),
    [currentScanDomain, isAdmin, investigatorSession],
  );

  useEffect(() => {
    setScanCapabilityContext({ isAdmin: Boolean(isAdmin) });
  }, [isAdmin]);

  const headerActions = useMemo(() => {
    return (
      <div className="app__topbar" role="group" aria-label="Workspace actions">
        <nav className="app__nav" aria-label="Primary">
          <Button
            type="button"
            className="app__nav-control"
            variant={activePage === 'scan' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigateTopLevel('scan')}
            onMouseEnter={() => prefetchPage('scan')}
            onFocus={() => prefetchPage('scan')}
            aria-current={activePage === 'scan' ? 'page' : undefined}
          >
            {currentScanDomain || 'Scan'}
          </Button>
          <Button
            type="button"
            className="app__nav-control"
            variant={activePage === 'investigations' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigateTopLevel('investigations')}
            onMouseEnter={() => prefetchPage('investigations')}
            onFocus={() => prefetchPage('investigations')}
            aria-current={activePage === 'investigations' ? 'page' : undefined}
          >
            Investigations
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              className="app__nav-control"
              variant={activePage === 'history' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigateTopLevel('history')}
              onMouseEnter={() => prefetchPage('history')}
              onFocus={() => prefetchPage('history')}
              aria-current={activePage === 'history' ? 'page' : undefined}
            >
              History
            </Button>
          ) : null}
          {isAdmin ? (
            <Button
              type="button"
              className="app__nav-control"
              variant={activePage === 'admin' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigateTopLevel('admin')}
              onMouseEnter={() => prefetchPage('admin')}
              onFocus={() => prefetchPage('admin')}
              aria-current={activePage === 'admin' ? 'page' : undefined}
            >
              Admin
            </Button>
          ) : null}
        </nav>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="app__new-scan"
          onClick={() => navigateTopLevel('scan')}
        >
          New scan
        </Button>
      </div>
    );
  }, [activePage, currentScanDomain, navigateTopLevel, isAdmin]);
  if (activePage === 'admin') {
    if (!isAdmin) {
      return (
        <main className="app__page-loading">
          <p role="status">You do not have admin access on this account.</p>
          <div style={{ marginTop: '1rem' }}>
            <Button type="button" className="" size="sm" onClick={() => navigateTopLevel('scan')}>
              Back to main view
            </Button>
          </div>
        </main>
      );
    }

    return (
      <AdminShell
        navigation={{ items: [{ id: 'admin', label: 'Admin' }], activeId: 'admin' }}
        commands={{ onNavigate: navigateTopLevel }}
        headerActions={headerActions}
      >
        <Suspense fallback={<PageLoadingState label="Loading admin console..." />}>
          <AdminPage
            onNavigate={navigateTopLevel}
            rotateLogs={rotateLogs}
            isRotatingLogs={isRotatingLogs}
            onRescan={(domain) => {
              if (!domain) return;
              navigateTopLevel('scan');
              startScan(domain);
            }}
          />
        </Suspense>
      </AdminShell>
    );
  }

  if (activePage === 'history') {
    if (!isAdmin) {
      return (
        <main className="app__page-loading">
          <p role="status">Full scan history is available for admin users only.</p>
          <div style={{ marginTop: '1rem' }}>
            <Button type="button" className="" size="sm" onClick={() => navigateTopLevel('scan')}>
              Back to main view
            </Button>
          </div>
        </main>
      );
    }

    return (
      <InvestigatorShell readModel={investigatorReadModel} commands={{ onSectionChange: handleInvestigatorSectionChange, onRetry: retryInvestigatorCapability }} activeSection={activePage === 'history' ? 'history' : activeInvestigatorSection} contentLandmark="main" contentMode="report" headerActions={headerActions}>
        <Suspense fallback={<PageLoadingState label="Loading scan history..." />}>
          <HistoryPage
            embedded
            onRescan={(domain) => {
              if (!domain) return;
               navigateTopLevel('scan');
              startScan(domain);
            }}
            onUseDomain={(domain) => {
              if (!domain) return;
              setDomain(domain);
               navigateTopLevel('scan');
            }}
          />
        </Suspense>
      </InvestigatorShell>
    );
  }

  if (activePage === 'investigations') {
    return (
      <InvestigatorShell readModel={investigatorReadModel} commands={{ onSectionChange: handleInvestigatorSectionChange, onRetry: retryInvestigatorCapability }} activeSection={activeInvestigatorSection} contentLandmark="main" contentMode="report" headerActions={headerActions}>
        <Suspense fallback={<PageLoadingState label="Loading investigations..." />}>
          <InvestigationsPage
            embedded
            onNavigate={navigateTopLevel}
            isAuthenticated={isAuthenticated}
            authSession={authSession}
            onResumeLocal={(investigationId) => {
              setSelectedInvestigationId(investigationId);
               navigateTopLevel('scan');
            }}
            onResumeInvestigation={(investigationId) => {
              setSelectedInvestigationId(investigationId);
               navigateTopLevel('scan');
            }}
          />
        </Suspense>
      </InvestigatorShell>
    );
  }

  return (
    <InvestigatorShell readModel={investigatorReadModel} commands={{ onSectionChange: handleInvestigatorSectionChange, onRetry: retryInvestigatorCapability }} activeSection={activeInvestigatorSection} contentLandmark="main" contentMode="report" headerActions={headerActions}>
        <Suspense fallback={<PageLoadingState label="Loading scanner..." />}>
          <ScanPage authSession={authSession} onNavigate={navigateTopLevel} isAdmin={isAdmin} isAuthenticated={isAuthenticated} activeSection={activeInvestigatorSection} onSectionChange={handleInvestigatorSectionChange} embedded />
        </Suspense>
      </InvestigatorShell>
    );
}

function App() {
  const { getAccessTokenSilently, isAuthenticated, user } = useAuth0();

  useEffect(() => {
    setTokenProvider(async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE }
        });
      } catch {
        return null;
      }
    });
  }, [getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    setAuthUserProvider(() => ({
      email: user?.email,
      name: user?.name || user?.nickname
    }));
  }, [user]);

  const authSession = useMemo(() => ({
    getUserId: () => user?.sub ?? null,
    getAccessToken: async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
      } catch {
        return null;
      }
    },
  }), [getAccessTokenSilently, isAuthenticated, user?.sub]);

  return (
    <TooltipProvider>
      <ScanProvider>
        <AppContent authSession={authSession} />
      </ScanProvider>
    </TooltipProvider>
  );
}

export default App;
