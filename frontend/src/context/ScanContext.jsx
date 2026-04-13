import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useScan } from '../hooks/useScan.js';
import { useHomepageScan } from '../hooks/useHomepageScan.js';

const ScanShellContext = createContext(undefined);
const ScanResultsContext = createContext(undefined);

export function ScanProvider({ children }) {
  const [activePage, setActivePage] = useState('scan');
  const [domain, setDomain] = useState('');

  const {
    startScan: runScan,
    scanResult,
    isScanning,
    scanError,
    isRotatingLogs,
    rotateLogs,
    activeDomain: scanActiveDomain
  } = useScan();
  const homepageScan = useHomepageScan();
  const {
    startHomepageScan,
    result: homepageResult,
    isRunning: homepageIsRunning,
    error: homepageError
  } = homepageScan;

  const handleDomainChange = useCallback((value) => {
    setDomain(value);
  }, []);

  const handleStartScan = useCallback((value) => {
    setDomain(value);
    runScan(value);
    startHomepageScan(value);
  }, [runScan, startHomepageScan]);

  const shellValue = useMemo(
    () => ({
      activePage,
      setActivePage,
      domain,
      setDomain,
      startScan: handleStartScan,
      isRotatingLogs,
      rotateLogs,
      activeDomain: domain || scanActiveDomain,
      handleDomainChange
    }),
    [
      activePage,
      domain,
      isRotatingLogs,
      rotateLogs,
      scanActiveDomain,
      handleStartScan,
      handleDomainChange
    ]
  );

  const resultsValue = useMemo(
    () => ({
      scanResult,
      isScanning,
      scanError,
      homepageResult,
      homepageIsRunning,
      homepageError
    }),
    [
      scanResult,
      isScanning,
      scanError,
      homepageResult,
      homepageIsRunning,
      homepageError
    ]
  );

  return (
    <ScanShellContext.Provider value={shellValue}>
      <ScanResultsContext.Provider value={resultsValue}>{children}</ScanResultsContext.Provider>
    </ScanShellContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScanShellContext() {
  const context = useContext(ScanShellContext);
  if (context === undefined) {
    throw new Error('useScanShellContext must be used within a ScanProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScanResultsContext() {
  const context = useContext(ScanResultsContext);
  if (context === undefined) {
    throw new Error('useScanResultsContext must be used within a ScanProvider');
  }
  return context;
}
