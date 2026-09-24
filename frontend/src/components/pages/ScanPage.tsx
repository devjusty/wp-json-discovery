import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '../templates/AppLayout';
import DomainForm from '../molecules/forms/DomainForm';
import {
  clearUserRecentRuns,
  fetchUnsupportedPlugins,
  fetchUserRecentRuns,
  request,
} from '../../api/client.js';
import {
  useScanResultsContext,
  useScanShellContext
} from '../../context/ScanContext';
import ScanSidebarNav from './scan/ScanSidebarNav';
import ScanSectionContent from './scan/ScanSectionContent.jsx';
import RecentDomainsCard from './scan/RecentDomainsCard.jsx';
import ScanStatusStack from './scan/ScanStatusStack';
import ScanProgress from './scan/ScanProgress';
import { mergeRecentScans } from '../../utils/scanFeed.js';
import {
  addInvestigationCapability,
  createInvestigatorWorkflow
} from '../../services/investigationSession.js';
import {
  loadAnonymousInvestigation,
  loadAuthenticatedInvestigationId,
  removeAnonymousInvestigation
} from '../../services/anonymousInvestigations.js';
import { normalizeCapabilityStates } from '../../domain/investigation/capabilityStates';

const noopSetInvestigatorRetryCapability = () => undefined;
import type { AuthSession } from '../../application/ports/auth-session';
import { domainToSession } from '../../adapters/persistence/sessionMapping';

type ScanPageProps = {
  headerActions: ReactNode;
  onNavigate: (page: string) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  activeSection?: string;
  onSectionChange?: (sectionId: string) => void;
  embedded?: boolean;
  authSession?: AuthSession;
};

