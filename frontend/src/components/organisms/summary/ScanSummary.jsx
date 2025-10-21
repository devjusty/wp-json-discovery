import PropTypes from 'prop-types';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function ScanSummary({ domain, fetchedAt, summary, namespaces }) {
  if (!summary) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Scan summary</h2>
          <p className="card__meta">
            {domain} · Scanned {new Date(fetchedAt).toLocaleString()}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="summary-grid">
          <div>
            <dt>Site name</dt>
            <dd>{summary.name || '—'}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{summary.description || '—'}</dd>
          </div>
          <div>
            <dt>Home URL</dt>
            <dd>
              {summary.home ? (
                <a href={summary.home} target="_blank" rel="noreferrer">
                  {summary.home}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Site URL</dt>
            <dd>
              {summary.url ? (
                <a href={summary.url} target="_blank" rel="noreferrer">
                  {summary.url}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{summary.timezoneString || '—'}</dd>
          </div>
          <div>
            <dt>GMT offset</dt>
            <dd>{summary.gmtOffset ?? '—'}</dd>
          </div>
          <div>
            <dt>Namespaces discovered</dt>
            <dd>{summary.namespacesCount ?? namespaces.length}</dd>
          </div>
          <div>
            <dt>Routes discovered</dt>
            <dd>{summary.routesCount ?? '—'}</dd>
          </div>
        </dl>
        <div className="namespaces">
          <h3>Namespaces</h3>
          <ul>
            {namespaces.map((namespace) => (
              <li key={namespace}>{namespace}</li>
            ))}
          </ul>
        </div>
        {summary.authentication ? (
          <div className="authentication">
            <h3>Authentication providers</h3>
            <pre>{JSON.stringify(summary.authentication, null, 2)}</pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

ScanSummary.propTypes = {
  domain: PropTypes.string.isRequired,
  fetchedAt: PropTypes.string.isRequired,
  summary: PropTypes.shape({
    name: PropTypes.string,
    description: PropTypes.string,
    url: PropTypes.string,
    home: PropTypes.string,
    gmtOffset: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    timezoneString: PropTypes.string,
    namespacesCount: PropTypes.number,
    routesCount: PropTypes.number,
    authentication: PropTypes.any
  }),
  namespaces: PropTypes.arrayOf(PropTypes.string).isRequired
};

export default ScanSummary;
