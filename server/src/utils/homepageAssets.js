import { extractAssetSlug, getAssetLookups, matchAssetSlug } from './html.js';

export async function aggregateHomepageAssets(activityLogs = []) {
  const { pluginLookup, themeLookup } = await getAssetLookups();
  const byPath = new Map();

  activityLogs
    .filter((log) => log.type === 'homepage-scan')
    .forEach((log) => {
      const assets = log.payload?.assets ?? log.payload?.assetSamples ?? [];
      assets.forEach((asset) => {
        const key = asset.path;
        const slug = asset.slug ?? extractAssetSlug(asset.path);
        const type = asset.type ?? (asset.path?.includes('/themes/') ? 'theme' : 'plugin');
        const matches = matchAssetSlug(type, slug, pluginLookup, themeLookup);
        const existing = byPath.get(key) ?? {
          path: asset.path,
          type,
          occurrences: 0,
          matches: new Map()
        };

        existing.occurrences += asset.count ?? 1;
        matches.forEach((match) => {
          const matchId = match.id ?? match.slug ?? match.label ?? 'unknown';
          if (!existing.matches.has(matchId)) {
            existing.matches.set(matchId, match);
          }
        });
        byPath.set(key, existing);
      });
    });

  const all = Array.from(byPath.values())
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      occurrences: entry.occurrences,
      matches: Array.from(entry.matches.values())
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  const unknown = all.filter((asset) => (asset.matches?.length ?? 0) === 0);

  return {
    totalPaths: all.length,
    unknownPaths: unknown.length,
    all,
    unknown
  };
}
