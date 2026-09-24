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
import { createInvestigation, type CapabilityStatus } from './domain/investigation/model';

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
  const { session, retryCapability } = useScanResultsContext();
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
  const handleInvestigatorSectionChange = (sectionId: string) => {
    setActiveInvestigatorSection(sectionId);
    setActivePage(sectionId === 'history' ? 'history' : 'scan');
  };
  const investigatorReadModel = useMemo(
    () => routeReadModel(currentScanDomain, isAdmin, session),
    [currentScanDomain, isAdmin, session],
  );

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
      <InvestigatorShell readModel={investigatorReadModel} commands={{ onSectionChange: handleInvestigatorSectionChange, onRetry: retryCapability }} activeSection={activePage === 'history' ? 'history' : activeInvestigatorSection} contentLandmark="div">
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
      <InvestigatorShell readModel={investigatorReadModel} commands={{ onSectionChange: handleInvestigatorSectionChange, onRetry: retryCapability }} activeSection={activeInvestigatorSection} contentLandmark="div">
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
      <InvestigatorShell readModel={investigatorReadModel} commands={{ onSectionChange: handleInvestigatorSectionChange, onRetry: retryCapability }} activeSection={activeInvestigatorSection} contentLandmark="div">
        <Suspense fallback={<PageLoadingState label="Loading scanner..." />}>
          <ScanPage headerActions={headerActions} onNavigate={setActivePage} isAdmin={isAdmin} isAuthenticated={isAuthenticated} activeSection={activeInvestigatorSection} onSectionChange={handleInvestigatorSectionChange} />
        </Suspense>
      </InvestigatorShell>
    );
}

function routeReadModel(currentScanDomain: string, isAdmin: boolean, session: {
  domain: string;
  overallStatus: string;
  capabilities: Record<string, { status: string; error?: { code?: string; message?: string; retryable?: boolean } | null }>;
} | null) {
  const domain = session?.domain || currentScanDomain;
  const capabilities = Object.entries(session?.capabilities ?? {}).map(([name, state]) => ({
    name,
    status: normalizeCapabilityStatus(state.status),
    ...(state.status === 'failed'
      ? { error: {
        code: state.error?.code || 'capability_failed',
        message: state.error?.message || 'Capability failed.',
        retryable: state.error?.retryable === true,
      } }
      : {}),
    ...(state.status === 'failed' || state.status === 'unavailable'
      ? { retryable: state.error?.retryable === true }
      : {}),
  }));
  const investigation = domain ? createInvestigation({
    id: `current:${domain}`,
    submittedUrl: domain,
    normalizedUrl: domain,
    redirectChain: [domain],
    createdAt: '1970-01-01T00:00:00.000Z',
    capabilities: capabilities.map(({ name, status, error }) => ({ name, status, ...(error ? { error } : {}) })),
  }) : undefined;

  return {
    title: currentScanDomain || 'Investigation workspace',
    status: normalizeInvestigationStatus(session?.overallStatus),
    capabilities,
    investigation,
    sections: [
      { id: 'overview', label: 'Overview', description: 'Site identity and investigation summary.' },
      { id: 'findings', label: 'Findings', description: 'Ranked signals requiring investigator attention.' },
      { id: 'evidence', label: 'Evidence', description: 'Observed evidence and provenance.' },
      { id: 'assets', label: 'Assets', description: 'Discovered site assets and their sources.' },
      { id: 'history', label: 'History', description: 'Previous investigation activity.' },
      { id: 'tools', label: 'Tools', description: 'Investigation actions and capability controls.' },
    ].map((section) => ({ ...section, disabled: section.id === 'history' && (!currentScanDomain || !isAdmin) })),
  };
}

function normalizeCapabilityStatus(status: string): CapabilityStatus {
  return ['queued', 'running', 'success', 'failed', 'unavailable'].includes(status)
    ? status as CapabilityStatus
    : 'unavailable';
}

function normalizeInvestigationStatus(status?: string): 'complete' | 'partial' | 'failed' | 'blocked' | 'incomplete' {
  if (status === 'complete' || status === 'partial' || status === 'failed' || status === 'blocked') return status;
  return 'incomplete';
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
