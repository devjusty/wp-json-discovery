import { runHomepageScan, runSitemapScan } from '../api/client.js';
import { scanDomain } from './scan.js';

export const CAPABILITY_IDS = Object.freeze({
  WORDPRESS: 'wordpress',
  HOMEPAGE: 'homepage',
  SITEMAP: 'sitemap'
});

export const SCAN_CAPABILITIES = Object.freeze([
  {
    id: CAPABILITY_IDS.WORDPRESS,
    label: 'WordPress API',
    description: 'Inspect public WordPress REST API data and exposure signals.',
    required: true,
    sectionIds: ['overview', 'exposure', 'performance', 'content', 'core', 'plugins', 'unsupported'],
    value: 5,
    cost: 2,
    baselineEligible: true,
    availability: () => true,
    defaultOptions: {},
    dependencies: [],
    normalizeOptions() {
      return { ...this.defaultOptions };
    },
    runner: ({ domain }) => scanDomain(domain)
  },
  {
    id: CAPABILITY_IDS.HOMEPAGE,
    label: 'Homepage',
    description: 'Inspect homepage assets, markup, and detected platform signals.',
    required: false,
    sectionIds: ['homepage'],
    value: 4,
    cost: 3,
    baselineEligible: true,
    availability: () => true,
    defaultOptions: {},
    dependencies: [],
    normalizeOptions() {
      return { ...this.defaultOptions };
    },
    runner: ({ domain }) => runHomepageScan({ domain })
  },
  {
    id: CAPABILITY_IDS.SITEMAP,
    label: 'Sitemap',
    description: 'Crawl sitemap URLs for page-level discovery signals.',
    required: false,
    sectionIds: ['sitemap'],
    value: 3,
    cost: 4,
    baselineEligible: true,
    availability: () => true,
    defaultOptions: { sitemapUrl: '', maxPages: 50 },
    dependencies: [],
    normalizeOptions(options) {
      return normalizeSitemapOptions(options, this.defaultOptions);
    },
    runner: ({ domain, options }) => runSitemapScan({ domain, ...options })
  }
]);

export function getCapabilityById(id) {
  return SCAN_CAPABILITIES.find((capability) => capability.id === id) ?? null;
}

export function getRecommendedCapabilityIds() {
  return SCAN_CAPABILITIES
    .filter((capability) => (
      capability.baselineEligible && capability.availability() && capability.value >= capability.cost
    ))
    .map((capability) => capability.id)
    .sort();
}

export function getRecommendedSelection() {
  return normalizeSelection({ capabilityIds: getRecommendedCapabilityIds() });
}

export function normalizeSelection(selection = {}) {
  const selectedIds = new Set(
    Array.isArray(selection.capabilityIds)
      ? selection.capabilityIds.filter((id) => getCapabilityById(id)?.availability())
      : []
  );
  selectedIds.add(CAPABILITY_IDS.WORDPRESS);

  const capabilityIds = Array.from(selectedIds).sort();
  const sourceOptions = selection.options && typeof selection.options === 'object'
    ? selection.options
    : {};
  const options = Object.fromEntries(capabilityIds.map((id) => [
    id,
    getCapabilityById(id).normalizeOptions(sourceOptions[id])
  ]));

  return { capabilityIds, options };
}

export function getSectionCapabilityId(sectionId) {
  return SCAN_CAPABILITIES.find((capability) => capability.sectionIds.includes(sectionId))?.id ?? null;
}

export function getCapabilityDependencies() {
  return Object.fromEntries(
    SCAN_CAPABILITIES.map((capability) => [capability.id, capability.dependencies])
  );
}

export function getCapabilityRunners(capabilityIds = SCAN_CAPABILITIES.map(({ id }) => id)) {
  return Object.fromEntries(
    capabilityIds
      .map((id) => getCapabilityById(id))
      .filter(Boolean)
      .map((capability) => [capability.id, capability.runner])
  );
}

function normalizeSitemapOptions(options, defaultOptions) {
  const source = options && typeof options === 'object' ? options : {};

  return {
    sitemapUrl: typeof source.sitemapUrl === 'string' ? source.sitemapUrl.trim() : defaultOptions.sitemapUrl,
    maxPages: clampMaxPages(source.maxPages, defaultOptions.maxPages)
  };
}

function clampMaxPages(value, fallback) {
  const parsedValue = Number(value);
  const maxPages = Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.trunc(parsedValue)
    : fallback;
  return Math.min(50, Math.max(1, maxPages));
}
