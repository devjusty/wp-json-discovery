import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useScan } from '../hooks/useScan.js';
import { normalizeSelection } from '../services/scanCapabilities.js';
import { loadScanPreferences, saveScanPreferences } from '../services/scanPreferences.js';

const ScanShellContext = createContext(undefined);
const ScanResultsContext = createContext(undefined);

export function ScanProvider({ children }) {
  const [activePage, setActivePage] = useState('scan');
  const [domain, setDomain] = useState('');
  const [scanSettings, setScanSettings] = useState(() => normalizeSelection(loadScanPreferences()));

  const {
    session,
    startScan,
    runCapability,
    retryCapability,
    isRotatingLogs,
    rotateLogs,
    activeDomain: scanActiveDomain
  } = useScan();

  const handleDomainChange = useCallback((value) => {
    setDomain(value);
  }, []);

  const updateScanSettings = useCallback((next) => {
    setScanSettings((current) => normalizeSelection(
      typeof next === 'function' ? next(cloneScanSettings(current)) : next
    ));
  }, []);

  const resetScanSettings = useCallback(() => {
    setScanSettings(() => normalizeSelection(loadScanPreferences()));
  }, []);

  const saveScanDefaults = useCallback(() => {
    setScanSettings((current) => saveScanPreferences(normalizeSelection(current)));
  }, []);

  const handleStartScan = useCallback((value) => {
    setDomain(value);
    return startScan(value, normalizeSelection(scanSettings));
  }, [scanSettings, startScan]);

  const wordpress = session?.capabilities.wordpress;
  const homepage = session?.capabilities.homepage;
  const isCapabilityRunning = (capability) => ['queued', 'running'].includes(capability?.status);

  const shellValue = useMemo(
    () => ({
      activePage,
      setActivePage,
      domain,
      setDomain,
      startScan: handleStartScan,
      isRotatingLogs,
      rotateLogs,
      activeDomain: scanActiveDomain,
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
      session,
      scanSettings,
      updateScanSettings,
      resetScanSettings,
      saveScanDefaults,
      startScan: handleStartScan,
      runCapability,
      retryCapability,
      scanResult: wordpress?.result ?? null,
      isScanning: session?.overallStatus === 'running',
      scanError: wordpress?.error ?? null,
      homepageResult: homepage?.result ?? null,
      homepageIsRunning: isCapabilityRunning(homepage),
      homepageError: homepage?.error ?? null
    }),
    [
      session,
      scanSettings,
      updateScanSettings,
      resetScanSettings,
      saveScanDefaults,
      handleStartScan,
      runCapability,
      retryCapability,
      wordpress,
      homepage
    ]
  );

  return (
    <ScanShellContext.Provider value={shellValue}>
      <ScanResultsContext.Provider value={resultsValue}>{children}</ScanResultsContext.Provider>
    </ScanShellContext.Provider>
  );
}

function cloneScanSettings(settings) {
  return {
    capabilityIds: [...settings.capabilityIds],
    options: Object.fromEntries(
      Object.entries(settings.options).map(([id, options]) => [id, { ...options }])
    )
  };
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
