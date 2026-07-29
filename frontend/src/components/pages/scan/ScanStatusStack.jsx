import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';

const CAPABILITY_LABELS = {
  wordpress: 'WordPress API',
  homepage: 'Homepage',
  sitemap: 'Sitemap'
};

function formatStatus(status) {
  return {
    idle: 'Not run',
    queued: 'Queued',
    running: 'Running',
    success: 'Success',
    failed: 'Failed',
    unavailable: 'Unavailable'
  }[status] ?? 'Not run';
}

function ScanStatusStack({ session, onRetryCapability }) {
  if (!session) {
    return null;
  }

  const isScanning = session.overallStatus === 'running';
  const capabilities = Object.entries(session.capabilities ?? {});

  return (
    <>
      {isScanning ? (
        <Card className="card card--info" role="status" aria-live="polite">
          <CardContent>
            <p>Scanning {session.domain}…</p>
          </CardContent>
        </Card>
      ) : null}

      {capabilities.map(([id, capability]) => (
        <Card
          key={id}
          className={capability.status === 'failed' ? 'card card--error' : undefined}
          role={capability.status === 'failed' ? 'alert' : 'status'}
        >
          <CardContent>
            <p>{CAPABILITY_LABELS[id] ?? id}: {formatStatus(capability.status)}</p>
            {capability.error ? <p>{capability.error.message}</p> : null}
            {capability.error?.code === 'auth_required' ? (
              <ul className="error-hints">
                <li>Confirm if the site blocks anonymous REST API access or requires application passwords.</li>
                <li>If you have credentials, sign in or create an application password before retrying.</li>
                <li>Otherwise, remove this domain from the scan list.</li>
              </ul>
            ) : null}
            {capability.status === 'failed' && capability.error?.retryable ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => onRetryCapability(id)}>
                Retry {CAPABILITY_LABELS[id] ?? id}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

ScanStatusStack.propTypes = {
  session: PropTypes.shape({
    domain: PropTypes.string,
    overallStatus: PropTypes.string,
    capabilities: PropTypes.object
  }),
  onRetryCapability: PropTypes.func
};

ScanStatusStack.defaultProps = {
  session: null,
  onRetryCapability: () => {}
};

export default ScanStatusStack;
