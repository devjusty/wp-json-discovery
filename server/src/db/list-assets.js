#!/usr/bin/env node
import { getDb } from './client.js';
import { extractAssetSlug } from '../utils/html.js';
import { SUPPORTED_PLUGINS } from '../../../frontend/src/config/plugins.js';
import { SUPPORTED_THEMES } from '../../../frontend/src/config/themes.js';

function buildAssetLookup(definitions = [], type) {
  const lookup = new Map();
  definitions.forEach((item) => {
    const slugs = collectSlugs(item);
    slugs.forEach((slug) => {
      const key = slug.toLowerCase();
      const match = {
        id: item.id ?? key,
        label: item.label ?? key,
        type,
        slug: key
      };
      const existing = lookup.get(key) ?? [];
      if (!existing.some((entry) => entry.id === match.id)) {
        lookup.set(key, [...existing, match]);
      }
    });
  });
  return lookup;
}

function collectSlugs(item) {
  const slugs = new Set();
  if (typeof item.id === 'string') slugs.add(item.id);
  if (Array.isArray(item.assetHints)) {
    item.assetHints.forEach((hint) => {
      if (typeof hint === 'string' && hint.trim()) slugs.add(hint.trim());
    });
  }
  const pathSignals = item.pathSignals ?? item.signals ?? [];
  if (Array.isArray(pathSignals)) {
    pathSignals.forEach((signal) => {
      const slug = extractAssetSlug(signal) ?? normalizeSlug(signal);
      if (slug) slugs.add(slug);
    });
  }
  if (Array.isArray(item.namespaceHints)) {
    item.namespaceHints.forEach((hint) => {
      const slug = normalizeSlug(hint);
      if (slug) slugs.add(slug);
    });
  }
  if (typeof item.pluginUrl === 'string') {
    const slug = item.pluginUrl.split('/').filter(Boolean).pop();
    if (slug) slugs.add(slug);
  }
  if (typeof item.themeUrl === 'string') {
    const slug = item.themeUrl.split('/').filter(Boolean).pop();
    if (slug) slugs.add(slug);
  }
  return slugs;
}

function matchAsset(slug, type, pluginLookup, themeLookup) {
  if (!slug) return [];
  const lookup = type === 'theme' ? themeLookup : pluginLookup;
  return lookup.get(slug.toLowerCase()) ?? [];
}

async function main() {
  const limit = Number.parseInt(process.argv[2] ?? '200', 10);
  const db = await getDb();
  const rows = db
    .prepare('select id, timestamp, payload_json from activity_logs where type = ? order by id desc limit ?')
    .all('homepage-scan', Number.isFinite(limit) ? limit : 200);

  const pluginLookup = buildAssetLookup(SUPPORTED_PLUGINS, 'plugin');
  const themeLookup = buildAssetLookup(SUPPORTED_THEMES, 'theme');

  const byPath = new Map();

  rows.forEach((row) => {
    let payload = {};
    try {
      payload = JSON.parse(row.payload_json ?? '{}');
    } catch {
      payload = {};
    }
    const assets = payload.assets ?? payload.assetSamples ?? [];
    assets.forEach((asset) => {
      const slug = asset.slug ?? extractAssetSlug(asset.path);
      const type = asset.type ?? (asset.path?.includes('/themes/') ? 'theme' : 'plugin');
      const matches = asset.matches?.length ? asset.matches : matchAsset(slug, type, pluginLookup, themeLookup);
      const key = asset.path;
      const existing = byPath.get(key) ?? {
        path: asset.path,
        type,
        slug,
        occurrences: 0,
        matches: new Map(),
        sources: []
      };
      existing.occurrences += asset.count ?? 1;
      matches.forEach((match) => {
        const matchId = match.id ?? match.slug ?? match.label ?? 'unknown';
        if (!existing.matches.has(matchId)) {
          existing.matches.set(matchId, match);
        }
      });
      existing.sources.push(row.timestamp);
      byPath.set(key, existing);
    });
  });

  const all = Array.from(byPath.values())
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      slug: entry.slug,
      occurrences: entry.occurrences,
      matches: Array.from(entry.matches.values()),
      samples: entry.sources.slice(0, 5)
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  const unknown = all.filter((asset) => (asset.matches?.length ?? 0) === 0);

  console.log(
    JSON.stringify(
      {
        scansAnalyzed: rows.length,
        totalAssets: all.length,
        unknownAssets: unknown.length,
        assets: all,
        unknown
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Failed to list assets', error);
  process.exit(1);
});

function normalizeSlug(value = '') {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
  return cleaned || null;
}
