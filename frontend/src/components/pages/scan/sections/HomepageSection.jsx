import PropTypes from 'prop-types';
import { Card, CardContent } from '@/components/ui/card.jsx';
import HomepageSourcePanel from '../../../organisms/panels/HomepageSourcePanel.jsx';
import HomepageInsightsPanel from '../../../organisms/panels/HomepageInsightsPanel.jsx';

function HomepageSection({ homepageResult, homepageDomain }) {
  return (
    <section className="section homepage-section">
      <div className="grid">
      <HomepageSourcePanel source={homepageResult?.source} />
      </div>
      {homepageResult ? (
        <HomepageInsightsPanel
          insights={homepageResult.insights}
          htmlPreview={homepageResult.htmlPreview}
        />
      ) : (
        <Card role="status" aria-label="Homepage source signals" className="card card--info">
          <CardContent>
            <p>
              Homepage source signals appear here after a scan completes for{' '}
              {homepageDomain || 'the selected domain'}.
            </p>
          </CardContent>
        </Card>
      )}
      <HomepageJsonPreview data={homepageResult} />
    </section>
  );
}

HomepageSection.propTypes = {
  homepageResult: PropTypes.object,
  homepageDomain: PropTypes.string
};

HomepageSection.defaultProps = {
  homepageResult: null,
  homepageDomain: ''
};

export default HomepageSection;

function HomepageJsonPreview({ data }) {
  if (!data) {
    return (
      <Card role="region" aria-label="Raw JSON" className="homepage-section__json">
        <CardContent>
          <h3>Raw JSON</h3>
          <p className="card__meta">
            Run a scan to view the full homepage source payload.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card role="region" aria-label="Raw JSON" className="homepage-section__json">
      <CardContent>
        <h3>Raw JSON</h3>
        <p className="card__meta">
          Full homepage source response for debugging and integrations.
        </p>
        <pre className="code-block" aria-label="Homepage source JSON">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

HomepageJsonPreview.propTypes = {
  data: PropTypes.object
};

HomepageJsonPreview.defaultProps = {
  data: null
};
