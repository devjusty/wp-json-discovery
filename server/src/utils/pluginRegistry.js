import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execute, queryAll, queryOne } from '../db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const SERVER_ROOT = path.resolve(__dirname, '../..');

const CANDIDATE_PLUGIN_PATHS = [
  process.env.WPJD_PLUGINS_CONFIG_PATH
    ? path.resolve(process.env.WPJD_PLUGINS_CONFIG_PATH)
    : null,
  path.join(WORKSPACE_ROOT, 'frontend/src/config/plugins.js'),
  path.join(SERVER_ROOT, 'frontend/src/config/plugins.js')
].filter(Boolean);

const CANDIDATE_THEME_PATHS = [
  process.env.WPJD_THEMES_CONFIG_PATH
    ? path.resolve(process.env.WPJD_THEMES_CONFIG_PATH)
    : null,
  path.join(WORKSPACE_ROOT, 'frontend/src/config/themes.js'),
  path.join(SERVER_ROOT, 'frontend/src/config/themes.js')
].filter(Boolean);

const DEFAULT_CORE_NAMESPACES = [
  'wp/v2',
  'oembed/1.0',
  'wp-site-health/v1'
];

let resolvedPluginsPath = null;
let resolvedThemesPath = null;
let seedPromise = null;

async function resolveConfigPath(candidates, cacheRefName) {
  if (cacheRefName === 'plugins' && resolvedPluginsPath) {
    return resolvedPluginsPath;
  }
  if (cacheRefName === 'themes' && resolvedThemesPath) {
    return resolvedThemesPath;
  }

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      if (cacheRefName === 'plugins') {
        resolvedPluginsPath = candidate;
        return resolvedPluginsPath;
      }
      resolvedThemesPath = candidate;
      return resolvedThemesPath;
    } catch {
      // try next
    }
  }

  throw new Error(`Unable to locate ${cacheRefName} config file. Checked: ${candidates.join(', ')}`);
}

async function loadSeedModule(filePath) {
  const fileUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
  return import(fileUrl);
}

function safeParseArrayJson(raw, fallback = []) {
  if (typeof raw !== 'string') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
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

function mapPluginRow(row) {
  return {
    id: row.id,
    label: row.label,
    description: row.description ?? '',
    pluginUrl: row.plugin_url ?? undefined,
    namespaces: safeParseArrayJson(row.namespaces_json, []),
    assetHints: safeParseArrayJson(row.asset_hints_json, [])
  };
}

function mapThemeRow(row) {
  return {
    id: row.id,
    label: row.label,
    description: row.description ?? '',
    themeUrl: row.theme_url ?? undefined,
    namespaceHints: safeParseArrayJson(row.namespace_hints_json, []),
    pathSignals: safeParseArrayJson(row.path_signals_json, [])
  };
}

export function sortPlugins(plugins = []) {
  return [...plugins].sort((a, b) => {
    const labelA = (a.label || a.id || '').toLowerCase();
    const labelB = (b.label || b.id || '').toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return (a.id || '').localeCompare(b.id || '');
  });
}

export function sortThemes(themes = []) {
  return [...themes].sort((a, b) => {
    const labelA = (a.label || a.id || '').toLowerCase();
    const labelB = (b.label || b.id || '').toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return (a.id || '').localeCompare(b.id || '');
  });
}

async function seedPluginRegistryIfEmpty() {
  const countRow = await queryOne('select count(1) as count from plugin_registry');
  const count = Number(countRow?.count ?? 0);
  if (count > 0) {
    return;
  }

  const pluginsPath = await resolveConfigPath(CANDIDATE_PLUGIN_PATHS, 'plugins');
  const seedModule = await loadSeedModule(pluginsPath);
  const seedPlugins = Array.isArray(seedModule.SUPPORTED_PLUGINS) ? seedModule.SUPPORTED_PLUGINS : [];
  const now = new Date().toISOString();

  for (const plugin of sortPlugins(seedPlugins)) {
    if (!plugin?.id || !plugin?.label) {
      continue;
    }

    await execute(
      `
        insert into plugin_registry (
          id,
          label,
          description,
          plugin_url,
          namespaces_json,
          asset_hints_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        plugin.id,
        plugin.label,
        plugin.description ?? '',
        plugin.pluginUrl ?? null,
        JSON.stringify(normalizeStringArray(plugin.namespaces)),
        JSON.stringify(normalizeStringArray(plugin.assetHints)),
        now,
        now
      ]
    );
  }

  const coreNamespaces = Array.isArray(seedModule.CORE_NAMESPACES)
    ? seedModule.CORE_NAMESPACES
    : DEFAULT_CORE_NAMESPACES;
  await execute(
    `
      insert into app_meta (key, value)
      values ('core_namespaces', ?)
      on conflict(key) do update set value = excluded.value
    `,
    [JSON.stringify(coreNamespaces)]
  );
}

async function seedThemeRegistryIfEmpty() {
  const countRow = await queryOne('select count(1) as count from theme_registry');
  const count = Number(countRow?.count ?? 0);
  if (count > 0) {
    return;
  }

  const themesPath = await resolveConfigPath(CANDIDATE_THEME_PATHS, 'themes');
  const seedModule = await loadSeedModule(themesPath);
  const seedThemes = Array.isArray(seedModule.SUPPORTED_THEMES) ? seedModule.SUPPORTED_THEMES : [];
  const now = new Date().toISOString();

  for (const theme of sortThemes(seedThemes)) {
    if (!theme?.id || !theme?.label) {
      continue;
    }

    await execute(
      `
        insert into theme_registry (
          id,
          label,
          description,
          theme_url,
          namespace_hints_json,
          path_signals_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        theme.id,
        theme.label,
        theme.description ?? '',
        theme.themeUrl ?? null,
        JSON.stringify(normalizeStringArray(theme.namespaceHints)),
        JSON.stringify(normalizeStringArray(theme.pathSignals)),
        now,
        now
      ]
    );
  }
}

async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await seedPluginRegistryIfEmpty();
      await seedThemeRegistryIfEmpty();
    })();
  }
  await seedPromise;
}

