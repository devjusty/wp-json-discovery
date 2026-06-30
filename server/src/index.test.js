process.env.NODE_ENV = 'test';
import request from 'supertest';
import app from './index.js';
import { execute, getDb } from './db/client.js';

describe('API routes', () => {
  const originalFetch = global.fetch;
  const adminHeaders = { 'x-wpjd-admin-key': 'test-admin-key' };

  beforeAll(() => {
    process.env.ADMIN_ENABLED = 'true';
    process.env.ADMIN_API_KEY = 'test-admin-key';
    process.env.TURSO_DATABASE_URL = 'file::memory:';
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes('sitemap.xml')) {
        return new Response('<urlset><url><loc>https://example.com/</loc></url></urlset>', {
          status: 200,
          headers: { 'content-type': 'application/xml' }
        });
      }

      if (target.endsWith('/')) {
        return new Response('<html><head><title>Test</title></head><body><script type="application/ld+json">{}</script></body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            'content-security-policy': "default-src 'self'",
            'x-frame-options': 'SAMEORIGIN',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'strict-origin-when-cross-origin'
          }
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('should respond to /health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should respond to /api/proxy', async () => {
    const res = await request(app).get('/api/proxy?domain=redirect-example.com');
    expect(res.statusCode).not.toEqual(404);
  });

  it('rejects proxy requests for IP literal domains', async () => {
    const res = await request(app).get('/api/proxy?domain=127.0.0.1');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/invalid domain/i);
  });

  it('rejects proxy requests with scheme-relative endpoints', async () => {
    const res = await request(app)
      .get('/api/proxy?domain=example.com&endpoint=%2F%2Fevil.example%2Fwp-json%2F');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/relative path/i);
  });

  it('should respond to /api/unsupported-plugins', async () => {
    const res = await request(app).get('/api/unsupported-plugins');
    expect(res.statusCode).not.toEqual(404);
  });

  it('rejects unsupported plugin writes without auth', async () => {
    const res = await request(app).post('/api/unsupported-plugins').send({ namespace: 'test' });
    expect(res.statusCode).toEqual(401);
  });

  it('should respond to /api/unsupported-plugins with admin key', async () => {
    const res = await request(app)
      .post('/api/unsupported-plugins')
      .set(adminHeaders)
      .send({ namespace: 'test' });
    expect(res.statusCode).not.toEqual(404);
  });

  it('hides unsupported plugin domains from anonymous requests', async () => {
    await request(app).post('/api/unsupported-plugins').set(adminHeaders).send({
      namespace: 'public-domain-test',
      domain: 'example.com'
    });

    const res = await request(app).get('/api/unsupported-plugins');
    expect(res.statusCode).toEqual(200);

    const entry = res.body.find((item) => item.namespace === 'public-domain-test');
    expect(entry).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(entry, 'domains')).toBe(false);
  });

  it('should respond to /api/logs', async () => {
    const res = await request(app).post('/api/logs').set(adminHeaders).send({
      type: 'scan.started',
      payload: { domain: 'example.com' }
    });
    expect(res.statusCode).not.toEqual(404);
  });

  it('rejects /api/logs without admin key', async () => {
    const res = await request(app).post('/api/logs').send({
      type: 'scan.started',
      payload: { domain: 'example.com' }
    });
    expect(res.statusCode).toEqual(401);
  });

  it('rejects unsupported client log event types', async () => {
    const res = await request(app).post('/api/logs').set(adminHeaders).send({
      type: 'test',
      payload: {}
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/unsupported log type/i);
  });

  it('should respond to /api/sitemap-scan', async () => {
    const res = await request(app).post('/api/sitemap-scan').send({ domain: 'example.com' });
    expect(res.statusCode).not.toEqual(404);
  });

  it('rejects sitemap scans when sitemap host does not match domain', async () => {
    const res = await request(app)
      .post('/api/sitemap-scan')
      .send({
        domain: 'example.com',
        sitemapUrl: 'https://attacker.example/sitemap.xml'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/must match the requested domain/i);
  });

  it('should respond to /api/homepage-scan', async () => {
    const res = await request(app).post('/api/homepage-scan').send({ domain: 'example.com' });
    expect(res.statusCode).not.toEqual(404);
    expect(res.body.securityHeaders).toBeDefined();
    expect(res.body.securityHeaders.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'content-security-policy',
          present: true,
          value: 'Present',
          rawValue: "default-src 'self'"
        }),
        expect.objectContaining({
          key: 'permissions-policy',
          present: false,
          value: 'Missing',
          rawValue: null
        })
      ])
    );
  });

  it('returns homepage security headers summary', async () => {
    const res = await request(app).post('/api/homepage-scan').send({ domain: 'example.com' });
    expect(res.statusCode).toEqual(200);

    expect(res.body.securityHeaders).toBeDefined();
    expect(Array.isArray(res.body.securityHeaders.items)).toBe(true);

    const csp = res.body.securityHeaders.items.find((item) => item.key === 'content-security-policy');
    const permissionsPolicy = res.body.securityHeaders.items.find((item) => item.key === 'permissions-policy');

    expect(csp).toMatchObject({
      present: true,
      value: 'Present',
      rawValue: "default-src 'self'"
    });
    expect(permissionsPolicy).toMatchObject({
      present: false,
      value: 'Missing',
      rawValue: null
    });
  });

  it('should respond to /api/logs/rotate', async () => {
    const res = await request(app).post('/api/logs/rotate').set(adminHeaders);
    expect(res.statusCode).not.toEqual(404);
  });

  it('rejects /api/admin routes without admin key', async () => {
    const res = await request(app).get('/api/admin/db-snapshot');
    expect(res.statusCode).toEqual(401);
  });

  it('returns public plugin registry payload', async () => {
    const res = await request(app).get('/api/registry/plugins');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.plugins)).toBe(true);
    expect(Array.isArray(res.body.coreNamespaces)).toBe(true);
    expect(res.body.plugins.length).toBeGreaterThan(0);
  });

  it('rejects scan history without admin access', async () => {
    const res = await request(app).get('/api/scan-history');
    expect(res.statusCode).toEqual(401);
  });

  it('hides failed scans from history by default', async () => {
    await request(app).post('/api/logs').send({
      type: 'scan.complete',
      payload: {
        domain: 'example.com',
        metrics: { durationMs: 800 },
        unsupportedNamespaces: []
      }
    }).set(adminHeaders);

    await request(app).post('/api/logs').set(adminHeaders).send({
      type: 'scan.error',
      payload: {
        domain: 'failed-example.com',
        message: 'Timeout'
      }
    });

    const hiddenFailed = await request(app).get('/api/scan-history').set(adminHeaders);
    expect(hiddenFailed.statusCode).toEqual(200);
    expect(hiddenFailed.body.items.some((item) => item.domain === 'failed-example.com')).toBe(false);

    const includeFailed = await request(app).get('/api/scan-history?includeFailed=true').set(adminHeaders);
    expect(includeFailed.statusCode).toEqual(200);
    expect(includeFailed.body.items.some((item) => item.domain === 'failed-example.com')).toBe(true);
  });

  it('returns domain run timeline with includeFailed toggle', async () => {
    await request(app).post('/api/logs').set(adminHeaders).send({
      type: 'scan.complete',
      payload: {
        domain: 'timeline-example.com',
        metrics: { durationMs: 620 },
        unsupportedNamespaces: ['foo/v1']
      }
    });

    await request(app).post('/api/logs').set(adminHeaders).send({
      type: 'scan.error',
      payload: {
        domain: 'timeline-example.com',
        message: 'Auth required',
        code: 'auth_required'
      }
    });

    const defaultTimeline = await request(app).get('/api/scan-history/timeline-example.com').set(adminHeaders);
    expect(defaultTimeline.statusCode).toEqual(200);
    expect(defaultTimeline.body.runs.every((run) => run.status !== 'failed')).toBe(true);

    const allTimeline = await request(app).get('/api/scan-history/timeline-example.com?includeFailed=true').set(adminHeaders);
    expect(allTimeline.statusCode).toEqual(200);
    expect(allTimeline.body.runs.some((run) => run.status === 'failed')).toBe(true);
  });

  it('supports scan history pagination and sorting', async () => {
    await request(app).post('/api/logs').set(adminHeaders).send({
      type: 'scan.complete',
      payload: {
        domain: 'paginate-a.com',
        metrics: { durationMs: 420 },
        unsupportedNamespaces: []
      }
    });

    await request(app).post('/api/logs').set(adminHeaders).send({
      type: 'scan.complete',
      payload: {
        domain: 'paginate-b.com',
        metrics: { durationMs: 510 },
        unsupportedNamespaces: []
      }
    });

    const paged = await request(app).get('/api/scan-history?includeFailed=true&sort=domain&q=paginate-&limit=1&offset=1').set(adminHeaders);

    expect(paged.statusCode).toEqual(200);
    expect(Array.isArray(paged.body.items)).toBe(true);
    expect(paged.body.items.length).toBe(1);
    expect(paged.body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(paged.body.items[0].domain).toBe('paginate-b.com');
  });

  it('rejects proxy redirects to a different host', async () => {
    const fallbackFetch = global.fetch;
    let callCount = 0;
    global.fetch = async (url) => {
      if (callCount === 0) {
        callCount += 1;
        return new Response('', {
          status: 302,
          headers: { location: 'https://evil.example/wp-json/' }
        });
      }

      return fallbackFetch(url);
    };

    const res = await request(app).get('/api/proxy?domain=example.com');
    expect(res.statusCode).toEqual(502);
    expect(res.body.error).toMatch(/host mismatch/i);

    global.fetch = fallbackFetch;
  });

  it('rejects sitemap scans with cross-host child sitemaps', async () => {
    const fallbackFetch = global.fetch;
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes('cross-host.xml')) {
        return new Response(
          '<sitemapindex><sitemap><loc>https://evil.example/sitemap.xml</loc></sitemap></sitemapindex>',
          {
            status: 200,
            headers: { 'content-type': 'application/xml' }
          }
        );
      }

      return fallbackFetch(url);
    };

    const res = await request(app)
      .post('/api/sitemap-scan')
      .send({ domain: 'example.com', sitemapUrl: 'https://example.com/cross-host.xml' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/host must match requested domain/i);

    global.fetch = fallbackFetch;
  });

  it('returns admin db snapshot when enabled', async () => {
    process.env.ADMIN_ENABLED = 'true';
    await getDb();
    // seed a log entry
    await execute(
      'insert into activity_logs (timestamp, type, payload_json) values (?, ?, ?)',
      [new Date().toISOString(), 'test.admin', '{"ok":true}']
    );

    const res = await request(app).get('/api/admin/db-snapshot?limit=5').set(adminHeaders);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('totals.activityLogs');
    expect(Array.isArray(res.body.activityLogs)).toBe(true);
    expect(res.body).toHaveProperty('turso');
  });

  it('returns seeded admin themes registry', async () => {
    process.env.ADMIN_ENABLED = 'true';
    const res = await request(app).get('/api/admin/themes').set(adminHeaders);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.themes)).toBe(true);
    expect(res.body.themes.length).toBeGreaterThan(0);
    expect(res.body.themes.some((theme) => theme.id === 'astra')).toBe(true);
  });

  it('reconciles unsupported namespaces after plugin creation', async () => {
    await request(app)
      .post('/api/unsupported-plugins')
      .send({ namespace: 'cleanup/v1', domain: 'example.com' });

    const createRes = await request(app)
      .post('/api/admin/plugins')
      .set(adminHeaders)
      .send({
        id: 'cleanup-plugin',
        label: 'Cleanup Plugin',
        description: 'Used in tests',
        pluginUrl: 'https://wordpress.org/plugins/cleanup-plugin/',
        namespaces: ['cleanup/v1'],
        assetHints: ['cleanup-plugin']
      });

    expect(createRes.statusCode).toEqual(201);

    const unsupportedRes = await request(app).get('/api/unsupported-plugins');
    expect(unsupportedRes.statusCode).toEqual(200);
    expect(unsupportedRes.body.some((entry) => entry.namespace === 'cleanup/v1')).toBe(false);
  });

  it('blocks admin snapshot when disabled', async () => {
    process.env.ADMIN_ENABLED = 'false';
    const res = await request(app).get('/api/admin/db-snapshot').set(adminHeaders);
    expect(res.statusCode).toEqual(403);
  });
});
