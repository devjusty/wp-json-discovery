import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import { fetchScanHistory, fetchUnsupportedPlugins } from '../../api/client.js';
import { useSitemapScan } from '../../hooks/useSitemapScan.js';
import { useScanContext } from '../../context/ScanContext.jsx';
import ScanSidebarNav from './scan/ScanSidebarNav.jsx';
import ScanSectionContent from './scan/ScanSectionContent.jsx';
import RecentDomainsCard from './scan/RecentDomainsCard.jsx';
import ScanStatusStack from './scan/ScanStatusStack.jsx';

function ScanPage({ headerActions }) {
  const {
    domain,
    handleDomainChange: onDomainChange,
    setActivePage,
    startScan,
    scanResult,
    isScanning,
    scanError,
    activeDomain,
    homepageResult,
    homepageIsRunning,
    homepageError
  } = useScanContext();

  const {
    startSitemapScan,
    result: sitemapResult,
    isRunning: isSitemapRunning
  } = useSitemapScan();

  const [sitemapFilter, setSitemapFilter] = useState('all');
  const [activeSection, setActiveSection] = useState('overview');

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

  const sidebar = (
    <ScanSidebarNav
      activeSection={activeSection}
      hasScanResult={Boolean(scanResult)}
      homepageNavSummary={homepageNavSummary}
      onSectionChange={setActiveSection}
      onOpenHistory={() => setActivePage('history')}
      onOpenAdmin={() => setActivePage('admin')}
    />
  );

  return (
    <AppLayout
      title="WP JSON Discovery"
      subtitle="Scan a WordPress site and review REST exposure plus homepage source signals."
      headerActions={headerActions}
      sidebar={sidebar}
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
        onOpenHistory={() => setActivePage('history')}
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
        onRefreshUnsupported={() => unsupportedQuery.refetch()}
      />
    </AppLayout>
  );
}

ScanPage.propTypes = {
  headerActions: PropTypes.node
};

ScanPage.defaultProps = {
  headerActions: null
};

export default ScanPage;
