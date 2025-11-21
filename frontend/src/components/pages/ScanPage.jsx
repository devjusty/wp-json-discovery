import { useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import DomainForm from '../molecules/forms/DomainForm.jsx';
import ScanSummary from '../organisms/summary/ScanSummary.jsx';
import DataTable from '../organisms/data/DataTable.jsx';
import PluginRoutesTable from '../organisms/data/PluginRoutesTable.jsx';
import UnsupportedPluginsPanel from '../organisms/panels/UnsupportedPluginsPanel.jsx';
import Button from '../atoms/Button.jsx';
import { fetchUnsupportedPlugins } from '../../api/client.js';
import { useScan } from '../../hooks/useScan.js';
import { useTableInteractions } from '../../hooks/useTableInteractions.js';

function ScanPage() {
  const {
    startScan,
    scanResult,
    isScanning,
    scanError,
    activeDomain,
    isRotatingLogs,
    rotateLogs
  } = useScan();

  const {
    getTableState,
    toggleTableCollapse,
    toggleTableExpand
  } = useTableInteractions();

  const unsupportedQuery = useQuery({
    queryKey: ['unsupportedPlugins'],
    queryFn: fetchUnsupportedPlugins,
    initialData: []
  });

  return (
    <AppLayout
      title="WP JSON Discovery"
      subtitle="Scan a WordPress site and explore publicly accessible REST data."
    >
      <DomainForm
        onSubmit={startScan}
        isScanning={isScanning}
        initialDomain={scanResult?.domain ?? activeDomain}
      />

      {isScanning ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Scanning {activeDomain}…</p>
          </div>
        </div>
      ) : null}

      {scanError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{scanError?.message ?? 'Scan failed.'}</p>
            {scanError?.code === 'auth_required' ? (
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

      {scanResult ? (
        <>
          <ScanSummary
            domain={scanResult.domain}
            fetchedAt={scanResult.fetchedAt}
            summary={scanResult.summary}
            namespaces={scanResult.namespaces}
            metrics={scanResult.metrics}
            plugins={scanResult.plugins}
            coreDatasets={scanResult.core}
          />

          <section className="section">
            <h2>Core data</h2>
              <div className="grid">
                {scanResult.core.map((dataset) => (
                  <DataTable
                    key={dataset.key}
                    domain={scanResult.domain}
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
                {scanResult.plugins.matched.length > 0 ? (
                  scanResult.plugins.matched.map((plugin) => (
                    <PluginRoutesTable
                      key={plugin.plugin.id}
                      domain={scanResult.domain}
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
            {scanResult.plugins.unsupportedNamespaces.length > 0 ? (
              <div className="card card--info">
                <div className="card__content">
                  <p>
                    Unsupported namespaces recorded:{' '}
                    {scanResult.plugins.unsupportedNamespaces.join(', ')}.
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

      <section className="section">
        <div className="app__footer-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={rotateLogs}
            disabled={isRotatingLogs}
          >
            {isRotatingLogs
              ? 'Rotating logs…'
              : 'Rotate activity log'}
          </Button>
        </div>
      </section>
    </AppLayout>
  );
}

export default ScanPage;
