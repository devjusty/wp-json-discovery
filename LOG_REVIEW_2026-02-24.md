# Recent Log Review - February 24, 2026

## Scope
Reviewed the 8 most recent activity logs in `server/data/`:
- `activity.log`
- `activity-2025-12-05T18-48-46-626Z.log`
- `activity-2025-12-05T17-41-21-886Z.log`
- `activity-2025-12-05T17-38-28-426Z.log`
- `activity-2025-12-05T17-38-07-047Z.log`
- `activity-2025-12-02T15-11-40-178Z.log`
- `activity-2025-12-01T16-49-43-008Z.log`
- `activity-2025-11-25T19-16-01-497Z.log`

Window covered by these files: `2025-11-14T20:48:53.309Z` to `2026-02-24T16:35:09.774Z`.

## High-Level Metrics
- Total JSON log entries parsed: `2760` (no malformed JSON lines).
- Most frequent event types:
  - `proxy.response`: `1682`
  - `unsupported_plugins.upserted`: `411`
  - `scan.started`: `150`
  - `scan.complete`: `96`
  - `scan.error`: `49`
  - `unhandled_error`: `20`
- Log rotations observed: `8`.
- Completed scans: `96`
  - Average duration: `4802ms`
  - P95 duration: `11871ms`
  - Long scans >=12s: `5` (worst observed: `27198ms`)

## Findings

### 1) Error payloads are too large and noisy
Evidence:
- `scan.error` and `unhandled_error` entries often include full HTML pages and frontend stack text in `payload.details.response` / `payload.message`.
- One recurring example includes full Cloudflare block pages and very large embedded HTML fragments in logs.

Impact:
- Log bloat and storage churn.
- Harder triage because signal is buried in page content.
- Potentially logs sensitive third-party markup/cookies/scripts unnecessarily.

### 2) Known backend import-path failure is recurring
Evidence:
- `unhandled_error` appears multiple times with:
  - `Cannot find module '/home/justin/code/wp-json-discovery/server/frontend/src/config/plugins.js' imported from /home/justin/code/wp-json-discovery/server/src/utils/pluginRegistry.js`

Impact:
- Admin endpoint reliability issue (`/api/admin/plugins`) with repeated hard failures.
- Creates repetitive noise and intermittent broken admin behavior.

### 3) Network/access failures are common and not strongly classified
Evidence:
- Frequent failures: `fetch failed`, timeouts, 4xx/5xx upstream responses, auth blocks.
- `scan.error` with `auth_required`/403 observed (10 instances in this review set).
- Top repeated scan-error domains include `timsimmonsdesign.com` (4) and `precisionmachinesc.com` (3).

Impact:
- User-facing scan outcomes mix reachable-but-protected vs unreachable vs invalid targets.
- Retry strategy and diagnostics are likely not differentiated enough.

### 4) Latency hotspots are concentrated in key endpoints
Evidence:
- `250` proxy calls >=1500ms.
- `wp-json` average ~`2071ms`, P95 ~`4249ms`.
- Long-running scans are mostly gated by slow `home` + `wp-json` + `sitemap/xmlrpc` chains.

Impact:
- Slower UX and increased timeout/error surface.
- Potential queue pressure under concurrent scans.

### 5) Large responses are frequent and repeat for same domains
Evidence:
- `86` proxy responses >=300KB in reviewed logs.
- Repeated large `/wp-json/` payloads from same domains (e.g., premierepc.com, maxoffsky.com).

Impact:
- Bandwidth and processing overhead.
- Duplicate heavy fetches for repeated scans without caching advantages.

### 6) Unsupported plugin discovery is healthy but high-volume
Evidence:
- `unsupported_plugins.upserted`: `411` entries.
- `unsupported.persist_attempt`: `69` entries, generally fulfilled.

Impact:
- Good discovery coverage, but high insert/upsert volume could become noisy without aggregation views and severity scoring.

## Recommended Improvements (Prioritized)

### P0 - Stabilize logging quality and reliability
1. Add structured error truncation/sanitization:
- Cap `payload.message` / `payload.details.response` to a fixed size (e.g., 2KB-8KB).
- Store `responseSnippet` + `responseHash` instead of full HTML.
- Strip script-heavy blocks and obvious sensitive tokens from persisted errors.

2. Fix plugin registry import resolution in server runtime:
- Remove brittle absolute coupling to `server/frontend/...` path.
- Resolve config path from workspace root or load through server-owned config mirror.
- Add startup self-check that fails fast with clear remediation when config path is invalid.

