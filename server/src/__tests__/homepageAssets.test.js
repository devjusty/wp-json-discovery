import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../utils/html.js', () => ({
  extractAssetSlug: vi.fn((value) => {
    const segments = String(value ?? '').split('/').filter(Boolean);
    return segments[segments.length - 1] ?? null;
  }),
  getAssetLookups: vi.fn(async () => ({
    pluginLookup: new Map([
      [
        'convertkit',
        [
          {
            id: 'convertkit',
            label: 'ConvertKit',
            type: 'plugin',
            slug: 'convertkit'
          }
        ]
      ]
    ]),
    themeLookup: new Map()
  })),
  matchAssetSlug: vi.fn((type, slug, pluginLookup, themeLookup) => {
    const lookup = type === 'theme' ? themeLookup : pluginLookup;
    return lookup.get(slug?.toLowerCase?.() ?? '') ?? [];
  })
}));

import { aggregateHomepageAssets } from '../utils/homepageAssets.js';

describe('aggregateHomepageAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rematches homepage assets against the current registry', async () => {
    const result = await aggregateHomepageAssets([
      {
        type: 'homepage-scan',
        payload: {
          assets: [
            {
              path: '/wp-content/plugins/convertkit/assets/embed.js',
              type: 'plugin',
              count: 2,
              matches: [
                {
                  id: 'legacy-match',
                  label: 'Legacy',
                  type: 'plugin',
                  slug: 'legacy'
                }
              ]
            }
          ]
        }
      }
    ]);

    expect(result.totalPaths).toBe(1);
    expect(result.unknownPaths).toBe(0);
    expect(result.all[0].matches).toEqual([
      expect.objectContaining({
        id: 'convertkit',
        label: 'ConvertKit',
        type: 'plugin',
        slug: 'convertkit'
      })
    ]);
  });
});
