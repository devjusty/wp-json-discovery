import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';

function RecentDomainsCard({
  isLoading,
  items,
  isScanning,
  isExpanded,
  onToggleExpanded,
  onOpenHistory,
  onRescan
}) {
  const buttonLabel = isExpanded ? 'Hide recent domains' : 'Show recent domains';
  const availabilityLabel = isLoading
    ? 'Fetching recent scans…'
    : items.length > 0
      ? `${items.length} recent domain${items.length === 1 ? '' : 's'} available`
      : 'No recent successful scans yet';

  return (
    <div className={`card recent-domains-card ${isExpanded ? 'recent-domains-card--expanded' : 'recent-domains-card--collapsed'}`}>
      <div className="card__content card__content--cta">
        <div>
          <h3 className="cta-title">Recent scanned domains</h3>
          <p className="card__meta">
            Re-run a previous successful scan instantly, or open full history for filters.
          </p>
          <p className="card__meta recent-domains-card__status">{availabilityLabel}</p>
        </div>
        <div className="cta-actions">
          <Button type="button" variant="ghost" size="sm" onClick={onToggleExpanded}>
            {buttonLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="recent-domains__history-button"
            onClick={onOpenHistory}
          >
            Open history
          </Button>
        </div>
      </div>
      {isExpanded ? (
        <div className="card__content">
          {isLoading ? (
            <p className="card__meta">Loading recent domains…</p>
          ) : items.length === 0 ? (
            <p className="card__meta">No successful scans recorded yet.</p>
          ) : (
            <ul className="recent-domains-list">
              {items.map((item) => (
                <li key={item.domain}>
                  <button
                    type="button"
                    className="recent-domains-list__item"
                    onClick={() => onRescan(item.domain)}
                    disabled={isScanning}
                  >
                    <span className="recent-domains-list__domain">{item.domain}</span>
                    <span className="recent-domains-list__meta">
                      {item.lastScannedAt ? new Date(item.lastScannedAt).toLocaleString() : '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
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
  onOpenHistory: PropTypes.func.isRequired,
  onRescan: PropTypes.func.isRequired
};

RecentDomainsCard.defaultProps = {
  isLoading: false,
  items: [],
  isScanning: false,
  isExpanded: false
};

export default RecentDomainsCard;
