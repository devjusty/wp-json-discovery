import { useMemo } from 'react';
import ScanPage from './components/pages/ScanPage.jsx';
import AdminPage from './components/pages/AdminPage.jsx';
import HistoryPage from './components/pages/HistoryPage.jsx';
import Button from './components/atoms/Button.jsx';
import './App.css';
import { ScanProvider, useScanContext } from './context/ScanContext.jsx';


function AppContent() {
  const {
    activePage,
    setActivePage,
    setDomain,
    startScan,
    activeDomain,
    scanResult,
    isRotatingLogs,
    rotateLogs
  } = useScanContext();
  const currentScanDomain = scanResult?.domain || activeDomain || '';

  const headerActions = useMemo(() => {
    return (
      <div className="app__topbar">
        <div className="app__topbar-actions">
          <nav className="app__nav" aria-label="Primary">
            <button
              type="button"
              className={`app__nav-link ${activePage === 'scan' ? 'is-active' : ''}`}
              onClick={() => setActivePage('scan')}
              aria-current={activePage === 'scan' ? 'page' : undefined}
            >
              Current scan
            </button>
            <button
              type="button"
              className={`app__nav-link ${activePage === 'history' ? 'is-active' : ''}`}
              onClick={() => setActivePage('history')}
              aria-current={activePage === 'history' ? 'page' : undefined}
            >
              History
            </button>
            <button
              type="button"
              className={`app__nav-link ${activePage === 'admin' ? 'is-active' : ''}`}
              onClick={() => setActivePage('admin')}
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
    );
  }

  if (activePage === 'history') {
    return (
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
    );
  }

  return <ScanPage headerActions={headerActions} />;
}

function App() {
  return (
    <ScanProvider>
      <AppContent />
    </ScanProvider>
  );
}

export default App;
