import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/client.js';
import { logSilently } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', '..', 'data');
const unsupportedPluginsPath = path.join(dataDir, 'unsupported-plugins.json');
let pluginsQueue = Promise.resolve();

async function seedFromJsonIfEmpty(db) {
  const [{ count }] = db
    .prepare('select count(1) as count from unsupported_plugins')
    .all();

  if (count > 0) {
    return;
  }

  try {
    const raw = await readFile(unsupportedPluginsPath, 'utf-8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const insertPlugin = db.prepare(`
      insert into unsupported_plugins (namespace, first_detected_at, last_detected_at)
      values (@namespace, @first_detected_at, @last_detected_at)
    `);
    const insertDomain = db.prepare(`
      insert into unsupported_plugin_domains (plugin_id, domain, first_seen_at, last_seen_at)
      values (@plugin_id, @domain, @first_seen_at, @last_seen_at)
      on conflict(plugin_id, domain) do update set last_seen_at=excluded.last_seen_at
    `);

    db.transaction(() => {
      parsed.forEach((plugin) => {
        const firstDetectedAt = plugin.firstDetectedAt ?? now;
        const lastDetectedAt = plugin.lastDetectedAt ?? firstDetectedAt;
        const result = insertPlugin.run({
          namespace: plugin.namespace,
          first_detected_at: firstDetectedAt,
          last_detected_at: lastDetectedAt
        });
        const pluginId = result.lastInsertRowid;
        const domains = Array.isArray(plugin.domains) ? plugin.domains : [];
        domains.forEach((domain) => {
          insertDomain.run({
            plugin_id: pluginId,
            domain,
            first_seen_at: firstDetectedAt,
            last_seen_at: lastDetectedAt
          });
        });
      });
    })();

    logSilently('unsupported_plugins.seeded_from_json', {
      count: parsed.length
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }

    if (error.name === 'SyntaxError') {
      logSilently('unsupported_plugins.seed_error', {
        reason: 'syntax_error',
        message: error.message
      });
      return;
    }

    throw error;
  }
}

function mapPlugins(db, plugins) {
  const domainStmt = db.prepare(`
    select domain from unsupported_plugin_domains
    where plugin_id = ?
    order by domain asc
  `);

  return plugins.map((plugin) => {
    const domains = domainStmt.all(plugin.id).map((row) => row.domain);
    return {
      namespace: plugin.namespace,
      firstDetectedAt: plugin.first_detected_at,
      lastDetectedAt: plugin.last_detected_at,
      domains
    };
  });
}

function withPluginsLock(task) {
  const run = pluginsQueue.then(() => task());
  // Ensure subsequent tasks are not blocked if the current one fails,
  // but also re-throw the error so the caller can handle it.
  pluginsQueue = run.catch(() => {}); // Consume the promise rejection for the queue chain
  return run;
}

export async function readUnsupportedPlugins() {
  return withPluginsLock(async () => {
    const db = await getDb();
    await seedFromJsonIfEmpty(db);
    const plugins = db
      .prepare(
        `
        select id, namespace, first_detected_at, last_detected_at
        from unsupported_plugins
        order by namespace asc
        `
      )
      .all();

    return mapPlugins(db, plugins);
  });
}

export async function upsertUnsupportedPluginRecord({ namespace, domain }) {
  return withPluginsLock(async () => {
    const db = await getDb();
    await seedFromJsonIfEmpty(db);

    const timestamp = new Date().toISOString();

    const selectPlugin = db.prepare(
      'select id, namespace, last_detected_at from unsupported_plugins where namespace = ?'
    );
    const insertPlugin = db.prepare(`
      insert into unsupported_plugins (namespace, first_detected_at, last_detected_at)
      values (?, ?, ?)
    `);
    const updatePlugin = db.prepare(
      'update unsupported_plugins set last_detected_at = ? where id = ?'
    );
    const upsertDomain = db.prepare(`
      insert into unsupported_plugin_domains (plugin_id, domain, first_seen_at, last_seen_at)
      values (?, ?, ?, ?)
      on conflict(plugin_id, domain) do update set last_seen_at=excluded.last_seen_at
    `);
    const countDomains = db.prepare(
      'select count(1) as count from unsupported_plugin_domains where plugin_id = ?'
    );

    const result = db.transaction(() => {
      const existing = selectPlugin.get(namespace);
      if (existing) {
        updatePlugin.run(timestamp, existing.id);
        if (domain) {
          upsertDomain.run(existing.id, domain, timestamp, timestamp);
        }
        const [{ count }] = countDomains.all(existing.id);
        return { mode: 'update', domainsTracked: count };
      }

      const insertResult = insertPlugin.run(namespace, timestamp, timestamp);
      const pluginId = insertResult.lastInsertRowid;
      let domainsTracked = 0;

      if (domain) {
        upsertDomain.run(pluginId, domain, timestamp, timestamp);
        domainsTracked = 1;
      }

      return { mode: 'insert', domainsTracked };
    })();

    return result;
  });
}
