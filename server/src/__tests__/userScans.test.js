process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execute } from '../db/client.js';
import { findOrCreateUser } from '../db/users.js';
import { claimDomain, getUserDomains, unclaimDomain } from '../db/userScans.js';

beforeAll(async () => {
  await execute('delete from scan_ownership');
  await execute('delete from scan_runs');
  await execute('delete from scan_domains');
  await findOrCreateUser('auth0|scans', 'scans@example.com', 'Scans User');
  for (const domain of ['example.com', 'unclaim-test.com']) {
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
