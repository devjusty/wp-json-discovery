import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import {
  clearUserRecentRuns,
  fetchUnsupportedPlugins,
  fetchUserRecentRuns,
  request
} from '../../api/client.js';
import {
  useScanResultsContext,
  useScanShellContext
} from '../../context/ScanContext.jsx';
import ScanSidebarNav from './scan/ScanSidebarNav.jsx';
import ScanSectionContent from './scan/ScanSectionContent.jsx';
import RecentDomainsCard from './scan/RecentDomainsCard.jsx';
import ScanStatusStack from './scan/ScanStatusStack.jsx';
import { mergeRecentScans } from '../../utils/scanFeed.js';

function ScanPage({ headerActions, onNavigate, isAdmin, isAuthenticated }) {
  const {
    domain,
    handleDomainChange: onDomainChange,
    setActivePage,
    startScan,
    activeDomain
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

  const visibleSection = !isAdmin && (activeSection === 'unsupported' || activeSection === 'recon')
    ? 'overview'
    : activeSection;

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
        hasSession={Boolean(session?.domain)}
        session={session}
        onSectionChange={setActiveSection}
        onOpenHistory={isAdmin ? handleOpenHistory : null}
        onOpenAdmin={isAdmin ? handleOpenAdmin : null}
        isAdmin={isAdmin}
      />
    ),
    [visibleSection, session, handleOpenHistory, handleOpenAdmin, isAdmin]
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
        onSubmit={startScan}
        isScanning={isScanning}
        initialDomain={scanResult?.domain ?? activeDomain}
        domain={domain}
        onDomainChange={onDomainChange}
        scanSettings={scanSettings}
        onScanSettingsChange={updateScanSettings}
        onSaveDefaults={saveScanDefaults}
      />

      {isAuthenticated && (
        <RecentDomainsCard
          isLoading={recentUserScansQuery.isLoading}
          items={recentItems}
          isScanning={isScanning}
          isExpanded={recentDomainsExpanded}
          onToggleExpanded={handleToggleRecentDomainsExpanded}
          onOpenHistory={isAdmin ? handleOpenHistory : null}
          onRescan={startScan}
          onSaved={handleRecentDomainSaved}
          onClearRecentDomains={handleClearRecentDomains}
        />
      )}

      <ScanStatusStack
        session={session}
        onRetryCapability={retryCapability}
      />

      <ScanSectionContent
        activeSection={visibleSection}
        session={session}
        scanSettings={scanSettings}
        onScanSettingsChange={updateScanSettings}
        onRunCapability={runCapability}
        onRetryCapability={retryCapability}
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
