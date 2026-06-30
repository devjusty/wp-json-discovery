import { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Button from './components/atoms/Button.jsx';
import './App.css';
import { ScanProvider, useScanShellContext } from './context/ScanContext.jsx';
import { setTokenProvider } from './api/client.js';

const loadScanPage = () => import('./components/pages/ScanPage.jsx');
const loadAdminPage = () => import('./components/pages/AdminPage.jsx');
const loadHistoryPage = () => import('./components/pages/HistoryPage.jsx');

const ScanPage = lazy(loadScanPage);
const AdminPage = lazy(loadAdminPage);
const HistoryPage = lazy(loadHistoryPage);


function AppContent() {
  const {
    activePage,
    setActivePage,
    setDomain,
    startScan,
    activeDomain,
    isRotatingLogs,
    rotateLogs
  } = useScanShellContext();
  const currentScanDomain = activeDomain || '';

  const prefetchPage = (page) => {
    if (page === 'scan') {
      void loadScanPage();
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

  const headerActions = useMemo(() => {
    return (
      <div className="app__topbar">
        <div className="app__topbar-actions">
          <nav className="app__nav" aria-label="Primary">
            <button
              type="button"
              className={`app__nav-link ${activePage === 'scan' ? 'is-active' : ''}`}
              onClick={() => setActivePage('scan')}
              onMouseEnter={() => prefetchPage('scan')}
              onFocus={() => prefetchPage('scan')}
              aria-current={activePage === 'scan' ? 'page' : undefined}
            >
              Current scan
            </button>
            <button
              type="button"
              className={`app__nav-link ${activePage === 'history' ? 'is-active' : ''}`}
              onClick={() => setActivePage('history')}
              onMouseEnter={() => prefetchPage('history')}
              onFocus={() => prefetchPage('history')}
              aria-current={activePage === 'history' ? 'page' : undefined}
            >
              History
            </button>
            <button
              type="button"
              className={`app__nav-link ${activePage === 'admin' ? 'is-active' : ''}`}
              onClick={() => setActivePage('admin')}
              onMouseEnter={() => prefetchPage('admin')}
              onFocus={() => prefetchPage('admin')}
              aria-current={activePage === 'admin' ? 'page' : undefined}
            >
              Admin
            </button>
          </nav>
          <Button
            type="button"
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
  }, [activePage, currentScanDomain, setActivePage]);

  if (activePage === 'admin') {
    return (
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
    );
  }

  if (activePage === 'history') {
    return (
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
    );
  }

  return (
    <Suspense fallback={<PageLoadingState label="Loading scanner..." />}>
      <ScanPage headerActions={headerActions} />
    </Suspense>
  );
}

function App() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

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

  return (
    <ScanProvider>
      <AppContent />
    </ScanProvider>
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
