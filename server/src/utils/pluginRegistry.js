import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const SERVER_ROOT = path.resolve(__dirname, '../..');

const CANDIDATE_PLUGIN_PATHS = [
  process.env.WPJD_PLUGINS_CONFIG_PATH
    ? path.resolve(process.env.WPJD_PLUGINS_CONFIG_PATH)
    : null,
  path.join(WORKSPACE_ROOT, 'frontend/src/config/plugins.js'),
  // Legacy fallback path used by earlier buggy resolution logic.
  path.join(SERVER_ROOT, 'frontend/src/config/plugins.js')
].filter(Boolean);
const DEFAULT_CORE_NAMESPACES = [
  'wp/v2',
  'oembed/1.0',
  'wp-site-health/v1'
];

let resolvedPluginsPath = null;

async function resolvePluginsPath() {
  if (resolvedPluginsPath) {
    return resolvedPluginsPath;
  }

  for (const candidate of CANDIDATE_PLUGIN_PATHS) {
    try {
      await fs.access(candidate);
      resolvedPluginsPath = candidate;
      return resolvedPluginsPath;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    `Unable to locate plugins config file. Checked: ${CANDIDATE_PLUGIN_PATHS.join(', ')}`
  );
}

export async function loadPlugins() {
  const pluginsPath = await resolvePluginsPath();
  const fileUrl = `${pathToFileURL(pluginsPath).href}?t=${Date.now()}`;
  const module = await import(fileUrl);
  const plugins = module.SUPPORTED_PLUGINS ?? [];
  return Array.isArray(plugins) ? plugins : [];
}

async function loadCoreNamespaces() {
  try {
    const pluginsPath = await resolvePluginsPath();
    const fileUrl = `${pathToFileURL(pluginsPath).href}?t=${Date.now()}`;
    const module = await import(fileUrl);
    const namespaces = module.CORE_NAMESPACES;
    return Array.isArray(namespaces) ? namespaces : DEFAULT_CORE_NAMESPACES;
  } catch {
    return DEFAULT_CORE_NAMESPACES;
  }
}

export function sortPlugins(plugins = []) {
  return [...plugins].sort((a, b) => {
    const labelA = (a.label || a.id || '').toLowerCase();
    const labelB = (b.label || b.id || '').toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    const idA = (a.id || '').toLowerCase();
    const idB = (b.id || '').toLowerCase();
    return idA.localeCompare(idB);
  });
}

export async function savePlugins(nextPlugins = []) {
  const pluginsPath = await resolvePluginsPath();
  const coreNamespaces = await loadCoreNamespaces();
  const sorted = sortPlugins(nextPlugins);
  const banner = '// This file is generated via admin plugin manager. Keep entries sorted by label.\n';
  const body = inspect(sorted, {
    depth: null,
    compact: false,
    breakLength: 80,
    sorted: false,
    maxArrayLength: null
  });
  const coreBody = inspect(coreNamespaces, {
    depth: null,
    compact: false,
    breakLength: 80,
    sorted: false,
    maxArrayLength: null
  });
  const contents = `${banner}export const SUPPORTED_PLUGINS = ${body};\n\nexport const CORE_NAMESPACES = ${coreBody};\n`;
  await fs.writeFile(pluginsPath, contents, 'utf8');
  return sorted;
}

export async function assertPluginRegistryReady() {
  const pluginsPath = await resolvePluginsPath();
  const plugins = await loadPlugins();
  if (!Array.isArray(plugins)) {
    throw new Error(
      `Invalid plugins config export at ${pluginsPath}: SUPPORTED_PLUGINS must be an array`
    );
  }
  return {
    pluginsPath,
    count: plugins.length
  };
}

export function validatePlugin(input = {}, { requireId = true } = {}) {
  const errors = [];
  const plugin = {};

  if (requireId) {
    if (typeof input.id !== 'string' || input.id.trim().length === 0) {
      errors.push('id is required');
    } else {
      plugin.id = input.id.trim();
    }
  } else if (typeof input.id === 'string' && input.id.trim().length > 0) {
    plugin.id = input.id.trim();
  }

  if (typeof input.label !== 'string' || input.label.trim().length === 0) {
    errors.push('label is required');
  } else {
    plugin.label = input.label.trim();
  }

  if (typeof input.description === 'string') {
    plugin.description = input.description.trim();
  } else {
    plugin.description = '';
  }

  if (typeof input.pluginUrl === 'string' && input.pluginUrl.trim().length > 0) {
    plugin.pluginUrl = input.pluginUrl.trim();
  }

  plugin.namespaces = normalizeStringArray(input.namespaces);
  plugin.assetHints = normalizeStringArray(input.assetHints);

  return { plugin, errors };
}

function normalizeStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}
