import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout.jsx';
import Button from '../atoms/Button.jsx';
import StatusBadge from '../molecules/StatusBadge.jsx';
import { fetchScanHistory } from '../../api/client.js';
import { formatDate } from '../../utils/format.js';

function HistoryPage({ headerActions, onRescan }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [includeFailed, setIncludeFailed] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['scanHistory', { query, sort, includeFailed }],
    queryFn: () => fetchScanHistory({
      q: query,
      sort,
      includeFailed,
      limit: 100
    })
  });

  const items = historyQuery.data?.items ?? [];
  const total = Number(historyQuery.data?.pagination?.total ?? 0);

  const statusMeta = useMemo(() => {
    const successful = items.filter((item) => item.lastStatus === 'success').length;
    const failed = items.filter((item) => item.lastStatus === 'failed').length;
    return { successful, failed };
  }, [items]);

  return (
    <AppLayout
      title="Scan History"
      subtitle="Browse previously scanned sites and re-scan with one click."
      headerActions={headerActions}
    >
      <div className="card">
        <div className="card__content">
          <div className="history-controls">
            <label className="history-controls__field" htmlFor="history-search">
              Search domains
              <input
                id="history-search"
                type="text"
                className="text-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="example.com"
              />
            </label>

            <label className="history-controls__field" htmlFor="history-sort">
              Sort by
              <select
                id="history-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">Most recent</option>
                <option value="domain">Domain (A-Z)</option>
                <option value="duration">Duration (slowest)</option>
              </select>
            </label>

            <label className="history-controls__toggle" htmlFor="history-show-failed">
              <input
                id="history-show-failed"
                type="checkbox"
                checked={includeFailed}
                onChange={(event) => setIncludeFailed(event.target.checked)}
              />
              Include failed scans
            </label>
          </div>

          <p className="card__meta">
            Showing {items.length} of {total} scanned domains. Success: {statusMeta.successful}
            {includeFailed ? ` · Failed: ${statusMeta.failed}` : ''}
          </p>
        </div>
      </div>

      {historyQuery.isLoading ? (
        <div className="card card--info">
          <div className="card__content">
            <p>Loading scan history…</p>
          </div>
        </div>
      ) : null}

      {historyQuery.error ? (
        <div className="card card--error">
          <div className="card__content">
            <p>{historyQuery.error.message ?? 'Failed to load scan history.'}</p>
          </div>
        </div>
      ) : null}

      {!historyQuery.isLoading && !historyQuery.error && items.length === 0 ? (
        <div className="card card--info">
          <div className="card__content">
            <p>No previously scanned domains match your filters.</p>
          </div>
        </div>
      ) : null}

      <div className="history-grid">
        {items.map((item) => (
          <article key={item.domain} className="history-card">
            <div className="history-card__header">
              <h3>{item.domain}</h3>
              <StatusBadge
                tone={item.lastStatus === 'success' ? 'success' : 'danger'}
                label={item.lastStatus === 'success' ? 'Success' : 'Failed'}
              />
            </div>

            <dl className="history-card__meta">
              <div>
                <dt>Last scanned</dt>
                <dd>{formatDate(item.lastScannedAt) || '—'}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(item.lastDurationMs)}</dd>
              </div>
              <div>
                <dt>Unsupported namespaces</dt>
                <dd>{Number(item.lastUnsupportedCount ?? 0)}</dd>
              </div>
              <div>
                <dt>Error category</dt>
                <dd>{item.lastErrorCategory || '—'}</dd>
              </div>
            </dl>

            <div className="history-card__actions">
              <Button type="button" size="sm" onClick={() => onRescan(item.domain)}>
                Re-scan
              </Button>
            </div>
          </article>
        ))}
      </div>
    </AppLayout>
  );
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return '—';
  }

  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  return `${durationMs}ms`;
}

HistoryPage.propTypes = {
  headerActions: PropTypes.node,
  onRescan: PropTypes.func.isRequired
};

HistoryPage.defaultProps = {
  headerActions: null
};

export default HistoryPage;
