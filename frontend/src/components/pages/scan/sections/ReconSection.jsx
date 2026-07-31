import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';
import ReconScanPanel from '../../../organisms/panels/ReconScanPanel.jsx';

function ReconSection({ capability, domain, onRun, onRetry }) {
  const result = capability?.result ?? null;
  const isRunning = ['queued', 'running'].includes(capability?.status);
  const hasFailed = capability?.status === 'failed';
  const isUnavailable = capability?.status === 'unavailable';

  return (
    <section className="section recon-section">
      {result ? (
        <ReconScanPanel result={result} />
      ) : (
        <Card role="status" aria-label="Domain recon" className="card card--info">
          <CardHeader>
            <div>
              <h2>Domain recon</h2>
              <p className="card__meta">
                {isRunning
                  ? `Looking up DNS Dumpster records for ${domain || 'the selected domain'}…`
                  : isUnavailable || hasFailed
                    ? capability.error?.message ?? 'Domain recon failed.'
                    : `Domain recon has not run for ${domain || 'the selected domain'}.`}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {hasFailed && capability.error?.retryable ? (
              <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
                Retry domain recon
              </Button>
            ) : null}
            {!isRunning && !hasFailed && !isUnavailable ? (
              <Button type="button" variant="secondary" size="sm" onClick={onRun}>
                Run domain recon
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
      {result ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRun}>
          Rerun domain recon
        </Button>
      ) : null}
      <ReconJsonPreview data={result} />
    </section>
  );
}

ReconSection.propTypes = {
  domain: PropTypes.string,
  capability: PropTypes.shape({
    status: PropTypes.string,
    result: PropTypes.object,
    error: PropTypes.shape({ message: PropTypes.string, retryable: PropTypes.bool })
  }),
  onRun: PropTypes.func,
  onRetry: PropTypes.func
};

ReconSection.defaultProps = {
  domain: '',
  capability: null,
  onRun: () => {},
  onRetry: () => {}
};

export default ReconSection;

function ReconJsonPreview({ data }) {
  return (
    <Collapsible className="recon-section__collapsible">
      <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="recon-section__toggle" />}>
        Raw JSON
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card role="region" aria-label="Raw JSON" className="recon-section__json">
          <CardHeader>
            <div>
              <h3>Raw JSON</h3>
              <p className="card__meta">
                Full DNS Dumpster response for debugging and integrations.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {data ? (
              <pre className="code-block" aria-label="Domain recon JSON">
                {JSON.stringify(data, null, 2)}
              </pre>
            ) : (
              <p className="card__meta">Run domain recon to view the full payload.</p>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

ReconJsonPreview.propTypes = {
  data: PropTypes.object
};

ReconJsonPreview.defaultProps = {
  data: null
};
