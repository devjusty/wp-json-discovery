import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import { fetchScanHistory, fetchUnsupportedPlugins, request } from '../../api/client.js';
import { useSitemapScan } from '../../hooks/useSitemapScan.js';
import {
  useScanResultsContext,
  useScanShellContext
} from '../../context/ScanContext.jsx';
import ScanSidebarNav from './scan/ScanSidebarNav.jsx';
import ScanSectionContent from './scan/ScanSectionContent.jsx';
import RecentDomainsCard from './scan/RecentDomainsCard.jsx';
import ScanStatusStack from './scan/ScanStatusStack.jsx';
import SaveScanButton from '../organisms/panels/SaveScanButton.jsx';

function ScanPage({ headerActions, onNavigate, isAdmin, isAuthenticated }) {
  const {
    domain,
    handleDomainChange: onDomainChange,
    setActivePage,
    startScan,
    activeDomain
  } = useScanShellContext();
  const {
    scanResult,
    isScanning,
    scanError,
    homepageResult,
    homepageIsRunning,
    homepageError
  } = useScanResultsContext();

  const {
    startSitemapScan,
    result: sitemapResult,
    isRunning: isSitemapRunning
  } = useSitemapScan();

  const [sitemapFilter, setSitemapFilter] = useState('all');
  const [activeSection, setActiveSection] = useState('overview');
  const [recentDomainsExpanded, setRecentDomainsExpanded] = useState(false);

  const prevIsAdmin = useRef(isAdmin);

  useEffect(() => {
    if (prevIsAdmin.current && !isAdmin && activeSection === 'unsupported') {
      setActiveSection('overview');
    }
    prevIsAdmin.current = isAdmin;
  }, [isAdmin, activeSection]);

  const homepageDomain = domain || activeDomain;
  const homepageNavSummary = useMemo(() => {
    if (homepageIsRunning) {
      return 'Analyzing…';
    }
    if (!homepageResult) {
      return 'No signals yet';
    }
    return `S${homepageResult.source?.statusCode ?? '—'} · M${homepageResult.insights?.meta?.length ?? 0} · A${homepageResult.insights?.assets?.length ?? 0} · F${homepageResult.insights?.frameworks?.length ?? 0}`;
  }, [homepageIsRunning, homepageResult]);

  const unsupportedQuery = useQuery({
    queryKey: ['unsupportedPlugins'],
    queryFn: fetchUnsupportedPlugins,
    initialData: []
  });
  const { refetch: refetchUnsupported } = unsupportedQuery;

  const recentUserScansQuery = useQuery({
    queryKey: ['recentUserScans'],
    queryFn: async () => {
      const result = await request('/api/user/scans');
      return result.ok ? (result.data.domains || []) : [];
    },
    enabled: isAuthenticated,
    staleTime: 30000
  });

  const recentHistoryQuery = useQuery({
    queryKey: ['scanHistoryRecent'],
    queryFn: () => fetchScanHistory({ limit: 8, includeFailed: false }),
    staleTime: 30000,
    enabled: !isAuthenticated
  });

  const recentItems = isAuthenticated
    ? (recentUserScansQuery.data ?? []).slice(0, 8).map((s) => ({
        domain: s.domain,
        lastScannedAt: s.last_scanned_at
      }))
    : (recentHistoryQuery.data?.items ?? []);

  useEffect(() => {
    if (scanResult) {
      setActiveSection('overview');
    }
  }, [scanResult]);

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
        activeSection={activeSection}
        hasScanResult={Boolean(scanResult)}
        homepageNavSummary={homepageNavSummary}
        onSectionChange={setActiveSection}
        onOpenHistory={isAdmin ? handleOpenHistory : null}
        onOpenAdmin={isAdmin ? handleOpenAdmin : null}
        isAdmin={isAdmin}
      />
    ),
    [activeSection, scanResult, homepageNavSummary, handleOpenHistory, handleOpenAdmin, isAdmin]
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
      />

      <RecentDomainsCard
        isLoading={recentHistoryQuery.isLoading}
        items={recentItems}
        isScanning={isScanning}
        isExpanded={recentDomainsExpanded}
        onToggleExpanded={handleToggleRecentDomainsExpanded}
        onOpenHistory={isAdmin ? handleOpenHistory : null}
        onRescan={startScan}
      />

      <ScanStatusStack
        isScanning={isScanning}
        activeDomain={activeDomain}
        homepageIsRunning={homepageIsRunning}
        scanError={scanError}
        homepageError={homepageError}
      />

      <ScanSectionContent
        activeSection={activeSection}
        scanResult={scanResult}
        homepageResult={homepageResult}
        homepageDomain={homepageDomain}
        startSitemapScan={startSitemapScan}
        sitemapResult={sitemapResult}
        isSitemapRunning={isSitemapRunning}
        sitemapFilter={sitemapFilter}
        setSitemapFilter={setSitemapFilter}
        unsupportedPlugins={unsupportedQuery.data ?? []}
        unsupportedIsLoading={unsupportedQuery.isLoading}
        onRefreshUnsupported={handleRefreshUnsupported}
        showDomains={isAdmin}
      />

      {scanResult ? (
        <SaveScanButton domain={scanResult.domain || activeDomain} />
      ) : null}
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
