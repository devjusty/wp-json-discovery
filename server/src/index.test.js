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
          headers: { 'content-type': 'text/html' }
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

  it('should respond to /api/unsupported-plugins', async () => {
    const res = await request(app).post('/api/unsupported-plugins').send({ namespace: 'test' });
    expect(res.statusCode).not.toEqual(404);
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

    const hiddenFailed = await request(app).get('/api/scan-history');
    expect(hiddenFailed.statusCode).toEqual(200);
    expect(hiddenFailed.body.items.some((item) => item.domain === 'failed-example.com')).toBe(false);

    const includeFailed = await request(app).get('/api/scan-history?includeFailed=true');
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

    const defaultTimeline = await request(app).get('/api/scan-history/timeline-example.com');
    expect(defaultTimeline.statusCode).toEqual(200);
    expect(defaultTimeline.body.runs.every((run) => run.status !== 'failed')).toBe(true);

    const allTimeline = await request(app).get('/api/scan-history/timeline-example.com?includeFailed=true');
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

    const paged = await request(app).get('/api/scan-history?includeFailed=true&sort=domain&q=paginate-&limit=1&offset=1');

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

  it('persists and returns trust envelope records', async () => {
    process.env.ADMIN_ENABLED = 'true';

    const createRes = await request(app)
      .post('/api/admin/trust/envelopes')
      .set(adminHeaders)
      .send({
        domain: 'example.com',
        scanRunId: 'run_123',
        scannedAt: '2026-04-21T12:00:00.000Z',
        schemaVersion: 1,
        coreFindings: { namespaces: ['wp/v2'] },
        trustInputs: { projectionLagMs: 0 }
      });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.envelope.domain).toBe('example.com');
    expect(createRes.body.envelope.envelopeId).toBeTruthy();

    const listRes = await request(app)
      .get('/api/admin/trust/envelopes?domain=example.com')
      .set(adminHeaders);

    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body.envelopes)).toBe(true);
    expect(listRes.body.envelopes.length).toBeGreaterThan(0);
    expect(listRes.body.envelopes[0].domain).toBe('example.com');
  });

  it('emits SCAN_CATALOG_MISMATCH warning when namespace lacks catalog support', async () => {
    process.env.ADMIN_ENABLED = 'true';

    const createEnvelopeRes = await request(app)
      .post('/api/admin/trust/envelopes')
      .set(adminHeaders)
      .send({
        domain: 'mismatch-example.com',
        scanRunId: 'run_mismatch',
        scannedAt: '2026-04-21T13:00:00.000Z',
      });

    expect(createEnvelopeRes.statusCode).toBe(201);
    const { envelopeId } = createEnvelopeRes.body.envelope;

    const evaluateRes = await request(app)
      .post('/api/admin/trust/evaluate')
      .set(adminHeaders)
      .send({
        envelopeId,
        domain: 'mismatch-example.com',
        findings: { namespaces: ['unknown-plugin/v1'] },
        catalog: { namespaces: ['wp/v2'] }
      });

    expect(evaluateRes.statusCode).toBe(200);
    expect(Array.isArray(evaluateRes.body.warnings)).toBe(true);
    expect(evaluateRes.body.warnings.some((warning) => warning.ruleCode === 'SCAN_CATALOG_MISMATCH')).toBe(true);
  });

  it('updates trust warning status transitions', async () => {
    process.env.ADMIN_ENABLED = 'true';

    const createEnvelopeRes = await request(app)
      .post('/api/admin/trust/envelopes')
      .set(adminHeaders)
      .send({
        domain: 'warning-status-example.com',
        scanRunId: 'run_warning_status',
      });

    const evaluateRes = await request(app)
      .post('/api/admin/trust/evaluate')
      .set(adminHeaders)
      .send({
        envelopeId: createEnvelopeRes.body.envelope.envelopeId,
        domain: 'warning-status-example.com',
        findings: { namespaces: ['unknown-status/v1'] },
        catalog: { namespaces: [] }
      });

    const warningId = evaluateRes.body.warnings?.[0]?.id;
    const updateRes = await request(app)
      .put(`/api/admin/trust/warnings/${warningId}`)
      .set(adminHeaders)
      .send({ status: 'resolved' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.warning.status).toBe('resolved');
    expect(updateRes.body.warning.resolvedAt).toBeTruthy();
  });

  it('creates deep-audit job and returns queued status', async () => {
    const createRes = await request(app)
      .post('/api/deep-audit/jobs')
      .send({
        domain: 'example.com',
        sitemapUrl: 'https://example.com/sitemap.xml',
        maxPages: 25,
      });

    expect(createRes.statusCode).toBe(202);
    expect(createRes.body.job.status).toBe('queued');
    expect(createRes.body.job.jobId).toBeTruthy();

    const getRes = await request(app)
      .get(`/api/deep-audit/jobs/${createRes.body.job.jobId}`);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.job.jobId).toBe(createRes.body.job.jobId);
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
