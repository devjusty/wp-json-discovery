import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '../templates/AppLayout.jsx';
import Button from '../atoms/Button.jsx';
import TextInput from '../atoms/TextInput.jsx';
import StatusBadge from '../molecules/StatusBadge.jsx';
import NoteEditor from '../molecules/NoteEditor.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '@/components/ui/card.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { fetchDomainScanHistory, fetchScanHistory } from '../../api/client.js';
import { formatDate, formatDurationMs } from '../../utils/format.js';

const PAGE_SIZE = 20;
const EMPTY_ITEMS = [];

function HistoryPage({ headerActions, onRescan, onUseDomain }) {
  const initialState = getInitialHistoryState();
  const [query, setQuery] = useState(initialState.query);
  const [sort, setSort] = useState(initialState.sort);
  const [includeFailed, setIncludeFailed] = useState(initialState.includeFailed);
  const [page, setPage] = useState(initialState.page);
  const [activeDomain, setActiveDomain] = useState('');
  const [copiedDomain, setCopiedDomain] = useState('');
  // Defer network-heavy filtering while the user types to keep input responsive.
  const deferredQuery = useDeferredValue(query);

  const historyQuery = useQuery({
    queryKey: ['scanHistory', { query: deferredQuery, sort, includeFailed, page }],
    queryFn: () => fetchScanHistory({
      q: deferredQuery,
      sort,
      includeFailed,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    }),
    staleTime: 30000,
    placeholderData: keepPreviousData
  });

  const items = historyQuery.data?.items ?? EMPTY_ITEMS;
  const total = Number(historyQuery.data?.pagination?.total ?? 0);

  const domainHistoryQuery = useQuery({
    queryKey: ['scanHistoryDomain', { domain: activeDomain, includeFailed }],
    queryFn: () => fetchDomainScanHistory(activeDomain, { includeFailed, limit: 10 }),
    enabled: Boolean(activeDomain)
  });

  const historyMetrics = useMemo(() => {
    const totalItems = items.length;
    let successCount = 0;
    let failedCount = 0;
    let durationTotal = 0;
    let durationSamples = 0;

    for (const item of items) {
      if (item.lastStatus === 'success') {
        successCount += 1;
      }
      if (item.lastStatus === 'failed') {
        failedCount += 1;
      }

      const duration = Number(item.lastDurationMs);
      if (Number.isFinite(duration) && duration >= 0) {
        durationTotal += duration;
        durationSamples += 1;
      }
    }

    return {
      successful: successCount,
      failed: failedCount,
      successRate: totalItems > 0 ? Math.round((successCount / totalItems) * 100) : null,
      failedCount,
      averageDuration: durationSamples
        ? Math.round(durationTotal / durationSamples)
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
      <Card>
        <CardContent>
          <div className="history-controls">
            <label className="history-controls__field" htmlFor="history-search">
              Search domains
              <TextInput
                id="history-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="example.com"
              />
            </label>

            <label className="history-controls__field" htmlFor="history-sort">
              Sort by
              <select
                className="select-input"
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
                className="checkbox-input"
                id="history-show-failed"
                type="checkbox"
                checked={includeFailed}
                onChange={(event) => setIncludeFailed(event.target.checked)}
              />
              Include failed scans
            </label>
          </div>

          <p className="card__meta">
            Showing {items.length} of {total} scanned domains. Success: {historyMetrics.successful}
            {includeFailed ? ` · Failed: ${historyMetrics.failed}` : ''}
          </p>

          <div className="history-trends">
            <span className="history-trends__item">
              Success rate: {historyMetrics.successRate === null ? '—' : `${historyMetrics.successRate}%`}
            </span>
            <span className="history-trends__item">
              Avg duration: {formatDurationMs(historyMetrics.averageDuration)}
            </span>
            <span className="history-trends__item">
              Failed in view: {historyMetrics.failedCount}
            </span>
          </div>
        </CardContent>
      </Card>

      {historyQuery.isLoading ? (
        <Card>
          <CardContent>
            <p>Loading scan history…</p>
          </CardContent>
        </Card>
      ) : null}

      {historyQuery.error ? (
        <Card>
          <CardContent>
            <p>{historyQuery.error.message ?? 'Failed to load scan history.'}</p>
          </CardContent>
        </Card>
      ) : null}

      {!historyQuery.isLoading && !historyQuery.error && items.length === 0 ? (
        <Card>
          <CardContent>
            <p>No previously scanned domains match your filters.</p>
          </CardContent>
        </Card>
      ) : null}

      <Table aria-label="Scan history">
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last scanned</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Unsupported</TableHead>
            <TableHead>Actions</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.domain}>
              <TableCell>
                <div className="history-card__header">
                  <h3>{item.domain}</h3>
                  <StatusBadge
                    tone={item.lastStatus === 'success' ? 'success' : 'danger'}
                    label={item.lastStatus === 'success' ? 'Success' : 'Failed'}
                  />
                </div>
              </TableCell>
              <TableCell>{item.lastStatus}</TableCell>
              <TableCell>{formatHistoryDate(item.lastScannedAt) || '—'}</TableCell>
              <TableCell>{formatDurationMs(item.lastDurationMs)}</TableCell>
              <TableCell>{Number(item.lastUnsupportedCount ?? 0)}</TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell>
                <NoteEditor domain={item.domain} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
        <Card>
          <CardHeader>
            <div>
              <h2>Recent runs for {activeDomain}</h2>
              <p className="card__meta">
                {includeFailed
                  ? 'Showing successful and failed runs.'
                  : 'Showing successful runs only. Enable include failed to see errors.'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
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
                      Duration: {formatDurationMs(run.durationMs)} · Unsupported: {Number(run.unsupportedCount ?? 0)}
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
          </CardContent>
        </Card>
      ) : null}
    </AppLayout>
  );
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
