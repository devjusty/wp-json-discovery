import { describe, expect, it } from 'vitest';
import { gatherExposure } from './scan.js';

describe('gatherExposure', () => {
  it('derives the open user sample and wp total header', () => {
    expect(
      gatherExposure({
        rootResult: { ok: true },
        userProbe: {
          ok: true,
          status: 200,
          headers: { 'x-wp-total': '17' },
          data: [{ id: 1, slug: 'admin', name: 'Admin' }]
        },
        settingsProbe: { ok: false, status: 401 },
        xmlrpcProbe: { status: 405 },
        robotsProbe: { ok: true, status: 200 },
        sitemapProbe: { ok: false, status: 404 },
        uploadsProbe: { status: 403, ok: false }
      })
    ).toEqual({
      restApiAvailable: true,
      userEnumeration: {
        open: true,
        statusCode: 200,
        total: 17,
        sample: { id: 1, slug: 'admin', name: 'Admin' }
      },
      settingsExposed: { open: false, statusCode: 401 },
      xmlrpc: { enabled: true, statusCode: 405 },
      robotsTxt: { available: true, statusCode: 200 },
      sitemapXml: { available: false, statusCode: 404 },
      uploads: { indexable: false, statusCode: 403 }
    });
  });

  it('falls back to null sample and disabled xmlrpc when probes are absent', () => {
    expect(
      gatherExposure({
        rootResult: { ok: false },
        userProbe: null,
        settingsProbe: null,
        xmlrpcProbe: null,
        robotsProbe: null,
        sitemapProbe: null,
        uploadsProbe: null
      })
    ).toMatchObject({
      restApiAvailable: false,
      userEnumeration: { open: false, statusCode: null, total: null, sample: null },
      settingsExposed: { open: false, statusCode: null },
      xmlrpc: { enabled: false, statusCode: null },
      robotsTxt: { available: false, statusCode: null },
      sitemapXml: { available: false, statusCode: null },
      uploads: { statusCode: null }
    });
  });
});
