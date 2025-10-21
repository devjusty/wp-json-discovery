import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import ScanSummary from '../organisms/summary/ScanSummary.jsx';
import DataTable from '../organisms/data/DataTable.jsx';
import PluginRoutesTable from '../organisms/data/PluginRoutesTable.jsx';
import UnsupportedPluginsPanel from '../organisms/panels/UnsupportedPluginsPanel.jsx';
import { scanDomain } from '../../services/scan.js';
import {
  fetchUnsupportedPlugins,
  upsertUnsupportedPlugin
} from '../../api/client.js';
import { logEvent } from '../../services/logger.js';

function ScanPage() {
  const [result, setResult] = useState(null);
  const [activeDomain, setActiveDomain] = useState('');
  const [tableViewState, setTableViewState] = useState({});

  const unsupportedQuery = useQuery({
    queryKey: ['unsupportedPlugins'],
    queryFn: fetchUnsupportedPlugins,
    initialData: []
  });

  const scanMutation = useMutation({
    mutationFn: scanDomain,
    onSuccess: async (data) => {
      setResult(data);
      setTableViewState({});
      let persistenceReport = [];

      if (data.plugins.unsupportedNamespaces.length > 0) {
        const persistenceOutcomes = await Promise.allSettled(
          data.plugins.unsupportedNamespaces.map((namespace) =>
            upsertUnsupportedPlugin({
              namespace,
              domain: data.domain
            })
          )
        );

        persistenceReport = persistenceOutcomes.map((outcome, index) => {
          const namespace = data.plugins.unsupportedNamespaces[index];
          if (outcome.status === 'fulfilled') {
            return {
              namespace,
              status: 'fulfilled'
            };
          }
          const message =
            outcome.reason?.message ??
            (typeof outcome.reason === 'string'
              ? outcome.reason
              : 'Unknown persistence error');

          toast.error(message);
          logEvent('unsupported.persist_failed', {
            domain: data.domain,
            namespace,
            message
          });

          return {
            namespace,
            status: 'rejected',
            message
          };
        });

        const hasSuccess = persistenceReport.some(
          (item) => item.status === 'fulfilled'
        );

        if (hasSuccess) {
          await unsupportedQuery.refetch();
        }

        logEvent('unsupported.persist_attempt', {
          domain: data.domain,
          attempted: persistenceReport.length,
          fulfilled: persistenceReport.filter(
            (item) => item.status === 'fulfilled'
          ).length,
          rejected: persistenceReport.filter(
            (item) => item.status === 'rejected'
          ).length,
          details: persistenceReport
        });
      }

      toast.success(`Scan complete for ${data.domain}`);
      logEvent('scan.complete', {
        domain: data.domain,
        metrics: data.metrics,
        coreSummary: data.core.map((dataset) => ({
          key: dataset.key,
          status: dataset.status,
          rows: dataset.rows.length,
          durationMs: dataset.durationMs
        })),
        matchedPlugins: data.plugins.matched.map((plugin) => ({
          id: plugin.plugin.id,
          namespaces: plugin.namespaces,
          routes: plugin.routes.length
        })),
        unsupportedNamespaces: data.plugins.unsupportedNamespaces,
        unsupportedPersistence: persistenceReport
      });
    },
    onError: (error) => {
      const friendlyMessage =
        error?.code === 'auth_required'
          ? 'Authentication required: REST API access is restricted on this site.'
          : error?.message || 'Scan failed';

      toast.error(friendlyMessage);
      logEvent('scan.error', {
        domain: activeDomain,
        message: friendlyMessage,
        code: error?.code,
        status: error?.status,
        details: error?.details,
        stack: error.stack
      });
    }
  });

  const handleScan = (domain) => {
    setActiveDomain(domain);
    logEvent('scan.started', { domain, triggeredAt: new Date().toISOString() });
    scanMutation.mutate(domain);
  };

  const getTableState = (key) =>
    tableViewState[key] ?? { collapsed: false, expanded: false };

  const updateTableState = (key, updater) => {
    setTableViewState((previous) => {
      const current = previous[key] ?? { collapsed: false, expanded: false };
      const next = updater(current);
      return {
        ...previous,
        [key]: next
      };
    });
  };

  const toggleTableCollapse = (key) => {
    updateTableState(key, (state) => {
      const collapsed = !state.collapsed;
      return {
        collapsed,
        expanded: collapsed ? false : state.expanded
      };
    });
  };

  const toggleTableExpand = (key) => {
    updateTableState(key, (state) => {
      const expanded = !state.expanded;
      return {
        expanded,
        collapsed: expanded ? false : state.collapsed
      };
    });
  };

  return (
    <AppLayout
      title="WP JSON Discovery"
      subtitle="Scan a WordPress site and explore publicly accessible REST data."
    >
      <DomainForm
        onSubmit={handleScan}
        isScanning={scanMutation.isPending}
        initialDomain={result?.domain ?? activeDomain}
      />

      {scanMutation.isPending ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Scanning {activeDomain}…</p>
          </div>
        </div>
      ) : null}

      {scanMutation.isError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{scanMutation.error?.message ?? 'Scan failed.'}</p>
            {scanMutation.error?.code === 'auth_required' ? (
              <ul className="error-hints">
                <li>
                  Confirm if the site blocks anonymous REST API access or
                  requires application passwords.
                </li>
                <li>
                  If you have credentials, sign in or create an application
                  password before retrying.
                </li>
                <li>Otherwise, remove this domain from the scan list.</li>
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {result ? (
        <>
          <ScanSummary
            domain={result.domain}
            fetchedAt={result.fetchedAt}
            summary={result.summary}
            namespaces={result.namespaces}
          />

          <section className="section">
            <h2>Core data</h2>
              <div className="grid">
                {result.core.map((dataset) => (
                  <DataTable
                    key={dataset.key}
                    domain={result.domain}
                    datasetKey={dataset.key}
                    title={dataset.label}
                    description={dataset.description}
                    columns={dataset.columns}
                    rows={dataset.rows}
                    status={dataset.status}
                    error={dataset.error}
                    isCollapsed={getTableState(dataset.key).collapsed}
                    isExpanded={getTableState(dataset.key).expanded}
                    onToggleCollapse={() => toggleTableCollapse(dataset.key)}
                    onToggleExpand={() => toggleTableExpand(dataset.key)}
                  />
                ))}
              </div>
            </section>

            <section className="section">
              <h2>Plugin routes</h2>
              <div className="grid">
                {result.plugins.matched.length > 0 ? (
                  result.plugins.matched.map((plugin) => (
                    <PluginRoutesTable
                      key={plugin.plugin.id}
                      domain={result.domain}
                      pluginMatch={plugin}
                      isCollapsed={
                        getTableState(`plugin-${plugin.plugin.id}`).collapsed
                      }
                      isExpanded={
                        getTableState(`plugin-${plugin.plugin.id}`).expanded
                      }
                      onToggleCollapse={() =>
                        toggleTableCollapse(`plugin-${plugin.plugin.id}`)
                      }
                      onToggleExpand={() =>
                        toggleTableExpand(`plugin-${plugin.plugin.id}`)
                      }
                    />
                  ))
                ) : (
                  <div className="card">
                    <div className="card__content">
                    <p>No supported plugin namespaces detected.</p>
                  </div>
                </div>
              )}
            </div>
            {result.plugins.unsupportedNamespaces.length > 0 ? (
              <div className="card card--info">
                <div className="card__content">
                  <p>
                    Unsupported namespaces recorded:{' '}
                    {result.plugins.unsupportedNamespaces.join(', ')}.
                    They&apos;ve been added to the persistent tracking list
                    below.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <div className="card card--info">
          <div className="card__content">
            <p>
              Enter a domain to discover available REST endpoints, review core
              content, and track unsupported plugin namespaces.
            </p>
          </div>
        </div>
      )}

      <section className="section">
        <UnsupportedPluginsPanel
          plugins={unsupportedQuery.data ?? []}
          isLoading={unsupportedQuery.isLoading}
          onRefresh={() => unsupportedQuery.refetch()}
        />
      </section>
    </AppLayout>
  );
}

export default ScanPage;
