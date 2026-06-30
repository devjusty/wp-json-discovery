import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const db = createClient({ url, authToken });

const statements = [
  `alter table scan_runs add column user_id text;`,
  `create index if not exists idx_scan_runs_user_id on scan_runs(user_id);`,
];

try {
  for (const sql of statements) {
    await db.execute(sql);
  }
  console.log('Migration v6 applied successfully');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}

await db.close();
