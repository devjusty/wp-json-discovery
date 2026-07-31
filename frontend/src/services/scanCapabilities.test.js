import { beforeEach, describe, expect, it, vi } from 'vitest';

const scanDomain = vi.fn();
const runHomepageScan = vi.fn();
const runSitemapScan = vi.fn();
const runReconScan = vi.fn();

vi.mock('./scan.js', () => ({ scanDomain }));
vi.mock('../api/client.js', () => ({ runHomepageScan, runSitemapScan, runReconScan }));

const {
  CAPABILITY_IDS,
  SCAN_CAPABILITIES,
  getCapabilityById,
  getCapabilityDependencies,
  getCapabilityRunners,
  getRecommendedCapabilityIds,
  getRecommendedSelection,
  getSectionCapabilityId,
  normalizeSelection,
  setScanCapabilityContext
} = await import('./scanCapabilities.js');

describe('scan capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setScanCapabilityContext({ isAdmin: false });
  });

  it('returns stable recommended capability IDs and selection', () => {
    expect(CAPABILITY_IDS).toEqual({
      WORDPRESS: 'wordpress',
      HOMEPAGE: 'homepage',
      SITEMAP: 'sitemap',
      RECON: 'recon'
    });
    expect(getRecommendedCapabilityIds()).toEqual(['homepage', 'wordpress']);
    expect(getRecommendedSelection()).toEqual({
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    });
  });

  it('defines the complete scan capability registry contract', () => {
    expect(SCAN_CAPABILITIES.map((capability) => Object.keys(capability))).toEqual([
      ['id', 'label', 'description', 'required', 'sectionIds', 'value', 'cost', 'baselineEligible', 'availability', 'defaultOptions', 'dependencies', 'normalizeOptions', 'runner', 'onSettled'],
      ['id', 'label', 'description', 'required', 'sectionIds', 'value', 'cost', 'baselineEligible', 'availability', 'defaultOptions', 'dependencies', 'normalizeOptions', 'runner'],
      ['id', 'label', 'description', 'required', 'sectionIds', 'value', 'cost', 'baselineEligible', 'availability', 'defaultOptions', 'dependencies', 'normalizeOptions', 'runner'],
      ['id', 'label', 'description', 'required', 'sectionIds', 'value', 'cost', 'baselineEligible', 'availability', 'defaultOptions', 'dependencies', 'normalizeOptions', 'runner']
    ]);
    expect(SCAN_CAPABILITIES.map((capability) => ({
      id: capability.id,
      label: capability.label,
      description: capability.description,
      required: capability.required,
      sectionIds: capability.sectionIds,
      value: capability.value,
      cost: capability.cost,
      baselineEligible: capability.baselineEligible,
      availability: typeof capability.availability,
      defaultOptions: capability.defaultOptions,
      dependencies: capability.dependencies,
      normalizeOptions: typeof capability.normalizeOptions,
      runner: typeof capability.runner,
      onSettled: typeof capability.onSettled
    }))).toEqual([
      {
        id: 'wordpress',
        label: 'WordPress API',
        description: 'Inspect public WordPress REST API data and exposure signals.',
        required: true,
        sectionIds: ['overview', 'exposure', 'performance', 'content', 'core', 'plugins', 'unsupported'],
        value: 5,
        cost: 2,
        baselineEligible: true,
        availability: 'function',
        defaultOptions: {},
        dependencies: [],
        normalizeOptions: 'function',
        runner: 'function',
        onSettled: 'function'
      },
      {
        id: 'homepage',
        label: 'Homepage',
        description: 'Inspect homepage assets, markup, and detected platform signals.',
        required: false,
        sectionIds: ['homepage'],
        value: 4,
        cost: 3,
        baselineEligible: true,
        availability: 'function',
        defaultOptions: {},
        dependencies: [],
        normalizeOptions: 'function',
        runner: 'function',
        onSettled: 'undefined'
      },
      {
        id: 'sitemap',
        label: 'Sitemap',
        description: 'Crawl sitemap URLs for page-level discovery signals.',
        required: false,
        sectionIds: ['sitemap'],
        value: 3,
        cost: 4,
        baselineEligible: true,
        availability: 'function',
        defaultOptions: { sitemapUrl: '', maxPages: 50 },
        dependencies: [],
        normalizeOptions: 'function',
        runner: 'function',
        onSettled: 'undefined'
      },
      {
        id: 'recon',
        label: 'Domain recon',
        description: 'Passive DNS and attack-surface lookup via DNS Dumpster (admin only).',
        required: false,
        sectionIds: ['recon'],
        value: 2,
        cost: 4,
        baselineEligible: false,
        availability: 'function',
        defaultOptions: {},
        dependencies: [],
        normalizeOptions: 'function',
        runner: 'function',
        onSettled: 'undefined'
      }
    ]);
    expect(getCapabilityById('sitemap').normalizeOptions({})).toEqual({
      sitemapUrl: '',
      maxPages: 50
    });
  });

  it('gates recon availability to admins and keeps it out of recommendations', () => {
    expect(getCapabilityById('recon').availability()).toBe(false);
    expect(normalizeSelection({
      capabilityIds: ['recon', 'homepage']
    }).capabilityIds).toEqual(['homepage', 'wordpress']);

    setScanCapabilityContext({ isAdmin: true });
    expect(getCapabilityById('recon').availability()).toBe(true);
    expect(getRecommendedCapabilityIds()).toEqual(['homepage', 'wordpress']);
    expect(normalizeSelection({
      capabilityIds: ['recon', 'homepage']
    }).capabilityIds).toEqual(['homepage', 'recon', 'wordpress']);
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

  it('excludes unavailable capabilities from recommendations and selections', () => {
    const homepage = getCapabilityById('homepage');
    const availability = homepage.availability;
    homepage.availability = () => false;

    try {
      expect(getRecommendedCapabilityIds()).toEqual(['wordpress']);
      expect(normalizeSelection({
        capabilityIds: ['homepage', 'sitemap']
      }).capabilityIds).toEqual(['sitemap', 'wordpress']);
    } finally {
      homepage.availability = availability;
    }
  });

  it('normalizes sitemap options by trimming its URL and clamping max pages', () => {
    expect(normalizeSelection({
      capabilityIds: ['sitemap'],
      options: { sitemap: { sitemapUrl: '  /custom-sitemap.xml  ', maxPages: 0.5 } }
    }).options.sitemap).toEqual({ sitemapUrl: '/custom-sitemap.xml', maxPages: 1 });

    for (const maxPages of ['', null, 0]) {
      expect(normalizeSelection({
        capabilityIds: ['sitemap'],
        options: { sitemap: { maxPages } }
      }).options.sitemap.maxPages).toBe(50);
    }
  });

  it('maps result sections to their capability', () => {
    expect(getSectionCapabilityId('overview')).toBe('wordpress');
    expect(getSectionCapabilityId('homepage')).toBe('homepage');
    expect(getSectionCapabilityId('sitemap')).toBe('sitemap');
    expect(getSectionCapabilityId('recon')).toBe('recon');
    expect(getSectionCapabilityId('missing')).toBeNull();
  });

  it('exposes registry lookup and dependencies for every capability', () => {
    expect(getCapabilityById('homepage')).toBe(SCAN_CAPABILITIES[1]);
    expect(getCapabilityById('missing')).toBeNull();
    expect(getCapabilityDependencies()).toEqual({
      wordpress: [],
      homepage: [],
      sitemap: [],
      recon: []
    });
  });

  it('runs selected capabilities through existing scan services', async () => {
    setScanCapabilityContext({ isAdmin: true });
    scanDomain.mockResolvedValue('wordpress result');
    runHomepageScan.mockResolvedValue('homepage result');
    runSitemapScan.mockResolvedValue('sitemap result');
    runReconScan.mockResolvedValue('recon result');
    const runners = getCapabilityRunners(['wordpress', 'homepage', 'sitemap', 'recon']);

    await expect(runners.wordpress({ domain: 'example.com', options: {} })).resolves.toBe('wordpress result');
    await expect(runners.homepage({ domain: 'example.com', options: {} })).resolves.toBe('homepage result');
    await expect(runners.sitemap({
      domain: 'example.com',
      options: { sitemapUrl: '/sitemap.xml', maxPages: 10 }
    })).resolves.toBe('sitemap result');
    await expect(runners.recon({ domain: 'example.com', options: {} })).resolves.toBe('recon result');

    expect(scanDomain).toHaveBeenCalledWith('example.com');
    expect(runHomepageScan).toHaveBeenCalledWith({ domain: 'example.com' });
    expect(runSitemapScan).toHaveBeenCalledWith({
      domain: 'example.com',
      sitemapUrl: '/sitemap.xml',
      maxPages: 10
    });
    expect(runReconScan).toHaveBeenCalledWith({ domain: 'example.com' });
  });
});
