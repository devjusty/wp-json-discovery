process.env.NODE_ENV = 'test';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from '@jest/globals';
import createInvestigationRoutes from './investigations.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { execute, queryOne } from '../db/client.js';

function buildApp(user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/investigations', createInvestigationRoutes());
  app.use(errorHandler);
  return app;
}

describe('investigation routes', () => {
  beforeAll(async () => {
    process.env.TURSO_DATABASE_URL = 'file::memory:';
    await execute(
      `insert or ignore into users (id, email, display_name, role, created_at) values (?, ?, '', 'standard', ?)`,
      ['route-owner', 'route-owner@example.test', '2026-09-10T12:00:00.000Z']
    );
    await execute(
      `insert or ignore into users (id, email, display_name, role, created_at) values (?, ?, '', 'standard', ?)`,
      ['route-other', 'route-other@example.test', '2026-09-10T12:00:00.000Z']
    );
  });

  it('rejects malformed start payloads before persistence', async () => {
    const before = await queryOne('select count(1) as count from investigations');
    const response = await request(buildApp({ sub: 'route-user' }))
      .post('/api/investigations')
      .send({ domain: '' });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
  });

  it('does not persist anonymous starts', async () => {
    const before = await queryOne('select count(1) as count from investigations');
    const response = await request(buildApp()).post('/api/investigations').send({
      domain: { submitted: 'local.example', normalized: 'https://local.example' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });

    expect(response.status).toBe(401);
    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
  });

  it('requires authentication for canonical investigation reads', async () => {
    const response = await request(buildApp()).get('/api/investigations/inv-1');

    expect(response.status).toBe(401);
  });

  it('starts, updates, and reads an authenticated investigation', async () => {
    const app = buildApp({ sub: 'route-owner' });
    const start = await request(app).post('/api/investigations').send({
      domain: { submitted: 'example.com', normalized: 'https://example.com' },
      selectedCapabilities: [],
    });

    expect(start.status).toBe(201);
    expect(start.body.status).toBe('success');
    const investigationId = start.body.data.investigation.id;
    const session = {
      id: `${investigationId}-session`,
      investigationId,
      status: 'completed',
      startedAt: '2026-09-10T12:00:00.000Z',
      completedAt: '2026-09-10T12:00:00.000Z',
      selectedCapabilities: [],
       capabilityStates: {},
      overall: { status: 'complete' },
    };

    const update = await request(app)
      .post(`/api/investigations/${investigationId}/sessions/${session.id}`)
      .send({ session });
    const read = await request(app).get(`/api/investigations/${investigationId}`);

    expect(update.status).toBe(200);
    expect(read.status).toBe(200);
    expect(read.body.data.sessionIds).toContain(session.id);
  });

  it('persists repeated authenticated snapshots and returns latest state in order', async () => {
    const app = buildApp({ sub: 'route-owner' });
    const start = await request(app).post('/api/investigations').send({
      domain: { submitted: 'timeline-route.example', normalized: 'https://timeline-route.example' },
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
    });
    const investigationId = start.body.data.investigation.id;
    const sessionId = start.body.data.sessionIds[0];
    const base = {
      id: sessionId,
      investigationId,
      status: 'completed',
      startedAt: '2026-09-10T12:00:00.000Z',
      completedAt: '2026-09-10T12:00:00.000Z',
      selectedCapabilities: [{ id: 'homepage', dependencies: [] }],
      capabilityStates: { homepage: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } } },
      overall: { status: 'complete' },
    };

    const firstUpdate = await request(app).post(`/api/investigations/${investigationId}/sessions/${sessionId}`).send({ session: base });
    const latest = { ...base, status: 'failed', capabilityStates: { homepage: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } }, retry: { status: 'not-retryable' } } }, overall: { status: 'incomplete' } };
    const secondUpdate = await request(app).post(`/api/investigations/${investigationId}/sessions/${sessionId}`).send({ session: latest });
    const read = await request(app).get(`/api/investigations/${investigationId}`);

    expect(read.status).toBe(200);
    expect(firstUpdate.status).toBe(200);
    expect(secondUpdate.status).toBe(200);
    expect(read.body.data.sessionIds).toEqual([sessionId, sessionId, sessionId]);
    expect(read.body.data.latestSession.status).toBe('failed');
    expect(await queryOne('select count(1) as count from investigation_sessions where investigation_id = ?', [investigationId]))
      .toEqual({ count: 3 });
  });

  it('rejects malformed session requests before persistence', async () => {
    const app = buildApp({ sub: 'route-owner' });
    const start = await request(app).post('/api/investigations').send({
      domain: { submitted: 'malformed-session.example', normalized: 'https://malformed-session.example' },
      selectedCapabilities: [],
    });
    const investigationId = start.body.data.investigation.id;
    const before = await queryOne(
      'select count(1) as count from investigation_sessions where investigation_id = ?',
      [investigationId]
    );
    const response = await request(app)
      .post(`/api/investigations/${investigationId}/sessions/bad-session`)
      .send({ session: { id: 'bad-session' } });

    expect(response.status).toBe(400);
    expect(await queryOne(
      'select count(1) as count from investigation_sessions where investigation_id = ?',
      [investigationId]
    )).toEqual(before);
  });

  it('imports a valid browser-held record through claim', async () => {
    const response = await request(buildApp({ sub: 'route-owner' }))
      .post('/api/investigations/claim')
      .send({
        domain: { submitted: 'claimed.example', normalized: 'https://claimed.example' },
        anonymousRecord: {
          recordType: 'session',
          session: {
            id: 'browser-session',
            investigationId: 'browser-investigation',
            status: 'completed',
            startedAt: '2026-09-10T12:00:00.000Z',
            completedAt: '2026-09-10T12:00:00.000Z',
            selectedCapabilities: [],
            capabilityStates: {},
            overall: { status: 'complete' },
          },
          persistedAt: '2026-09-10T12:00:00.000Z',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.investigation.ownerId).toBe('route-owner');
    expect(response.body.data.sessionIds).toEqual(['browser-session']);

    const replay = await request(buildApp({ sub: 'route-other' }))
      .post('/api/investigations/claim')
      .send({
        domain: { submitted: 'claimed.example', normalized: 'https://claimed.example' },
        anonymousRecord: {
          recordType: 'session',
          session: {
            id: 'browser-session',
            investigationId: 'browser-investigation',
            status: 'completed',
            startedAt: '2026-09-10T12:00:00.000Z',
            completedAt: '2026-09-10T12:00:00.000Z',
            selectedCapabilities: [],
            capabilityStates: {},
            overall: { status: 'complete' },
          },
          persistedAt: '2026-09-10T12:00:00.000Z',
        },
      });
    const ownerRead = await request(buildApp({ sub: 'route-owner' }))
      .get(`/api/investigations/${response.body.data.investigation.id}`);

    expect(replay.status).toBe(404);
    expect(ownerRead.body.data.sessionIds).toEqual(['browser-session']);
  });

  it('returns 404 for missing or foreign investigations', async () => {
    const response = await request(buildApp({ sub: 'route-owner' }))
      .get('/api/investigations/not-owned');

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('error');
  });

  it('blocks cross-user reads and session writes', async () => {
    const ownerApp = buildApp({ sub: 'route-owner' });
    const start = await request(ownerApp).post('/api/investigations').send({
      domain: { submitted: 'foreign.example', normalized: 'https://foreign.example' },
      selectedCapabilities: [],
    });
    const investigationId = start.body.data.investigation.id;
    const session = {
      id: 'foreign-session',
      investigationId,
      status: 'idle',
      startedAt: null,
      completedAt: null,
      selectedCapabilities: [],
      capabilityStates: {},
      overall: { status: 'incomplete' },
    };

    const otherApp = buildApp({ sub: 'route-other' });
    const read = await request(otherApp).get(`/api/investigations/${investigationId}`);
    const write = await request(otherApp)
      .post(`/api/investigations/${investigationId}/sessions/${session.id}`)
      .send({ session });

    expect(read.status).toBe(404);
    expect(write.status).toBe(404);
    const ownerRead = await request(ownerApp).get(`/api/investigations/${investigationId}`);
    expect(ownerRead.body.data.sessionIds).toHaveLength(1);
  });

  it('rejects invalid anonymous claims', async () => {
    const before = await queryOne('select count(1) as count from investigations');
    const response = await request(buildApp({ sub: 'route-claimer' }))
      .post('/api/investigations/claim')
      .send({ anonymousRecord: { recordType: 'investigation' } });

    expect(response.status).toBe(400);
    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
  });
});
