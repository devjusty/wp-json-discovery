import { useMemo } from 'react';
import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table.jsx';

// Human-readable label + tone for each flag key
const FLAG_META = {
  noindex: { label: 'Noindex', tone: 'warning' },
  schema_invalid: { label: 'Schema invalid', tone: 'danger' },
  missing_title: { label: 'No title', tone: 'warning' },
  missing_description: { label: 'No description', tone: 'warning' },
  canonical_mismatch: { label: 'Canonical mismatch', tone: 'warning' },
  fetch_error: { label: 'Fetch error', tone: 'danger' },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'schema_invalid', label: 'Schema invalid' },
  { value: 'noindex', label: 'Noindex' },
  { value: 'missing_title', label: 'No title' },
  { value: 'canonical_mismatch', label: 'Canonical mismatch' },
  { value: 'fetch_error', label: 'Fetch errors' },
];

function FlagPills({ flags }) {
  if (!flags?.length) return <span className="sitemap-table__no-flags">—</span>;
  return (
    <span className="sitemap-table__flags">
      {flags.map((flag) => {
        const meta = FLAG_META[flag] ?? { label: flag, tone: 'neutral' };
        return (
          <StatusBadge key={flag} label={meta.label} tone={meta.tone} />
        );
      })}
    </span>
  );
}

FlagPills.propTypes = {
  flags: PropTypes.arrayOf(PropTypes.string),
};

FlagPills.defaultProps = {
  flags: [],
};

/**
 * Strip the scheme+host from a URL and return only the path+query+hash.
 * Falls back to the full URL if parsing fails.
 */
function urlPath(fullUrl) {
  try {
    const parsed = new URL(fullUrl);
    return parsed.pathname + parsed.search + parsed.hash || '/';
  } catch {
    return fullUrl;
  }
}

function SitemapPagesTable({ pages, filterValue, onFilterChange }) {
  // Memoize per-filter counts
  const filterCounts = useMemo(() => {
    const counts = { all: pages.length };
    for (const f of FILTERS.slice(1)) {
      counts[f.value] = pages.filter((p) => p.flags?.includes(f.value)).length;
    }
    return counts;
  }, [pages]);

  const filteredPages = useMemo(() => {
    if (filterValue === 'all') return pages;
    return pages.filter((p) => p.flags?.includes(filterValue));
  }, [pages, filterValue]);

  if (!pages || pages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3>Pages</h3>
        </CardHeader>
        <CardContent>
          <p className="card__meta">
            Run a sitemap scan above to see per-page SEO and schema signals.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="sitemap-pages-header">
          <h3>Pages</h3>
          <div className="pill-row">
            {FILTERS.map((f) => {
              const count = filterCounts[f.value] ?? 0;
              // Hide zero-count filters (except "All")
              if (f.value !== 'all' && count === 0) return null;
              return (
                <button
                  key={f.value}
                  type="button"
                  className={`pill pill--filter ${filterValue === f.value ? 'is-active' : ''}`}
                  onClick={() => onFilterChange(f.value)}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="table-responsive">
          <Table aria-label="Sitemap pages">
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Schema</TableHead>
                <TableHead>Last modified</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPages.map((page) => {
                const path = urlPath(page.url);
                const targetUrl = page.finalUrl || page.url;
                return (
                  <TableRow key={page.url} className={page.flags?.includes('fetch_error') ? 'sitemap-table__row--error' : ''}>
                    <TableCell className="sitemap-table__url-cell !whitespace-normal align-top">
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="sitemap-table__url-link block"
                      >
                        {path}
                      </a>
                    </TableCell>
                    <TableCell>
                      {page.statusCode != null ? (
                        <StatusBadge
                          label={page.statusCode}
                          tone={page.ok ? 'success' : 'warning'}
                        />
                      ) : (
                        <StatusBadge label="Error" tone="danger" />
                      )}
                    </TableCell>
                    <TableCell className="sitemap-table__title-cell">
                      {page.seo?.title || <span className="sitemap-table__missing">No title</span>}
                    </TableCell>
                    <TableCell>
                      {(page.schema?.types ?? []).length > 0
                        ? (page.schema.types ?? []).join(', ')
                        : <span className="sitemap-table__missing">—</span>}
                    </TableCell>
                    <TableCell className="sitemap-table__date-cell">
                      {page.lastmod
                        ? <span title={page.lastmod}>{page.lastmod.slice(0, 10)}</span>
                        : <span className="sitemap-table__missing">—</span>}
                    </TableCell>
                    <TableCell>
                      <FlagPills flags={page.flags} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

SitemapPagesTable.propTypes = {
  pages: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      finalUrl: PropTypes.string,
      statusCode: PropTypes.number,
      ok: PropTypes.bool,
      lastmod: PropTypes.string,
      seo: PropTypes.object,
      schema: PropTypes.object,
      flags: PropTypes.arrayOf(PropTypes.string)
    })
  ),
  filterValue: PropTypes.string,
  onFilterChange: PropTypes.func
};

SitemapPagesTable.defaultProps = {
  pages: [],
  filterValue: 'all',
  onFilterChange: () => {}
};

export default SitemapPagesTable;
