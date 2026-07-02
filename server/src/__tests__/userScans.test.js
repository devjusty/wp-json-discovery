process.env.NODE_ENV = 'test';

import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from '@jest/globals';
import { execute } from '../db/client.js';
import { findOrCreateUser } from '../db/users.js';
import { claimDomain, getUserDomains, unclaimDomain, getUserRecentRuns, clearUserRecentRuns, clearUserSavedScans } from '../db/userScans.js';
import createUserScanRoutes from '../routes/userScans.js';

function buildApp(userId) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: userId };
    next();
  });
  app.use('/api/user/scans', createUserScanRoutes());
  return app;
}

beforeAll(async () => {
  await execute('delete from scan_ownership');
  await execute('delete from scan_runs');
  await execute('delete from scan_domains');
  await findOrCreateUser('auth0|scans', 'scans@example.com', 'Scans User');
  await findOrCreateUser('auth0|other', 'other@example.com', 'Other User');
  for (const domain of ['example.com', 'unclaim-test.com', 'recent-only.com', 'other-user.com']) {
    await execute(
      'insert or ignore into scan_domains (domain, first_scanned_at, last_scanned_at, last_status) values (?, ?, ?, ?)',
      [domain, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', 'ok']
    );
  }
});

describe('claimDomain', () => {
  it('creates ownership record', async () => {
    const record = await claimDomain('auth0|scans', 'example.com', 'my notes');
    expect(record.user_id).toBe('auth0|scans');
    expect(record.domain).toBe('example.com');
    expect(record.notes).toBe('my notes');
  });
});

describe('getUserDomains', () => {
  it('returns claimed domains for user', async () => {
    const domains = await getUserDomains('auth0|scans');
    expect(domains.length).toBeGreaterThanOrEqual(1);
    expect(domains.some(d => d.domain === 'example.com')).toBe(true);
  });

  it('returns empty array for user with no claims', async () => {
    const domains = await getUserDomains('auth0|noclaims');
    expect(domains).toEqual([]);
  });
});

describe('unclaimDomain', () => {
  it('removes ownership record', async () => {
    await claimDomain('auth0|scans', 'unclaim-test.com');
    await unclaimDomain('auth0|scans', 'unclaim-test.com');
    const domains = await getUserDomains('auth0|scans');
    expect(domains.some(d => d.domain === 'unclaim-test.com')).toBe(false);
  });
});

describe('clearUserRecentRuns', () => {
  it('removes only the current users recent scan rows and leaves saved scans intact', async () => {
    await claimDomain('auth0|scans', 'example.com', 'saved note');
    await execute(
      'insert into scan_runs (domain, scanned_at, status, user_id) values (?, ?, ?, ?)',
      ['recent-only.com', '2026-06-30T10:00:00.000Z', 'success', 'auth0|scans']
    );
    await execute(
      'insert into scan_runs (domain, scanned_at, status, user_id) values (?, ?, ?, ?)',
      ['other-user.com', '2026-06-30T11:00:00.000Z', 'success', 'auth0|other']
    );

    await clearUserRecentRuns('auth0|scans');

    expect(await getUserRecentRuns('auth0|scans')).toEqual([]);
    expect(await getUserRecentRuns('auth0|other')).toHaveLength(1);
    expect(await getUserDomains('auth0|scans')).toHaveLength(1);
  });

  it('returns success from the delete endpoint', async () => {
    await request(buildApp('auth0|scans'))
      .delete('/api/user/scans/recent-runs')
      .expect(200)
      .expect({ ok: true });
  });
});

describe('clearUserSavedScans', () => {
  it('removes only the current users saved scan rows', async () => {
    await claimDomain('auth0|scans', 'example.com', 'saved note');
    await claimDomain('auth0|other', 'unclaim-test.com', 'other note');
    await execute(
      'insert into scan_runs (domain, scanned_at, status, user_id) values (?, ?, ?, ?)',
      ['recent-only.com', '2026-06-30T10:00:00.000Z', 'success', 'auth0|scans']
    );

    await clearUserSavedScans('auth0|scans');

    expect(await getUserDomains('auth0|scans')).toEqual([]);
    expect(await getUserDomains('auth0|other')).toHaveLength(1);
    expect(await getUserRecentRuns('auth0|scans')).toHaveLength(1);
  });

  it('returns success from the delete endpoint', async () => {
    await request(buildApp('auth0|scans'))
      .delete('/api/user/scans')
      .expect(200)
      .expect({ ok: true });
  });
});
