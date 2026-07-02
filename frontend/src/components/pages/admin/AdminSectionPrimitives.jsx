import { Suspense } from 'react';
import PropTypes from 'prop-types';
import { Card, CardContent } from '@/components/ui/card.jsx';

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
    <Card>
      <CardContent>
        <p>{label}</p>
      </CardContent>
    </Card>
  );
}

SectionLoadingState.propTypes = {
  label: PropTypes.string.isRequired
};

export function SnapshotStatusCard({ label, tone }) {
  return (
    <Card className={tone === 'error' ? 'card--error' : 'card--info'}>
      <CardContent>
        <p>{label}</p>
      </CardContent>
    </Card>
  );
}

SnapshotStatusCard.propTypes = {
  label: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['info', 'error'])
};

SnapshotStatusCard.defaultProps = {
  tone: 'info'
};
