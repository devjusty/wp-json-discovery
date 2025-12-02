import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import { Card, CardContent, CardHeader } from '../atoms/Card.jsx';
import Button from '../atoms/Button.jsx';
import { fetchDbSnapshot } from '../../api/admin.js';
import { SUPPORTED_PLUGINS } from '../../config/plugins.js';
import { SUPPORTED_THEMES } from '../../config/themes.js';

function AdminPage({ headerActions, onNavigate }) {
  const [activeSection, setActiveSection] = useState('db');
  const snapshotQuery = useQuery({
    queryKey: ['dbSnapshot'],
    queryFn: () => fetchDbSnapshot(75),
    refetchOnWindowFocus: false
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
        </div>
      </nav>
    );
  }, [activeSection, onNavigate, snapshotQuery]);

  const data = snapshotQuery.data;

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
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="pill-list">
                    <li className="pill">Unsupported plugins: {data.totals?.unsupportedPlugins ?? 0}</li>
                    <li className="pill">Domains tracked: {data.totals?.unsupportedPluginDomains ?? 0}</li>
                    <li className="pill">Activity logs: {data.totals?.activityLogs ?? 0}</li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div>
                    <h2>Unsupported plugins</h2>
                    <p className="card__meta">Current registry with domains and timestamps.</p>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.unsupportedPlugins?.length ? (
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
                          <span>{plugin.firstDetectedAt}</span>
                          <span>{plugin.lastDetectedAt}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="card__meta">No unsupported plugins recorded.</p>
                  )}
                </CardContent>
              </Card>
            </div>
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
                {SUPPORTED_PLUGINS.map((plugin) => (
                  <div key={plugin.id} className="admin-table__row">
                    <span>{plugin.label}</span>
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
                  </div>
                ))}
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
                {SUPPORTED_THEMES.map((theme) => (
                  <div key={theme.id} className="admin-table__row">
                    <span>{theme.label}</span>
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
                  </div>
                ))}
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
  onNavigate: PropTypes.func.isRequired
};

AdminPage.defaultProps = {
  headerActions: null
};

export default AdminPage;
