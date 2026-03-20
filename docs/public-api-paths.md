# Public WordPress API Paths & Integration Notes

This doc captures the core WordPress REST endpoints and common plugin routes that are typically reachable without authentication, plus how we can surface them in WP JSON Discovery.

## Core WP REST endpoints (unauthenticated)

- `GET /wp-json/` — REST index (namespaces, routes, discovery links). Already fetched in the main scan.
- `GET /wp-json/wp/v2/posts?per_page=1&_fields=id,title,link` — Posts listing/count via `x-wp-total`. Implemented in core datasets.
- `GET /wp-json/wp/v2/pages?per_page=1&_fields=id,title,link` — Pages listing/count. Implemented.
- `GET /wp-json/wp/v2/categories?per_page=1&_fields=id,name,slug` — Categories. Implemented.
- `GET /wp-json/wp/v2/tags?per_page=1&_fields=id,name,slug` — Tags. Implemented.
- `GET /wp-json/wp/v2/media?per_page=5&_fields=id,media_type,mime_type,source_url` — Media; use `x-wp-total` for counts. Implemented + media breakdown.
- `GET /wp-json/wp/v2/users?per_page=1&_fields=id,slug,name` — User enumeration probe. Implemented in exposure.
- `GET /wp-json/wp/v2/settings` — Settings exposure probe. Implemented in exposure.
- `GET /xmlrpc.php` — XML-RPC probe (status only). Implemented in exposure/performance.
- `GET /sitemap.xml` — Sitemap probe (status + redirects). Implemented in exposure/performance and sitemap scan tab.
- `GET /robots.txt` — Robots probe. Implemented in exposure/performance.
- `GET /wp-content/uploads/` — Indexability probe for directory listing. Implemented in exposure.
- `GET /` (homepage) — Opt-in HTML fetch for generators/builders/asset paths; results logged and aggregated for plugin/theme mapping.

## Common plugin APIs (public surfaces)

These are routed via `/wp-json/{namespace}/…` and should be treated as best-effort; many sites lock them down.

- WooCommerce: `/wp-json/wc/v3/products`, `/wc/store/v1/products`, `/wc-analytics` (telemetry), `/wc-admin` (internal). We currently detect namespaces; product/currency extraction is pending.
- Jetpack: `/wp-json/jetpack/v4/site`, `/jetpack/v4/stats-app`, `/wpcom/v2|v3` (site info). Detected via namespaces today.
- Yoast: `/wp-json/yoast/v1` (analyzer/sitemap hints). Namespace detection only.
- Rank Math: `/wp-json/rankmath/v1` (SEO analysis). Detected.
- Elementor: `/wp-json/elementor/v1/globals` (some public). Detected via namespace; data fetch not implemented.
- WPForms/Ninja Forms/CF7: form listings/submission endpoints vary; we only surface namespaces and avoid posting data.
- AIOSEO/SEOPress: `/aioseo/v1`, `/seopress/v1` for analyzer/redirects; detection only.
- MemberPress/LearnDash/LMS plugins: often expose course/lesson listings; treated as detection only to avoid large pulls.

See `frontend/src/config/plugins.js` for the authoritative namespace list. When adding new plugin routes:

- Prefer `per_page=1&_fields=...` to avoid heavy pulls.
- Avoid POSTing to plugin endpoints; stick to safe GETs.
- Gate large collections behind explicit UI actions (not automatic on scan).

## How to implement/surface in the project

- Discovery: continue using `/wp-json/` to enumerate namespaces. Unknown namespaces are persisted (Turso/libSQL) via `/api/unsupported-plugins`. Homepage asset paths are also logged and aggregated to speed up plugin/theme registry updates.
- Light data pulls: core collections already fetch with `per_page=1` to derive counts; reuse this pattern for plugin endpoints we decide to sample.
- Probes vs. fetches: keep “probe-only” endpoints (sitemap, robots, uploads, settings, users) as status/metadata checks, not full crawls.
- Plugin enrichment (future):
  - Add optional fetchers per plugin under `frontend/src/services/scan.js` or a new `pluginEnrichers/` module, called only when a namespace is detected.
  - Normalize responses to small summaries (counts, key settings), and cap rows.
  - Log enrichment attempts in `activity_logs` with timing/status for debugging.
- UI: extend plugin panels to show any fetched plugin metadata; add guardrails and clear labels when data is sampled vs. inferred.
- Performance/safety:
  - Respect existing request timeout and size caps.
  - Keep concurrency low for plugin fetches; prefer sequential small GETs.
  - Treat 401/403/429 as “protected/limited” and surface as such, not errors.

## Quick next steps

- Decide 2–3 high-value plugin GETs to sample safely (e.g., WooCommerce products?per_page=1&\_fields=id,name,price; Jetpack site info), behind a user-triggered “plugin details” toggle.
- Add a small registry to mark plugin namespaces as “probe-only” vs. “fetch-small” with the exact endpoint and fields.
- Surface any fetched plugin data in the plugin tab cards with status codes and durations for transparency. Use homepage asset aggregates (Admin → Homepage assets or `pnpm --filter wp-json-discovery-server db:assets`) to prioritize registry updates.
