import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map();

vi.mock('./scanCapabilities.js', async (importOriginal) => importOriginal());

const {
  SCAN_PREFERENCES_KEY,
  loadScanPreferences,
  saveScanPreferences
} = await import('./scanPreferences.js');

describe('scan preferences', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    });
  });

  it('restores a valid versioned selection from storage', () => {
    storage.set(SCAN_PREFERENCES_KEY, JSON.stringify({
      version: 1,
      capabilityIds: ['sitemap'],
      options: { sitemap: { sitemapUrl: ' /site.xml ', maxPages: 20 } }
    }));

    expect(loadScanPreferences()).toEqual({
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        wordpress: {},
        sitemap: { sitemapUrl: '/site.xml', maxPages: 20 }
      }
    });
  });

  it('falls back to recommendations for malformed, missing, or wrong-version storage', () => {
    expect(loadScanPreferences()).toEqual({
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    });

    storage.set(SCAN_PREFERENCES_KEY, '{bad json');
    expect(loadScanPreferences().capabilityIds).toEqual(['homepage', 'wordpress']);

    storage.set(SCAN_PREFERENCES_KEY, JSON.stringify({ version: 2 }));
    expect(loadScanPreferences().capabilityIds).toEqual(['homepage', 'wordpress']);
  });

  it('saves a normalized versioned record without scan state', () => {
    expect(saveScanPreferences({
      capabilityIds: ['sitemap', 'unknown'],
      options: { sitemap: { sitemapUrl: ' site.xml ', maxPages: 99 } },
      domain: 'example.com',
      results: { private: true },
      status: 'complete',
      error: 'none'
    })).toEqual({
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        wordpress: {},
        sitemap: { sitemapUrl: 'site.xml', maxPages: 50 }
      }
    });

    expect(JSON.parse(storage.get(SCAN_PREFERENCES_KEY))).toEqual({
      version: 1,
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        wordpress: {},
        sitemap: { sitemapUrl: 'site.xml', maxPages: 50 }
      }
    });
  });

  it('returns normalized preferences when storage rejects writes', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key) => storage.get(key) ?? null,
      setItem: () => {
        throw new Error('Storage blocked');
      }
    });

    expect(saveScanPreferences({
      capabilityIds: ['sitemap'],
      options: { sitemap: { maxPages: 10 } }
    })).toEqual({
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        wordpress: {},
        sitemap: { sitemapUrl: '', maxPages: 10 }
      }
    });
  });
});