### P1 - Improve scan error taxonomy and operator visibility
3. Normalize scan failure classes:
- Separate `auth_required`, `blocked_waf`, `dns/network_failure`, `timeout`, `invalid_domain`, `non_wordpress`.
- Include a stable `failureCategory` field on both `scan.error` and `unhandled_error`.

4. Add domain-level suppression/backoff for repeated failures:
- For repeated failures of same category/domain in short windows, back off and emit summarized log lines (`suppressedCount`, `firstSeen`, `lastSeen`).

### P1 - Reduce latency and heavy fetch overhead
5. Add short-TTL caching for expensive probe endpoints:
- Cache `/wp-json/` and homepage asset scans by domain for N minutes.
- Reuse recently fetched payload metadata when scan inputs are unchanged.

6. Add per-endpoint timeout tuning and partial completion:
- Keep scan completion even when optional endpoints (e.g., `xmlrpc.php`) fail/timeout.
- Persist endpoint-level timeout outcomes explicitly without promoting to global scan failure unless critical.

### P2 - Improve observability ergonomics
7. Emit aggregate heartbeat metrics periodically (every M scans):
- Error rate by category, p50/p95 scan duration, top failing domains, top unsupported namespaces.
- This reduces need to manually parse raw JSON logs for trend analysis.

8. Add log retention guardrails:
- Auto-rotate by size and age with capped archive count.
- Optionally gzip rotated logs.

## Quick Wins for Next Iteration
1. Implement error response truncation + hash (small code change, immediate reduction in log noise).
2. Patch `pluginRegistry` path resolution and add regression test for `/api/admin/plugins`.
3. Add `failureCategory` to current error emitters and update frontend/admin table filters to use it.
4. Add 5-10 minute in-memory/domain cache for `/wp-json/` probe metadata.

## Suggested Validation After Changes
- Run 20+ mixed scans (reachable WP, Cloudflare-blocked, invalid domain, timeout-prone domain).
- Verify:
  - `scan.error` logs are concise and categorized.
  - `/api/admin/plugins` has zero import-path failures.
  - P95 scan time decreases vs current `~11.9s` baseline.
  - Rotated logs remain readable and significantly smaller.

## Recent Addendum (February 24, 2026)

### Confirmed Kadence signals on recent domains
- `ourfarmerhouse.com` (`scan.complete` at `2026-02-24T17:59:25.046Z`):
  - Unsupported namespaces include Kadence-family routes:
    - `kb-*` namespaces (Kadence Blocks integrations)
    - `kbp/v1`, `kbp-dynamic/v1`, `kbpp/v1` (Kadence Blocks Pro)
    - `ktp/v1` (Kadence Pro)
  - Homepage assets include:
    - `/wp-content/plugins/kadence-blocks`
    - `/wp-content/plugins/kadence-blocks-pro`
    - `/wp-content/themes/kadence`
- `sustainablykindliving.com` (`scan.complete` at `2026-02-24T18:00:52.497Z`):
  - Same Kadence namespace pattern (`kb-*`, `kbp*`, `ktp/v1`).
  - Homepage assets include:
    - `/wp-content/plugins/kadence-blocks`
    - `/wp-content/plugins/kadence-blocks-pro`
    - `/wp-content/plugins/kadence-pro`
    - `/wp-content/themes/kadence`

### Additional issues from these latest logs
1. Very large `/wp-json/` payloads remain common:
- `ourfarmerhouse.com`: ~`958KB`
- `sustainablykindliving.com`: ~`784KB`
- This is above many practical cache thresholds and can reduce cache-hit effectiveness unless metadata-only caching is used for very large bodies.

2. Slow endpoint outliers still present:
- `ourfarmerhouse.com` `/sitemap.xml`: `4400ms`
- Multiple core-content probes (`posts/pages/media/tags/categories`) in the `1.5s-1.9s` range.

3. Unknown asset slugs still observed (non-Kadence):
- `ourfarmerhouse.com`: `social-pug`, `pmd-ourfarmhouse` (custom theme)
- `sustainablykindliving.com`: `convertkit`, `gdpr-cookie-compliance`, `pmdsustainkind` (custom theme)

4. New sanitizer side-effect to monitor:
- Some `scan.complete` snapshots now show high `max_depth` truncation counts in `_logSanitizer`, which can still create noisy payload metadata on large route lists.

## Follow-up Notes
- Admin heartbeat UI enhancement: add sparkline/trend badges (for example, p95 latency delta and error-rate delta vs previous heartbeat window) to improve at-a-glance regression detection.

## Validation Addendum (February 25, 2026)

### Recent scan volume observed
- Last 6 hours in `activity.log`:
  - `scan.complete`: `17`
  - `homepage-scan`: `17`

