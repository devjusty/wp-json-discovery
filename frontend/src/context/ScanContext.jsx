import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useScan } from '../hooks/useScan.js';
import { useHomepageScan } from '../hooks/useHomepageScan.js';

const ScanContext = createContext(undefined);

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

  const value = useMemo(
    () => ({
      activePage,
      setActivePage,
      domain,
      setDomain,
      scanResult,
      isScanning,
      scanError,
      startScan: handleStartScan,
      isRotatingLogs,
      rotateLogs,
      activeDomain: domain || scanActiveDomain,
      homepageResult,
      homepageIsRunning,
      homepageError,
      handleDomainChange
    }),
    [
      activePage,
      domain,
      scanResult,
      isScanning,
      scanError,
      isRotatingLogs,
      rotateLogs,
      scanActiveDomain,
      homepageResult,
      homepageIsRunning,
      homepageError,
      handleStartScan,
      handleDomainChange
    ]
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScanContext() {
  const context = useContext(ScanContext);
  if (context === undefined) {
    throw new Error('useScanContext must be used within a ScanProvider');
  }
  return context;
}
