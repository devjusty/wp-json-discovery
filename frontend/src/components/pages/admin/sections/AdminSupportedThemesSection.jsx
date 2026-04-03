import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import TextInput from '../../../atoms/TextInput.jsx';

function AdminSupportedThemesSection({
  totalThemes,
  isLoading,
  isError,
  errorMessage,
  themeCatalogQuery,
  setThemeCatalogQuery,
  themeCatalogSort,
  setThemeCatalogSort,
  filteredSupportedThemes,
  expandedThemeId,
  setExpandedThemeId
}) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-supported-themes-main">Supported themes</h2>
            <p className="card__meta">
              {totalThemes} popular themes tracked for detection signals.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="card__meta">Loading supported themes…</p>
          ) : null}
          {isError ? (
            <div className="card card--error">
              <div className="card__content">
                <p>{errorMessage || 'Unable to load supported themes.'}</p>
              </div>
            </div>
          ) : null}
          {!isLoading && !isError ? (
            <>
          <div className="admin-filters">
            <label className="admin-filter-field">
              Search
              <TextInput
                type="text"
                value={themeCatalogQuery}
                onChange={(event) => setThemeCatalogQuery(event.target.value)}
                placeholder="Search theme label or ID"
              />
            </label>
            <label className="admin-filter-field">
              Sort
              <select
                className="select-input"
                value={themeCatalogSort}
                onChange={(event) => setThemeCatalogSort(event.target.value)}
              >
                <option value="labelAsc">Label (A-Z)</option>
                <option value="pathsDesc">Paths (high-low)</option>
                <option value="pathsAsc">Paths (low-high)</option>
              </select>
            </label>
          </div>
          <div className="admin-table admin-table--themes">
            <div className="admin-table__header">
              <span>Theme</span>
              <span>Paths</span>
              <span>Namespaces</span>
              <span>Docs</span>
              <span>Description</span>
            </div>
            {filteredSupportedThemes.map((theme) => {
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
                  <span>{theme.pathSignals?.length ?? 0}</span>
                  <span>{theme.namespaceHints?.length ?? 0}</span>
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
                      <p><strong>Path signals:</strong> {theme.pathSignals?.length ? theme.pathSignals.join(', ') : 'None'}</p>
                      <p><strong>Namespace hints:</strong> {theme.namespaceHints?.length ? theme.namespaceHints.join(', ') : 'None'}</p>
                      {theme.themeUrl ? (
                        <p><strong>Docs:</strong> <a href={theme.themeUrl} target="_blank" rel="noreferrer">{theme.themeUrl}</a></p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!filteredSupportedThemes.length ? (
            <p className="card__meta">No supported themes match this filter.</p>
          ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

AdminSupportedThemesSection.propTypes = {
  totalThemes: PropTypes.number,
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  errorMessage: PropTypes.string,
  themeCatalogQuery: PropTypes.string.isRequired,
  setThemeCatalogQuery: PropTypes.func.isRequired,
  themeCatalogSort: PropTypes.string.isRequired,
  setThemeCatalogSort: PropTypes.func.isRequired,
  filteredSupportedThemes: PropTypes.array,
  expandedThemeId: PropTypes.string,
  setExpandedThemeId: PropTypes.func.isRequired
};

AdminSupportedThemesSection.defaultProps = {
  totalThemes: 0,
  isLoading: false,
  isError: false,
  errorMessage: '',
  filteredSupportedThemes: [],
  expandedThemeId: null
};

export default AdminSupportedThemesSection;