### Heartbeat + cache checks
1. Heartbeat events:
- `metrics.heartbeat` in last 24h: `0`
- Despite >10 completed scans recently, no heartbeat rows were emitted in this run window.
- Root cause identified: heartbeat aggregation state was in-memory only, so process restarts could prevent hitting the 10-scan threshold in one runtime window.
- Fix implemented: heartbeat now bootstraps state from persisted DB rows (since latest heartbeat) on first log event after startup, then continues rolling in memory.
- Follow-up: restart server process explicitly and re-test with 10+ scans to confirm `metrics.heartbeat` appears again.

2. Cache hits:
- `proxy.cache_hit` in last 24h: `2`
- Domains observed:
  - `memorizetomatoes.s5-tastewp.com` (`2`)

### Unknown assets after latest scans
- `sustainablykindliving.com` unknown assets now reduced to:
  - `convertkit`
  - `gdpr-cookie-compliance`
  - (Kadence-related unknowns no longer present)
- `bookstoreblogger.com` unknown assets:
  - `gutenberg`
- Additional recurring unknowns from recent domains worth mapping:
  - `bridge`, `bridge-core`, `bridge-child`, `qi-addons-for-elementor`, `qi-blocks`
  - `oceanwp`, `sticky-header-effects-for-elementor`, `password-protected-categories`
  - `gravityformsrecaptcha`, `w3-total-cache`, `divi-child`

## Status Update (February 25, 2026 - Latest)

### Completed since last addendum
1. Heartbeat emission issue fixed:
- Root cause confirmed: heartbeat counters were process-memory-only and could miss threshold after restarts.
- Fix shipped: heartbeat now bootstraps from persisted DB rows since last `metrics.heartbeat`.
- Current logs now show heartbeat events again.

2. Unknown asset coverage significantly expanded:
- Added focused plugin/theme mappings for high-frequency unknown slugs (including Kadence-related, ConvertKit, GDPR cookie compliance, Bridge/Qi, OceanWP, Salient companion slugs, and several custom theme slugs).
- Local lookup verification confirms previously targeted top unknown slugs now resolve.

3. Cache behavior confirmed:
- `proxy.cache_hit` events are present in recent logs.

### Current observed metrics snapshot
- Last 24h (latest check):
  - `scan.started`: `37`
  - `scan.complete`: `30`
  - `metrics.heartbeat`: `1`
  - `proxy.cache_hit`: `2`
  - `scan.error`: `7`
- Latest heartbeat (`2026-02-25T01:07:16.325Z`):
  - `scansCompleted=50`
  - `scanDurationMs`: avg `4169`, p50 `3972`, p95 `6184`, max `11871`
  - `errors.total=56`
  - Largest error category remains `unknown`

### Remaining gaps
1. Error taxonomy quality:
- `unknown` still dominates heartbeat error categories; categorization rules need another pass.

2. Log payload ergonomics:
- `_logSanitizer.truncated` arrays can still be noisy for large snapshots.

3. Asset detection tail:
- Additional long-tail plugin/theme slugs will continue to appear and need iterative registry updates.

4. Architecture follow-up (deferred intentionally):
- Supported plugin registry is still file-backed (`frontend/src/config/plugins.js`), not DB-backed.

## Updated Next Steps
1. Run a targeted re-scan set on previously noisy domains and confirm unknown-asset reductions in the Admin “Homepage assets” view.
2. Refine failure categorization to reduce `unknown` share in heartbeat metrics.
3. Cap/summarize `_logSanitizer.truncated` entry lists to reduce payload clutter while preserving signal.
4. Add cache hit-rate summary to Admin heartbeat panel (or DB snapshot summary) for ongoing performance tracking.
5. Continue iterative plugin/theme mapping updates based on top unknown slugs from recent batches.

## Health Addendum (February 25, 2026 - Log + DB Check)

### Current storage state (legacy snapshot)
- `server/data/activity.log`: ~`9.1 MB`
- Legacy local DB file (`server/data/wpjd.sqlite`): ~`9.2 MB`
- Legacy WAL file (`server/data/wpjd.sqlite-wal`): ~`4.0 MB`

### Legacy SQLite status (historical)
- DB file: `server/data/wpjd.sqlite`
- `PRAGMA quick_check`: `ok`
- `PRAGMA journal_mode`: `wal`
- `PRAGMA page_count`: `2348`
- `PRAGMA page_size`: `4096`

### Tables confirmed in legacy SQLite snapshot
- `activity_logs`
- `unsupported_plugins`
- `unsupported_plugin_domains`

