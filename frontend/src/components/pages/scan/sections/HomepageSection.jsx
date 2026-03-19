import PropTypes from 'prop-types';
import HomepageSourcePanel from '../../../organisms/panels/HomepageSourcePanel.jsx';
import HomepageInsightsPanel from '../../../organisms/panels/HomepageInsightsPanel.jsx';

function HomepageSection({ homepageResult, homepageDomain }) {
  return (
    <section className="section">
      <div className="grid">
        <HomepageSourcePanel source={homepageResult?.source} />
        <HomepageJsonPreview data={homepageResult} />
      </div>
      {homepageResult ? (
        <HomepageInsightsPanel
          insights={homepageResult.insights}
          htmlPreview={homepageResult.htmlPreview}
        />
      ) : (
        <div className="card card--info">
          <div className="card__content">
            <p>
              Homepage source signals appear here after a scan completes for{' '}
              {homepageDomain || 'the selected domain'}.
            </p>
          </div>
        </div>
      )}
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
      <div className="card">
        <div className="card__content">
          <h3>Raw JSON</h3>
          <p className="card__meta">
            Run a scan to view the full homepage source payload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__content">
        <h3>Raw JSON</h3>
        <p className="card__meta">
          Full homepage source response for debugging and integrations.
        </p>
        <pre className="code-block" aria-label="Homepage source JSON">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

HomepageJsonPreview.propTypes = {
  data: PropTypes.object
};

HomepageJsonPreview.defaultProps = {
  data: null
};
