process.env.NODE_ENV = 'test';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from '@jest/globals';
import createInvestigationRoutes from './investigations.ts';
import { errorHandler } from '../middleware/errorHandler.js';
import { execute, queryOne } from '../db/client.js';

function buildApp(user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    /** @type {typeof req & { user?: typeof user }} */
    const authenticatedRequest = req;
    authenticatedRequest.user = user;
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

  it.each([
    'http://localhost',
    '127.0.0.1',
    'bad_label.example.com',
  ])('rejects unsafe start domain %j before persistence', async (submitted) => {
    const before = await queryOne('select count(1) as count from investigations');
    const response = await request(buildApp({ sub: 'route-owner' }))
      .post('/api/investigations')
      .send({
        domain: { submitted, normalized: 'https://forged.example.com' },
        selectedCapabilities: [],
      });

    expect(response.status).toBe(400);
    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
  });

  it('persists server-derived normalized identity for valid starts', async () => {
    const response = await request(buildApp({ sub: 'route-owner' }))
      .post('/api/investigations')
      .send({
        domain: { submitted: 'EXAMPLE.COM', normalized: 'https://forged.example.com' },
        selectedCapabilities: [],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.investigation.domain).toEqual({
      submitted: 'EXAMPLE.COM',
      normalized: 'example.com',
    });
  });

  it('requires authentication for canonical investigation reads', async () => {
    const response = await request(buildApp()).get('/api/investigations/inv-1');

    expect(response.status).toBe(401);
  });

  it('requires authentication for investigation lists', async () => {
    const response = await request(buildApp()).get('/api/investigations');

    expect(response.status).toBe(401);
  });

  it('returns authenticated investigation summaries in the existing envelope', async () => {
    const app = buildApp({ sub: 'route-owner' });
    const start = await request(app).post('/api/investigations').send({
      domain: { submitted: 'list-route.example', normalized: 'list-route.example' },
      selectedCapabilities: [],
    });

    const response = await request(app).get('/api/investigations');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ status: 'success', requestId: expect.any(String) }));
    expect(response.body.data.investigations).toContainEqual(expect.objectContaining({
      id: start.body.data.investigation.id,
      domain: { submitted: 'list-route.example', normalized: 'list-route.example' },
      selectedCapabilityCount: 0,
      completedCapabilityCount: 0,
      findingsCount: 0,
    }));
    expect(response.body.data.investigations[0]).not.toHaveProperty('ownerId');
    expect(response.body.data.investigations[0]).not.toHaveProperty('latestSession');
    expect(response.body.data.investigations[0]).not.toHaveProperty('sessionIds');
  });

  it('does not include another owner\'s investigation in collection responses', async () => {
    const otherOwnerApp = buildApp({ sub: 'route-other' });
    const currentOwnerApp = buildApp({ sub: 'route-owner' });
    const foreign = await request(otherOwnerApp).post('/api/investigations').send({
      domain: { submitted: 'foreign-collection.example', normalized: 'https://foreign-collection.example' },
      selectedCapabilities: [],
    });

    const response = await request(currentOwnerApp).get('/api/investigations');

    expect(response.status).toBe(200);
    expect(response.body.data.investigations).not.toContainEqual(expect.objectContaining({
      id: foreign.body.data.investigation.id,
    }));
    expect(response.body.data.investigations).not.toContainEqual(expect.objectContaining({
      domain: { submitted: 'foreign-collection.example', normalized: 'foreign-collection.example' },
    }));
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
    expect(start.body.data.latestSession.investigationState).toEqual(expect.objectContaining({
      id: investigationId,
      submittedUrl: 'example.com',
      normalizedUrl: 'example.com',
    }));
    const initialRead = await request(app).get(`/api/investigations/${investigationId}`);
    expect(initialRead.status).toBe(200);
    expect(initialRead.body.data.latestSession.investigationState.id).toBe(investigationId);
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

  it('persists authoritative dependency metadata from authenticated starts', async () => {
    const response = await request(buildApp({ sub: 'route-owner' }))
      .post('/api/investigations')
      .send({
        domain: { submitted: 'dependency-route.example', normalized: 'https://dependency-route.example' },
        selectedCapabilities: [
          { id: 'wordpress', dependencies: [] },
          { id: 'sitemap', dependencies: ['wordpress'] }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.data.latestSession.selectedCapabilities).toContainEqual({
      id: 'sitemap', dependencies: ['wordpress']
    });
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
        domain: { submitted: 'claimed.example', normalized: 'claimed.example' },
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
    expect(response.body.data.latestSession.investigationState).toEqual(expect.objectContaining({
      id: response.body.data.investigation.id,
      submittedUrl: 'claimed.example',
      normalizedUrl: 'claimed.example',
    }));

    const replay = await request(buildApp({ sub: 'route-other' }))
      .post('/api/investigations/claim')
      .send({
        domain: { submitted: 'claimed.example', normalized: 'claimed.example' },
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

  it('rejects claim when envelope and embedded state identities differ', async () => {
    const before = await queryOne('select count(1) as count from investigations');
    const response = await request(buildApp({ sub: 'route-owner' }))
      .post('/api/investigations/claim')
      .send({
        domain: { submitted: 'envelope-route.example', normalized: 'envelope-route.example' },
        anonymousRecord: {
          recordType: 'session',
          session: {
            id: 'mismatch-route-session',
            investigationId: 'mismatch-route-investigation',
            status: 'completed',
            startedAt: '2026-09-10T12:00:00.000Z',
            completedAt: '2026-09-10T12:00:00.000Z',
            selectedCapabilities: [],
            capabilityStates: {},
            overall: { status: 'complete' },
            investigationState: {
              id: 'mismatch-route-investigation',
              submittedUrl: 'embedded-route.example',
              normalizedUrl: 'embedded-route.example',
              redirectChain: [],
              createdAt: '2026-09-10T12:00:00.000Z',
              capabilities: [],
              observationTimeline: [],
              evidence: [],
              findings: [],
            },
          },
          persistedAt: '2026-09-10T12:00:00.000Z',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      status: 'error',
      error: expect.objectContaining({ code: 'REQUEST_INVALID' }),
    }));
    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
  });

  it.each([
    'http://localhost',
    '10.0.0.1',
    'bad_label.example.com',
  ])('rejects unsafe claim domain %j before persistence', async (submitted) => {
    const before = await queryOne('select count(1) as count from investigations');
    const response = await request(buildApp({ sub: 'route-owner' }))
      .post('/api/investigations/claim')
      .send({
        domain: { submitted, normalized: 'https://forged.example.com' },
        anonymousRecord: {
          recordType: 'session',
          session: {
            id: `unsafe-${submitted}`,
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

    expect(response.status).toBe(400);
    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
  });

  it('rejects forged normalized identity on claim before persistence', async () => {
    const before = await queryOne('select count(1) as count from investigations');
    const response = await request(buildApp({ sub: 'route-owner' }))
      .post('/api/investigations/claim')
      .send({
        domain: { submitted: 'claimed-forged.example.com', normalized: 'forged.example.com' },
        anonymousRecord: {
          recordType: 'session',
          session: {
            id: 'forged-claim-session',
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

    expect(response.status).toBe(400);
    expect(await queryOne('select count(1) as count from investigations')).toEqual(before);
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
