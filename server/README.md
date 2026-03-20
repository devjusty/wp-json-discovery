# Server Overview

The server workspace exposes a lightweight Express API that proxies WordPress REST requests, persists unsupported plugin namespaces, and forwards structured logs to disk.

## Scripts

```bash
pnpm install                 # Install dependencies for the server workspace
pnpm dev:server              # Start the API on http://localhost:4100
pnpm --filter server run lint   # (Future) hook for linting once introduced
pnpm --filter server run db:inspect  # Print Turso table counts and last log entry
pnpm --filter server run db:assets   # Summarize homepage asset paths and unknown matches
pnpm --filter server run db:import:logs  # Import activity.log JSONL into Turso activity_logs
```

The workspace is booted automatically when you run `pnpm dev` from the repository root.

## Environment Variables

Copy `.env.example` to `.env` in this directory to customize defaults:

- `PORT` – Express listen port (defaults to `4100` if unset).
- (Optional) `LOG_LEVEL` – Reserved for future logger controls.
- `TURSO_DATABASE_URL` – Turso database URL (for example `libsql://<db>-<org>.turso.io`).
- `TURSO_AUTH_TOKEN` – Turso auth token for the database.
- (Optional) `TURSO_API_TOKEN` – Turso API token for control-plane stats (`/stats`, `/usage`, `/instances`) shown in Admin Data health.
- (Optional) `TURSO_ORGANIZATION` – Explicit Turso org slug override for API metric calls.
- (Optional) `TURSO_DATABASE_NAME` – Explicit Turso database name override for API metric calls.
- (Optional) `ADMIN_ENABLED` – Set to `false` to disable `/api/admin/*` endpoints when exposing the server beyond local dev.
- (Optional) `ACTIVITY_LOG_ARCHIVE_RETENTION_DAYS` / `ACTIVITY_LOG_ARCHIVE_MAX_FILES` – Archive cleanup policy applied whenever logs are rotated.

Values from `.env` override the bundled defaults; restart the server after changes.

## Endpoints

| Method | Path                          | Purpose |
| ------ | ----------------------------- | ------- |
| GET    | `/health`                     | Simple status check used by CI/dev scripts. |
| GET    | `/api/proxy`                  | Fetches `https://<domain>/<endpoint>` with a 15 s timeout and streams the response back to the client. |
| GET    | `/api/unsupported-plugins`    | Returns unsupported namespace records persisted in Turso. |
| POST   | `/api/unsupported-plugins`    | Upserts a namespace/domain pair and stamps `lastDetectedAt`. |
| POST   | `/api/logs`                   | Accepts structured log events coming from the frontend scan workflow. |
| GET    | `/api/registry/plugins`       | Public plugin registry payload (`plugins`, `coreNamespaces`) used by scanner matching. |
| POST   | `/api/logs/rotate`            | Rotates the activity log file, clears Turso `activity_logs`, and prunes old archive files. |
| GET    | `/api/scan-history`           | Returns previously scanned domains (failed scans hidden by default unless `includeFailed=true`). |
| GET    | `/api/scan-history/:domain`   | Returns recent scan runs for a domain (failed runs hidden by default unless `includeFailed=true`). |
| POST   | `/api/sitemap-scan`           | Fetches and parses sitemap XML, then fetches page HTML for SEO/schema signals. |
| POST   | `/api/homepage-scan`          | Single GET to `/` with size cap; extracts meta, comments, frameworks, and asset paths. |
| GET    | `/api/admin/db-snapshot`      | Returns Turso snapshot (counts, unsupported plugins, homepage asset aggregates, recent logs). |
| POST   | `/api/admin/db/maintenance`   | Runs integrity checks and records maintenance markers. |
| POST   | `/api/admin/activity/prune`   | Prunes `activity_logs` by age/count. |
| GET    | `/api/admin/plugins`          | Returns known plugin registry entries from Turso. |
| POST   | `/api/admin/plugins`          | Creates a plugin registry entry. |
| PUT    | `/api/admin/plugins/:id`      | Updates a plugin registry entry. |
| DELETE | `/api/admin/plugins/:id`      | Deletes a plugin registry entry. |
| POST   | `/api/admin/plugins/sort`     | Sorts plugin entries by label and rewrites registry ordering. |
| GET    | `/api/admin/themes`           | Returns known theme registry entries from Turso. |
| POST   | `/api/admin/themes`           | Creates a theme registry entry. |
| PUT    | `/api/admin/themes/:id`       | Updates a theme registry entry. |
| DELETE | `/api/admin/themes/:id`       | Deletes a theme registry entry. |
| POST   | `/api/admin/themes/sort`      | Sorts theme entries by label and rewrites registry ordering. |

The proxy attaches a custom user agent (`wp-json-discovery/0.0.1`) to aid vendor rate-limit debugging.

## Persistence & Logging

- Turso (libSQL) holds `unsupported_plugins`, `unsupported_plugin_domains`, `activity_logs`, scan-history tables (`scan_domains`, `scan_runs`), and known registries (`plugin_registry`, `theme_registry`).
- `server/data/unsupported-plugins.json` – Legacy file store; automatically imported into Turso on first boot when the table is empty.
- `server/data/activity.log` – JSONL log containing `proxy.response`, `unsupported_plugins.upserted`, `homepage-scan` (with full asset lists), and custom events from the frontend. `/api/logs/rotate` archives this file and clears the DB table to keep storage small.

All file writes are protected by a simple promise queue to prevent concurrent corruption. If you encounter malformed JSON, rebuild the file from a recent commit and re-run the failing scan.

## Unsupported Namespace Loop

1. Trigger a scan (UI `Scan Domain` button or `POST /api/scan` through the frontend service).
2. When a namespace is persisted, review the latest log entries (`tail -f server/data/activity.log`).
3. Research the namespace with Context7:
   - `pnpm context7 -- "/wordpress/plugins/<namespace>"` for plugin-level docs.
   - Record key findings (features, auth requirements, REST endpoints) in the PR notes.
4. Extend the frontend registry at `frontend/src/config/plugins.js` and re-run the scan.
5. Confirm the unsupported list is cleared and the log no longer shows `unsupported_plugins.upserted`.

## Operational Tips

- Increase the `REQUEST_TIMEOUT_MS` constant in `src/index.js` for exceptionally slow targets.
- Keep `activity.log` under 1 MB by rotating or archiving older entries.
- Use `PORT` to run the proxy on a non-default port when needed; the frontend picks up `VITE_API_BASE_URL`.
- To debug proxy failures, run with `DEBUG=fetch` or insert temporary `console.log` statements wrapped in descriptive log types.

## Future Enhancements

- Add request caching for duplicate namespace fetches across scans.
- Introduce MSW/nock-based integration tests around `upsertUnsupportedPluginRecord`.
- Emit structured metrics (p95 proxy latency, per-namespace hit counts) to aid prioritization.
