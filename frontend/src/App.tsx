import { Suspense, lazy, useEffect, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import './App.css';
import { ScanProvider, useScanShellContext } from './context/ScanContext';
import { useActivityLog } from './hooks/useActivityLog.js';
import { setTokenProvider, setAuthUserProvider, fetchUserProfile } from './api/client.js';
import { setScanCapabilityContext } from './services/scanCapabilities.js';
import { AdminShell } from './ui/shell/AdminShell';
import { InvestigatorShell } from './ui/shell/InvestigatorShell';

const loadScanPage = () => import('./components/pages/ScanPage');
const loadAdminPage = () => import('./components/pages/AdminPage');
const loadHistoryPage = () => import('./components/pages/HistoryPage');
const loadInvestigationsPage = () => import('./components/pages/InvestigationsPage');

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

function AppContent() {
  const {
    activePage,
    setActivePage,
    setDomain,
    startScan,
    currentScanDomain,
    setSelectedInvestigationId
  } = useScanShellContext();
  const { isRotatingLogs, rotateLogs } = useActivityLog();
  const { isAuthenticated } = useAuth0();
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: fetchUserProfile,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000
  });
  const isAdmin = userProfile?.user?.role === 'admin';
  const handleInvestigatorSectionChange = (sectionId: string) => {
    if (sectionId === 'history') setActivePage('history');
  };

  useEffect(() => {
    setScanCapabilityContext({ isAdmin: Boolean(isAdmin) });
  }, [isAdmin]);

  const headerActions = useMemo(() => {
    return (
      <div className="app__topbar">
        <div className="app__topbar-actions">
          <nav className="app__nav" aria-label="Primary">
            <Button
              type="button"
              className=""
              variant={activePage === 'scan' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActivePage('scan')}
              onMouseEnter={() => prefetchPage('scan')}
              onFocus={() => prefetchPage('scan')}
              aria-current={activePage === 'scan' ? 'page' : undefined}
            >
              Current scan
            </Button>
            <Button
                type="button"
                className=""
                variant={activePage === 'investigations' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActivePage('investigations')}
                onMouseEnter={() => prefetchPage('investigations')}
                onFocus={() => prefetchPage('investigations')}
                aria-current={activePage === 'investigations' ? 'page' : undefined}
              >
                Investigations
            </Button>
            {isAdmin && (
              <Button
                type="button"
                className=""
                variant={activePage === 'history' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActivePage('history')}
                onMouseEnter={() => prefetchPage('history')}
                onFocus={() => prefetchPage('history')}
                aria-current={activePage === 'history' ? 'page' : undefined}
              >
                History
              </Button>
            )}
            {isAdmin && (
              <Button
                type="button"
                className=""
                variant={activePage === 'admin' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActivePage('admin')}
                onMouseEnter={() => prefetchPage('admin')}
                onFocus={() => prefetchPage('admin')}
                aria-current={activePage === 'admin' ? 'page' : undefined}
              >
                Admin
              </Button>
            )}
          </nav>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="app__new-scan"
            onClick={() => setActivePage('scan')}
          >
            New scan
          </Button>
        </div>
        <p className="app__context">
          Current scan: {currentScanDomain || 'none yet'}
        </p>
      </div>
    );
  }, [activePage, currentScanDomain, setActivePage, isAdmin, isAuthenticated]);
  if (activePage === 'admin') {
    if (!isAdmin) {
      return (
        <div className="app__page-loading" role="status">
          <p>You do not have admin access on this account.</p>
          <div style={{ marginTop: '1rem' }}>
            <Button type="button" className="" size="sm" onClick={() => setActivePage('scan')}>
              Back to main view
            </Button>
          </div>
        </div>
      );
    }

    return (
      <AdminShell
        navigation={{ items: [{ id: 'admin', label: 'Admin' }], activeId: 'admin' }}
        commands={{ onNavigate: setActivePage }}
      >
        <Suspense fallback={<PageLoadingState label="Loading admin console..." />}>
          <AdminPage
            headerActions={headerActions}
            onNavigate={setActivePage}
            rotateLogs={rotateLogs}
            isRotatingLogs={isRotatingLogs}
            onRescan={(domain) => {
              if (!domain) return;
              setActivePage('scan');
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
        <div className="app__page-loading" role="status">
          <p>Full scan history is available for admin users only.</p>
          <div style={{ marginTop: '1rem' }}>
            <Button type="button" className="" size="sm" onClick={() => setActivePage('scan')}>
              Back to main view
            </Button>
          </div>
        </div>
      );
    }

    return (
      <InvestigatorShell readModel={routeReadModel(currentScanDomain)} commands={{ onSectionChange: handleInvestigatorSectionChange }} activeSection={activePage === 'history' ? 'history' : 'overview'}>
        <Suspense fallback={<PageLoadingState label="Loading scan history..." />}>
          <HistoryPage
            headerActions={headerActions}
            onRescan={(domain) => {
              if (!domain) return;
              setActivePage('scan');
              startScan(domain);
            }}
            onUseDomain={(domain) => {
              if (!domain) return;
              setDomain(domain);
              setActivePage('scan');
            }}
          />
        </Suspense>
      </InvestigatorShell>
    );
  }

  if (activePage === 'investigations') {
    return (
      <InvestigatorShell readModel={routeReadModel(currentScanDomain)} commands={{ onSectionChange: handleInvestigatorSectionChange }} activeSection="overview">
        <Suspense fallback={<PageLoadingState label="Loading investigations..." />}>
          <InvestigationsPage
            headerActions={headerActions}
            onNavigate={setActivePage}
            isAuthenticated={isAuthenticated}
            onResumeLocal={() => {
              setSelectedInvestigationId('local');
              setActivePage('scan');
            }}
            onResumeInvestigation={(investigationId) => {
              setSelectedInvestigationId(investigationId);
              setActivePage('scan');
            }}
          />
        </Suspense>
      </InvestigatorShell>
    );
  }

    return (
      <InvestigatorShell readModel={routeReadModel(currentScanDomain)} commands={{ onSectionChange: handleInvestigatorSectionChange }} activeSection="overview">
        <Suspense fallback={<PageLoadingState label="Loading scanner..." />}>
          <ScanPage headerActions={headerActions} onNavigate={setActivePage} isAdmin={isAdmin} isAuthenticated={isAuthenticated} />
        </Suspense>
      </InvestigatorShell>
    );
}

function routeReadModel(currentScanDomain: string) {
  return {
    title: currentScanDomain || 'Investigation workspace',
    status: 'incomplete' as const,
    capabilities: [],
    sections: [
      { id: 'overview', label: 'Overview' },
      { id: 'findings', label: 'Findings' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'assets', label: 'Assets' },
      { id: 'history', label: 'History' },
      { id: 'tools', label: 'Tools' },
    ].map((section) => ({ ...section, disabled: section.id === 'history' && !currentScanDomain })),
  };
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

  return (
    <TooltipProvider>
      <ScanProvider>
        <AppContent />
      </ScanProvider>
    </TooltipProvider>
  );
}

export default App;

function PageLoadingState({ label }) {
  return (
    <div className="app__page-loading" role="status" aria-live="polite">
      <p>{label}</p>
    </div>
  );
}
