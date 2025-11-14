import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logSilently, recordLog, rotateLog } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, '..', '.env'));

const app = express();
const PORT = process.env.PORT ?? 4100;
const REQUEST_TIMEOUT_MS = 15000;
const dataDir = path.join(__dirname, '..', 'data');
const unsupportedPluginsPath = path.join(dataDir, 'unsupported-plugins.json');
let pluginsQueue = Promise.resolve();

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/proxy', async (req, res) => {
  const { domain, endpoint = '/wp-json/' } = req.query;

  if (typeof domain !== 'string' || domain.trim().length === 0) {
    return res.status(400).json({ error: 'domain query parameter is required' });
  }

  const sanitizedDomain = sanitizeDomain(domain);
  if (!sanitizedDomain) {
    return res.status(400).json({ error: 'Invalid domain provided' });
  }

  let targetUrl;
  let normalizedEndpoint;

  try {
    normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    targetUrl = new URL(normalizedEndpoint, `https://${sanitizedDomain}`).toString();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid endpoint path', details: error.message });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': 'wp-json-discovery/0.0.1 (+https://github.com/justinthompson/wp-json-discovery)'
      }
    });

    const contentType = response.headers.get('content-type') ?? 'application/json';
    const payload = await response.text();
    const durationMs = Date.now() - startedAt;

    logSilently('proxy.response', {
      domain: sanitizedDomain,
      endpoint: normalizedEndpoint,
      targetUrl,
      status: response.status,
      durationMs,
      contentType,
      bytes: payload.length
    });

    res.status(response.status);
    res.set('content-type', contentType);
    res.send(payload);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logSilently('proxy.error', {
      domain: sanitizedDomain,
      endpoint: normalizedEndpoint ?? endpoint,
      targetUrl,
      durationMs,
      error: error.message
    });

    if (error.name === 'AbortError') {
      res.status(504).json({ error: 'Request to target domain timed out', targetUrl });
    } else {
      res.status(502).json({ error: 'Failed to reach target domain', targetUrl, details: error.message });
    }
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/api/unsupported-plugins', async (_req, res) => {
  try {
    const plugins = await readUnsupportedPlugins();
    res.json(plugins);
  } catch (error) {
    logSilently('unsupported_plugins.read_error', {
      message: error.message
    });
    res.status(500).json({ error: 'Failed to read unsupported plugins list', details: error.message });
  }
});

app.post('/api/unsupported-plugins', async (req, res) => {
  const { namespace, domain } = req.body ?? {};

  if (typeof namespace !== 'string' || namespace.trim().length === 0) {
    return res.status(400).json({ error: 'namespace is required' });
  }

  const sanitizedNamespace = namespace.trim();
  const sanitizedDomain = typeof domain === 'string' ? sanitizeDomain(domain) : null;

  try {
    const { mode, domainsTracked } = await upsertUnsupportedPluginRecord({
      namespace: sanitizedNamespace,
      domain: sanitizedDomain
    });

    res.status(mode === 'insert' ? 201 : 200).json({ namespace: sanitizedNamespace });

    logSilently('unsupported_plugins.upserted', {
      namespace: sanitizedNamespace,
      domain: sanitizedDomain,
      mode,
      domainsTracked
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save unsupported plugin', details: error.message });
  }
});

app.post('/api/logs', async (req, res) => {
  const { type, payload } = req.body ?? {};

  if (typeof type !== 'string' || type.trim().length === 0) {
    return res.status(400).json({ error: 'type is required for log events' });
  }

  try {
    await recordLog(type.trim(), payload ?? {});
    res.status(202).json({ acknowledged: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record log entry', details: error.message });
  }
});

app.post('/api/logs/rotate', async (_req, res) => {
  try {
    const { archiveName } = await rotateLog();
    logSilently('logs.rotated', { archive: archiveName });
    res.json({ filename: archiveName });
  } catch (error) {
    logSilently('logs.rotate_error', { message: error.message });
    res
      .status(500)
      .json({ error: 'Failed to rotate activity log', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function sanitizeDomain(input) {
  const trimmed = input.trim().toLowerCase();

  // Basic allowlist: alphanumerics, dots, dashes. No protocol or path.
  if (!/^[a-z0-9.-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

async function readUnsupportedPlugins() {
  return withPluginsLock(async () => {
    return readRawUnsupportedPlugins();
  });
}

async function upsertUnsupportedPluginRecord({ namespace, domain }) {
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
  pluginsQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .forEach((line) => {
        const [key, ...valueParts] = line.split('=');
        if (!key || process.env[key] !== undefined) {
          return;
        }
        const value = valueParts.join('=').trim();
        process.env[key] = value;
      });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[env] Failed to load ${filePath}: ${error.message}`);
    }
  }
}
