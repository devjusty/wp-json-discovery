import { Suspense } from 'react';
import PropTypes from 'prop-types';

// Reusable building blocks for section suspense/loading/status UI.

export function SectionSuspense({ label, children }) {
  return (
    <Suspense fallback={<SectionLoadingState label={label} />}>
      {children}
    </Suspense>
  );
}

SectionSuspense.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};

export function SectionLoadingState({ label }) {
  return (
    <div className="card card--info">
      <div className="card__content">
        <p>{label}</p>
      </div>
    </div>
  );
}

SectionLoadingState.propTypes = {
  label: PropTypes.string.isRequired
};

export function SnapshotStatusCard({ label, tone }) {
  return (
    <div className={`card ${tone === 'error' ? 'card--error' : 'card--info'}`}>
      <div className="card__content">
        <p>{label}</p>
      </div>
    </div>
  );
}

SnapshotStatusCard.propTypes = {
  label: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['info', 'error'])
};

SnapshotStatusCard.defaultProps = {
  tone: 'info'
};
