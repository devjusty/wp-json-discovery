import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';

function ExposurePanel({ exposure, homepageSecurityHeaders }) {
  if (!exposure) {
    return null;
  }

  const items = [
    {
      key: 'rest',
      label: 'REST API',
      description: 'Root /wp-json/ availability',
      tone: exposure.restApiAvailable ? 'success' : 'danger',
      value: exposure.restApiAvailable ? 'Public' : 'Restricted'
    },
    {
      key: 'users',
      label: 'User enumeration',
      description: 'Public access to /wp-json/wp/v2/users',
      tone: exposure.userEnumeration.open ? 'warning' : 'success',
      value: exposure.userEnumeration.open ? 'Open' : 'Blocked',
      meta: exposure.userEnumeration.total
        ? `${exposure.userEnumeration.total} users visible`
        : exposure.userEnumeration.statusCode
          ? `HTTP ${exposure.userEnumeration.statusCode}`
          : ''
    },
    {
      key: 'settings',
      label: 'Settings endpoint',
      description: 'Exposure of /wp-json/wp/v2/settings',
      tone: exposure.settingsExposed.open ? 'danger' : 'success',
      value: exposure.settingsExposed.open ? 'Exposed' : 'Protected',
      meta: exposure.settingsExposed.statusCode
        ? `HTTP ${exposure.settingsExposed.statusCode}`
        : ''
    },
    {
      key: 'xmlrpc',
      label: 'XML-RPC',
      description: 'xmlrpc.php enabled',
      tone: exposure.xmlrpc.enabled ? 'warning' : 'success',
      value: exposure.xmlrpc.enabled ? 'Enabled' : 'Disabled',
      meta: exposure.xmlrpc.statusCode ? `HTTP ${exposure.xmlrpc.statusCode}` : ''
    },
    {
      key: 'robots',
      label: 'robots.txt',
      description: 'Crawl hints',
      tone: exposure.robotsTxt.available ? 'success' : 'warning',
      value: exposure.robotsTxt.available ? 'Available' : 'Missing',
      meta: exposure.robotsTxt.statusCode ? `HTTP ${exposure.robotsTxt.statusCode}` : ''
    },
    {
      key: 'sitemap',
      label: 'sitemap.xml',
      description: 'Sitemap discoverable',
      tone: exposure.sitemapXml.available ? 'success' : 'warning',
      value: exposure.sitemapXml.available ? 'Available' : 'Missing',
      meta: exposure.sitemapXml.statusCode ? `HTTP ${exposure.sitemapXml.statusCode}` : ''
    },
    {
      key: 'uploads',
      label: 'Uploads directory',
      description: 'Whether /wp-content/uploads/ is browsable',
      tone: exposure.uploads.indexable ? 'warning' : 'success',
      value: exposure.uploads.indexable ? 'Indexable' : 'Blocked',
      meta: exposure.uploads.statusCode ? `HTTP ${exposure.uploads.statusCode}` : ''
    },
    ...(homepageSecurityHeaders?.items ?? []).map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      tone: item.tone ?? (item.present ? 'success' : 'warning'),
      value: item.value ?? (item.present ? 'Present' : 'Missing'),
      meta: item.rawValue ?? ''
    }))
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <h2>Exposure checks</h2>
          <p className="card__meta">
            Quick flags for open endpoints and surface-level risk indicators.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="exposure-list">
          {items.map((item) => (
            <li key={item.key} className="exposure-list__item">
              <div className="exposure-list__header">
                <div>
                  <div className="exposure-list__label">{item.label}</div>
                  <div className="exposure-list__description">{item.description}</div>
                </div>
                <StatusBadge label={item.value} tone={item.tone} />
              </div>
              {item.meta ? (
                <div className="exposure-list__meta">{item.meta}</div>
              ) : null}
            </li>
          ))}
        </ul>
        {exposure.userEnumeration.sample ? (
          <div className="sample-box">
            <div className="sample-box__label">Sample user</div>
            <code className="sample-box__code">
              {JSON.stringify(exposure.userEnumeration.sample, null, 2)}
            </code>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

ExposurePanel.propTypes = {
  exposure: PropTypes.shape({
    restApiAvailable: PropTypes.bool,
    userEnumeration: PropTypes.shape({
      open: PropTypes.bool,
      total: PropTypes.number,
      statusCode: PropTypes.number,
      sample: PropTypes.any
    }),
    settingsExposed: PropTypes.shape({
      open: PropTypes.bool,
      statusCode: PropTypes.number
    }),
    xmlrpc: PropTypes.shape({
      enabled: PropTypes.bool,
      statusCode: PropTypes.number
    }),
    robotsTxt: PropTypes.shape({
      available: PropTypes.bool,
      statusCode: PropTypes.number
    }),
    sitemapXml: PropTypes.shape({
      available: PropTypes.bool,
      statusCode: PropTypes.number
    }),
    uploads: PropTypes.shape({
      indexable: PropTypes.bool,
      statusCode: PropTypes.number
    })
  }),
  homepageSecurityHeaders: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      description: PropTypes.string,
      present: PropTypes.bool,
      value: PropTypes.string,
      rawValue: PropTypes.string,
      tone: PropTypes.string
    })),
    presentCount: PropTypes.number,
    missingCount: PropTypes.number,
    totalCount: PropTypes.number,
    passed: PropTypes.bool
  })
};

ExposurePanel.defaultProps = {
  exposure: null,
  homepageSecurityHeaders: null
};

export default ExposurePanel;
