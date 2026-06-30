import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const email = process.argv[2];

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

if (!email) {
  console.error('Usage: node src/db/promote-admin.js <email>');
  process.exit(1);
}

const db = createClient({ url, authToken });

try {
  const user = await db.execute({
    sql: 'select * from users where email = ?',
    args: [email]
  });

  if (user.rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    console.error('First log in via the app so the account is created, then re-run this script.');
    process.exit(1);
  }

  await db.execute({
    sql: 'update users set role = ? where email = ?',
    args: ['admin', email]
  });

  console.log(`User ${email} promoted to admin successfully.`);
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
}

await db.close();
