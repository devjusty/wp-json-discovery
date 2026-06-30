import { createClient } from '@libsql/client';

let clientInstance = null;
let migrationsPromise = null;

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
  },
  {
    version: 3,
    statements: [
      `
      create table if not exists scan_domains (
        domain text primary key,
        first_scanned_at text not null,
        last_scanned_at text not null,
        last_status text not null,
        last_duration_ms integer,
        last_error_category text,
        last_unsupported_count integer not null default 0
      );
      `,
      `
      create table if not exists scan_runs (
        id integer primary key autoincrement,
        domain text not null,
        scanned_at text not null,
        status text not null,
        duration_ms integer,
        unsupported_count integer not null default 0,
        error_category text,
        error_message text,
        summary_json text,
        foreign key(domain) references scan_domains(domain) on delete cascade
      );
      `,
      `create index if not exists idx_scan_runs_domain on scan_runs(domain);`,
      `create index if not exists idx_scan_runs_scanned_at on scan_runs(scanned_at desc);`,
      `create index if not exists idx_scan_runs_status on scan_runs(status);`,
      `create index if not exists idx_scan_domains_last_scanned on scan_domains(last_scanned_at desc);`
    ]
  },
  {
    version: 4,
    statements: [
      `
      create table if not exists plugin_registry (
        id text primary key,
        label text not null,
        description text not null default '',
        plugin_url text,
        namespaces_json text not null default '[]',
        asset_hints_json text not null default '[]',
        created_at text not null,
        updated_at text not null
      );
      `,
      `
      create table if not exists theme_registry (
        id text primary key,
        label text not null,
        description text not null default '',
        theme_url text,
        namespace_hints_json text not null default '[]',
        path_signals_json text not null default '[]',
        created_at text not null,
        updated_at text not null
      );
      `,
      `create index if not exists idx_plugin_registry_label on plugin_registry(label);`,
      `create index if not exists idx_theme_registry_label on theme_registry(label);`
    ]
  },
  {
    version: 5,
    statements: [
      `
      create table if not exists users (
        id text primary key,
        email text not null,
        display_name text not null default '',
        role text not null default 'standard' check(role in ('standard', 'admin')),
        created_at text not null
      );
      `,
      `
      create table if not exists scan_ownership (
        id integer primary key autoincrement,
        user_id text not null references users(id) on delete cascade,
        domain text not null references scan_domains(domain),
        saved_at text not null,
        notes text,
        unique(user_id, domain)
      );
      `,
      `
      create table if not exists user_notes (
        id integer primary key autoincrement,
        user_id text not null references users(id) on delete cascade,
        domain text not null,
        note_text text not null,
        created_at text not null,
        updated_at text not null
      );
      `,
      `create index if not exists idx_scan_ownership_user on scan_ownership(user_id);`,
      `create index if not exists idx_user_notes_user on user_notes(user_id);`
    ]
  }
];

function resolveConnectionConfig() {
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
  const url = process.env.TURSO_DATABASE_URL || (isTestEnv ? 'file::memory:' : null);
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is required');
  }

  return {
    url,
    authToken,
    isRemote: !url.startsWith('file:')
  };
}

function toRowObject(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return normalized;
}

async function getCurrentVersion(client) {
  await client.execute(`
    create table if not exists app_meta (
      key text primary key,
      value text not null
    )
  `);

  const result = await client.execute({
    sql: 'select value from app_meta where key = ?',
    args: ['schema_version']
  });

  const versionValue = result.rows?.[0]?.value;
  const parsed = Number.parseInt(String(versionValue ?? '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function setCurrentVersion(client, version) {
  await client.execute({
    sql: `
      insert into app_meta (key, value)
      values ('schema_version', ?)
      on conflict(key) do update set value = excluded.value
    `,
    args: [String(version)]
  });
}

async function applyMigrations(client) {
  const currentVersion = await getCurrentVersion(client);
  const pending = MIGRATIONS
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    const statements = migration.statements.map((sql) => ({ sql }));
    await client.batch(statements, 'write');
    await setCurrentVersion(client, migration.version);
  }
}

export async function getDb() {
  if (clientInstance) {
    return clientInstance;
  }

  const config = resolveConnectionConfig();
  clientInstance = createClient({
    url: config.url,
    authToken: config.authToken
  });
  clientInstance.__meta = {
    url: config.url,
    isRemote: config.isRemote
  };

  if (!migrationsPromise) {
    migrationsPromise = applyMigrations(clientInstance);
  }
  await migrationsPromise;

  return clientInstance;
}

export async function queryAll(sql, args = []) {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  return (result.rows ?? []).map((row) => toRowObject(row));
}

export async function queryOne(sql, args = []) {
  const rows = await queryAll(sql, args);
  return rows[0] ?? null;
}

export async function execute(sql, args = []) {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  return {
    rowsAffected: Number(result.rowsAffected ?? 0),
    lastInsertRowid:
      result.lastInsertRowid === undefined || result.lastInsertRowid === null
        ? null
        : Number(result.lastInsertRowid)
  };
}
