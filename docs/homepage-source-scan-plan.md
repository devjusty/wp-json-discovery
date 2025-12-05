# Homepage Source Scan Plan

## Objective

- Add an optional scan that fetches the homepage HTML and infers extra site details from visible tags, comments, inline scripts, and asset paths.
- Keep it lightweight, cache-friendly, and safe (no DOM execution, no XSS risk) while enriching plugin/theme detection and exposure insights.

## Scope

- Single GET to `/` (respecting existing domain normalization and redirects) with a short timeout and HTML-only handling. ✅ Implemented with redirect tracking and timeout.
- Parse static text only; do not execute scripts or follow links/assets.
- Store findings alongside existing scan payloads for UI display and logging. ✅ Results stored and logged.

## Signals to capture

- **Meta tags:** `generator`, `powered-by`, `application-name`, `theme-color`, Open Graph `og:site_name`, `og:locale`, Twitter `twitter:site`, `twitter:creator`. ✅
- **Comments:** theme markers (e.g., `<!-- This site is optimized with the Yoast SEO plugin -->`), builder hints (Elementor/Divi/Bricks), host fingerprints (WP Engine, SiteGround, Flywheel). ✅
- **Inline scripts/data:** global variables naming (e.g., `elementorFrontendConfig`, `wpeData`, `wpmlBrowserRedirectLanguage`), JSON-ld contexts, known plugin config objects. ✅ Basic substring scan; could expand heuristics.
- **Asset paths:** theme directory names, common plugin asset roots (`/wp-content/plugins/{plugin}/`, `/wp-content/themes/{theme}/`), CDNs (Jetpack, Elementor assets, Cloudflare Pages). ✅ Full list now logged per scan (no longer truncated).
- **Other hints:** presence of `xmlrpc.php` links, REST API discovery headers/scripts, hreflang tags, canonical URLs. ✅ Framework hints captured.

## Data model (server → client)

- `homepageSource`: `{ fetched: boolean, statusCode, finalUrl, contentType, sizeBytes, durationMs, error, truncated, redirects }`. ✅
- `homepageInsights`: arrays of `{ type, value, source }`, grouped by `meta`, `comment`, `script`, `asset`, `other`. ✅
- `assetPaths`: normalized list of detected `/wp-content/plugins/*` and `/wp-content/themes/*` paths with counts. ✅ Aggregated into Admin + CLI report.
- `frameworks`: array of detected framework names (Next.js, Gatsby, Vite, etc.). ✅

## Server implementation sketch

- Extend `server/src/index.js` scan pipeline:
  - New helper `fetchHomepageHtml(domain)` using existing `proxyRequest` with accept `text/html`. ✅
  - Enforce max size (1 MB) and short timeout to avoid slow pages. ✅
  - Record redirects, status, headers, and raw HTML string (trimmed to limit) for parsing. ✅
- Parsing strategy (no DOM):
  - Use fast string/regex extraction for meta tags and comments. ✅
  - Parse `<meta>` attributes with a small HTML parser or manual regex targeting `name`, `property`, `content`. ✅
  - Extract comment blocks `<!-- -->`, collect unique hints. ✅
  - Scan for `wp-content/plugins/` and `wp-content/themes/` path segments; count occurrences. ✅
  - Scan inline `<script>` blocks for known config variable names (simple substring search). ✅
- Integrate results into existing scan response under `homepageSource` and `homepageInsights`. ✅
- Log to `server/data/activity.log` with a new event type `homepage-scan` for troubleshooting. ✅ Full assets + unknown assets logged.

## Frontend integration

- Update scan service to request/display `homepageSource` and `homepageInsights`. ✅
- UI: separate opt-in tab with shared domain state so switching tabs preserves inputs/results; CTA from REST scan to launch homepage scan. ✅
- Panels:
  - Status/latency, final URL, content type, size, redirect count. ✅
  - Badges for detected meta generators, builder hints, plugin/theme asset paths. ✅
  - Lists for comments, script hints, other signals, and a JSON preview for debugging. ✅ (JSON preview present)
  - Admin tab aggregates all homepage asset paths, flags unknown matches, and surfaces them for registry updates. ✅
  - 🚧 Add summary in Overview (done) and detail drawer improvements (pending).
- Enable CSV export of asset paths or insights if useful. 🚧 Not built.

## Performance & safety

- Do not fetch sub-resources; single request only. ✅
- Cap HTML read size (set to 1 MB; truncate and mark as truncated. Adjust after measuring real-world cases). ✅
- Respect existing error handling; do not fail the overall scan if homepage parsing fails (mark as warning). ✅ Returns status/error payload; logged with `homepage-scan.error`.
- Ensure no dynamic evaluation of scripts; treat content as plain text. ✅
- 🚧 Add explicit frontend error/empty states to avoid stuck spinners if the request fails.

## Decisions (answered)

- **Opt-in location:** Add as an opt-in feature under a new dashboard page; only run when explicitly requested. ✅
- **HTML size cap:** Start at 500 KB. If signals are insufficient, we can lift to ~1 MB after measuring impact. ✅ Currently 1 MB.
- **Storage approach:** Keep both paths noted:
  - Derived insights only: minimal storage/privacy risk; requires re-scan to revisit evidence.
  - Truncated HTML snapshot (<= cap): aids debugging and future parsers; treat as sensitive data and consider redaction before persisting. ✅ Preview stored; consider opt-out/redaction later.
- **Framework detection:** Yes—add detection for frameworks (Next.js, Gatsby, Vite, Squarespace, Shopify, etc.) via meta names, script IDs, and asset path patterns. ✅ Basic detection present.
- **Comment signals:** Log unusual/unknown comment markers so we can improve parsing rules over time. ✅ Logged via `homepage-scan`.
- **Logging:** Emit `homepage-scan` entries with status, size, cap bytes, truncated flag, counts (meta/comments/scripts/assets), frameworks, preview length, and full asset lists for diagnostics. ✅
- **Integration:** Auto-run homepage scan after a REST scan completes for the same domain; shared domain state keeps forms/results in sync across tabs. ✅
- **Controls:** Toggle in the REST scan form to enable/disable automatic homepage scans after REST runs. ✅
- 🚧 Missing: better frontend failure handling (clear pending state) and optional CSV/JSON export of signals; consider a bulk asset export from Admin.
