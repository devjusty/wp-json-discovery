import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';
import HomepageSourcePanel from '../../../organisms/panels/HomepageSourcePanel.jsx';
import HomepageInsightsPanel from '../../../organisms/panels/HomepageInsightsPanel.jsx';

function HomepageSection({ capability, homepageDomain, onRun, onRetry }) {
  const homepageResult = capability?.result ?? null;
  const isRunning = ['queued', 'running'].includes(capability?.status);
  const hasFailed = capability?.status === 'failed';
  const homepageSummary = isRunning
    ? 'Analyzing…'
    : homepageResult
      ? `S${homepageResult.source?.statusCode ?? '—'} · M${homepageResult.insights?.meta?.length ?? 0} · A${homepageResult.insights?.assets?.length ?? 0} · F${homepageResult.insights?.frameworks?.length ?? 0}`
      : '';

  return (
    <section className="section homepage-section">
      <div className="grid">
      <HomepageSourcePanel source={homepageResult?.source} summary={homepageSummary} />
      </div>
      {homepageResult ? (
        <HomepageInsightsPanel
          insights={homepageResult.insights}
          htmlPreview={homepageResult.htmlPreview}
        />
      ) : (
        <Card role="status" aria-label="Homepage source signals" className="card card--info">
          <CardHeader>
            <div>
              <h2>Homepage source signals</h2>
              <p className="card__meta">
                {isRunning
                  ? `Analyzing homepage source signals for ${homepageDomain || 'the selected domain'}…`
                  : hasFailed
                    ? capability.error?.message ?? 'Homepage source analysis failed.'
                    : `Homepage source signals have not run for ${homepageDomain || 'the selected domain'}.`}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {isRunning ? <p className="card__meta">Partial WordPress results remain available while this runs.</p> : null}
            {hasFailed && capability.error?.retryable ? (
              <Button type="button" variant="secondary" size="sm" onClick={onRetry}>Retry homepage scan</Button>
            ) : null}
            {!isRunning && !hasFailed ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => onRun('homepage')}>Run homepage scan</Button>
            ) : null}
          </CardContent>
        </Card>
      )}
      {homepageResult ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => onRun('homepage')}>Rerun homepage scan</Button>
      ) : null}
      <HomepageJsonPreview data={homepageResult} />
    </section>
  );
}

HomepageSection.propTypes = {
  homepageDomain: PropTypes.string,
  capability: PropTypes.shape({
    status: PropTypes.string,
    result: PropTypes.object,
    error: PropTypes.shape({ message: PropTypes.string, retryable: PropTypes.bool })
  }),
  onRun: PropTypes.func,
  onRetry: PropTypes.func
};

HomepageSection.defaultProps = {
  homepageDomain: '',
  capability: null,
  onRun: () => {},
  onRetry: () => {}
};

export default HomepageSection;

function HomepageJsonPreview({ data }) {
  return (
    <Collapsible className="homepage-section__collapsible">
      <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="homepage-section__toggle" />}>
        Raw JSON
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card role="region" aria-label="Raw JSON" className="homepage-section__json">
          <CardHeader>
            <div>
              <h3>Raw JSON</h3>
              <p className="card__meta">
                Full homepage source response for debugging and integrations.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {data ? (
              <pre className="code-block" aria-label="Homepage source JSON">
                {JSON.stringify(data, null, 2)}
              </pre>
            ) : (
              <p className="card__meta">Run a scan to view the full homepage source payload.</p>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

HomepageJsonPreview.propTypes = {
  data: PropTypes.object
};

HomepageJsonPreview.defaultProps = {
  data: null
};