export async function loadPlugins() {
  await ensureSeeded();
  const rows = await queryAll(
    `
      select
        id,
        label,
        description,
        plugin_url,
        namespaces_json,
        asset_hints_json
      from plugin_registry
      order by lower(label) asc, lower(id) asc
    `
  );
  return rows.map(mapPluginRow);
}

export async function loadThemes() {
  await ensureSeeded();
  const rows = await queryAll(
    `
      select
        id,
        label,
        description,
        theme_url,
        namespace_hints_json,
        path_signals_json
      from theme_registry
      order by lower(label) asc, lower(id) asc
    `
  );
  return rows.map(mapThemeRow);
}

export async function savePlugins(nextPlugins = []) {
  await ensureSeeded();
  const sorted = sortPlugins(nextPlugins);
  const now = new Date().toISOString();

  await execute('delete from plugin_registry');

  for (const plugin of sorted) {
    await execute(
      `
        insert into plugin_registry (
          id,
          label,
          description,
          plugin_url,
          namespaces_json,
          asset_hints_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        plugin.id,
        plugin.label,
        plugin.description ?? '',
        plugin.pluginUrl ?? null,
        JSON.stringify(normalizeStringArray(plugin.namespaces)),
        JSON.stringify(normalizeStringArray(plugin.assetHints)),
        now,
        now
      ]
    );
  }

  return sorted;
}

export async function saveThemes(nextThemes = []) {
  await ensureSeeded();
  const sorted = sortThemes(nextThemes);
  const now = new Date().toISOString();

  await execute('delete from theme_registry');

  for (const theme of sorted) {
    await execute(
      `
        insert into theme_registry (
          id,
          label,
          description,
          theme_url,
          namespace_hints_json,
          path_signals_json,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        theme.id,
        theme.label,
        theme.description ?? '',
        theme.themeUrl ?? null,
        JSON.stringify(normalizeStringArray(theme.namespaceHints)),
        JSON.stringify(normalizeStringArray(theme.pathSignals)),
        now,
        now
      ]
    );
  }

  return sorted;
}

export async function loadCoreNamespaces() {
  await ensureSeeded();
  const row = await queryOne(
    'select value from app_meta where key = ?',
    ['core_namespaces']
  );

  const parsed = safeParseArrayJson(row?.value, DEFAULT_CORE_NAMESPACES)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return parsed.length ? parsed : DEFAULT_CORE_NAMESPACES;
}

export async function assertPluginRegistryReady() {
  await ensureSeeded();
  const pluginCountRow = await queryOne('select count(1) as count from plugin_registry');
  const themeCountRow = await queryOne('select count(1) as count from theme_registry');

  return {
    pluginsCount: Number(pluginCountRow?.count ?? 0),
    themesCount: Number(themeCountRow?.count ?? 0)
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

  plugin.description = typeof input.description === 'string' ? input.description.trim() : '';

  if (typeof input.pluginUrl === 'string' && input.pluginUrl.trim().length > 0) {
    plugin.pluginUrl = input.pluginUrl.trim();
  }

  plugin.namespaces = normalizeStringArray(input.namespaces);
  plugin.assetHints = normalizeStringArray(input.assetHints);

  return { plugin, errors };
}

export function validateTheme(input = {}, { requireId = true } = {}) {
  const errors = [];
  const theme = {};

  if (requireId) {
    if (typeof input.id !== 'string' || input.id.trim().length === 0) {
      errors.push('id is required');
    } else {
      theme.id = input.id.trim();
    }
  } else if (typeof input.id === 'string' && input.id.trim().length > 0) {
    theme.id = input.id.trim();
  }

  if (typeof input.label !== 'string' || input.label.trim().length === 0) {
    errors.push('label is required');
  } else {
    theme.label = input.label.trim();
  }

  theme.description = typeof input.description === 'string' ? input.description.trim() : '';

  if (typeof input.themeUrl === 'string' && input.themeUrl.trim().length > 0) {
    theme.themeUrl = input.themeUrl.trim();
  }

  theme.namespaceHints = normalizeStringArray(input.namespaceHints);
  theme.pathSignals = normalizeStringArray(input.pathSignals);

  return { theme, errors };
}
