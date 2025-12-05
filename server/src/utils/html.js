import * as cheerio from 'cheerio';
import { SUPPORTED_PLUGINS } from '../../../frontend/src/config/plugins.js';
import { SUPPORTED_THEMES } from '../../../frontend/src/config/themes.js';

const KNOWN_PLUGIN_ASSETS = buildAssetLookup(SUPPORTED_PLUGINS, 'plugin');
const KNOWN_THEME_ASSETS = buildAssetLookup(SUPPORTED_THEMES, 'theme');

export function extractHomepageInsights(html = '') {
  const $ = cheerio.load(html);

  const meta = extractMetaTags($);
  const comments = extractComments($);
  const assets = extractAssetPaths($);
  const scriptHints = extractScriptHints($);
  const frameworks = detectFrameworks($, assets, scriptHints);
  const other = detectOtherHints($);

  return {
    meta,
    comments,
    scripts: scriptHints,
    assets,
    frameworks,
    other
  };
}

function extractMetaTags($) {
  const results = [];
  $('meta').each((_i, el) => {
    const name = $(el).attr('name') || $(el).attr('property');
    const content = $(el).attr('content');
    if (name && content) {
      results.push({
        name: name.trim(),
        content: content.trim()
      });
    }
  });

  const seen = new Set();
  const uniqueResults = [];
  for (const item of results) {
    const key = `${item.name}::${item.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueResults.push(item);
  }

  return uniqueResults.slice(0, 50);
}

function extractComments($) {
  const comments = [];
  $('*')
    .contents()
    .each((_i, el) => {
      if (el.nodeType === 8) {
        // Comment node
        const value = $(el).text().trim();
        if (value) {
          comments.push(value.slice(0, 240));
        }
        if (comments.length >= 30) return false; // Break loop
      }
    });
  return comments;
}

function extractAssetPaths($) {
  const counts = new Map();

  // Find all elements that might link to assets
  $('link[href*="/wp-content/"], script[src*="/wp-content/"], img[src*="/wp-content/"]')
    .each((_i, el) => {
      const src = $(el).attr('href') || $(el).attr('src');
      if (src) {
        const match = src.match(/\/wp-content\/(plugins|themes)\/[a-zA-Z0-9._-]+/);
        if (match) {
          const pathValue = match[0];
          counts.set(pathValue, (counts.get(pathValue) ?? 0) + 1);
        }
      }
    });

  const assets = Array.from(counts.entries())
    .map(([pathValue, count]) => ({
      path: pathValue,
      count,
      type: pathValue.includes('/plugins/') ? 'plugin' : 'theme'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return assets.map((asset) => {
    const slug = extractAssetSlug(asset.path);
    const matches = matchAssetSlug(asset.type, slug);

    return {
      ...asset,
      slug,
      matches
    };
  });
}

function extractScriptHints($) {
  const hints = [];
  const patterns = [
    'elementorFrontendConfig',
    'elementorKit',
    'et_builder_utils', // Divi
    'Divi',
    'BricksConfig',
    '__NEXT_DATA__',
    'gatsby',
    'astro/assets',
    'oxygen',
    'wpmlBrowserRedirectLanguage',
    'wpeData',
    'wpaas',
    'jetpack',
    'CloudflarePages',
    'Shopify',
    'Squarespace',
    'Wix',
    'Webflow',
    'import.meta.env'
  ];

  const html = $.html(); // Get the full HTML content to search for script hints

  patterns.forEach((needle) => {
    if (html.includes(needle)) {
      hints.push(needle);
    }
  });

  return hints;
}

function detectFrameworks($, assets = [], scriptHints = []) {
  const frameworks = new Set();
  const assetPaths = assets.map((item) => item.path);

  // Check for Next.js
  if (
    $.html().includes('__NEXT_DATA__') ||
    assetPaths.some((p) => p.includes('/_next/'))
  ) {
    frameworks.add('Next.js');
  }
  // Check for Gatsby
  if ($.html().includes('gatsby') || assetPaths.some((p) => p.includes('/static/'))) {
    frameworks.add('Gatsby');
  }
  // Check for Shopify
  if (
    $.html().includes('Shopify') ||
    assetPaths.some((p) => p.includes('cdn.shopify.com'))
  ) {
    frameworks.add('Shopify');
  }
  // Check for Squarespace
  if ($.html().includes('Squarespace')) {
    frameworks.add('Squarespace');
  }
  // Check for Vite
  if ($.html().includes('import.meta.env') || $.html().includes('vite')) {
    frameworks.add('Vite');
  }
  // Check for Wix
  if ($.html().includes('Wix')) {
    frameworks.add('Wix');
  }
  // Check for Webflow
  if ($.html().toLowerCase().includes('webflow')) {
    frameworks.add('Webflow');
  }

  scriptHints.forEach((hint) => {
    if (hint === 'BricksConfig') {
      frameworks.add('Bricks');
    }
    if (hint === 'elementorFrontendConfig' || hint === 'elementorKit') {
      frameworks.add('Elementor');
    }
    if (hint === 'et_builder_utils' || hint === 'Divi') {
      frameworks.add('Divi');
    }
  });

  return Array.from(frameworks);
}

function detectOtherHints($) {
  const hints = [];
  const html = $.html();
  if (html.includes('/xmlrpc.php')) {
    hints.push('xmlrpc reference present');
  }
  if (html.includes('/wp-json')) {
    hints.push('wp-json reference present');
  }
  // Check for hreflang tags
  if ($('link[rel="alternate"][hreflang]').length > 0) {
    hints.push('hreflang tags present');
  }
  return hints.slice(0, 20);
}

export function extractAssetSlug(pathValue = '') {
  const match = pathValue.match(/\/wp-content\/(?:plugins|themes)\/([^/]+)/i);
  if (!match || !match[1]) {
    return null;
  }
  return match[1].toLowerCase();
}

function matchAssetSlug(type, slug) {
  if (!slug) {
    return [];
  }
  const lookup = type === 'plugin' ? KNOWN_PLUGIN_ASSETS : KNOWN_THEME_ASSETS;
  return lookup.get(slug) ?? [];
}

function buildAssetLookup(definitions = [], type) {
  const lookup = new Map();

  definitions.forEach((item) => {
    const slugs = collectAssetSlugs(item);

    slugs.forEach((slug) => {
      const normalized = slug.toLowerCase();
      const existing = lookup.get(normalized) ?? [];
      const match = {
        id: item.id ?? normalized,
        label: item.label ?? normalized,
        type,
        slug: normalized
      };

      if (!existing.some((entry) => entry.id === match.id)) {
        lookup.set(normalized, [...existing, match]);
      }
    });
  });

  return lookup;
}

function collectAssetSlugs(item) {
  const slugs = new Set();
  if (!item) {
    return slugs;
  }

  if (typeof item.id === 'string') {
    slugs.add(item.id);
  }

  if (typeof item.pluginUrl === 'string') {
    const pluginSlug = extractSlugFromUrl(item.pluginUrl);
    if (pluginSlug) {
      slugs.add(pluginSlug);
    }
  }

  if (typeof item.themeUrl === 'string') {
    const themeSlug = extractSlugFromUrl(item.themeUrl);
    if (themeSlug) {
      slugs.add(themeSlug);
    }
  }

  if (Array.isArray(item.signals)) {
    item.signals.forEach((signal) => {
      const signalSlug = extractAssetSlug(signal);
      if (signalSlug) {
        slugs.add(signalSlug);
      }
    });
  }

  if (Array.isArray(item.assetHints)) {
    item.assetHints.forEach((hint) => {
      if (typeof hint === 'string' && hint.trim().length > 0) {
        slugs.add(hint.trim());
      }
    });
  }

  return slugs;
}

function extractSlugFromUrl(url = '') {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? null;
  } catch {
    const match = String(url).match(/\/([^/]+)\/?$/);
    return match ? match[1] : null;
  }
}
