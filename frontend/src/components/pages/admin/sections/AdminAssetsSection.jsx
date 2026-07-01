import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';

function AdminAssetsSection({ data }) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-assets-overview">Homepage asset signals</h2>
            <p className="card__meta">
              Aggregated asset paths from recent homepage scans, grouped by match status.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="muted section-note">
            <strong>{data?.homepageAssets?.totalPaths ?? 0}</strong> total paths ·{' '}
            <strong>{data?.homepageAssets?.unknownPaths ?? 0}</strong> unknown
          </div>
          <p className="card__meta section-note">
            Unknown assets may not appear in Unsupported plugins when a plugin does not expose a discoverable `/wp-json/` namespace.
          </p>

          <h3 id="admin-assets-unknown">Unknown assets</h3>
          {data?.homepageAssets?.unknown?.length ? (
            <div className="admin-table admin-table--assets-unknown">
              <div className="admin-table__header">
                <span>Path</span>
                <span>Type</span>
                <span>Occurrences</span>
              </div>
              {data.homepageAssets.unknown.map((asset) => (
                <div key={`unknown-${asset.path}`} className="admin-table__row">
                  <span className="admin-table__cell admin-table__cell--expand">{asset.path}</span>
                  <span>{asset.type}</span>
                  <span>{asset.occurrences}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="card__meta">No unknown assets detected in recent scans.</p>
          )}

          <h3 id="admin-assets-all" className="section-heading-spaced">All assets</h3>
          {data?.homepageAssets?.all?.length ? (
            <div className="admin-table admin-table--assets-all">
              <div className="admin-table__header">
                <span>Path</span>
                <span>Type</span>
                <span>Occurrences</span>
                <span>Matches</span>
              </div>
              {data.homepageAssets.all.map((asset) => (
                <div key={asset.path} className="admin-table__row admin-table__row--expandable">
                  <span className="admin-table__cell admin-table__cell--expand">{asset.path}</span>
                  <span>{asset.type}</span>
                  <span>{asset.occurrences}</span>
                  <span>
                    {asset.matches?.length ? (
                      <div className="tag-cloud tag-cloud--compact">
                        {asset.matches.map((match) => (
                          <span key={`${asset.path}:${match.id ?? match.slug ?? match.label}`} className="tag">
                            {match.label ?? match.id ?? match.slug}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">No matches</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="card__meta">No homepage asset data available.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminAssetsSection.propTypes = {
  data: PropTypes.object.isRequired
};

export default AdminAssetsSection;
