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

    const rows = await queryAll(
      `
        select
          up.id,
          up.namespace,
          up.first_detected_at,
          up.last_detected_at,
          upd.domain
        from unsupported_plugins up
        left join unsupported_plugin_domains upd
          on upd.plugin_id = up.id
        order by up.namespace asc, upd.domain asc
      `
    );

    const byPluginId = new Map();

    for (const row of rows) {
      const pluginId = Number(row.id);
      const existing = byPluginId.get(pluginId) ?? {
        namespace: row.namespace,
        firstDetectedAt: row.first_detected_at,
        lastDetectedAt: row.last_detected_at,
        domains: []
      };

      if (typeof row.domain === 'string' && row.domain.trim().length > 0) {
        existing.domains.push(row.domain);
      }

      byPluginId.set(pluginId, existing);
    }

    return Array.from(byPluginId.values());
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

export async function reconcileUnsupportedPluginsForRegistryEntry(plugin = {}) {
  return withPluginsLock(async () => {
    await seedFromJsonIfEmpty();

    const namespaces = Array.isArray(plugin.namespaces)
      ? plugin.namespaces
      : [];
    const normalizedNamespaces = Array.from(new Set(
      namespaces
        .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .filter(Boolean)
    ));

    if (!normalizedNamespaces.length) {
      return {
        removedNamespaces: 0,
        removedDomains: 0
      };
    }

    const rows = await queryAll(
      'select id, namespace from unsupported_plugins'
    );

    const idsToDelete = rows
      .filter((row) => shouldRemoveNamespace(row.namespace, normalizedNamespaces))
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!idsToDelete.length) {
      return {
        removedNamespaces: 0,
        removedDomains: 0
      };
    }

    const placeholders = idsToDelete.map(() => '?').join(', ');
    const removedDomains = await execute(
      `delete from unsupported_plugin_domains where plugin_id in (${placeholders})`,
      idsToDelete
    );
    const removedNamespaces = await execute(
      `delete from unsupported_plugins where id in (${placeholders})`,
      idsToDelete
    );

    return {
      removedNamespaces: removedNamespaces?.rowsAffected ?? 0,
      removedDomains: removedDomains?.rowsAffected ?? 0
    };
  });
}

function shouldRemoveNamespace(namespace, normalizedPrefixes) {
  if (typeof namespace !== 'string' || namespace.trim().length === 0) {
    return false;
  }

  const candidate = namespace.trim().toLowerCase();
  return normalizedPrefixes.some((prefix) => (
    candidate === prefix || candidate.startsWith(`${prefix}/`)
  ));
}
