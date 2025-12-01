# Sitemap & Page SEO Scan Plan

Goal: add a secondary scan that crawls sitemap(s), fetches page-level data, and surfaces SEO/Schema insights. Start with pages; expand to posts/CPTs later.

## Scope (iteration 1)

- Discover sitemaps: follow `/sitemap.xml` (handle redirects) and parse index + page sitemaps. ✅ Implemented (with 3-hop redirects).
- Target pages only: collect canonical URL list (respect `<loc>`; optionally filter by `lastmod` recency). ✅ Pages pulled; `lastmod` filter pending.
- Fetch page HTML (lightweight GET with sane concurrency and timeouts). ✅ Basic fetch; add concurrency/timeout controls.
- Extract SEO basics: ✅ Title, meta description, meta robots, canonical, OG/Twitter captured.
- Schema detection: ✅ JSON-LD parse; collects `@type` including `@graph`; minimal validation for common types.
- Flags: ✅ Missing title/description, noindex, canonical mismatch, schema_invalid. (Length checks pending.)

## Data model

- `sitemapScan`: {
  startedAt, completedAt, durationMs,
  sitemaps: [{ url, type: 'index'|'page', entries, status, durationMs }],
  pages: [
  {
  url, sourceSitemap,
  statusCode, durationMs, bytes, redirectedTo,
  seo: { title, description, robots, canonical, ogTags, twitterTags },
  schema: {
  types: [ '@type strings' ],
  items: [ { type, raw, valid, errors } ]
  },
  flags: [ 'missing_title', 'missing_description', 'noindex', 'canonical_mismatch', 'schema_invalid' ]
  }
  ],
  totals: { pagesScanned, schemaCount, invalidSchemaCount, noindexCount },
  errors: [ { stage, url, message } ]
  }

## Backend changes (server/)

- Add `/api/sitemap-scan` endpoint:
  - Accept `{ domain, maxPages?, timeoutMs?, userAgent? }`.
  - Steps: resolve domain; fetch sitemap.xml (follow redirects); parse XML to collect page URLs; cap pages by `maxPages` and dedupe.
  - Fetch pages with concurrency limit (e.g., 3-5), timeout, custom UA.
  - Extract HTML data (title/meta/canonical/og/twitter), JSON-LD blocks; run lightweight validation on known schemas.
  - Return structured JSON above; log to `activity.log`.
- Reuse existing proxy infra where possible; allow raw fetch for HTML to avoid content-type forcing JSON.
- Handle gzip/deflate transparently; keep size cap (e.g., 1.5MB per page).

## Frontend changes (frontend/)

- Add a new navigation section "Sitemap scan" with:
  - Controls: max pages, optional sitemap URL override.
  - Summary card: pages scanned, average latency, invalid schema count, noindex count.
  - Table of pages with filters (flags, schema types, status).
  - Detail drawer per page showing SEO tags and schema parse/validation results.
- Extend `scan.js` or add `sitemapScan.js` service to call `/api/sitemap-scan`.
- Add cards to existing Performance/Exposure to show if sitemap crawl succeeded and how many pages were scanned.

## Validation approach (light)

- JSON-LD parse errors → `schema_invalid`.
- For common types, check presence of required keys:
  - `Organization`: `name`, `logo` (URL), `url`
  - `LocalBusiness`: `name`, `address`/`geo` or `areaServed`
  - `Article/BlogPosting`: `headline`, `datePublished`, `author`
  - `Product`: `name`, `offers`, `offers.price`
  - `FAQPage`: `mainEntity[].name` + `acceptedAnswer.text`
  - `HowTo`: `name`, `step`
  - `BreadcrumbList`: `itemListElement[]`
- Flag but do not block; mark `valid=false` with errors array.

## Phased delivery

1. ✅ Backend: sitemap discovery + page fetch + SEO/JSON-LD extraction; return raw results.
2. ✅ Frontend: sitemap scan UI + summary + pages table with flags and filters (schema_invalid/noindex).
3. Validation polish (next): richer schema checks, microdata/RDFa, posts/CPT support, dedupe by canonical, robots.txt allow/deny awareness, per-page error surfacing.

## Open questions

- Respect robots.txt? (default: fetch sitemap even if disallow; consider honoring for page fetch or warn when disallowed).
- Caching: store recent sitemap scans per domain in `server/data` to avoid re-fetching unchanged sites.
- Throttling: per-host delay/backoff to avoid hammering slow sites.
- Surface schema errors in UI: show invalid item types + messages per page and log details (partially logged server-side).
