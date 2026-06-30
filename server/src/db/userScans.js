import { queryAll, queryOne, execute } from './client.js';

export async function claimDomain(userId, domain, notes = null) {
  const now = new Date().toISOString();
  await execute(
    'insert or replace into scan_ownership (user_id, domain, saved_at, notes) values (?, ?, ?, ?)',
    [userId, domain, now, notes]
  );
  return queryOne(
    'select * from scan_ownership where user_id = ? and domain = ?',
    [userId, domain]
  );
}

export async function getUserDomains(userId) {
  return queryAll(
    `select sd.*, so.saved_at, so.notes
     from scan_ownership so
     join scan_domains sd on sd.domain = so.domain
     where so.user_id = ?
     order by so.saved_at desc`,
    [userId]
  );
}

export async function unclaimDomain(userId, domain) {
  await execute(
    'delete from scan_ownership where user_id = ? and domain = ?',
    [userId, domain]
  );
}
