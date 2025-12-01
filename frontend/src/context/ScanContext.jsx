import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useScan } from '../hooks/useScan.js';
import { useHomepageScan } from '../hooks/useHomepageScan.js';

const ScanContext = createContext(undefined);

export function ScanProvider({ children }) {
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

  const value = useMemo(
    () => ({
      activePage,
      setActivePage,
      domain,
      setDomain,
      autoHomepageEnabled,
      setAutoHomepageEnabled,
      scanResult: scan.scanResult,
      isScanning: scan.isScanning,
      scanError: scan.scanError,
      startScan: handleStartScan,
      isRotatingLogs: scan.isRotatingLogs,
      rotateLogs: scan.rotateLogs,
      activeDomain: domain || scan.activeDomain,
      homepageResult,
      homepageIsRunning,
      homepageError,
      startHomepageScan: handleStartHomepageScan,
      handleDomainChange,
      setAutoHomepageDomain,
    }),
    [
      activePage,
      domain,
      autoHomepageEnabled,
      scan.scanResult,
      scan.isScanning,
      scan.scanError,
      scan.isRotatingLogs,
      scan.rotateLogs,
      scan.activeDomain,
      homepageResult,
      homepageIsRunning,
      homepageError,
      handleStartScan,
      handleStartHomepageScan,
      handleDomainChange,
      setAutoHomepageDomain,
    ]
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScanContext() {
  const context = useContext(ScanContext);
  if (context === undefined) {
    throw new Error('useScanContext must be used within a ScanProvider');
  }
  return context;
}