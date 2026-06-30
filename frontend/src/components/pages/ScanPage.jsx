import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import { fetchScanHistory, fetchUnsupportedPlugins } from '../../api/client.js';
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

function ScanPage({ headerActions, onNavigate, isAdmin }) {
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

  const recentHistoryQuery = useQuery({
    queryKey: ['scanHistoryRecent'],
    queryFn: () => fetchScanHistory({ limit: 8, includeFailed: false }),
    staleTime: 30000
  });

  const recentItems = recentHistoryQuery.data?.items ?? [];

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
      />
    ),
    [activeSection, scanResult, homepageNavSummary, handleOpenHistory, handleOpenAdmin, isAdmin]
  );

  return (
      <AppLayout
      title="WP JSON Discovery"
      subtitle="Scan a WordPress site and review REST exposure plus homepage source signals."
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
  isAdmin: PropTypes.bool
};

ScanPage.defaultProps = {
  headerActions: null,
  onNavigate: undefined,
  isAdmin: false
};

export default ScanPage;
