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

  it('defines the complete scan capability registry contract', () => {
    expect(SCAN_CAPABILITIES.map((capability) => ({
      id: capability.id,
      required: capability.required,
      sections: capability.sections,
      value: capability.value,
      cost: capability.cost,
      defaultOptions: capability.defaultOptions
    }))).toEqual([
      {
        id: 'wordpress',
        required: true,
        sections: ['overview', 'exposure', 'performance', 'content', 'core', 'plugins', 'unsupported'],
        value: 5,
        cost: 2,
        defaultOptions: {}
      },
      {
        id: 'homepage',
        required: false,
        sections: ['homepage'],
        value: 4,
        cost: 3,
        defaultOptions: {}
      },
      {
        id: 'sitemap',
        required: false,
        sections: ['sitemap'],
        value: 3,
        cost: 4,
        defaultOptions: { sitemapUrl: '', maxPages: 50 }
      }
    ]);
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

  it('exposes registry lookup and dependencies for every capability', () => {
    expect(getCapabilityById('homepage')).toBe(SCAN_CAPABILITIES[1]);
    expect(getCapabilityById('missing')).toBeNull();
    expect(getCapabilityDependencies()).toEqual({
      wordpress: [],
      homepage: [],
      sitemap: []
    });
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
