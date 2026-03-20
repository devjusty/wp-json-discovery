# Scan Capabilities

This file summarizes what is currently shipped and what still needs work.

## Core scanner

- REST discovery via `/wp-json/` (namespaces/routes/core metadata).
- Content footprint counts from core collections (`posts`, `pages`, `categories`, `tags`, `media`) using lightweight requests.
- Exposure probes for common risks (`users`, `settings`, `xmlrpc.php`, uploads indexability, sitemap, robots).
- Endpoint performance snapshot for home, `/wp-json/`, `xmlrpc.php`, `sitemap.xml`, and `robots.txt`.

## Homepage source scan

- HTML fetch with redirect handling and size/time limits.
- Extracted signals from meta tags, comments, scripts, and asset paths.
- Framework hint detection from markup and asset patterns.
- Homepage asset paths are logged and aggregated for admin triage.
- Unknown asset signals can be promoted to plugin/theme registry entries from Admin.

## Sitemap scan

- Sitemap discovery and parsing (index + URL sitemaps).
- Page-level fetch and extraction of SEO basics (title/description/robots/canonical/OG/Twitter).
- JSON-LD detection and basic schema validation flags.
- Summary/table UI for scanned pages and flags.

## Admin capabilities

- Turso-backed DB snapshot and operational panels.
- Supported plugin/theme managers (CRUD + sorting).
- Unsupported namespace tracking and asset-only signal tracking.
- Domains tracked based on scan history (successful and failed attempts).
- Heartbeat metrics and activity log inspection.

## Logging and retention

- `proxy.response` logs are sampled/gated to reduce noise.
- `scan.complete` payloads are compacted before persistence.
- Activity prune defaults are tightened (`keepLatest=500`, `olderThanDays=21`).
- Log rotation includes archive cleanup controls.

## Known gaps

- Homepage security-header analysis panel (CSP/HSTS/XFO/XCTO/etc.).
- Further error taxonomy refinement (reduce `unknown` category share).
- Per-event-class retention policies.
- Asset export workflow (CSV/JSON) for bulk registry updates.
