import PropTypes from 'prop-types';

type CapabilityStatus = 'queued' | 'running' | 'success' | 'failed' | 'unavailable' | 'idle' | string;

type CapabilityState = {
  status?: CapabilityStatus;
};

type ScanProgressProps = {
  capabilityStates?: Record<string, CapabilityState>;
};

type DisplayStatus = 'pending' | 'running' | 'complete' | 'unavailable' | 'failed';

const SEGMENTS = [
  { id: 'identity', label: 'Identity', source: 'wordpress' },
  { id: 'exposure', label: 'Exposure', source: 'wordpress' },
  { id: 'homepage', label: 'Homepage', source: 'homepage' },
  { id: 'wordpress-api', label: 'WordPress API', source: 'wordpress' }
] as const;

const STATUS_CUES: Record<DisplayStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  complete: 'Complete',
  unavailable: 'Unavailable',
  failed: 'Failed'
};

function normalizeStatus(status?: CapabilityStatus): DisplayStatus {
  if (status === 'running') return 'running';
  if (status === 'success') return 'complete';
  if (status === 'failed') return 'failed';
  if (status === 'unavailable') return 'unavailable';
  return 'pending';
}

function ScanProgress({ capabilityStates = {} }: ScanProgressProps) {
  const segments = SEGMENTS.map((segment) => ({
    ...segment,
    status: normalizeStatus(capabilityStates[segment.source]?.status)
  }));
  const completed = segments.filter(({ status }) => status === 'complete').length;
  const failed = segments.filter(({ status }) => status === 'failed').length;
  const unavailable = segments.filter(({ status }) => status === 'unavailable').length;
  const summary = `${completed} of ${segments.length} complete${failed ? `; ${failed} failed` : ''}${unavailable ? `; ${unavailable} unavailable` : ''}`;

  return (
    <section className="scan-progress-panel" aria-labelledby="scan-progress-heading">
      <div className="scan-progress-panel__header">
        <h2 id="scan-progress-heading">Scan progress</h2>
        <p className="scan-progress-panel__summary" role="status" aria-live="polite">{summary}</p>
      </div>
      <ol aria-label="Initial scan capabilities" className="scan-progress">
        {segments.map(({ id, label, status }) => (
          <li key={id} className={`scan-progress__segment scan-progress__segment--${status}`}>
            <span className="scan-progress__label">{label}</span>
            <span className="scan-progress__status">{STATUS_CUES[status]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

ScanProgress.propTypes = {
  capabilityStates: PropTypes.object
};

export default ScanProgress;
