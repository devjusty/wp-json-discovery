import { useEffect, useMemo, useState } from 'react';
import ScanPage from './components/pages/ScanPage.jsx';
import HomepageScanPage from './components/pages/HomepageScanPage.jsx';
import Button from './components/atoms/Button.jsx';
import { useScan } from './hooks/useScan.js';
import { useHomepageScan } from './hooks/useHomepageScan.js';
import './App.css';

function App() {
  const [activePage, setActivePage] = useState('scan');
  const [domain, setDomain] = useState('');
  const [autoHomepageDomain, setAutoHomepageDomain] = useState(null);
  const [autoHomepageEnabled, setAutoHomepageEnabled] = useState(true);

  const scan = useScan();
  const homepageScan = useHomepageScan();
  const {
    startHomepageScan,
    result: homepageResult,
    isRunning: homepageIsRunning,
    error: homepageError
  } = homepageScan;

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
      </div>
    );
  }, [activePage]);

  const handleDomainChange = (value) => {
    setDomain(value);
  };

  const handleStartScan = (value) => {
    setDomain(value);
    scan.startScan(value);
  };

  const handleStartHomepageScan = (value) => {
    setDomain(value);
    setAutoHomepageDomain(value);
    startHomepageScan(value);
  };

  // Auto-run homepage scan after REST scan completes for the same domain
  useEffect(() => {
    const scannedDomain = scan.scanResult?.domain;
    if (!scannedDomain) return;
    if (autoHomepageDomain === scannedDomain) return;
    if (autoHomepageEnabled) {
      setAutoHomepageDomain(scannedDomain);
      startHomepageScan(scannedDomain);
    }
  }, [scan.scanResult, autoHomepageDomain, startHomepageScan, autoHomepageEnabled]);

  if (activePage === 'homepage') {
    return (
      <HomepageScanPage
        headerActions={headerActions}
        domain={domain}
        onDomainChange={handleDomainChange}
        startHomepageScan={handleStartHomepageScan}
        result={homepageResult?.domain === domain ? homepageResult : homepageResult}
        isRunning={homepageIsRunning}
        error={homepageError}
      />
    );
  }

  return (
    <ScanPage
      headerActions={headerActions}
      domain={domain}
      onDomainChange={handleDomainChange}
      onNavigateHomepage={() => setActivePage('homepage')}
      scanResult={scan.scanResult}
      isScanning={scan.isScanning}
      scanError={scan.scanError}
      startScan={handleStartScan}
      isRotatingLogs={scan.isRotatingLogs}
      rotateLogs={scan.rotateLogs}
      activeDomain={domain || scan.activeDomain}
      homepageResult={
        homepageResult?.domain === domain ? homepageResult : homepageResult
      }
      homepageIsRunning={homepageIsRunning}
      onRunHomepage={handleStartHomepageScan}
      homepageAutoEnabled={autoHomepageEnabled}
      onToggleHomepageAuto={(checked) => {
        setAutoHomepageEnabled(checked);
        setAutoHomepageDomain(null);
      }}
    />
  );
}

export default App;
