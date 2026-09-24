import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useScan } from '../hooks/useScan.js';
import { normalizeSelection } from '../services/scanCapabilities.js';
import { loadScanPreferences, saveScanPreferences } from '../services/scanPreferences.js';
import { normalizeDomain } from '../utils/format.js';

type ScanSettings = {
  capabilityIds: string[];
  options: Record<string, Record<string, unknown>>;
};

type ScanCapabilityState = {
  status: string;
  result?: { domain?: string; [key: string]: unknown } | null;
  error?: { code?: string; message?: string; retryable?: boolean } | null;
};

type ScanSession = {
  domain: string;
  overallStatus: string;
  capabilities: Record<string, ScanCapabilityState>;
  selection?: ScanSettings;
};

type InvestigatorSession = {
  id?: string;
  status?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  domain?: { submitted: string; normalized: string; redirectChain?: string[] };
  selection?: { capabilityIds: string[]; options: Record<string, Record<string, unknown>> };
  selectedCapabilities?: ReadonlyArray<{ id: string; dependencies?: ReadonlyArray<string>; options?: Record<string, unknown> }>;
  capabilityStates?: Record<string, unknown>;
  overall?: { status?: string };
  [key: string]: unknown;
};

type InvestigatorRetryCommand = (capabilityName: string) => void | Promise<void>;

type ScanShellContextValue = {
  activePage: string;
  setActivePage: Dispatch<SetStateAction<string>>;
  domain: string;
  setDomain: Dispatch<SetStateAction<string>>;
  startScan: (value: string) => unknown;
  activeDomain: string;
  investigatorDomain: string;
  setInvestigatorDomain: Dispatch<SetStateAction<string>>;
  selectedInvestigationId: string;
  setSelectedInvestigationId: Dispatch<SetStateAction<string>>;
  currentScanDomain: string;
  handleDomainChange: (value: string) => void;
};

type ScanResultsContextValue = {
  session: ScanSession | null;
  investigatorSession: InvestigatorSession;
  setInvestigatorSession: Dispatch<SetStateAction<InvestigatorSession>>;
  retryInvestigatorCapability: InvestigatorRetryCommand;
  setInvestigatorRetryCapability: Dispatch<SetStateAction<InvestigatorRetryCommand>>;
  scanSettings: ScanSettings;
  updateScanSettings: (next: ScanSettings | ((current: ScanSettings) => ScanSettings)) => void;
  resetScanSettings: () => void;
  saveScanDefaults: () => void;
  startScan: (value: string) => unknown;
  runCapability: (id: string, options?: Record<string, unknown>) => unknown;
  retryCapability: (id: string) => unknown;
  isScanning: boolean;
};

const ScanShellContext = createContext<ScanShellContextValue | undefined>(undefined);
const ScanResultsContext = createContext<ScanResultsContextValue | undefined>(undefined);

type ScanProviderProps = { children: ReactNode };

export function ScanProvider({ children }: ScanProviderProps) {
  const [activePage, setActivePage] = useState('scan');
  const [domain, setDomain] = useState('');
  const [investigatorDomain, setInvestigatorDomain] = useState('');
  const [selectedInvestigationId, setSelectedInvestigationId] = useState('');
  const [investigatorSession, setInvestigatorSession] = useState<InvestigatorSession>(null);
  const [retryInvestigatorCapability, setInvestigatorRetryCapability] = useState<InvestigatorRetryCommand>(() => () => undefined);
  const [scanSettings, setScanSettings] = useState<ScanSettings>(() => normalizeSelection(loadScanPreferences()) as ScanSettings);

  const {
    session,
    startScan,
    runCapability,
    retryCapability,
    activeDomain: scanActiveDomain,
    isScanning
  } = useScan();

  const handleDomainChange = useCallback((value) => {
    setDomain(value);
  }, []);

  const updateScanSettings = useCallback((next: ScanSettings | ((current: ScanSettings) => ScanSettings)) => {
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
    const domainIdentity = { submitted: value, normalized: normalizeDomain(value) };
    setDomain(value);
    setInvestigatorDomain('');
    setSelectedInvestigationId('');
    return startScan(domainIdentity.normalized, normalizeSelection(scanSettings), domainIdentity);
  }, [scanSettings, startScan]);

  const shellValue = useMemo(
    () => ({
      activePage,
      setActivePage,
      domain,
      setDomain,
      startScan: handleStartScan,
      activeDomain: scanActiveDomain,
      investigatorDomain,
      setInvestigatorDomain,
      selectedInvestigationId,
      setSelectedInvestigationId,
       currentScanDomain: investigatorDomain || scanActiveDomain,
      handleDomainChange
    }),
    [
      activePage,
      domain,
      scanActiveDomain,
      investigatorDomain,
      selectedInvestigationId,
      handleStartScan,
      handleDomainChange
    ]
  );

  const resultsValue = useMemo(
    () => ({
      session,
      investigatorSession,
      setInvestigatorSession,
      retryInvestigatorCapability,
      setInvestigatorRetryCapability,
      scanSettings,
      updateScanSettings,
      resetScanSettings,
      saveScanDefaults,
      startScan: handleStartScan,
      runCapability,
      retryCapability,
      isScanning
    }),
    [
      session,
      investigatorSession,
      retryInvestigatorCapability,
      scanSettings,
      updateScanSettings,
      resetScanSettings,
      saveScanDefaults,
      handleStartScan,
      runCapability,
      retryCapability,
      isScanning
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
      Object.entries(settings.options).map(([id, options]) => [id, { ...(options as Record<string, unknown>) }])
    )
  };
}

export function useScanShellContext() {
  const context = useContext(ScanShellContext);
  if (context === undefined) {
    throw new Error('useScanShellContext must be used within a ScanProvider');
  }
  return context;
}

export function useScanResultsContext() {
  const context = useContext(ScanResultsContext);
  if (context === undefined) {
    throw new Error('useScanResultsContext must be used within a ScanProvider');
  }
  return context;
}
