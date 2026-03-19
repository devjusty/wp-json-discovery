import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execute, queryAll, queryOne } from '../db/client.js';
import { logSilently } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', '..', 'data');
const unsupportedPluginsPath = path.join(dataDir, 'unsupported-plugins.json');
let pluginsQueue = Promise.resolve();

async function seedFromJsonIfEmpty() {
  const countRow = await queryOne('select count(1) as count from unsupported_plugins');
  const count = Number(countRow?.count ?? 0);

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

    for (const plugin of parsed) {
      const namespace = plugin.namespace;
      if (typeof namespace !== 'string' || namespace.trim().length === 0) {
        continue;
      }

      const firstDetectedAt = plugin.firstDetectedAt ?? now;
      const lastDetectedAt = plugin.lastDetectedAt ?? firstDetectedAt;

      await execute(
        `
          insert into unsupported_plugins (namespace, first_detected_at, last_detected_at)
          values (?, ?, ?)
          on conflict(namespace) do update set
            last_detected_at = excluded.last_detected_at
        `,
        [namespace, firstDetectedAt, lastDetectedAt]
      );

      const row = await queryOne(
        'select id from unsupported_plugins where namespace = ?',
        [namespace]
      );

      const pluginId = Number(row?.id ?? 0);
      if (!pluginId) {
        continue;
      }

      const domains = Array.isArray(plugin.domains) ? plugin.domains : [];
      for (const domain of domains) {
        if (typeof domain !== 'string' || domain.trim().length === 0) {
          continue;
        }

        await execute(
          `
            insert into unsupported_plugin_domains (plugin_id, domain, first_seen_at, last_seen_at)
            values (?, ?, ?, ?)
            on conflict(plugin_id, domain) do update set
              last_seen_at = excluded.last_seen_at
          `,
          [pluginId, domain.trim(), firstDetectedAt, lastDetectedAt]
        );
      }
    }

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

function withPluginsLock(task) {
  const run = pluginsQueue.then(() => task());
  pluginsQueue = run.catch(() => {});
  return run;
}

export async function readUnsupportedPlugins() {
  return withPluginsLock(async () => {
    await seedFromJsonIfEmpty();

    const plugins = await queryAll(
      `
        select id, namespace, first_detected_at, last_detected_at
        from unsupported_plugins
        order by namespace asc
      `
    );

    const result = [];
    for (const plugin of plugins) {
      const domains = await queryAll(
        `
          select domain
          from unsupported_plugin_domains
          where plugin_id = ?
          order by domain asc
        `,
        [plugin.id]
      );

      result.push({
        namespace: plugin.namespace,
        firstDetectedAt: plugin.first_detected_at,
        lastDetectedAt: plugin.last_detected_at,
        domains: domains.map((row) => row.domain)
      });
    }

    return result;
  });
}

export async function upsertUnsupportedPluginRecord({ namespace, domain }) {
  return withPluginsLock(async () => {
    await seedFromJsonIfEmpty();

    const timestamp = new Date().toISOString();
    const existing = await queryOne(
      'select id from unsupported_plugins where namespace = ?',
      [namespace]
    );

    if (!existing) {
      await execute(
        `
          insert into unsupported_plugins (namespace, first_detected_at, last_detected_at)
          values (?, ?, ?)
        `,
        [namespace, timestamp, timestamp]
      );
    } else {
      await execute(
        'update unsupported_plugins set last_detected_at = ? where id = ?',
        [timestamp, existing.id]
      );
    }

    const pluginRow = await queryOne(
      'select id from unsupported_plugins where namespace = ?',
      [namespace]
    );
    const pluginId = Number(pluginRow?.id ?? 0);

    if (domain && pluginId) {
      await execute(
        `
          insert into unsupported_plugin_domains (plugin_id, domain, first_seen_at, last_seen_at)
          values (?, ?, ?, ?)
          on conflict(plugin_id, domain) do update set
            last_seen_at = excluded.last_seen_at
        `,
        [pluginId, domain, timestamp, timestamp]
      );
    }

    const countRow = pluginId
      ? await queryOne(
        'select count(1) as count from unsupported_plugin_domains where plugin_id = ?',
        [pluginId]
      )
      : { count: 0 };

    return {
      mode: existing ? 'update' : 'insert',
      domainsTracked: Number(countRow?.count ?? 0)
    };
  });
}
