import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm';
import {
  clearUserRecentRuns,
  fetchUnsupportedPlugins,
  fetchUserRecentRuns,
  request,
  startInvestigation,
  fetchInvestigation,
  saveInvestigationSession,
  claimAnonymousInvestigation
} from '../../api/client.js';
import {
  useScanResultsContext,
  useScanShellContext
} from '../../context/ScanContext';
import ScanSidebarNav from './scan/ScanSidebarNav.jsx';
import ScanSectionContent from './scan/ScanSectionContent.jsx';
import RecentDomainsCard from './scan/RecentDomainsCard.jsx';
import ScanStatusStack from './scan/ScanStatusStack';
import { mergeRecentScans } from '../../utils/scanFeed.js';
import {
  createInvestigationSession,
  addInvestigationCapability,
  getInvestigatorSelection,
  recoverInvestigationSession,
  retryInvestigationCapability,
  runInvestigationSession
} from '../../services/investigationSession.js';
import {
  getCapabilityRunners,
  getCapabilitySelection
} from '../../services/scanCapabilities.js';
import {
  createClaimPayload,
  loadAnonymousInvestigation,
  loadAuthenticatedInvestigationId,
  saveAuthenticatedInvestigationId,
  removeAnonymousInvestigation,
  saveAnonymousInvestigation
} from '../../services/anonymousInvestigations.js';
import { normalizeDomain } from '../../utils/format.js';

