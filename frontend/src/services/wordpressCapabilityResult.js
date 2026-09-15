const CAPABILITY_ID = 'wordpress';
const ROOT_LOCATOR = '/wp-json/';

export function toWordpressCapabilityResult(legacyResult, domainIdentity) {
  const legacy = isRecord(legacyResult) ? legacyResult : {};
  const rootSucceeded = legacy.exposure?.restApiAvailable === true
    || legacy.performance?.wpJson?.ok === true;
  const identitySource = getIdentitySource(legacy, domainIdentity, rootSucceeded);
  const records = rootSucceeded ? buildExposureRecords(legacy.exposure) : [];

  return {
    ...legacy,
    exposure: {
      ...(isRecord(legacy.exposure) ? legacy.exposure : {}),
      records
    },
    identity: identitySource,
    findings: rootSucceeded ? buildFindings(records) : []
  };
}

function getIdentitySource(result, domainIdentity, rootSucceeded) {
  const summary = result.summary ?? {};
  const value = [summary.name, summary.url, summary.home]
    .find((candidate) => typeof candidate === 'string' && candidate.trim());

  if (rootSucceeded && value) {
    return {
      value,
      evidence: [{ id: 'wordpress-identity', capabilityId: CAPABILITY_ID, locator: ROOT_LOCATOR }],
      evidenceLevel: 'observed',
      source: ROOT_LOCATOR,
      reason: `Identity observed from ${ROOT_LOCATOR} for ${domainIdentity?.normalized ?? 'the scanned domain'}.`
    };
  }

  return {
    value: null,
    evidence: [],
    evidenceLevel: 'unavailable',
    source: ROOT_LOCATOR,
    reason: 'WordPress identity could not be observed from a successful /wp-json/ response.'
  };
}

function buildExposureRecords(exposure) {
  const definitions = [
    ['rest', 'REST API', 'Root /wp-json/ availability', exposure?.restApiAvailable, 'Public', 'Restricted', ROOT_LOCATOR],
    ['users', 'User enumeration', 'Public access to /wp-json/wp/v2/users', exposure?.userEnumeration?.open, 'Open', 'Blocked', '/wp-json/wp/v2/users'],
    ['settings', 'Settings endpoint', 'Exposure of /wp-json/wp/v2/settings', exposure?.settingsExposed?.open, 'Exposed', 'Protected', '/wp-json/wp/v2/settings'],
    ['xmlrpc', 'XML-RPC', 'xmlrpc.php enabled', exposure?.xmlrpc?.enabled, 'Enabled', 'Disabled', '/xmlrpc.php'],
    ['robots', 'robots.txt', 'Crawl hints', exposure?.robotsTxt?.available, 'Available', 'Missing', '/robots.txt'],
    ['sitemap', 'sitemap.xml', 'Sitemap discoverable', exposure?.sitemapXml?.available, 'Available', 'Missing', '/sitemap.xml'],
    ['uploads', 'Uploads directory', 'Whether /wp-content/uploads/ is browsable', exposure?.uploads?.indexable, 'Indexable', 'Blocked', '/wp-content/uploads/']
  ];

  return definitions
    .filter(([, , , value]) => typeof value === 'boolean')
    .map(([id, label, description, value, positive, negative, locator]) => {
      const statusCode = getStatusCode(exposure, id);
      const evidenceLevel = statusCode === null ? 'unavailable' : 'observed';
      const evidenceId = `wordpress-${id}`;
      return {
        id: evidenceId,
        label,
        description,
        value: value ? positive : negative,
        tone: value ? 'warning' : 'success',
        evidence: evidenceLevel === 'observed'
          ? [{ id: evidenceId, capabilityId: CAPABILITY_ID, locator }]
          : [],
        evidenceLevel,
        source: locator,
        ...(evidenceLevel === 'unavailable'
          ? { reason: `No response status was recorded for ${locator}.` }
          : {})
      };
    });
}

function buildFindings(records) {
  return records
    .filter((record) => record.evidenceLevel !== 'unavailable' && isRiskyRecord(record))
    .map((record) => ({
      id: findingId(record.id),
      capabilityId: CAPABILITY_ID,
      consequence: findingConsequence(record.id),
      evidenceLevel: record.evidenceLevel,
      novelty: 'new',
      summary: findingSummary(record.id),
      evidence: record.evidence
    }));
}

function findingId(id) {
  return {
    'wordpress-users': 'wordpress-user-enumeration',
    'wordpress-settings': 'wordpress-settings-exposed',
    'wordpress-xmlrpc': 'wordpress-xmlrpc-enabled',
    'wordpress-uploads': 'wordpress-uploads-indexable'
  }[id];
}

function isRiskyRecord(record) {
  return ['wordpress-users', 'wordpress-settings', 'wordpress-xmlrpc', 'wordpress-uploads'].includes(record.id)
    && !['Blocked', 'Protected', 'Disabled'].includes(record.value);
}

function findingConsequence(id) {
  return {
    'wordpress-users': 'high',
    'wordpress-settings': 'critical',
    'wordpress-xmlrpc': 'medium',
    'wordpress-uploads': 'medium'
  }[id];
}

function findingSummary(id) {
  return {
    'wordpress-users': 'User enumeration is publicly accessible.',
    'wordpress-settings': 'WordPress settings are publicly exposed.',
    'wordpress-xmlrpc': 'XML-RPC is enabled.',
    'wordpress-uploads': 'Uploads directory is indexable.'
  }[id];
}

function getStatusCode(exposure, id) {
  const source = {
    rest: exposure,
    users: exposure?.userEnumeration,
    settings: exposure?.settingsExposed,
    xmlrpc: exposure?.xmlrpc,
    robots: exposure?.robotsTxt,
    sitemap: exposure?.sitemapXml,
    uploads: exposure?.uploads
  }[id];
  return Number.isFinite(source?.statusCode) ? source.statusCode : null;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
