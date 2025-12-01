# WP JSON Discovery – Public Data & Feature Ideas

Brief notes on what we can reliably surface from public WordPress endpoints and which features would make the scanner more useful.

## High-value public data to pull (in place or next)

- REST index (`/wp-json`): site name, description, timezone, namespaces, routes; generator header for WP version hints. ✅ Implemented.
- Plugin/theme signals: `/wp-json/wp/v2/plugins` or `/wp-json/wp/v2/themes` when exposed; infer from namespaces (e.g., `jetpack/v4`, `wc/v3`, `yoast/v1`, `rankmath/v1`, `contact-form-7/v1`). ✅ Namespace inference in place; plugin list expands over time.
- Content footprint: use `X-WP-Total` from `/wp-json/wp/v2/{posts,pages,categories,tags,media,users}?per_page=1&_fields=id` to estimate counts; media MIME distribution via `/media`. ✅ Counts + media breakdown implemented.
- Exposure checks: user enumeration (`/users`), settings leakage (`/wp/v2/settings`), REST availability/lockdown, XML-RPC status, directory listing probe on `/wp-content/uploads/` (todo). ✅ Most checks implemented; uploads probe pending.
- Commerce: WooCommerce routes (`/wc/v3`), currency/tax display and product counts if catalog is public. 🚧 Infer from namespaces today; product/currency extraction still pending.
- SEO & crawl seeds: `sitemap.xml`, `robots.txt`, `humans.txt`, Yoast/Rank Math endpoints for sitemap hints or analyzer data. ✅ Robots + sitemap probes with redirect awareness and external links; humans + plugin-specific analyzers pending.
- Infra & performance: TTFB + status for root, `/wp-json`, `/xmlrpc.php`, `/sitemap.xml`, `/robots.txt`; headers for CDN/host/cache (`cf-ray`, `x-cache`, `x-litespeed-cache`), compression, HSTS. ✅ Basic snapshot with cache/server headers; add compression/HSTS check next.

## Feature ideas

- Plugin/theme detection panel: map namespaces to known plugins (`frontend/src/config/plugins.js`); flag unknown namespaces and persist to `server/data/unsupported-plugins.json`. ✅ Panel + persistence live; continue expanding mapping.
- Exposure/risk flags: REST open/closed, user enumeration open, settings endpoint exposed, XML-RPC enabled, directory indexing likely. ✅ Flags live; add uploads index probe + better messaging.
- Version/health hints: show WP version if leaked; maintain a small “likely outdated/vulnerable” map for popular plugins and highlight mismatches. 🚧 Not started.
- Content overview: counts for posts/pages/media/taxonomies; media MIME breakdown to spot asset-heavy sites. ✅ Live.
- Performance snapshot: per-endpoint latency/status, redirect badge, cache/CDN header summary, external links to sitemap/robots. ✅ Live; could add gzip/Brotli/HSTS flags.
- Crawl aids: surface discovered sitemaps, main robots rules, and handy links to common admin/login endpoints. ✅ Sitemap/robots links in performance; admin/login quick links still pending.
- Reporting & history: export JSON/HTML summaries, copy-to-clipboard notes, recent scans list with timestamps in `server/data/activity.log`. 🚧 CSV export exists; JSON/HTML + scan history pending.
- Batch/scheduled scans: queue multiple domains with throttling; store histories for comparison. 🚧 Not started.

## Implementation hooks

- `frontend/src/services/scan.js` now pulls core counts, exposure probes, performance with redirect awareness, and media breakdown. Extend with uploads probe, gzip/HSTS checks, commerce details.
- Expand plugin namespace mapping in `frontend/src/config/plugins.js`; log unknown namespaces to the unsupported list via the server API. Ongoing task.
- UI now has sidebar navigation with dedicated pages for Overview, Exposure, Performance, Content, Core data, Plugins, and Unsupported. Add quick links (admin/login), version/vuln hints, and batch scan UI later.
- Keep scan logs actionable via `server/data/activity.log`; add optional history view and export pipeline (JSON/HTML) in a future iteration.