Note:
- There is no `plugin_assets` table in the historical local DB snapshot. Homepage asset aggregations are derived from logged scan payloads, not a dedicated persisted table.

### Row counts
- `activity_logs`: `1027`
- `unsupported_plugins`: `270`
- `unsupported_plugin_domains`: `331`

### Recent event mix (DB)
- `proxy.response`: `633`
- `unsupported_plugins.upserted`: `136`
- `scan.started`: `42`
- `scan.complete`: `36`
- `scan.error`: `7`
- `homepage.scan.started`: `42`
- `homepage.scan.complete`: `42`
- `homepage-scan`: `42`
- `metrics.heartbeat`: `1`
- `proxy.error`: `5`
- `unhandled_error`: `6`

### Latest error snapshot
Recent `scan.error` domains observed:
- `thinktek.com` (`404`, non-WP/Webflow HTML body)
- `speakforanimals.com` (`404`, non-WP/Squarespace HTML body)
- `prevention.com` (`404`, non-WP frontend response)
- `ghostbrands.com` (`404`, non-WP frontend response)
- `greenvilleits.com` (`504`, timeout)
- `adrianhoppel.com` (`403`, `auth_required`)
- `suppression-test.local` (`502`, network failure)

Interpretation:
- Current scan errors are mostly expected non-WordPress targets, auth-restricted sites, or network timeout cases, not DB corruption/systemic persistence failures.

### Unsupported namespace hotspots (latest)
Top domains by unsupported namespace volume:
- `y-stretch.com`: `25`
- `ourfarmerhouse.com`: `21`
- `sustainablykindliving.com`: `18`
- `daan.dev`: `14`
- `bookstoreblogger.com`: `7`

`ourfarmerhouse.com` / `sustainablykindliving.com` remain high-volume namespace contributors (Kadence-family and adjacent integrations), consistent with earlier findings.

### Largest payload pressure points
Top payload rows in `activity_logs` are still mostly `scan.complete` snapshots in the `~200 KB` to `~292 KB` range, with one oversized `scan.error` entry around `~265 KB` due embedded HTML.

Operational impact:
- Log growth is now driven more by large scan snapshots and occasional HTML-heavy error payloads than by event count alone.

## Recommended Guardrails (Actionable Thresholds)
1. Log file rotation:
- Rotate `activity.log` when size exceeds `10 MB` (or daily, whichever comes first).
- Keep max `10` rotated archives and gzip archives older than `24h`.

2. Turso maintenance cadence:
- Trigger regular maintenance marker checks every `24h` during heavy write periods.
- Keep integrity-check maintenance action as the manual fallback.

3. Oversized payload controls:
- Soft cap persisted `payload_json` at `256 KB` per row for routine events.
- For oversize events, persist:
  - structured summary fields,
  - `payload_truncated=true`,
  - optional hash/snippet for forensic correlation.

4. Error payload hygiene:
- For `scan.error`/`proxy.error`, cap raw HTML/body captures to `2-8 KB` preview.
- Preserve status code, category, and first useful fragment only (avoid full page markup dumps).

5. Heartbeat reliability check:
- Alert if no `metrics.heartbeat` row appears after each additional `10` `scan.complete` events.

## Suggested immediate follow-up
1. Add a small Admin “Data health” card with:
- `activity.log` size,
- Turso endpoint + DB marker state,
- latest heartbeat timestamp.
2. Add an automated prune/rotate policy to reduce manual maintenance frequency.

## Implementation update (March 2026)

### Completed from this review
1. Log-volume controls shipped:
- `proxy.response` logs are now gated/sampled (errors, slow calls, redirects, plus deterministic sampling) instead of logging every response.
- `scan.complete` payloads are compacted before writing to `activity_logs` to reduce large-row pressure.

2. Retention/prune improvements shipped:
- Activity prune defaults reduced to `keepLatest=500` and `olderThanDays=21`.
- Log rotation now performs archive cleanup with configurable retention/env controls.

3. Admin observability expanded:
- Data health section now includes Turso diagnostics (health/stats/usage/instances) with graceful fallback when API token is not configured.

4. Scanner/admin workflow updates relevant to this review:
- Domains tracked now lists all scan attempts from scan history (not just unsupported-plugin domain links).
- Asset-only unknown plugin signals can now jump directly into Plugin Manager create/edit flow.

### Remaining high-value follow-ups
1. Add Homepage security-header analysis panel (CSP, HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy).
2. Continue reducing `unknown` error category share in heartbeat taxonomy.
3. Consider optional per-type retention policy (for example, shorter retention for `proxy.response` than for `scan.error` / `metrics.heartbeat`).
