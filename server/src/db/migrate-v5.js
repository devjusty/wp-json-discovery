import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const db = createClient({ url, authToken });

const statements = [
  `create table if not exists users (
    id text primary key,
    email text not null,
    display_name text not null default '',
    role text not null default 'standard' check(role in ('standard', 'admin')),
    created_at text not null
  );`,
  `create table if not exists scan_ownership (
    id integer primary key autoincrement,
    user_id text not null references users(id) on delete cascade,
    domain text not null references scan_domains(domain),
    saved_at text not null,
    notes text,
    unique(user_id, domain)
  );`,
  `create table if not exists user_notes (
    id integer primary key autoincrement,
    user_id text not null references users(id) on delete cascade,
    domain text not null,
    note_text text not null,
    created_at text not null,
    updated_at text not null
  );`,
  `create index if not exists idx_scan_ownership_user on scan_ownership(user_id);`,
  `create index if not exists idx_user_notes_user on user_notes(user_id);`,
];

try {
  for (const sql of statements) {
    await db.execute(sql);
  }
  console.log('Migration v5 applied successfully');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}

await db.close();
