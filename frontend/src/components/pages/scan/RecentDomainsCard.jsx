import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';

function RecentDomainsCard({
  isLoading,
  items,
  isScanning,
  onOpenHistory,
  onRescan
}) {
  return (
    <div className="card">
      <div className="card__content card__content--cta">
        <div>
          <h3 className="cta-title">Recent scanned domains</h3>
          <p className="card__meta">
            Re-run a previous successful scan instantly, or open full history for filters.
          </p>
        </div>
        <div className="cta-actions">
          <Button type="button" variant="ghost" size="sm" onClick={onOpenHistory}>
            Open history
          </Button>
        </div>
      </div>
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
  onOpenHistory: PropTypes.func.isRequired,
  onRescan: PropTypes.func.isRequired
};

RecentDomainsCard.defaultProps = {
  isLoading: false,
  items: [],
  isScanning: false
};

export default RecentDomainsCard;
