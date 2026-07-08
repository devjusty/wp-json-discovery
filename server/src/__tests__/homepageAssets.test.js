import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const extractAssetSlug = jest.fn((value) => {
  const match = String(value ?? '').match(/\/wp-content\/(?:plugins|themes)\/([^/]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
});

const getAssetLookups = jest.fn(async () => ({
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
  }));

const matchAssetSlug = jest.fn((type, slug, pluginLookup, themeLookup) => {
    const lookup = type === 'theme' ? themeLookup : pluginLookup;
    return lookup.get(slug?.toLowerCase?.() ?? '') ?? [];
  });

jest.unstable_mockModule('../utils/html.js', () => ({
  extractAssetSlug,
  getAssetLookups,
  matchAssetSlug
}));

const { aggregateHomepageAssets } = await import('../utils/homepageAssets.js');

describe('aggregateHomepageAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
