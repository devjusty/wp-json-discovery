import PropTypes from 'prop-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';

function HomepageInsightsPanel({ insights, htmlPreview }) {
  if (!insights) {
    return null;
  }

  const hasSignals =
    (insights.meta?.length ?? 0) > 0 ||
    (insights.comments?.length ?? 0) > 0 ||
    (insights.assets?.length ?? 0) > 0 ||
    (insights.scripts?.length ?? 0) > 0 ||
    (insights.frameworks?.length ?? 0) > 0 ||
    (insights.other?.length ?? 0) > 0;

  return (
    <div className="grid">
      <Card role="region" aria-label="Frameworks & assets">
        <CardHeader>
          <div>
            <h2>Frameworks & assets</h2>
            <p className="card__meta">
              Detected frameworks plus plugin/theme asset paths visible in the homepage HTML.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <h3>Framework hints</h3>
          {insights.frameworks?.length ? (
            <div className="tag-cloud">
              {insights.frameworks.map((framework) => (
                <span key={framework} className="tag">
                  {framework}
                </span>
              ))}
            </div>
          ) : (
            <p className="card__meta">No framework hints detected.</p>
          )}

          <h3>Asset paths</h3>
          {insights.assets?.length ? (
            <div className="asset-grid asset-grid--triple">
              {insights.assets.map((asset) => (
                <div key={asset.path} className="asset-card">
                  <div className="asset-card__path">{asset.path}</div>
                  <div className="asset-card__meta">
                    <Badge variant="secondary">{asset.type}</Badge>
                    <span className="muted">×{asset.count}</span>
                  </div>
                  {renderAssetMatches(asset)}
                </div>
              ))}
            </div>
          ) : (
            <p className="card__meta">No plugin or theme asset paths detected.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2>Meta tags</h2>
            <p className="card__meta">
              Generator, Open Graph, Twitter, and other meta values surfaced from the homepage.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {insights.meta?.length ? (
            <ul className="stacked-list">
              {insights.meta.map((tag) => (
                <li key={`${tag.name}:${tag.content}`}>
                  <div className="stacked-list__label">{tag.name}</div>
                  <div className="stacked-list__value">{tag.content}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card__meta">No meta tags captured from the homepage.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2>Comments & scripts</h2>
            <p className="card__meta">
              Inline comments and script hints that may reveal builders, hosts, or other tools.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <h3>Comments</h3>
          {renderList(insights.comments, 'No HTML comments detected.')}

          <h3>Script hints</h3>
          {renderList(insights.scripts, 'No script hints detected.')}

          <h3>Other signals</h3>
          {renderList(insights.other, 'No additional signals detected.')}
        </CardContent>
      </Card>

      {hasSignals ? (
        <Collapsible className="homepage-insights__collapsible">
          <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="homepage-insights__toggle" />}>
            HTML preview
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card role="region" aria-label="HTML preview">
              <CardHeader>
                <div>
                  <h2>HTML preview</h2>
                  <p className="card__meta">
                    Truncated excerpt of the fetched HTML (first 2,000 characters).
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="code-block">
                  {htmlPreview && htmlPreview.length > 0
                    ? htmlPreview
                    : 'Preview unavailable (empty response).'}
                </pre>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function renderList(items, emptyText) {
  if (!items || items.length === 0) {
    return <p className="card__meta">{emptyText}</p>;
  }

  return (
    <ul className="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function renderAssetMatches(asset) {
  if (asset.matches && asset.matches.length > 0) {
    return (
      <div className="tag-cloud tag-cloud--compact">
        {asset.matches.map((match) => (
          <span key={`${asset.path}:${match.id}`} className="tag">
            {match.label}
          </span>
        ))}
      </div>
    );
  }

  return <p className="card__meta">No known plugin or theme match.</p>;
}

HomepageInsightsPanel.propTypes = {
  insights: PropTypes.shape({
    meta: PropTypes.array,
    comments: PropTypes.array,
    assets: PropTypes.arrayOf(PropTypes.shape({
      path: PropTypes.string,
      count: PropTypes.number,
      type: PropTypes.string,
      slug: PropTypes.string,
      matches: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        label: PropTypes.string,
        type: PropTypes.string,
        slug: PropTypes.string
      }))
    })),
    scripts: PropTypes.array,
    frameworks: PropTypes.array,
    other: PropTypes.array
  }),
  htmlPreview: PropTypes.string
};

HomepageInsightsPanel.defaultProps = {
  insights: null,
  htmlPreview: ''
};

export default HomepageInsightsPanel;
