import PropTypes from 'prop-types';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import SaveScanButton from '../../organisms/panels/SaveScanButton.jsx';

function formatTimestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function RecentDomainsCard({
  isLoading,
  items,
  isScanning,
  isExpanded,
  onToggleExpanded,
  onOpenHistory,
  onRescan,
  onSaved
}) {
  const buttonLabel = isExpanded ? 'Hide recent domains' : 'Show recent domains';
  const availabilityLabel = isLoading
    ? 'Fetching recent scans…'
    : items.length > 0
      ? `${items.length} authenticated scan${items.length === 1 ? '' : 's'} available`
      : 'No recent authenticated scans yet';

  return (
    <Card
      role="region"
      aria-label="Recent scanned domains"
      className={`recent-domains-card ${isExpanded ? 'recent-domains-card--expanded' : 'recent-domains-card--collapsed'}`}
    >
      <CardHeader className="card__content card__content--cta">
        <div>
          <CardTitle className="cta-title">Recent scanned domains</CardTitle>
          <CardDescription>
            Re-run a recent scan instantly, or save the ones you want to keep in My Scans.
          </CardDescription>
          <p className="card__meta recent-domains-card__status">{availabilityLabel}</p>
        </div>
        <div className="cta-actions">
          <Button type="button" variant="ghost" size="sm" onClick={onToggleExpanded}>
            {buttonLabel}
          </Button>
          {onOpenHistory && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="recent-domains__history-button"
              onClick={onOpenHistory}
            >
              Open history
            </Button>
          )}
        </div>
      </CardHeader>
      {isExpanded ? (
        <CardContent>
          {isLoading ? (
            <p className="card__meta">Loading recent domains…</p>
          ) : items.length === 0 ? (
            <p className="card__meta">No recent authenticated scans recorded yet.</p>
          ) : (
            <ul className="recent-domains-list">
              {items.map((item) => (
                <li key={item.domain}>
                  <div className="recent-domains-list__entry">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="recent-domains-list__item recent-domains-list__item--compact"
                      onClick={() => onRescan(item.domain)}
                      disabled={isScanning}
                    >
                      <span className="recent-domains-list__item-main">
                        <span className="recent-domains-list__domain">{item.domain}</span>
                        <span className="recent-domains-list__meta">
                          Last scan {formatTimestamp(item.lastScannedAt)}
                        </span>
                        {item.savedAt ? (
                          <span className="recent-domains-list__meta">
                            Saved {formatTimestamp(item.savedAt)}
                          </span>
                        ) : null}
                        {item.notes ? (
                          <span className="recent-domains-list__notes">{item.notes}</span>
                        ) : null}
                        {item.lastStatus ? (
                          <Badge variant="secondary">Status {item.lastStatus}</Badge>
                        ) : null}
                      </span>
                    </Button>
                    <div className="recent-domains-list__action">
                      {item.isSaved ? (
                        <Badge variant="secondary">Saved to My Scans</Badge>
                      ) : (
                        <SaveScanButton domain={item.domain} onSaved={onSaved} />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

RecentDomainsCard.propTypes = {
  isLoading: PropTypes.bool,
  items: PropTypes.arrayOf(PropTypes.shape({
    domain: PropTypes.string,
    lastScannedAt: PropTypes.string
  })),
  isScanning: PropTypes.bool,
  isExpanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func.isRequired,
  onOpenHistory: PropTypes.func,
  onRescan: PropTypes.func.isRequired,
  onSaved: PropTypes.func
};

RecentDomainsCard.defaultProps = {
  isLoading: false,
  items: [],
  isScanning: false,
  isExpanded: false,
  onSaved: undefined
};

export default RecentDomainsCard;
