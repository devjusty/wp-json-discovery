import { queryAll, queryOne, execute } from './client.js';

export async function findOrCreateUser(id, email, displayName) {
  const existing = await findUserById(id);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  await execute(
    'insert into users (id, email, display_name, role, created_at) values (?, ?, ?, \'standard\', ?)',
    [id, email, displayName, now]
  );

  return findUserById(id);
}

export async function findUserById(id) {
  return queryOne('select * from users where id = ?', [id]);
}

export async function updateUserRole(id, role) {
  await execute('update users set role = ? where id = ?', [role, id]);
  return findUserById(id);
}
