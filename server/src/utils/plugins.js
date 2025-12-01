import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logSilently } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', '..', 'data');
const unsupportedPluginsPath = path.join(dataDir, 'unsupported-plugins.json');
let pluginsQueue = Promise.resolve();

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readRawUnsupportedPlugins() {
  await ensureDataDir();
  try {
    const data = await readFile(unsupportedPluginsPath, 'utf-8');
    if (!data.trim()) {
      return [];
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeRawUnsupportedPlugins([]);
      return [];
    }

    if (error.name === 'SyntaxError') {
      logSilently('unsupported_plugins.repaired_file', {
        reason: 'syntax_error',
        message: error.message
      });
      await writeRawUnsupportedPlugins([]);
      return [];
    }

    throw error;
  }
}

async function writeRawUnsupportedPlugins(plugins) {
  await ensureDataDir();
  const serialized = JSON.stringify(plugins, null, 2);
  await writeFile(unsupportedPluginsPath, `${serialized}\n`, 'utf-8');
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
    return readRawUnsupportedPlugins();
  });
}

export async function upsertUnsupportedPluginRecord({ namespace, domain }) {
  return withPluginsLock(async () => {
    const plugins = await readRawUnsupportedPlugins();
    const timestamp = new Date().toISOString();
    const existingIndex = plugins.findIndex((plugin) => plugin.namespace === namespace);

    if (existingIndex >= 0) {
      const plugin = plugins[existingIndex];
      const domains = new Set(plugin.domains ?? []);
      if (domain) {
        domains.add(domain);
      }

      plugins[existingIndex] = {
        ...plugin,
        lastDetectedAt: timestamp,
        domains: Array.from(domains)
      };

      await writeRawUnsupportedPlugins(plugins);
      return {
        mode: 'update',
        domainsTracked: plugins[existingIndex].domains?.length ?? 0
      };
    }

    plugins.push({
      namespace,
      firstDetectedAt: timestamp,
      lastDetectedAt: timestamp,
      domains: domain ? [domain] : []
    });

    await writeRawUnsupportedPlugins(plugins);

    return {
      mode: 'insert',
      domainsTracked: domain ? 1 : 0
    };
  });
}
