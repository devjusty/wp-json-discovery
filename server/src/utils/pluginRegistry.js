import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGINS_PATH = path.resolve(__dirname, '../../../frontend/src/config/plugins.js');

export async function loadPlugins() {
  const fileUrl = `${pathToFileURL(PLUGINS_PATH).href}?t=${Date.now()}`;
  const module = await import(fileUrl);
  const plugins = module.SUPPORTED_PLUGINS ?? [];
  return Array.isArray(plugins) ? plugins : [];
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
  const sorted = sortPlugins(nextPlugins);
  const banner = '// This file is generated via admin plugin manager. Keep entries sorted by label.\n';
  const body = inspect(sorted, {
    depth: null,
    compact: false,
    breakLength: 80,
    sorted: false,
    maxArrayLength: null
  });
  const contents = `${banner}export const SUPPORTED_PLUGINS = ${body};\n`;
  await fs.writeFile(PLUGINS_PATH, contents, 'utf8');
  return sorted;
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
