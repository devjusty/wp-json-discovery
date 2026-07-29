import { beforeEach, describe, expect, it, vi } from 'vitest';

const scanDomain = vi.fn();
const runHomepageScan = vi.fn();
const runSitemapScan = vi.fn();

vi.mock('./scan.js', () => ({ scanDomain }));
vi.mock('../api/client.js', () => ({ runHomepageScan, runSitemapScan }));

const {
  CAPABILITY_IDS,
  SCAN_CAPABILITIES,
  getCapabilityById,
  getCapabilityDependencies,
  getCapabilityRunners,
  getRecommendedCapabilityIds,
  getRecommendedSelection,
  getSectionCapabilityId,
  normalizeSelection
} = await import('./scanCapabilities.js');

describe('scan capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stable recommended capability IDs and selection', () => {
    expect(CAPABILITY_IDS).toEqual({
      WORDPRESS: 'wordpress',
      HOMEPAGE: 'homepage',
      SITEMAP: 'sitemap'
    });
    expect(getRecommendedCapabilityIds()).toEqual(['homepage', 'wordpress']);
    expect(getRecommendedSelection()).toEqual({
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    });
  });

  it('removes unknown and duplicate IDs while preserving required wordpress', () => {
    expect(normalizeSelection({
      capabilityIds: ['sitemap', 'unknown', 'sitemap'],
      options: {
        sitemap: { sitemapUrl: ' https://example.com/sitemap.xml ', maxPages: 75 },
        unknown: { ignored: true }
      }
    })).toEqual({
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        sitemap: { sitemapUrl: 'https://example.com/sitemap.xml', maxPages: 50 },
        wordpress: {}
      }
    });
  });

  it('normalizes sitemap options by trimming its URL and clamping max pages', () => {
    expect(normalizeSelection({
      capabilityIds: ['sitemap'],
      options: { sitemap: { sitemapUrl: '  /custom-sitemap.xml  ', maxPages: 0.5 } }
    }).options.sitemap).toEqual({ sitemapUrl: '/custom-sitemap.xml', maxPages: 1 });
  });

  it('maps result sections to their capability', () => {
    expect(getSectionCapabilityId('overview')).toBe('wordpress');
    expect(getSectionCapabilityId('homepage')).toBe('homepage');
    expect(getSectionCapabilityId('sitemap')).toBe('sitemap');
    expect(getSectionCapabilityId('missing')).toBeNull();
  });

  it('exposes registry lookup and empty dependencies', () => {
    expect(getCapabilityById('homepage')).toBe(SCAN_CAPABILITIES[1]);
    expect(getCapabilityById('missing')).toBeNull();
    expect(getCapabilityDependencies('sitemap')).toEqual([]);
    expect(getCapabilityDependencies('missing')).toEqual([]);
  });

  it('runs selected capabilities through existing scan services', async () => {
    scanDomain.mockResolvedValue('wordpress result');
    runHomepageScan.mockResolvedValue('homepage result');
    runSitemapScan.mockResolvedValue('sitemap result');
    const runners = getCapabilityRunners(['wordpress', 'homepage', 'sitemap']);

    await expect(runners.wordpress({ domain: 'example.com', options: {} })).resolves.toBe('wordpress result');
    await expect(runners.homepage({ domain: 'example.com', options: {} })).resolves.toBe('homepage result');
    await expect(runners.sitemap({
      domain: 'example.com',
      options: { sitemapUrl: '/sitemap.xml', maxPages: 10 }
    })).resolves.toBe('sitemap result');

    expect(scanDomain).toHaveBeenCalledWith('example.com');
    expect(runHomepageScan).toHaveBeenCalledWith({ domain: 'example.com' });
    expect(runSitemapScan).toHaveBeenCalledWith({
      domain: 'example.com',
      sitemapUrl: '/sitemap.xml',
      maxPages: 10
    });
  });
});
