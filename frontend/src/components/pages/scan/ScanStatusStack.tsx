import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import ScanProgress from './ScanProgress';
import { normalizeCapabilityStates, type SafeCapabilityState } from '../../../domain/investigation/capabilityStates';

const CAPABILITY_LABELS = {
  wordpress: 'WordPress API',
  homepage: 'Homepage',
  sitemap: 'Sitemap',
  recon: 'Domain recon'
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

function formatInvestigatorStatus(status) {
  return {
    queued: 'Queued',
    running: 'Running',
    success: 'Complete',
    failed: 'Failed',
    unavailable: 'Unavailable'
  }[status] ?? 'Queued';
}

type RetryHandler = (id: string) => void;

type ScanStatusStackProps = {
  session?: Record<string, unknown> | null;
  onRetryCapability?: RetryHandler;
  retryingCapabilityId?: string | null;
};

function ScanStatusStack({ session, onRetryCapability = () => {}, retryingCapabilityId = null }: ScanStatusStackProps) {
  if (!session) {
    return null;
  }

  if (session.capabilityStates && typeof session.capabilityStates === 'object') {
    const normalized = normalizeCapabilityStates(session.capabilityStates);
    const capabilities = Object.entries(normalized) as [string, SafeCapabilityState][];
    const details = capabilities.filter(([, capability]) => ['failed', 'unavailable'].includes(capability.status));
    return (
      <>
        <ScanProgress capabilityStates={normalized} />
        {details.map(([id, capability]) => (
          <Card key={id} className={`section-enter${capability.status === 'failed' ? ' card card--error' : ''}`} role={capability.status === 'failed' ? 'alert' : 'status'}>
            <CardContent className="">
              <p>{CAPABILITY_LABELS[id] ?? id}: {formatInvestigatorStatus(capability.status)}</p>
              {capability.outcome?.error ? <p>{capability.outcome.error.message}</p> : null}
              {capability.status === 'failed' && capability.outcome?.error?.retryable === true ? (
                <Button className="" type="button" variant="secondary" size="sm" aria-label={`Retry ${CAPABILITY_LABELS[id] ?? id}`} disabled={retryingCapabilityId === id} onClick={() => onRetryCapability(id)}>
                  {retryingCapabilityId === id ? `Retrying ${CAPABILITY_LABELS[id] ?? id}…` : `Retry ${CAPABILITY_LABELS[id] ?? id}`}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </>
    );
  }

  const isScanning = session.overallStatus === 'running';
  const capabilities = Object.entries(session.capabilities ?? {}) as [string, { status: string; error?: { message?: string; code?: string; retryable?: boolean } | null }][];
  const legacyDomain = session.domain as string | undefined;

  return (
    <>
      {isScanning ? (
        <Card className="card card--info" role="status" aria-live="polite">
          <CardContent className="">
            <p>Scanning {legacyDomain ?? 'site'}…</p>
          </CardContent>
        </Card>
      ) : null}

      {capabilities.map(([id, capability]) => (
        <Card
          key={id}
          className={capability.status === 'failed' ? 'card card--error' : undefined}
          role={capability.status === 'failed' ? 'alert' : 'status'}
        >
          <CardContent className="">
            <p>{CAPABILITY_LABELS[id] ?? id}: {formatStatus(capability.status)}</p>
            {capability.error ? <p>{capability.error.message}</p> : null}
            {capability.error?.code === 'auth_required' ? (
              <ul className="error-hints">
                <li>Confirm if the site blocks anonymous REST API access or requires application passwords.</li>
                <li>If you have credentials, sign in or create an application password before retrying.</li>
                <li>Otherwise, remove this domain from the scan list.</li>
              </ul>
            ) : null}
            {capability.status === 'failed' && capability.error?.retryable === true ? (
              <Button className="" type="button" variant="secondary" size="sm" onClick={() => onRetryCapability(id)}>
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
    domain: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        submitted: PropTypes.string,
        normalized: PropTypes.string
      })
    ]),
    overallStatus: PropTypes.string,
    capabilities: PropTypes.object,
    status: PropTypes.string,
    selectedCapabilities: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      dependencies: PropTypes.arrayOf(PropTypes.string),
      options: PropTypes.object
    })),
    capabilityStates: PropTypes.object
  }),
  onRetryCapability: PropTypes.func,
  retryingCapabilityId: PropTypes.string
};

ScanStatusStack.defaultProps = {
  session: null,
  onRetryCapability: () => {},
  retryingCapabilityId: null
};

export default ScanStatusStack;
