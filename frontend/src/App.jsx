import { useMemo } from 'react';
import ScanPage from './components/pages/ScanPage.jsx';
import HomepageScanPage from './components/pages/HomepageScanPage.jsx';
import AdminPage from './components/pages/AdminPage.jsx';
import Button from './components/atoms/Button.jsx';
import './App.css';
import { ScanProvider, useScanContext } from './context/ScanContext.jsx';


function AppContent() {
  const {
    activePage,
    setActivePage,
    domain,
    handleDomainChange,
    homepageResult,
    homepageIsRunning,
    homepageError,
    startHomepageScan,
    scanResult,
    isScanning,
    scanError,
    startScan,
    isRotatingLogs,
    rotateLogs,
    activeDomain,
    autoHomepageEnabled,
    setAutoHomepageEnabled,
    setAutoHomepageDomain
  } = useScanContext();

  const headerActions = useMemo(() => {
    return (
      <div className="app__tabs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`app__tab ${activePage === 'scan' ? 'is-active' : ''}`}
          onClick={() => setActivePage('scan')}
        >
          REST scan
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`app__tab ${activePage === 'homepage' ? 'is-active' : ''}`}
          onClick={() => setActivePage('homepage')}
        >
          Homepage source (opt-in)
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`app__tab ${activePage === 'admin' ? 'is-active' : ''}`}
          onClick={() => setActivePage('admin')}
        >
          Admin
        </Button>
      </div>
    );
  }, [activePage, setActivePage]);

  if (activePage === 'homepage') {
    return (
      <HomepageScanPage
        headerActions={headerActions}
        domain={domain}
        onDomainChange={handleDomainChange}
        startHomepageScan={startHomepageScan}
        result={homepageResult}
        isRunning={homepageIsRunning}
        error={homepageError}
      />
    );
  }

  if (activePage === 'admin') {
    return (
      <AdminPage
        headerActions={headerActions}
        onNavigate={setActivePage}
      />
    );
  }

  return (
    <ScanPage
      headerActions={headerActions}
      domain={domain}
      onDomainChange={handleDomainChange}
      onNavigateHomepage={() => setActivePage('homepage')}
      scanResult={scanResult}
      isScanning={isScanning}
      scanError={scanError}
      startScan={startScan}
      isRotatingLogs={isRotatingLogs}
      rotateLogs={rotateLogs}
      activeDomain={activeDomain}
      homepageResult={homepageResult}
      homepageIsRunning={homepageIsRunning}
      onRunHomepage={startHomepageScan}
      homepageAutoEnabled={autoHomepageEnabled}
      onToggleHomepageAuto={(checked) => {
        setAutoHomepageEnabled(checked);
        setAutoHomepageDomain(null);
      }}
    />
  );
}

function App() {
  return (
    <ScanProvider>
      <AppContent />
    </ScanProvider>
  );
}

export default App;
