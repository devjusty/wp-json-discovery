import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function SitemapPagesTable({ pages, filterValue, onFilterChange }) {
  if (!pages || pages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3>Pages</h3>
        </CardHeader>
        <CardContent>
          <p className="card__meta">No pages scanned yet.</p>
        </CardContent>
      </Card>
    );
  }

  const filteredPages = filterPages(pages, filterValue);

  return (
    <Card>
      <CardHeader>
        <div className="sitemap-pages-header">
          <h3>Pages</h3>
          <div className="pill-row">
            <button
              type="button"
              className={`pill pill--filter ${filterValue === 'all' ? 'is-active' : ''}`}
              onClick={() => onFilterChange('all')}
            >
              All ({pages.length})
            </button>
            <button
              type="button"
              className={`pill pill--filter ${filterValue === 'schema_invalid' ? 'is-active' : ''}`}
              onClick={() => onFilterChange('schema_invalid')}
            >
              Schema invalid ({pages.filter((p) => p.flags?.includes('schema_invalid')).length})
            </button>
            <button
              type="button"
              className={`pill pill--filter ${filterValue === 'noindex' ? 'is-active' : ''}`}
              onClick={() => onFilterChange('noindex')}
            >
              Noindex ({pages.filter((p) => p.flags?.includes('noindex')).length})
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Status</th>
                <th>Title</th>
                <th>Schema types</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.map((page) => (
                <tr key={page.url}>
                  <td>
                    <a href={page.finalUrl || page.url} target="_blank" rel="noreferrer">
                      {page.url}
                    </a>
                  </td>
                  <td>
                    <StatusBadge
                      label={page.statusCode || '—'}
                      tone={page.ok ? 'success' : 'warning'}
                    />
                  </td>
                  <td>{page.seo?.title || '—'}</td>
                  <td>{(page.schema?.types ?? []).join(', ') || '—'}</td>
                  <td>{page.flags?.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function filterPages(pages, filterValue) {
  if (filterValue === 'schema_invalid') {
    return pages.filter((page) => page.flags?.includes('schema_invalid'));
  }
  if (filterValue === 'noindex') {
    return pages.filter((page) => page.flags?.includes('noindex'));
  }
  return pages;
}

SitemapPagesTable.propTypes = {
  pages: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      finalUrl: PropTypes.string,
      statusCode: PropTypes.number,
      ok: PropTypes.bool,
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
