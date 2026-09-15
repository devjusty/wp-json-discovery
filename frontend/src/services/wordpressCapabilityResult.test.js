import { describe, expect, it } from 'vitest';
import { toWordpressCapabilityResult } from './wordpressCapabilityResult.js';

const domainIdentity = {
  submitted: 'https://Example.com/',
  normalized: 'example.com'
};

const legacyResult = {
  domain: 'example.com',
  fetchedAt: '2026-09-10T12:00:00.000Z',
  summary: {
    name: 'Example site',
    url: 'https://example.com',
    home: 'https://example.com'
  },
  namespaces: ['wp/v2'],
  core: [],
  contentOverview: { totals: {}, collections: [] },
  versions: { wordpress: { version: '6.6.1', status: 'ok' }, plugins: [] },
  exposure: {
    restApiAvailable: true,
    userEnumeration: { open: true, statusCode: 200, total: 1 },
    settingsExposed: { open: false, statusCode: 401 },
    xmlrpc: { enabled: true, statusCode: 405 },
    robotsTxt: { available: true, statusCode: 200 },
    sitemapXml: { available: true, statusCode: 200 },
    uploads: { indexable: true, statusCode: 200 }
  },
  performance: {
    wpJson: { ok: true, statusCode: 200, endpoint: '/wp-json/' }
  },
  plugins: { matched: [], unsupportedNamespaces: [] },
  metrics: {}
};

describe('toWordpressCapabilityResult', () => {
  it('preserves legacy fields and adds observed identity, exposure records, and findings', () => {
    const result = toWordpressCapabilityResult(legacyResult, domainIdentity);

    expect(result).toMatchObject({
      ...legacyResult,
      identity: {
        value: 'Example site',
        evidenceLevel: 'observed',
        source: '/wp-json/',
        reason: expect.any(String)
      }
    });
    expect(result).not.toBe(legacyResult);
    expect(result.identity.evidence).toEqual([
      { id: 'wordpress-identity', capabilityId: 'wordpress', locator: '/wp-json/' }
    ]);
    expect(result.exposure.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'wordpress-users',
        value: 'Open',
        evidenceLevel: 'observed',
        evidence: [{ id: 'wordpress-users', capabilityId: 'wordpress', locator: '/wp-json/wp/v2/users' }]
      }),
      expect.objectContaining({
        id: 'wordpress-uploads',
        value: 'Indexable',
        evidenceLevel: 'observed'
      })
    ]));

    const userFinding = result.findings.find((finding) => finding.id === 'wordpress-user-enumeration');
    expect(userFinding).toEqual({
      id: 'wordpress-user-enumeration',
      capabilityId: 'wordpress',
      consequence: 'high',
      evidenceLevel: 'observed',
      novelty: 'new',
      summary: 'User enumeration is publicly accessible.',
      evidence: [{ id: 'wordpress-users', capabilityId: 'wordpress', locator: '/wp-json/wp/v2/users' }]
    });
  });

  it('does not claim WordPress when root response has no successful identity source', () => {
    const result = toWordpressCapabilityResult({
      ...legacyResult,
      summary: { ...legacyResult.summary, name: '', url: '', home: '' },
      exposure: { ...legacyResult.exposure, restApiAvailable: false },
      performance: { wpJson: { ok: false, statusCode: 503, endpoint: '/wp-json/' } }
    }, domainIdentity);

    expect(result.identity).toEqual({
      value: null,
      evidence: [],
      evidenceLevel: 'unavailable',
      source: '/wp-json/',
      reason: 'WordPress identity could not be observed from a successful /wp-json/ response.'
    });
    expect(result.findings).toEqual([]);
  });

  it('returns a safe canonical empty result for failed or empty legacy results', () => {
    expect(toWordpressCapabilityResult(null, domainIdentity)).toMatchObject({
      identity: {
        value: null,
        evidenceLevel: 'unavailable',
        source: '/wp-json/'
      },
      exposure: { records: [] },
      findings: []
    });
  });
});
