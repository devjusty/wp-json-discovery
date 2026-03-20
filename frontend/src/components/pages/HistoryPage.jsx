import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '../templates/AppLayout.jsx';
import Button from '../atoms/Button.jsx';
import StatusBadge from '../molecules/StatusBadge.jsx';
import { fetchDomainScanHistory, fetchScanHistory } from '../../api/client.js';
import { formatDate } from '../../utils/format.js';

const PAGE_SIZE = 20;

function HistoryPage({ headerActions, onRescan, onUseDomain }) {
  const initialState = getInitialHistoryState();
  const [query, setQuery] = useState(initialState.query);
  const [sort, setSort] = useState(initialState.sort);
  const [includeFailed, setIncludeFailed] = useState(initialState.includeFailed);
  const [page, setPage] = useState(initialState.page);
  const [activeDomain, setActiveDomain] = useState('');
  const [copiedDomain, setCopiedDomain] = useState('');

  const historyQuery = useQuery({
    queryKey: ['scanHistory', { query, sort, includeFailed, page }],
    queryFn: () => fetchScanHistory({
      q: query,
      sort,
      includeFailed,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    })
  });

  const items = useMemo(() => historyQuery.data?.items ?? [], [historyQuery.data?.items]);
  const total = Number(historyQuery.data?.pagination?.total ?? 0);

  const domainHistoryQuery = useQuery({
    queryKey: ['scanHistoryDomain', { domain: activeDomain, includeFailed }],
    queryFn: () => fetchDomainScanHistory(activeDomain, { includeFailed, limit: 10 }),
    enabled: Boolean(activeDomain)
  });

  const statusMeta = useMemo(() => {
    const successful = items.filter((item) => item.lastStatus === 'success').length;
    const failed = items.filter((item) => item.lastStatus === 'failed').length;
    return { successful, failed };
  }, [items]);

  const trendMeta = useMemo(() => {
    const totalItems = items.length;
    const successCount = items.filter((item) => item.lastStatus === 'success').length;
    const failedCount = items.filter((item) => item.lastStatus === 'failed').length;
    const avgDuration = items
      .map((item) => Number(item.lastDurationMs))
      .filter((value) => Number.isFinite(value) && value >= 0);

    return {
      successRate: totalItems > 0 ? Math.round((successCount / totalItems) * 100) : null,
      failedCount,
      averageDuration: avgDuration.length
        ? Math.round(avgDuration.reduce((sum, value) => sum + value, 0) / avgDuration.length)
        : null
    };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrevPage = page > 1;
  const hasNextPage = page < totalPages;

  useEffect(() => {
    setPage(1);
  }, [query, sort, includeFailed]);

  useEffect(() => {
    setActiveDomain('');
  }, [page, query, sort, includeFailed]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (query) params.set('q', query);
    else params.delete('q');
    params.set('sort', sort);
    if (includeFailed) params.set('includeFailed', 'true');
    else params.delete('includeFailed');
    if (page > 1) params.set('page', String(page));
    else params.delete('page');

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [query, sort, includeFailed, page]);

  const handleCopyDomain = async (domain) => {
    if (!domain) {
      return;
    }

    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(domain);
      toast.success(`Copied ${domain}`);
      window.setTimeout(() => {
        setCopiedDomain((current) => (current === domain ? '' : current));
      }, 1500);
    } catch {
      toast.error('Unable to copy domain to clipboard.');
    }
  };

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

          <div className="history-trends">
            <span className="history-trends__item">
              Success rate: {trendMeta.successRate === null ? '—' : `${trendMeta.successRate}%`}
            </span>
            <span className="history-trends__item">
              Avg duration: {formatDuration(trendMeta.averageDuration)}
            </span>
            <span className="history-trends__item">
              Failed in view: {trendMeta.failedCount}
            </span>
          </div>
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
                <dd>{formatHistoryDate(item.lastScannedAt) || '—'}</dd>
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCopyDomain(item.domain)}
              >
                {copiedDomain === item.domain ? 'Copied' : 'Copy domain'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onUseDomain(item.domain)}
              >
                Use in scanner
              </Button>
              <Button
                type="button"
                variant={activeDomain === item.domain ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveDomain((current) => (current === item.domain ? '' : item.domain))}
              >
                {activeDomain === item.domain ? 'Hide runs' : 'View runs'}
              </Button>
              <Button type="button" size="sm" onClick={() => onRescan(item.domain)}>
                Re-scan
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="history-pagination">
        <Button type="button" variant="ghost" size="sm" disabled={!hasPrevPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          Previous
        </Button>
        <span className="history-pagination__meta">
          Page {page} of {totalPages}
        </span>
        <Button type="button" variant="ghost" size="sm" disabled={!hasNextPage} onClick={() => setPage((current) => current + 1)}>
          Next
        </Button>
      </div>

      {activeDomain ? (
        <div className="card">
          <div className="card__header">
            <div>
              <h2>Recent runs for {activeDomain}</h2>
              <p className="card__meta">
                {includeFailed
                  ? 'Showing successful and failed runs.'
                  : 'Showing successful runs only. Enable include failed to see errors.'}
              </p>
            </div>
          </div>
          <div className="card__content">
            {domainHistoryQuery.isLoading ? (
              <p className="card__meta">Loading run history…</p>
            ) : domainHistoryQuery.error ? (
              <p className="card__error">{domainHistoryQuery.error.message ?? 'Unable to load run history.'}</p>
            ) : (
              <ul className="history-runs-list">
                {(domainHistoryQuery.data?.runs ?? []).map((run) => (
                  <li key={run.id} className="history-runs-list__item">
                    <div className="history-runs-list__header">
                      <strong>{formatDate(run.scannedAt) || 'Unknown time'}</strong>
                      <StatusBadge
                        tone={run.status === 'success' ? 'success' : 'danger'}
                        label={run.status === 'success' ? 'Success' : 'Failed'}
                      />
                    </div>
                    <p className="card__meta">
                      Duration: {formatDuration(run.durationMs)} · Unsupported: {Number(run.unsupportedCount ?? 0)}
                    </p>
                    {run.errorCategory || run.errorMessage ? (
                      <p className="card__meta">
                        Error: {run.errorCategory || 'unknown'}
                        {run.errorMessage ? ` - ${run.errorMessage}` : ''}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
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

function formatHistoryDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

HistoryPage.propTypes = {
  headerActions: PropTypes.node,
  onRescan: PropTypes.func.isRequired,
  onUseDomain: PropTypes.func.isRequired
};

HistoryPage.defaultProps = {
  headerActions: null
};

export default HistoryPage;

function getInitialHistoryState() {
  if (typeof window === 'undefined') {
    return {
      query: '',
      sort: 'recent',
      includeFailed: false,
      page: 1
    };
  }

  const params = new URLSearchParams(window.location.search);
  const query = params.get('q') ?? '';
  const sort = normalizeSort(params.get('sort'));
  const includeFailed = parseBoolean(params.get('includeFailed'));
  const page = parsePositiveInteger(params.get('page'));

  return {
    query,
    sort,
    includeFailed,
    page
  };
}

function normalizeSort(value) {
  if (value === 'domain' || value === 'duration' || value === 'recent') {
    return value;
  }
  return 'recent';
}

function parseBoolean(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}
