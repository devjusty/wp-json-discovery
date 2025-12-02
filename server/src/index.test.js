import request from 'supertest';
import app from './index.js';

describe('API routes', () => {
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
});