function ScanPage({ headerActions, onNavigate, isAdmin, isAuthenticated, authSession, activeSection: controlledActiveSection, onSectionChange, embedded = false }: ScanPageProps) {
  const {
    domain,
    handleDomainChange: onDomainChange,
    setActivePage,
    activeDomain,
    setInvestigatorDomain,
    selectedInvestigationId,
    setSelectedInvestigationId,
  } = useScanShellContext();
  const {
    session,
    investigatorSession: contextInvestigatorSession,
    setInvestigatorSession: contextSetInvestigatorSession,
    setInvestigatorRetryCapability: contextSetInvestigatorRetryCapability,
    isScanning,
    scanSettings,
    updateScanSettings,
    saveScanDefaults,
    runCapability,
    retryCapability
  } = useScanResultsContext();

  const investigatorSession = contextInvestigatorSession;
  const setInvestigatorSession = contextSetInvestigatorSession;
  const setInvestigatorRetryCapability = contextSetInvestigatorRetryCapability ?? noopSetInvestigatorRetryCapability;

  const [sitemapFilter, setSitemapFilter] = useState('all');
  const [localActiveSection, setLocalActiveSection] = useState('overview');
  const activeSection = controlledActiveSection ?? localActiveSection;
  const setActiveSection = useCallback((sectionId: string) => {
    if (onSectionChange) {
      onSectionChange(sectionId);
      return;
    }
    setLocalActiveSection(sectionId);
  }, [onSectionChange]);
  const [recentDomainsExpanded, setRecentDomainsExpanded] = useState(false);
  const [anonymousSnapshot, setAnonymousSnapshot] = useState(null);
  const [anonymousStorageError, setAnonymousStorageError] = useState('');
  const [retryingCapabilityId, setRetryingCapabilityId] = useState(null);
  const [claimError, setClaimError] = useState('');
  const [investigatorError, setInvestigatorError] = useState('');
  const [isStartingInvestigation, setIsStartingInvestigation] = useState(false);
  const [isResumingInvestigation, setIsResumingInvestigation] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const startInFlightRef = useRef(false);
  const resumeRequestRef = useRef(null);
  const investigatorWorkflow = useMemo(() => authSession
    ? createInvestigatorWorkflow({
      auth: authSession,
      onProgress: (investigation) => setInvestigatorSession(domainToSession(investigation)),
    })
    : null, [authSession, setInvestigatorSession]);

  useEffect(() => {
    let snapshot;
    try {
      snapshot = loadAnonymousInvestigation({ strict: true });
    } catch (error) {
      setAnonymousStorageError(error.message ?? 'Saved investigation data could not be read.');
      return;
    }
    if (!snapshot) return;
    setAnonymousSnapshot(snapshot);
    if (isAuthenticated || !investigatorWorkflow) return;
    const investigationId = snapshot.record?.session?.investigationId;
    if (!investigationId) return;
    const resumeKey = `anonymous:${investigationId}`;
    if (resumeRequestRef.current === resumeKey) return;
    resumeRequestRef.current = resumeKey;
    setIsResumingInvestigation(true);
    let resumed = false;
    investigatorWorkflow.resume(investigationId)
      .then((result) => {
        resumed = true;
        setInvestigatorSession(result.session);
        onDomainChange(result.investigation.submittedUrl);
        setInvestigatorDomain(result.investigation.normalizedUrl);
      })
      .catch((error) => setResumeError(`Saved investigation could not be resumed: ${error.message}`))
      .finally(() => {
        if (resumed && resumeRequestRef.current === resumeKey) resumeRequestRef.current = null;
        setIsResumingInvestigation(false);
      });
  }, [investigatorWorkflow, isAuthenticated, onDomainChange, setInvestigatorDomain, setInvestigatorSession]);

  useEffect(() => {
    if (!isAuthenticated || !investigatorWorkflow) return undefined;
    if (activeDomain && !selectedInvestigationId) return undefined;
    const investigationId = selectedInvestigationId || loadAuthenticatedInvestigationId();
    if (!investigationId) return undefined;
    const resumeKey = `authenticated:${investigationId}`;
    if (resumeRequestRef.current === resumeKey) return undefined;
    resumeRequestRef.current = resumeKey;
    setIsResumingInvestigation(true);
    setResumeError('');
    let resumed = false;
    investigatorWorkflow.resume(investigationId)
      .then((result) => {
        resumed = true;
        setInvestigatorSession(result.session);
        onDomainChange(result.investigation.submittedUrl);
        setInvestigatorDomain(result.investigation.normalizedUrl);
      })
      .catch((error) => {
        setResumeError(`Saved investigation could not be resumed: ${error.message}`);
      })
      .finally(() => {
        if (resumed && resumeRequestRef.current === resumeKey) {
          resumeRequestRef.current = null;
          setSelectedInvestigationId('');
        }
        setIsResumingInvestigation(false);
      });
  }, [activeDomain, investigatorWorkflow, isAuthenticated, onDomainChange, selectedInvestigationId, setInvestigatorDomain, setInvestigatorSession, setSelectedInvestigationId]);

  const handleInvestigatorSubmit = useCallback(async (normalizedValue, submittedValue = normalizedValue) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setIsStartingInvestigation(true);
    setInvestigatorError('');
    resumeRequestRef.current = null;
    setSelectedInvestigationId('');
    try {
      if (!investigatorWorkflow) throw new Error('Investigation authentication context is unavailable.');
      const result = await investigatorWorkflow.start(submittedValue, scanSettings);
      setInvestigatorSession(result.session);
      onDomainChange(result.investigation.submittedUrl);
      setInvestigatorDomain(result.investigation.normalizedUrl);
    } catch (error) {
      setInvestigatorError(error.message ?? 'Investigation could not start. Check domain and try again.');
    } finally {
      startInFlightRef.current = false;
      setIsStartingInvestigation(false);
    }
  }, [investigatorWorkflow, onDomainChange, scanSettings, setInvestigatorDomain, setInvestigatorSession, setSelectedInvestigationId]);

  const handleRecentDomainRescan = useCallback((value) => {
    return handleInvestigatorSubmit(value, value);
  }, [handleInvestigatorSubmit]);

  const handleRunInvestigatorCapability = useCallback(async (id, options = {}) => {
    if (!investigatorSession || retryingCapabilityId) return;
    try {
      const current = addInvestigationCapability(investigatorSession, id, options);
      if (!investigatorWorkflow) throw new Error('Investigation authentication context is unavailable.');
      const result = await investigatorWorkflow.run(current.investigationState);
      setInvestigatorSession(result.session);
    } catch (error) {
      setInvestigatorError(error.message ?? `Could not run ${id}. Try again.`);
    }
  }, [investigatorSession, investigatorWorkflow, retryingCapabilityId, setInvestigatorSession]);

  const handleRetryInvestigatorCapability = useCallback(async (id) => {
    if (!investigatorSession || retryingCapabilityId) return;
    setRetryingCapabilityId(id);
    if (investigatorSession.investigationState && investigatorWorkflow) {
      try {
      const result = await investigatorWorkflow.retry(investigatorSession.investigationState, id);
        setInvestigatorSession(result.session);
      } catch (error) {
        setInvestigatorError(error.message ?? `Could not retry ${id}. Try again.`);
      } finally {
        setRetryingCapabilityId(null);
      }
      return;
    }
  }, [investigatorSession, investigatorWorkflow, retryingCapabilityId, setInvestigatorSession]);

  useEffect(() => {
    setInvestigatorRetryCapability(() => handleRetryInvestigatorCapability);
    return () => setInvestigatorRetryCapability(() => () => undefined);
  }, [handleRetryInvestigatorCapability, setInvestigatorRetryCapability]);

  const handleClaim = useCallback(async () => {
    if (!anonymousSnapshot) return;
    setClaimError('');
    if (typeof window.confirm === 'function' && !window.confirm('Import this investigation?')) return;
    try {
      if (anonymousSnapshot.record?.session?.investigationId) {
        const result = await investigatorWorkflow.claim(anonymousSnapshot.record.session.investigationId);
        removeAnonymousInvestigation();
        setAnonymousSnapshot(null);
        setInvestigatorSession(result.session);
        onDomainChange(result.investigation.submittedUrl);
        setInvestigatorDomain(result.investigation.normalizedUrl);
        return;
      }
    } catch (error) {
      setClaimError(error.message ?? 'Import failed. Your local investigation remains available.');
    }
  }, [anonymousSnapshot, investigatorWorkflow, onDomainChange, setInvestigatorDomain, setInvestigatorSession]);

  const visibleSection = !isAdmin && (activeSection === 'unsupported' || activeSection === 'recon')
    ? 'overview'
    : activeSection;
  const sidebarSession = investigatorSession ? bridgeInvestigatorSession(investigatorSession) : session;

  const scanResult = session?.capabilities.wordpress?.result ?? null;

  const unsupportedQuery = useQuery({
    queryKey: ['unsupportedPlugins'],
    queryFn: fetchUnsupportedPlugins,
    initialData: []
  });
  const { refetch: refetchUnsupported } = unsupportedQuery;

  const recentUserScansQuery = useQuery({
    queryKey: ['recentUserScans'],
    queryFn: () => fetchUserRecentRuns(8),
    enabled: isAuthenticated,
    staleTime: 30000
  });

  const savedScansQuery = useQuery({
    queryKey: ['savedScans'],
    queryFn: async () => {
      const result = await request('/api/user/scans');
      if (!result.ok) {
        throw new Error('Failed to load saved scans');
      }

      return result.data.domains ?? [];
    },
    enabled: isAuthenticated,
    staleTime: 30000
  });

  const recentItems = useMemo(
    () => (isAuthenticated
      ? mergeRecentScans(recentUserScansQuery.data?.items ?? [], savedScansQuery.data ?? [])
      : []),
    [isAuthenticated, recentUserScansQuery.data, savedScansQuery.data]
  );

  const handleRecentDomainSaved = useCallback(() => {
    void recentUserScansQuery.refetch();
    void savedScansQuery.refetch();
  }, [recentUserScansQuery, savedScansQuery]);

  const handleClearRecentDomains = useCallback(async () => {
    try {
      await clearUserRecentRuns();
      toast.success('Cleared recent domains');
      await recentUserScansQuery.refetch();
    } catch (error) {
      toast.error(error.message ?? 'Failed to clear recent domains');
    }
  }, [recentUserScansQuery]);

  useEffect(() => {
    if (session?.domain) {
      setActiveSection('overview');
    }
  }, [session?.domain, setActiveSection]);

  const handleOpenHistory = useCallback(() => {
    setActivePage('history');
  }, [setActivePage]);

  const handleOpenAdmin = useCallback(() => {
    setActivePage('admin');
  }, [setActivePage]);

  const handleToggleRecentDomainsExpanded = useCallback(() => {
    setRecentDomainsExpanded((value) => !value);
  }, []);

  const handleRefreshUnsupported = useCallback(() => {
    refetchUnsupported();
  }, [refetchUnsupported]);

  const sidebar = useMemo(
    () => (
      <ScanSidebarNav
        activeSection={visibleSection}
        hasSession={Boolean(investigatorSession?.domain || session?.domain)}
        session={sidebarSession}
        onSectionChange={setActiveSection}
        onOpenHistory={isAdmin ? handleOpenHistory : null}
        onOpenAdmin={isAdmin ? handleOpenAdmin : null}
        isAdmin={isAdmin}
      />
    ),
    [visibleSection, session, investigatorSession, sidebarSession, handleOpenHistory, handleOpenAdmin, isAdmin, setActiveSection]
  );

  const subtitle = isScanning
    ? undefined
    : 'Scan a WordPress site and review REST exposure, homepage source signals, and unsupported plugins. Log in to save history and notes.';

  const scanProgressSlot = useMemo(() => {
    const rawStates = investigatorSession?.capabilityStates ?? session?.capabilityStates ?? null;
    if (!rawStates || typeof rawStates !== 'object') return null;
    const capabilityStates = normalizeCapabilityStates(rawStates);
    if (Object.keys(capabilityStates).length === 0) return null;
    return <ScanProgress capabilityStates={capabilityStates} />;
  }, [investigatorSession?.capabilityStates, session?.capabilityStates]);

  return (
      <AppLayout
      title="WP JSON Discovery"
      subtitle={subtitle}
      headerActions={headerActions}
      sidebar={sidebar}
      onNavigate={onNavigate}
      embedded={embedded}
    >
      <DomainForm
        onSubmit={handleInvestigatorSubmit}
        isScanning={isScanning || isStartingInvestigation || ['queued', 'running'].includes(investigatorSession?.status)}
        initialDomain={scanResult?.domain ?? activeDomain}
        domain={domain}
        onDomainChange={onDomainChange}
        scanSettings={scanSettings}
        onScanSettingsChange={updateScanSettings}
        onSaveDefaults={saveScanDefaults}
        progressSlot={scanProgressSlot}
      />

      {anonymousStorageError ? (
        <section role="alert" aria-label="Saved investigation recovery">
          <p>Saved investigation data could not be read. Clear it to recover local scanning.</p>
          <button type="button" onClick={() => {
            removeAnonymousInvestigation();
            setAnonymousStorageError('');
          }}>Clear saved investigation</button>
        </section>
      ) : null}

      {investigatorError ? <p role="alert">{investigatorError}</p> : null}
      {isResumingInvestigation ? <p role="status">Resuming saved investigation…</p> : null}
      {resumeError ? <p role="alert">{resumeError}</p> : null}

      {isAuthenticated && anonymousSnapshot ? (
        <section className="section-enter" aria-label="Anonymous investigation import">
          <button type="button" onClick={handleClaim}>Import this investigation</button>
          {claimError ? <p role="alert">{claimError}</p> : null}
        </section>
      ) : null}

      {isAuthenticated && (
        <RecentDomainsCard
          isLoading={recentUserScansQuery.isLoading}
          items={recentItems}
          isScanning={isScanning}
          isExpanded={recentDomainsExpanded}
          onToggleExpanded={handleToggleRecentDomainsExpanded}
          onOpenHistory={isAdmin ? handleOpenHistory : null}
          onRescan={handleRecentDomainRescan}
          onSaved={handleRecentDomainSaved}
          onClearRecentDomains={handleClearRecentDomains}
        />
      )}

      <div className="scan-flow">
        <ScanStatusStack
          session={investigatorSession ?? session}
          onRetryCapability={investigatorSession ? handleRetryInvestigatorCapability : retryCapability}
          retryingCapabilityId={retryingCapabilityId}
        />

        <ScanSectionContent
          activeSection={visibleSection}
          session={investigatorSession ? bridgeInvestigatorSession(investigatorSession) : session}
          scanSettings={scanSettings}
          onScanSettingsChange={updateScanSettings}
          onRunCapability={investigatorSession ? handleRunInvestigatorCapability : runCapability}
          onRetryCapability={investigatorSession ? handleRetryInvestigatorCapability : retryCapability}
          sitemapFilter={sitemapFilter}
          setSitemapFilter={setSitemapFilter}
          unsupportedPlugins={unsupportedQuery.data ?? []}
          unsupportedIsLoading={unsupportedQuery.isLoading}
          onRefreshUnsupported={handleRefreshUnsupported}
          showDomains={isAdmin}
        />
      </div>

    </AppLayout>
  );
}

function bridgeInvestigatorSession(session) {
  const selection = session.selection ?? {
    capabilityIds: session.selectedCapabilities?.map(({ id }) => id) ?? [],
    options: {}
  };
  const capabilities = normalizeCapabilityStates(session.capabilityStates);
  return {
    domain: session.domain.normalized,
    selection,
    overallStatus: session.overall?.status ?? session.status,
    capabilities: Object.fromEntries(Object.entries(capabilities).map(([id, state]) => [id, {
      status: state.status,
      result: state.outcome?.result ?? null,
      error: state.outcome?.error ?? null
    }]))
  };
}

ScanPage.propTypes = {
  headerActions: PropTypes.node,
  onNavigate: PropTypes.func,
  isAdmin: PropTypes.bool,
  isAuthenticated: PropTypes.bool
};

ScanPage.defaultProps = {
  headerActions: null,
  onNavigate: undefined,
  isAdmin: false,
  isAuthenticated: false
};

export default ScanPage;
