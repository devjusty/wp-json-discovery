process.env.NODE_ENV = 'test';
import request from 'supertest';
import app from './index.js';
import { execute, getDb } from './db/client.js';

describe('API routes', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.ADMIN_ENABLED = 'true';
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
    const res = await request(app).get('/api/proxy?domain=example.com');
    expect(res.statusCode).not.toEqual(404);
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
    const res = await request(app).post('/api/logs').send({ type: 'test' });
    expect(res.statusCode).not.toEqual(404);
  });

  it('should respond to /api/sitemap-scan', async () => {
    const res = await request(app).post('/api/sitemap-scan').send({ domain: 'example.com' });
    expect(res.statusCode).not.toEqual(404);
  });

  it('should respond to /api/homepage-scan', async () => {
    const res = await request(app).post('/api/homepage-scan').send({ domain: 'example.com' });
    expect(res.statusCode).not.toEqual(404);
  });

  it('should respond to /api/logs/rotate', async () => {
    const res = await request(app).post('/api/logs/rotate');
    expect(res.statusCode).not.toEqual(404);
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
    });

    await request(app).post('/api/logs').send({
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
    await request(app).post('/api/logs').send({
      type: 'scan.complete',
      payload: {
        domain: 'timeline-example.com',
        metrics: { durationMs: 620 },
        unsupportedNamespaces: ['foo/v1']
      }
    });

    await request(app).post('/api/logs').send({
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
    await request(app).post('/api/logs').send({
      type: 'scan.complete',
      payload: {
        domain: 'paginate-a.com',
        metrics: { durationMs: 420 },
        unsupportedNamespaces: []
      }
    });

    await request(app).post('/api/logs').send({
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

  it('returns admin db snapshot when enabled', async () => {
    process.env.ADMIN_ENABLED = 'true';
    await getDb();
    // seed a log entry
    await execute(
      'insert into activity_logs (timestamp, type, payload_json) values (?, ?, ?)',
      [new Date().toISOString(), 'test.admin', '{"ok":true}']
    );

    const res = await request(app).get('/api/admin/db-snapshot?limit=5');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('totals.activityLogs');
    expect(Array.isArray(res.body.activityLogs)).toBe(true);
  });

  it('returns seeded admin themes registry', async () => {
    process.env.ADMIN_ENABLED = 'true';
    const res = await request(app).get('/api/admin/themes');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.themes)).toBe(true);
    expect(res.body.themes.length).toBeGreaterThan(0);
    expect(res.body.themes.some((theme) => theme.id === 'astra')).toBe(true);
  });

  it('blocks admin snapshot when disabled', async () => {
    process.env.ADMIN_ENABLED = 'false';
    const res = await request(app).get('/api/admin/db-snapshot');
    expect(res.statusCode).toEqual(403);
  });
});
