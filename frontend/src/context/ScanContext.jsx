import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useScan } from '../hooks/useScan.js';
import { useHomepageScan } from '../hooks/useHomepageScan.js';

const ScanContext = createContext(undefined);

export function ScanProvider({ children }) {
  const [activePage, setActivePage] = useState('scan');
  const [domain, setDomain] = useState('');
  const [autoHomepageDomain, setAutoHomepageDomain] = useState(null);
  const [autoHomepageEnabled, setAutoHomepageEnabled] = useState(true);

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
  }, [runScan]);

  const handleStartHomepageScan = useCallback((value) => {
    setDomain(value);
    setAutoHomepageDomain(value);
    startHomepageScan(value);
  }, [startHomepageScan]);

  // Auto-run homepage scan after REST scan completes for the same domain
  useEffect(() => {
    const scannedDomain = scanResult?.domain;
    if (!scannedDomain) return;
    if (autoHomepageDomain === scannedDomain) return;
    if (autoHomepageEnabled) {
      setAutoHomepageDomain(scannedDomain);
      startHomepageScan(scannedDomain);
    }
  }, [scanResult, autoHomepageDomain, startHomepageScan, autoHomepageEnabled]);

  const value = useMemo(
    () => ({
      activePage,
      setActivePage,
      domain,
      setDomain,
      autoHomepageEnabled,
      setAutoHomepageEnabled,
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
      startHomepageScan: handleStartHomepageScan,
      handleDomainChange,
      setAutoHomepageDomain
    }),
    [
      activePage,
      domain,
      autoHomepageEnabled,
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
      handleStartHomepageScan,
      handleDomainChange,
      setAutoHomepageDomain
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
