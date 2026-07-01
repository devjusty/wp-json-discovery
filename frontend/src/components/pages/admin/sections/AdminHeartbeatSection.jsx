import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import TrendBadge from '../TrendBadge.jsx';
import { formatFullTimestamp, formatMs } from '../utils.js';

function AdminHeartbeatSection({ data, heartbeatP95Series, heartbeatErrorSeries }) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-heartbeat-overview">Heartbeat metrics</h2>
            <p className="card__meta">
              Rolling metrics emitted every 10 completed scans (`metrics.heartbeat`).
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {data?.heartbeat?.latest ? (
            <>
              <div className="stat-grid">
                <div className="stat-grid__item">
                  <dt>Window</dt>
                  <dd>
                    {formatFullTimestamp(data.heartbeat.latest.payload?.window?.startedAt) || '—'} →{' '}
                    {formatFullTimestamp(data.heartbeat.latest.payload?.window?.endedAt) || '—'}
                  </dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Latest heartbeat</dt>
                  <dd>{formatFullTimestamp(data.heartbeat.latest.timestamp) || '—'}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Scans completed</dt>
                  <dd>{data.heartbeat.latest.payload?.scansCompleted ?? '—'}</dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Scan p50 / p95</dt>
                  <dd>
                    {formatMs(data.heartbeat.latest.payload?.scanDurationMs?.p50)} /{' '}
                    {formatMs(data.heartbeat.latest.payload?.scanDurationMs?.p95)}
                  </dd>
                </div>
                <div className="stat-grid__item">
                  <dt>Error total</dt>
                  <dd>{data.heartbeat.latest.payload?.errors?.total ?? 0}</dd>
                </div>
              </div>
              <div className="heartbeat-trends">
                <TrendBadge
                  label="p95 latency trend"
                  values={heartbeatP95Series}
                  lowerIsBetter
                  formatValue={(value) => formatMs(value)}
                />
                <TrendBadge
                  label="Error total trend"
                  values={heartbeatErrorSeries}
                  lowerIsBetter
                  formatValue={(value) => String(Math.round(value))}
                />
              </div>

              <h3 id="admin-heartbeat-errors" className="section-heading-spaced">Errors by category</h3>
              {data.heartbeat.latest.payload?.errors?.perCategory?.length ? (
                <div className="admin-table admin-table--heartbeat-errors">
                  <div className="admin-table__header">
                    <span>Category</span>
                    <span>Count</span>
                    <span>Rate / scan</span>
                  </div>
                  {data.heartbeat.latest.payload.errors.perCategory.map((row) => (
                    <div key={`errcat-${row.category}`} className="admin-table__row">
                      <span>{row.category}</span>
                      <span>{row.count}</span>
                      <span>{Number.isFinite(row.ratePerScan) ? row.ratePerScan.toFixed(2) : '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No errors recorded in latest heartbeat window.</p>
              )}

              <h3 id="admin-heartbeat-failing-domains" className="section-heading-spaced">Top failing domains</h3>
              {data.heartbeat.latest.payload?.errors?.topFailingDomains?.length ? (
                <div className="admin-table admin-table--heartbeat-failing">
                  <div className="admin-table__header">
                    <span>Domain</span>
                    <span>Count</span>
                  </div>
                  {data.heartbeat.latest.payload.errors.topFailingDomains.map((row) => (
                    <div key={`fail-domain-${row.domain}`} className="admin-table__row">
                      <span>{row.domain}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No failing domains in latest heartbeat window.</p>
              )}

              <h3 id="admin-heartbeat-unsupported" className="section-heading-spaced">Top unsupported namespaces</h3>
              {data.heartbeat.latest.payload?.unsupportedPlugins?.topNamespaces?.length ? (
                <div className="admin-table admin-table--heartbeat-unsupported">
                  <div className="admin-table__header">
                    <span>Namespace</span>
                    <span>Count</span>
                  </div>
                  {data.heartbeat.latest.payload.unsupportedPlugins.topNamespaces.map((row) => (
                    <div key={`unsupported-ns-${row.namespace}`} className="admin-table__row">
                      <span>{row.namespace}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card__meta">No unsupported namespace events in latest heartbeat window.</p>
              )}
            </>
          ) : (
            <p className="card__meta">
              No heartbeat events yet. Heartbeat emits after every 10 completed scans.
            </p>
          )}

          <h3 id="admin-heartbeat-recent" className="section-heading-spaced">Recent heartbeat events</h3>
          {data?.heartbeat?.recent?.length ? (
            <div className="admin-table admin-table--heartbeat-recent">
              <div className="admin-table__header">
                <span>ID</span>
                <span>Timestamp</span>
                <span>Scans</span>
                <span>p95</span>
                <span>Error total</span>
              </div>
              {data.heartbeat.recent.map((heartbeat) => (
                <div key={`heartbeat-${heartbeat.id}`} className="admin-table__row">
                  <span>{heartbeat.id}</span>
                  <span>{formatFullTimestamp(heartbeat.timestamp) || '—'}</span>
                  <span>{heartbeat.payload?.scansCompleted ?? '—'}</span>
                  <span>{formatMs(heartbeat.payload?.scanDurationMs?.p95)}</span>
                  <span>{heartbeat.payload?.errors?.total ?? 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="card__meta">No heartbeat history yet.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminHeartbeatSection.propTypes = {
  data: PropTypes.object.isRequired,
  heartbeatP95Series: PropTypes.arrayOf(PropTypes.number),
  heartbeatErrorSeries: PropTypes.arrayOf(PropTypes.number)
};

AdminHeartbeatSection.defaultProps = {
  heartbeatP95Series: [],
  heartbeatErrorSeries: []
};

export default AdminHeartbeatSection;
