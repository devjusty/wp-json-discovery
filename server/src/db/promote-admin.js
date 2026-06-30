import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const arg = process.argv[2];

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const db = createClient({ url, authToken });

try {
  if (!arg || arg === 'list') {
    const result = await db.execute('select id, email, display_name, role from users order by created_at desc');
    if (result.rows.length === 0) {
      console.log('No users found in database.');
      console.log('Log in via the app first to create your user record.');
    } else {
      console.log('Users:');
      for (const u of result.rows) {
        console.log(`  ${u.id}  ${u.email || '(no email)'}  role=${u.role}`);
      }
    }
    process.exit(0);
  }

  let user;
  if (arg.startsWith('sub:')) {
    const sub = arg.slice(4);
    user = await db.execute({ sql: 'select * from users where id = ?', args: [sub] });
  } else {
    user = await db.execute({ sql: 'select * from users where email = ?', args: [arg] });
  }

  if (user.rows.length === 0) {
    console.error(`No user found matching: ${arg}`);
    console.error('Run with no args to list existing users.');
    process.exit(1);
  }

  const match = user.rows[0];
  await db.execute({
    sql: 'update users set role = ? where id = ?',
    args: ['admin', match.id]
  });

  console.log(`User ${match.email || match.id} promoted to admin successfully.`);
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
}

await db.close();
