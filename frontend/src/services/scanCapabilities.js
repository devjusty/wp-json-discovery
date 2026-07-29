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
    required: true,
    sections: ['overview', 'exposure', 'performance', 'content', 'core', 'plugins', 'unsupported'],
    value: 5,
    cost: 2,
    baselineEligible: true,
    defaultOptions: {},
    dependencies: [],
    run: ({ domain }) => scanDomain(domain)
  },
  {
    id: CAPABILITY_IDS.HOMEPAGE,
    required: false,
    sections: ['homepage'],
    value: 4,
    cost: 3,
    baselineEligible: true,
    defaultOptions: {},
    dependencies: [],
    run: ({ domain }) => runHomepageScan({ domain })
  },
  {
    id: CAPABILITY_IDS.SITEMAP,
    required: false,
    sections: ['sitemap'],
    value: 3,
    cost: 4,
    baselineEligible: true,
    defaultOptions: { sitemapUrl: '', maxPages: 50 },
    dependencies: [],
    run: ({ domain, options }) => runSitemapScan({ domain, ...options })
  }
]);

export function getCapabilityById(id) {
  return SCAN_CAPABILITIES.find((capability) => capability.id === id) ?? null;
}

export function getRecommendedCapabilityIds() {
  return SCAN_CAPABILITIES
    .filter((capability) => capability.baselineEligible && capability.value >= capability.cost)
    .map((capability) => capability.id)
    .sort();
}

export function getRecommendedSelection() {
  return normalizeSelection({ capabilityIds: getRecommendedCapabilityIds() });
}

export function normalizeSelection(selection = {}) {
  const selectedIds = new Set(
    Array.isArray(selection.capabilityIds)
      ? selection.capabilityIds.filter((id) => getCapabilityById(id))
      : []
  );
  selectedIds.add(CAPABILITY_IDS.WORDPRESS);

  const capabilityIds = Array.from(selectedIds).sort();
  const sourceOptions = selection.options && typeof selection.options === 'object'
    ? selection.options
    : {};
  const options = Object.fromEntries(capabilityIds.map((id) => [
    id,
    normalizeCapabilityOptions(id, sourceOptions[id])
  ]));

  return { capabilityIds, options };
}

export function getSectionCapabilityId(sectionId) {
  return SCAN_CAPABILITIES.find((capability) => capability.sections.includes(sectionId))?.id ?? null;
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
      .map((capability) => [capability.id, capability.run])
  );
}

function normalizeCapabilityOptions(id, options) {
  const capability = getCapabilityById(id);
  const source = options && typeof options === 'object' ? options : {};

  if (id === CAPABILITY_IDS.SITEMAP) {
    return {
      sitemapUrl: typeof source.sitemapUrl === 'string' ? source.sitemapUrl.trim() : '',
      maxPages: clampMaxPages(source.maxPages)
    };
  }

  return { ...capability.defaultOptions };
}

function clampMaxPages(value) {
  const maxPages = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 50;
  return Math.min(50, Math.max(1, maxPages));
}