function ScanPage({ headerActions, onNavigate, isAdmin, isAuthenticated }) {
  const {
    domain,
    handleDomainChange: onDomainChange,
    setActivePage,
    activeDomain,
    setInvestigatorDomain
  } = useScanShellContext();
  const {
    session,
    isScanning,
    scanSettings,
    updateScanSettings,
    saveScanDefaults,
    runCapability,
    retryCapability
  } = useScanResultsContext();

  const [sitemapFilter, setSitemapFilter] = useState('all');
  const [activeSection, setActiveSection] = useState('overview');
  const [recentDomainsExpanded, setRecentDomainsExpanded] = useState(false);
  const [investigatorSession, setInvestigatorSession] = useState(null);
  const [anonymousSnapshot, setAnonymousSnapshot] = useState(null);
  const [retryingCapabilityId, setRetryingCapabilityId] = useState(null);
  const [claimError, setClaimError] = useState('');
  const [investigatorError, setInvestigatorError] = useState('');
  const [isStartingInvestigation, setIsStartingInvestigation] = useState(false);
  const [isResumingInvestigation, setIsResumingInvestigation] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const startInFlightRef = useRef(false);
  const persistenceQueueRef = useRef(Promise.resolve());
  const persistenceRevisionRef = useRef(0);

  const persistInvestigatorSession = useCallback(async (nextSession, identity) => {
    const snapshot = {
      domain: identity,
      session: nextSession,
      persistedAt: new Date().toISOString()
    };
    if (isAuthenticated) {
      saveAuthenticatedInvestigationId(nextSession.investigationId);
      const revision = ++persistenceRevisionRef.current;
      const persist = async () => {
        try {
          await saveInvestigationSession(nextSession.investigationId, nextSession);
        } catch (error) {
          if (revision !== persistenceRevisionRef.current) return;
          saveAnonymousInvestigation(snapshot);
          setAnonymousSnapshot(snapshot);
          setInvestigatorError(`Investigation progress could not be saved. Local copy kept: ${error.message}`);
        }
      };
      persistenceQueueRef.current = persistenceQueueRef.current.then(persist, persist);
    } else {
      saveAnonymousInvestigation(snapshot);
      setAnonymousSnapshot(loadAnonymousInvestigation());
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const snapshot = loadAnonymousInvestigation();
    if (snapshot) {
      setAnonymousSnapshot(snapshot);
      if (!isAuthenticated) {
        const hydrated = hydrateSession(snapshot.record.session, snapshot.domain, scanSettings.options, true);
        setInvestigatorSession(hydrated);
        onDomainChange(snapshot.domain.submitted);
        setInvestigatorDomain(snapshot.domain.normalized);
        if (hydrated !== snapshot.record.session) void persistInvestigatorSession(hydrated, snapshot.domain);
      }
    }
    // Snapshot selection options are restored from persisted scan settings when
    // engine-private selection metadata was not serialized.
  }, [isAuthenticated, persistInvestigatorSession]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (activeDomain) return undefined;
    const investigationId = loadAuthenticatedInvestigationId();
    if (!investigationId) return undefined;
    let cancelled = false;
    setIsResumingInvestigation(true);
    setResumeError('');
    fetchInvestigation(investigationId)
      .then((record) => {
        if (cancelled) return;
        if (!record.latestSession) throw new Error('Saved investigation has no resumable session');
        const hydrated = hydrateSession(record.latestSession, record.investigation.domain, {}, true);
        setInvestigatorSession(hydrated);
        onDomainChange(record.investigation.domain.submitted);
        setInvestigatorDomain(record.investigation.domain.normalized);
        if (hydrated !== record.latestSession) void persistInvestigatorSession(hydrated, record.investigation.domain);
      })
      .catch((error) => {
        if (!cancelled) setResumeError(`Saved investigation could not be resumed: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) setIsResumingInvestigation(false);
      });
    return () => { cancelled = true; };
  }, [activeDomain, isAuthenticated, persistInvestigatorSession]);

  const handleInvestigatorSubmit = useCallback(async (normalizedValue, submittedValue = normalizedValue) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setIsStartingInvestigation(true);
    setInvestigatorError('');
    const identity = { submitted: submittedValue, normalized: normalizeDomain(normalizedValue) };
    onDomainChange(identity.submitted);
    setInvestigatorDomain(identity.normalized);
    const selection = getInvestigatorSelection();
    try {
       let investigationId: string = globalThis.crypto?.randomUUID?.() ?? `anonymous-${Date.now()}`;
      let sessionId = `session-${Date.now()}`;
      const nextSession = createInvestigationSession({ investigationId, domain: identity, selection });
      nextSession.id = sessionId;
      let hydratedNextSession = hydrateSession(nextSession, identity, selection.options);
      setInvestigatorSession(hydratedNextSession);
      if (isAuthenticated) {
        const record = await startInvestigation(identity, hydratedNextSession.selectedCapabilities);
        investigationId = record.investigation.id;
        sessionId = record.sessionIds[0];
        hydratedNextSession = hydrateSession({ ...hydratedNextSession, investigationId, id: sessionId }, identity, selection.options);
        setInvestigatorSession(hydratedNextSession);
      }
      const token = { active: true };
      const onChange = (changedSession) => {
        const hydrated = hydrateSession(changedSession, identity, selection.options);
        setInvestigatorSession(hydrated);
        void persistInvestigatorSession(hydrated, identity);
      };
      const result = await runInvestigationSession(hydratedNextSession, getCapabilityRunners(selection.capabilityIds), onChange, token);
      if (result) {
        const hydrated = hydrateSession(result, identity, selection.options);
        setInvestigatorSession(hydrated);
        void persistInvestigatorSession(hydrated, identity);
      }
    } catch (error) {
      setInvestigatorError(error.message ?? 'Investigation could not start. Check domain and try again.');
    } finally {
      startInFlightRef.current = false;
      setIsStartingInvestigation(false);
    }
  }, [isAuthenticated, persistInvestigatorSession]);

  const handleRecentDomainRescan = useCallback((value) => {
    return handleInvestigatorSubmit(value, value);
  }, [handleInvestigatorSubmit]);

  const handleRunInvestigatorCapability = useCallback(async (id, options = {}) => {
    if (!investigatorSession || retryingCapabilityId) return;
    const identity = investigatorSession.domain;
    const current = id === 'sitemap'
      ? addInvestigationCapability(investigatorSession, id, options)
      : investigatorSession;
    const onChange = (changedSession) => {
      const hydrated = hydrateSession(changedSession, identity, current.selection?.options);
      setInvestigatorSession(hydrated);
      void persistInvestigatorSession(hydrated, identity);
    };
    try {
      const result = await runInvestigationSession(current, getCapabilityRunners([id]), onChange, { active: true });
      if (result) {
        const hydrated = hydrateSession(result, identity, current.selection?.options);
        setInvestigatorSession(hydrated);
        void persistInvestigatorSession(hydrated, identity);
      }
    } catch (error) {
      setInvestigatorError(error.message ?? `Could not run ${id}. Try again.`);
    }
  }, [investigatorSession, persistInvestigatorSession, retryingCapabilityId]);

  const handleRetryInvestigatorCapability = useCallback(async (id) => {
    if (!investigatorSession || retryingCapabilityId) return;
    setRetryingCapabilityId(id);
    const token = { active: true };
    const identity = investigatorSession.domain;
    const onChange = (changedSession) => {
      const hydrated = hydrateSession(changedSession, identity, investigatorSession.selection?.options);
      setInvestigatorSession(hydrated);
      void persistInvestigatorSession(hydrated, identity);
    };
    try {
      const result = await retryInvestigationCapability(investigatorSession, id, getCapabilityRunners([id]), onChange, token);
      if (result) setInvestigatorSession(hydrateSession(result, identity, investigatorSession.selection?.options));
    } catch (error) {
      setInvestigatorError(error.message ?? `Could not retry ${id}. Try again.`);
    } finally {
      setRetryingCapabilityId(null);
    }
  }, [investigatorSession, persistInvestigatorSession, retryingCapabilityId]);

  const handleClaim = useCallback(async () => {
    if (!anonymousSnapshot) return;
    setClaimError('');
    if (typeof window.confirm === 'function' && !window.confirm('Import this investigation?')) return;
    try {
      const payload = createClaimPayload(anonymousSnapshot);
      if (!payload) return;
      const record = await claimAnonymousInvestigation(payload.domain, payload.anonymousRecord);
      removeAnonymousInvestigation();
      setAnonymousSnapshot(null);
      if (record?.investigation) {
        saveAuthenticatedInvestigationId(record.investigation.id);
        if (record.latestSession) {
          const hydrated = hydrateSession(record.latestSession, record.investigation.domain, {}, true);
          setInvestigatorSession(hydrated);
          onDomainChange(record.investigation.domain.submitted);
          setInvestigatorDomain(record.investigation.domain.normalized);
          if (hydrated !== record.latestSession) void persistInvestigatorSession(hydrated, record.investigation.domain);
        }
      }
    } catch (error) {
      setClaimError(error.message ?? 'Import failed. Your local investigation remains available.');
    }
  }, [anonymousSnapshot, persistInvestigatorSession]);

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
  }, [session?.domain]);

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
    [visibleSection, session, investigatorSession, sidebarSession, handleOpenHistory, handleOpenAdmin, isAdmin]
  );

  const subtitle = isScanning
    ? undefined
    : 'Scan a WordPress site and review REST exposure, homepage source signals, and unsupported plugins. Log in to save history and notes.';

  return (
      <AppLayout
      title="WP JSON Discovery"
      subtitle={subtitle}
      headerActions={headerActions}
      sidebar={sidebar}
      onNavigate={onNavigate}
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
      />

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

    </AppLayout>
  );
}

function hydrateSession(session, domain, fallbackOptions = {}, recover = false) {
  if (!session) return null;
  const hydrated = { ...session };
  const selectedCapabilities = (session.selectedCapabilities ?? []).map((capability) => {
    const registered = getCapabilitySelection(capability.id);
    return registered
      ? { ...capability, dependencies: registered.dependencies }
      : { ...capability, dependencies: [...(capability.dependencies ?? [])] };
  });
  Object.defineProperty(hydrated, 'domain', { value: domain, enumerable: false, configurable: true });
  const options = session.selection?.options ?? fallbackOptions;
  Object.defineProperty(hydrated, 'selection', {
    value: {
      capabilityIds: session.selection?.capabilityIds ?? selectedCapabilities.map(({ id }) => id),
      options: Object.fromEntries(selectedCapabilities.map(({ id, options: persistedOptions }) => [id, {
        ...(options[id] ?? {}),
        ...(persistedOptions ?? {})
      }]))
    },
    enumerable: false,
    configurable: true
  });
  return recover ? recoverInvestigationSession(hydrated) : hydrated;
}

function bridgeInvestigatorSession(session) {
  const selection = session.selection ?? {
    capabilityIds: session.selectedCapabilities?.map(({ id }) => id) ?? [],
    options: {}
  };
  return {
    domain: session.domain.normalized,
    selection,
    overallStatus: session.status === 'completed' ? 'complete' : session.status === 'failed' ? 'incomplete' : session.status,
    capabilities: Object.fromEntries(Object.entries(session.capabilityStates as Record<string, { status: string; outcome?: { result?: unknown; error?: { message?: string; code?: string; retryable?: boolean } | null } }>).map(([id, state]) => [id, {
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
