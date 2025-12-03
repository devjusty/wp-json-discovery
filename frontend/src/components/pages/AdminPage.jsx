import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import { Card, CardContent, CardHeader } from '../atoms/Card.jsx';
import Button from '../atoms/Button.jsx';
import { fetchDbSnapshot, pruneActivityLogs } from '../../api/admin.js';
import { SUPPORTED_PLUGINS } from '../../config/plugins.js';
import { SUPPORTED_THEMES } from '../../config/themes.js';

function AdminPage({ headerActions, onNavigate, rotateLogs, isRotatingLogs, onRescan }) {
  const [activeSection, setActiveSection] = useState('db');
  const [expandedPluginId, setExpandedPluginId] = useState(null);
  const [expandedThemeId, setExpandedThemeId] = useState(null);
  const [expandedScanIds, setExpandedScanIds] = useState(new Set());
  const snapshotQuery = useQuery({
    queryKey: ['dbSnapshot'],
    queryFn: () => fetchDbSnapshot(75),
    refetchOnWindowFocus: false
  });
  const pruneMutation = useMutation({
    mutationFn: pruneActivityLogs,
    onSuccess: () => {
      snapshotQuery.refetch();
    }
  });

  const sidebarNav = useMemo(() => {
    return (
      <nav className="sidebar">
        <div className="sidebar__section">
          <p className="sidebar__title">Navigation</p>
          <ul className="sidebar__nav">
            <li>
              <button
                type="button"
                className="sidebar__link"
                onClick={() => onNavigate('scan')}
              >
                ← Back to overview
              </button>
            </li>
            <li>
              <button
                type="button"
                className="sidebar__link is-active"
                onClick={() => onNavigate('admin')}
                aria-current="page"
              >
                Admin (current)
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'db' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('db')}
              >
                Data snapshot
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'unsupported' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('unsupported')}
              >
                Unsupported plugins
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'domains' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('domains')}
              >
                Domains tracked
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'logs' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('logs')}
              >
                Activity logs
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'plugins' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('plugins')}
              >
                Supported plugins
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__link ${activeSection === 'themes' ? 'is-active' : ''}`}
                onClick={() => setActiveSection('themes')}
              >
                Supported themes
              </button>
            </li>
          </ul>
        </div>
        <div className="sidebar__section">
          <p className="sidebar__title">Actions</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="sidebar__action"
            onClick={() => snapshotQuery.refetch()}
            disabled={snapshotQuery.isFetching || activeSection !== 'db'}
          >
            {snapshotQuery.isFetching ? 'Refreshing…' : 'Refresh snapshot'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="sidebar__action"
            onClick={rotateLogs}
            disabled={isRotatingLogs}
          >
            {isRotatingLogs ? 'Rotating logs…' : 'Rotate activity log'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="sidebar__action"
            onClick={() => pruneMutation.mutate({ keepLatest: 1000, olderThanDays: 30 })}
            disabled={pruneMutation.isPending}
          >
            {pruneMutation.isPending ? 'Pruning…' : 'Prune activity log'}
          </Button>
        </div>
      </nav>
    );
  }, [activeSection, onNavigate, snapshotQuery, rotateLogs, isRotatingLogs, pruneMutation.isPending]);

  const data = snapshotQuery.data;
  const recentScans = useMemo(() => {
    if (!data?.activityLogs?.length) return [];
    return data.activityLogs
      .filter((log) => log.type === 'scan.complete' && log.payload?.domain)
      .slice(0, 10);
  }, [data]);

  return (
    <AppLayout
      title="Admin"
      subtitle="Inspect SQLite persistence for unsupported plugins and recent activity logs."
      headerActions={headerActions}
      sidebar={sidebarNav}
    >
      {activeSection === 'db' && snapshotQuery.isLoading ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Loading database snapshot…</p>
          </div>
        </div>
      ) : null}
      {activeSection === 'db' && snapshotQuery.isError ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{snapshotQuery.error?.message ?? 'Failed to load snapshot.'}</p>
          </div>
        </div>
      ) : null}

      {activeSection === 'db' && data ? (
        <>
          <section className="section">
            <div className="grid">
      <Card>
        <CardHeader>
          <div>
            <h2>Database</h2>
            <p className="card__meta">{data.dbPath}</p>
                    {pruneMutation.data ? (
                      <p className="card__meta">
                        Pruned {pruneMutation.data.prunedByAge + pruneMutation.data.prunedByCount} rows · Remaining: {pruneMutation.data.remaining}
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="pill-list">
                    <li className="pill">
                      <button type="button" className="pill__link" onClick={() => setActiveSection('unsupported')}>
                        Unsupported plugins: {data.totals?.unsupportedPlugins ?? 0}
                      </button>
                    </li>
                    <li className="pill">
                      <button type="button" className="pill__link" onClick={() => setActiveSection('domains')}>
                        Domains tracked: {data.totals?.unsupportedPluginDomains ?? 0}
                      </button>
                    </li>
                    <li className="pill">
                      <button type="button" className="pill__link" onClick={() => setActiveSection('logs')}>
                        Activity logs: {data.totals?.activityLogs ?? 0}
                      </button>
                    </li>
                  </ul>
                  <div className="stat-grid">
                    <div className="stat-grid__item">
                      <dt>DB size</dt>
                      <dd>{formatBytes(data.files?.db?.sizeBytes)}</dd>
                    </div>
                    <div className="stat-grid__item">
                      <dt>Activity log</dt>
                      <dd>{formatBytes(data.files?.activityLog?.sizeBytes)}</dd>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="section">
            <Card>
              <CardHeader>
                <div>
                  <h2>Recent scans</h2>
                  <p className="card__meta">
                    Last 10 scan events from the activity log. Full snapshots are stored in log payloads.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {recentScans.length ? (
                  <div className="admin-table admin-table--scans">
                  <div className="admin-table__header">
                    <span>Domain</span>
                    <span>Timestamp</span>
                    <span>Namespaces</span>
                    <span>Plugins matched</span>
                    <span>Action</span>
                  </div>
                    {recentScans.map((log) => {
                      const key = `${log.id}:${log.payload?.domain}`;
                      const isExpanded = expandedScanIds.has(key);
                      const snapshot = log.payload?.snapshot ?? log.payload ?? {};

                      const toggleExpanded = () => {
                        setExpandedScanIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) {
                            next.delete(key);
                          } else {
                            next.add(key);
                          }
                          return next;
                        });
                      };

                      return (
                        <div key={key} className="admin-table__row admin-table__row--expandable">
                          <button
                            type="button"
                            className="admin-table__cell admin-table__cell--expand"
                            onClick={toggleExpanded}
                            aria-expanded={isExpanded}
                          >
                            {log.payload?.domain}
                          </button>
                          <span>{log.timestamp}</span>
                          <span>{log.payload?.metrics?.namespacesCount ?? '—'}</span>
                          <span>{log.payload?.metrics?.plugins?.matchedCount ?? '—'}</span>
                          <span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onRescan(log.payload?.domain)}
                              disabled={!log.payload?.domain}
                            >
                              Rescan
                            </Button>
                          </span>
                          {isExpanded ? (
                            <div className="admin-table__details">
                              <p>
                                <strong>Snapshot size:</strong>{' '}
                                {log.payload?.snapshotBytes ?? JSON.stringify(snapshot).length} bytes
                              </p>
                              <code className="code-block">
                                {JSON.stringify(snapshot, null, 2)}
                              </code>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="card__meta">No recent scans found.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="section">
            <Card>
              <CardHeader>
                <div>
                  <h2>Recent activity logs</h2>
                  <p className="card__meta">Most recent entries (up to 75).</p>
                </div>
              </CardHeader>
              <CardContent>
                {data.activityLogs?.length ? (
                  <div className="admin-table admin-table--logs">
                    <div className="admin-table__header">
                      <span>ID</span>
                      <span>Timestamp</span>
                      <span>Type</span>
                      <span>Payload</span>
                    </div>
                    {data.activityLogs.map((log) => (
                      <div key={log.id} className="admin-table__row">
                        <span>{log.id}</span>
                        <span>{log.timestamp}</span>
                        <span>{log.type}</span>
                        <code className="admin-table__code">
                          {typeof log.payload === 'string'
                            ? log.payload
                            : JSON.stringify(log.payload ?? {}, null, 2)}
                        </code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="card__meta">No log entries found.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      {activeSection === 'domains' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2>Domains tracked</h2>
                <p className="card__meta">
                  Unique domains observed across unsupported plugin records.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {data?.unsupportedPlugins?.length ? (
                <div className="admin-table">
                  <div className="admin-table__header">
                    <span>Domain</span>
                    <span>Plugins</span>
                    <span>Action</span>
                  </div>
                  {deriveDomainsFromUnsupported(data.unsupportedPlugins).map((domainEntry) => (
                    <div key={domainEntry.domain} className="admin-table__row">
                      <span>{domainEntry.domain}</span>
                      <span>{domainEntry.namespaces.length}</span>
                      <span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onRescan(domainEntry.domain)}
                        >
                          Rescan
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No domains recorded.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'unsupported' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2>Unsupported plugins</h2>
                <p className="card__meta">Current registry with domains and timestamps.</p>
              </div>
            </CardHeader>
            <CardContent>
              {data?.unsupportedPlugins?.length ? (
                <div className="admin-table">
                  <div className="admin-table__header">
                    <span>Namespace</span>
                    <span>Domains</span>
                    <span>First seen</span>
                    <span>Last seen</span>
                  </div>
                  {data.unsupportedPlugins.map((plugin) => (
                    <div key={plugin.namespace} className="admin-table__row">
                      <span>{plugin.namespace}</span>
                      <span>{plugin.domains?.length ?? 0}</span>
                      <span className="tooltip">
                        {formatShortDate(plugin.firstDetectedAt)}
                        <span className="tooltip__content">
                          {formatFullTimestamp(plugin.firstDetectedAt) || '—'}
                        </span>
                      </span>
                      <span className="tooltip">
                        {formatShortDate(plugin.lastDetectedAt)}
                        <span className="tooltip__content">
                          {formatFullTimestamp(plugin.lastDetectedAt) || '—'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No unsupported plugins recorded.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'logs' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2>Activity logs</h2>
                <p className="card__meta">
                  Recent activity log rows (up to 75) with payloads.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {data?.activityLogs?.length ? (
                <div className="admin-table admin-table--logs">
                  <div className="admin-table__header">
                    <span>ID</span>
                    <span>Timestamp</span>
                    <span>Type</span>
                    <span>Payload</span>
                  </div>
                  {data.activityLogs.map((log) => (
                    <div key={log.id} className="admin-table__row">
                      <span>{log.id}</span>
                      <span>{log.timestamp}</span>
                      <span>{log.type}</span>
                      <code className="admin-table__code">
                        {typeof log.payload === 'string'
                          ? log.payload
                          : JSON.stringify(log.payload ?? {}, null, 2)}
                      </code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No log entries found.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'plugins' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2>Supported plugins</h2>
                <p className="card__meta">
                  {SUPPORTED_PLUGINS.length} plugin namespaces tracked in the registry.
                </p>
              </div>
            </CardHeader>
            <CardContent>
                <div className="admin-table admin-table--plugins">
                  <div className="admin-table__header">
                    <span>Plugin</span>
                    <span>Namespaces</span>
                    <span>Docs</span>
                    <span>Description</span>
                  </div>
                  {SUPPORTED_PLUGINS.map((plugin) => {
                    const isExpanded = expandedPluginId === plugin.id;
                    return (
                      <div key={plugin.id} className="admin-table__row admin-table__row--expandable">
                        <button
                          type="button"
                          className="admin-table__cell admin-table__cell--expand"
                          onClick={() => setExpandedPluginId(isExpanded ? null : plugin.id)}
                          aria-expanded={isExpanded}
                        >
                          {plugin.label}
                        </button>
                        <span>{plugin.namespaces?.length ?? 0}</span>
                        <span>
                          {plugin.pluginUrl ? (
                            <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">
                              Link
                            </a>
                          ) : (
                            '—'
                          )}
                        </span>
                        <span>{plugin.description}</span>
                        {isExpanded ? (
                          <div className="admin-table__details">
                            <p><strong>Namespaces:</strong> {plugin.namespaces?.length ? plugin.namespaces.join(', ') : 'None'}</p>
                            <p><strong>Asset hints:</strong> {plugin.assetHints?.length ? plugin.assetHints.join(', ') : 'None'}</p>
                            {plugin.pluginUrl ? (
                              <p><strong>Docs:</strong> <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">{plugin.pluginUrl}</a></p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeSection === 'themes' ? (
        <section className="section">
          <Card>
            <CardHeader>
              <div>
                <h2>Supported themes</h2>
                <p className="card__meta">
                  {SUPPORTED_THEMES.length} popular themes tracked for detection signals.
                </p>
              </div>
            </CardHeader>
            <CardContent>
                <div className="admin-table admin-table--themes">
                  <div className="admin-table__header">
                    <span>Theme</span>
                    <span>Signals</span>
                    <span>Docs</span>
                    <span>Description</span>
                  </div>
                  {SUPPORTED_THEMES.map((theme) => {
                    const isExpanded = expandedThemeId === theme.id;
                    return (
                      <div key={theme.id} className="admin-table__row admin-table__row--expandable">
                        <button
                          type="button"
                          className="admin-table__cell admin-table__cell--expand"
                          onClick={() => setExpandedThemeId(isExpanded ? null : theme.id)}
                          aria-expanded={isExpanded}
                        >
                          {theme.label}
                        </button>
                        <span>{theme.signals?.length ?? 0}</span>
                        <span>
                          {theme.themeUrl ? (
                            <a href={theme.themeUrl} target="_blank" rel="noreferrer">
                              Link
                            </a>
                          ) : (
                            '—'
                          )}
                        </span>
                        <span>{theme.description}</span>
                        {isExpanded ? (
                          <div className="admin-table__details">
                            <p><strong>Signals:</strong> {theme.signals?.length ? theme.signals.join(', ') : 'None'}</p>
                            {theme.themeUrl ? (
                              <p><strong>Docs:</strong> <a href={theme.themeUrl} target="_blank" rel="noreferrer">{theme.themeUrl}</a></p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </AppLayout>
  );
}

AdminPage.propTypes = {
  headerActions: PropTypes.node,
  onNavigate: PropTypes.func.isRequired,
  rotateLogs: PropTypes.func.isRequired,
  isRotatingLogs: PropTypes.bool,
  onRescan: PropTypes.func.isRequired
};

AdminPage.defaultProps = {
  headerActions: null,
  isRotatingLogs: false
};

export default AdminPage;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatShortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  });
}

function formatFullTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function deriveDomainsFromUnsupported(unsupported = []) {
  const map = new Map();
  unsupported.forEach((entry) => {
    (entry.domains ?? []).forEach((domain) => {
      const record = map.get(domain) ?? { domain, namespaces: [] };
      record.namespaces.push(entry.namespace);
      map.set(domain, record);
    });
  });
  return Array.from(map.values()).sort((a, b) => a.domain.localeCompare(b.domain));
}
