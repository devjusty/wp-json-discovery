import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';
import HomepageSourcePanel from '../../../organisms/panels/HomepageSourcePanel.jsx';
import HomepageInsightsPanel from '../../../organisms/panels/HomepageInsightsPanel.jsx';

function HomepageSection({ homepageResult, homepageDomain, homepageSummary }) {
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
                Homepage source signals appear here after a scan completes for{' '}
                {homepageDomain || 'the selected domain'}.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {homepageSummary ? (
              <p className="card__meta">Current summary: {homepageSummary}</p>
            ) : null}
          </CardContent>
        </Card>
      )}
      <HomepageJsonPreview data={homepageResult} />
    </section>
  );
}

HomepageSection.propTypes = {
  homepageResult: PropTypes.object,
  homepageDomain: PropTypes.string,
  homepageSummary: PropTypes.string
};

HomepageSection.defaultProps = {
  homepageResult: null,
  homepageDomain: '',
  homepageSummary: ''
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
