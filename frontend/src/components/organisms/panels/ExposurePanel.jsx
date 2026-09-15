import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import {
  canonicalizeEvidence,
  evidenceLabel,
  evidenceSources,
  evidenceStatus,
  normalizeEvidence
} from '../../../utils/evidence.js';

function ExposurePanel({ exposure, homepageSecurityHeaders }) {
  if (!exposure) {
    return null;
  }

  const normalized = exposure.records
    ? normalizeRecords(exposure.records)
    : { items: buildLegacyItems(exposure, homepageSecurityHeaders), unavailable: [] };
  const items = normalized.items;

  if (items.length === 0) {
    return (
      <Card role="region" aria-label="Exposure checks">
        <CardHeader><h2>Exposure checks</h2></CardHeader>
        <CardContent>
          <p>Unavailable</p>
          {normalized.unavailable.length > 0 ? (
            <UnavailableExposureEvidence items={normalized.unavailable} />
          ) : (
            <p className="card__meta">No successful exposure evidence was returned.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  /* Legacy WordPress scan records predate explicit evidence records. */
  function buildLegacyItems(record, headers) {
    const knownItems = [
    {
      key: 'rest',
      valid: typeof record.restApiAvailable === 'boolean',
      label: 'REST API',
      description: 'Root /wp-json/ availability',
      tone: record.restApiAvailable ? 'success' : 'danger',
      value: record.restApiAvailable ? 'Public' : 'Restricted'
    },
    {
      key: 'users',
      valid: hasBooleanField(record.userEnumeration, 'open'),
      label: 'User enumeration',
      description: 'Public access to /wp-json/wp/v2/users',
      tone: record.userEnumeration?.open ? 'warning' : 'success',
      value: record.userEnumeration?.open ? 'Open' : 'Blocked',
      meta: record.userEnumeration?.total
        ? `${record.userEnumeration.total} users visible`
        : record.userEnumeration?.statusCode
          ? `HTTP ${record.userEnumeration.statusCode}`
          : ''
    },
    {
      key: 'settings',
      valid: hasBooleanField(record.settingsExposed, 'open'),
      label: 'Settings endpoint',
      description: 'Exposure of /wp-json/wp/v2/settings',
      tone: record.settingsExposed?.open ? 'danger' : 'success',
      value: record.settingsExposed?.open ? 'Exposed' : 'Protected',
      meta: record.settingsExposed?.statusCode
        ? `HTTP ${record.settingsExposed.statusCode}`
        : ''
    },
    {
      key: 'xmlrpc',
      valid: hasBooleanField(record.xmlrpc, 'enabled'),
      label: 'XML-RPC',
      description: 'xmlrpc.php enabled',
      tone: record.xmlrpc?.enabled ? 'warning' : 'success',
      value: record.xmlrpc?.enabled ? 'Enabled' : 'Disabled',
      meta: record.xmlrpc?.statusCode ? `HTTP ${record.xmlrpc.statusCode}` : ''
    },
    {
      key: 'robots',
      valid: hasBooleanField(record.robotsTxt, 'available'),
      label: 'robots.txt',
      description: 'Crawl hints',
      tone: record.robotsTxt?.available ? 'success' : 'warning',
      value: record.robotsTxt?.available ? 'Available' : 'Missing',
      meta: record.robotsTxt?.statusCode ? `HTTP ${record.robotsTxt.statusCode}` : ''
    },
    {
      key: 'sitemap',
      valid: hasBooleanField(record.sitemapXml, 'available'),
      label: 'sitemap.xml',
      description: 'Sitemap discoverable',
      tone: record.sitemapXml?.available ? 'success' : 'warning',
      value: record.sitemapXml?.available ? 'Available' : 'Missing',
      meta: record.sitemapXml?.statusCode ? `HTTP ${record.sitemapXml.statusCode}` : ''
    },
    {
      key: 'uploads',
      valid: hasBooleanField(record.uploads, 'indexable'),
      label: 'Uploads directory',
      description: 'Whether /wp-content/uploads/ is browsable',
      tone: record.uploads?.indexable ? 'warning' : 'success',
      value: record.uploads?.indexable ? 'Indexable' : 'Blocked',
      meta: record.uploads?.statusCode ? `HTTP ${record.uploads.statusCode}` : ''
    },
  ];
    const legacyItems = knownItems.filter((item) => item.valid);
    return legacyItems.concat((headers?.items ?? []).map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      tone: item.tone ?? (item.present ? 'success' : 'warning'),
      value: item.value ?? (item.present ? 'Present' : 'Missing'),
      meta: item.rawValue ?? ''
    }))).map((item) => ({
      ...item,
      meta: item.meta || 'Observed · Source: /wp-json/'
    }));
  }

  return (
    <Card role="region" aria-label="Exposure checks">
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
        {normalized.unavailable.length > 0 ? <UnavailableExposureEvidence items={normalized.unavailable} /> : null}
        {!exposure.records && exposure.userEnumeration?.sample ? (
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

function UnavailableExposureEvidence({ items }) {
  return (
    <div className="exposure-unavailable" aria-label="Unavailable exposure evidence">
      <strong>Unavailable evidence</strong>
      <ul>
        {items.map((item) => (
          <li key={`${item.label}-${item.source ?? 'unknown'}`}>
            {item.label}: Unavailable{item.source ? ` · Source: ${item.source}` : ''} · {item.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function normalizeRecords(records) {
  const items = [];
  const unavailable = [];
  records.forEach((record, index) => {
    const evidence = normalizeEvidence(record?.evidence, record);
    const successful = evidence.successful;
    const failed = evidence.unavailable;
    failed.forEach((evidence) => unavailable.push({
      label: record?.label ?? `Exposure record ${index + 1}`,
      source: evidence?.source,
      reason: evidence?.reason ?? 'Exposure evidence was not successful.'
    }));
    if (successful.length > 0) {
      items.push({
        key: record.id ?? record.label ?? `exposure-${index}`,
        label: record.label,
        description: record.description ?? '',
        tone: record.tone ?? 'info',
        value: record.value ?? 'Observed',
        meta: evidenceMeta(successful)
      });
    }
  });
  return { items, unavailable: canonicalizeEvidence(unavailable) };
}

function evidenceMeta(evidence, evidenceLevel) {
  const reference = Array.isArray(evidence) ? evidence : [evidence];
  const status = evidenceStatus(reference, evidenceLevel);
  const label = evidenceLabel(status);
  const sources = evidenceSources(reference);
  return `${label}${sources ? ` · Source: ${sources}` : ''}`;
}

function hasBooleanField(value, field) {
  return value !== null && typeof value === 'object' && typeof value[field] === 'boolean';
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
