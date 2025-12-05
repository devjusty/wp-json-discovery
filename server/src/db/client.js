import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'data', 'wpjd.sqlite');

let dbInstance = null;

const MIGRATIONS = [
  {
    version: 1,
    statements: [
      `
      create table if not exists unsupported_plugins (
        id integer primary key autoincrement,
        namespace text not null unique,
        first_detected_at text not null,
        last_detected_at text not null
      );
      `,
      `
      create table if not exists unsupported_plugin_domains (
        id integer primary key autoincrement,
        plugin_id integer not null references unsupported_plugins(id) on delete cascade,
        domain text not null,
        first_seen_at text not null,
        last_seen_at text not null,
        unique(plugin_id, domain)
      );
      `,
      `
      create table if not exists activity_logs (
        id integer primary key autoincrement,
        timestamp text not null,
        type text not null,
        payload_json text not null
      );
      `,
      `create index if not exists idx_activity_logs_type on activity_logs(type);`
    ]
  },
  {
    version: 2,
    statements: [
      `create index if not exists idx_activity_logs_timestamp on activity_logs(timestamp desc);`,
      `create index if not exists idx_activity_logs_type_timestamp on activity_logs(type, timestamp desc);`,
      `create index if not exists idx_unsupported_plugin_domains_domain on unsupported_plugin_domains(domain);`,
      `create index if not exists idx_unsupported_plugins_last_detected on unsupported_plugins(last_detected_at desc);`
    ]
  }
];

function applyMigrations(db) {
  const [{ user_version: currentVersion }] = db.pragma('user_version', { simple: false });
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    db.transaction(() => {
      migration.statements.forEach((statement) => {
        db.exec(statement);
      });
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}

async function ensureDbDir(dbPath) {
  const dir = path.dirname(dbPath);
  await mkdir(dir, { recursive: true });
}

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath =
    process.env.DB_PATH ||
    (process.env.NODE_ENV === 'test' ? ':memory:' : DEFAULT_DB_PATH);
  await ensureDbDir(dbPath);

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  applyMigrations(dbInstance);

  return dbInstance;
}
