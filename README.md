# WP JSON Discovery

WP JSON Discovery is a Vite-powered React application backed by a lightweight Express API that scans WordPress sites for publicly exposed REST data. The tool makes it easy to inspect core content, enumerate plugin namespaces, highlight unsupported integrations, and export results for further analysis.

---

## Features

- **Domain scanning** – Probe `/wp-json/` plus plugin namespaces, capturing route metadata, response timings, and schema hints.
- **Core content explorer** – Tabular views for posts, pages, categories, tags, and media with sortable columns, pagination, and CSV export.
- **Plugin intelligence** – Supports dozens of high-impact plugins (WooCommerce, Jetpack, Elementor, Rank Math, WPForms, Ninja Forms, WP Recipe Maker, etc.) and reports namespace coverage gaps.
- **Unsupported tracking** – Persists unknown namespaces to a shared list so teams can prioritise handler development.
- **Research workflows** – Context7 queries are bundled into the docs so unsupported namespaces can be researched without leaving the terminal.
- **Robust logging** – JSONL activity log records proxy performance, scan duration, persistence actions, and error diagnostics.
- **Atomic design system** – UI is composed using Brad Frost’s atoms → molecules → organisms → templates → pages to encourage reuse and scalability.

---

## Architecture Overview

```text
root/
├── server/               # Express proxy + persistence
│   ├── src/index.js      # REST proxy, unsupported plugin API, logging
│   ├── src/logger.js     # JSONL logger utility
│   └── data/             # Persisted unsupported plugin list + logs
└── frontend/             # Vite + React client
    ├── src/
    │   ├── api/          # Client wrappers for proxy + persistence endpoints
    │   ├── components/   # Atomic design layers (atoms, molecules, organisms, templates, pages)
    │   ├── config/       # Core collections + plugin namespace registry
    │   ├── services/     # Scan orchestration, logging, formatting helpers
    │   └── utils/        # CSV export, formatting helpers
    └── public/           # Static assets
```

**Data flow**

1. User submits a domain from the frontend.
2. Client calls the Express proxy (`/api/proxy`) which fetches `https://domain/wp-json/...` with timeouts and logging.
3. Scan service enumerates namespaces, triggers core collection fetches, and collects plugin route metadata.
4. Newly detected namespaces without handlers are POSTed to `/api/unsupported-plugins` and persisted.
5. Results render into tables, summaries, and plugin panels; CSV exports leverage `papaparse`.

---

## Unsupported Namespace Workflow

The project now ships with the full WooCommerce, Rank Math, Divi, Health Check, LiteSpeed, MEC, and Yabe namespaces mapped under `frontend/src/config/plugins.js`, so `server/data/unsupported-plugins.json` should remain empty after a successful crawl. Use the following loop when new namespaces surface:

1. **Run a scan** via the UI or `POST /api/scan` to reproduce the unsupported namespace.
2. **Inspect persisted state**:
   - `server/data/unsupported-plugins.json` – list of unresolved namespaces (JSON array).
   - `server/data/activity.log` – JSONL log with `namespaceDetected`, `unsupportedPersisted`, and error entries.
3. **Research the plugin** using Context7:
   - `pnpm context7 -- "/wordpress/plugins/<namespace>"` (replace with the namespace slug) to retrieve docs, repo links, and usage details.
   - Summarise findings in the PR description so future contributors understand the plugin surface area.
4. **Add support** by extending `frontend/src/config/plugins.js` and any related UI/service logic.
5. **Verify regression** by re-running the scan; confirm the array stays empty and no new log entries are emitted.

Document edge cases (auth-only routes, HTML responses, rate limits) in PR notes so the unsupported list stays actionable for the team.

---

## Project Status (2025-10-21)

- **Scanning pipeline**: Stable for anonymous sites; error handling added for 401/403 (auth required) and non-JSON responses.
- **Core datasets**: Posts, pages, categories, tags, media (latest subsets for performance).
- **Plugin coverage**: 25+ plugins supported (WooCommerce, Jetpack, Contact Form 7, Ninja Forms, WP Recipe Maker, Wordfence, CleanTalk, WP Engine MU suite, Elementor, WPForms, Rank Math, SEOPress, LearnDash, MemberPress, etc.).
- **Unsupported namespaces**: Actively tracked; recent scans surfaced Rank Math sub-routes, LiteSpeed cache, Divi, Modern Events Calendar, and WooCommerce telemetry routes for future support.
- **Logging**: Structured `activity.log` capturing scan lifecycle, proxy timings, persistence, and errors. Auto-repair for malformed JSON store implemented.
- **UI**: Atomic design refactor completed; major components reorganised by layer for maintainability.

---

## Getting Started

```bash
# Install dependencies for all workspaces
pnpm install

# Start development servers (proxy + Vite) in parallel
pnpm dev

# Target a single service
pnpm dev:server
pnpm dev:frontend

# Production smoke checks
pnpm --filter frontend run preview
```

**Environment variables**

- Copy `server/.env.example` to `server/.env` to override the Express server port (`PORT`) or add extra tuning flags.
- Copy `frontend/.env.example` to `frontend/.env` to point the UI at a non-default proxy (`VITE_API_BASE_URL`).
- Without overrides the proxy listens on `4100` and the frontend targets `http://localhost:4100`.

**Logs & persistence**

- `server/data/activity.log` – JSONL event log (rotate when >1 MB).
- `server/data/unsupported-plugins.json` – Persisted unsupported namespaces (should be `[]` after a clean scan).
- `frontend/src/config/plugins.js` – Source of truth for supported namespaces.

Whenever you add new namespaces, run `pnpm --filter frontend run lint` and `pnpm --filter frontend run build` before committing.

---

## Testing & QA

Current validation:

- `pnpm --filter frontend run lint` – ESLint React rules (passes as of 2025-10-21).
- `pnpm --filter frontend run build` – production bundle verification.
- Manual scans against anonymous, auth-gated, and plugin-heavy WordPress domains, with log review.

Planned coverage:

1. **API contract tests** using MSW/nock fixtures to assert namespace enumeration and unsupported persistence.
2. **Service orchestration tests** around `frontend/src/services/scan.js` (multiple namespace matches, empty unsupported list).
3. **Component interaction tests** with `@testing-library/react` for the results table and plugin panels.
4. **End-to-end regression tests** (Playwright) to validate domain submission, tab navigation, and CSV export.
5. **Performance checks** capturing proxy latency and render times for large payloads.

When adding tests, co-locate them under `frontend/src/__tests__/` or alongside the feature directory (e.g., `components/organisms/ResultsTable/ResultsTable.test.js`).

## Operations & Troubleshooting

- **Verify services** – `curl http://localhost:4100/api/health` confirms the Express proxy, while Vite serves the UI on `5173`.
- **Reset persisted data** – Remove `activity.log` entries cautiously; never delete the file without confirming no scans are running.
- **Common issues**
  - `ECONNRESET` / `ETIMEDOUT`: Increase proxy timeout in `server/src/index.js`.
  - HTML responses from `/wp-json/`: The scan service downgrades the namespace and logs a warning; check `activity.log` for the rendered HTML snippet ID.
  - Non-empty unsupported list after a run: Re-check the plugin registry and run a Context7 lookup to confirm the namespace belongs to a known plugin.
- **Context7 tips**
  - `pnpm context7 -- "/wordpress/plugins/<namespace>"` – Docs lookup.
  - `pnpm context7 -- "site:<vendor>.com <namespace> REST API"` – Narrow results to vendor docs.
  - Cache results in PR descriptions for future contributors.

---

## Roadmap & Ideas

- **Plugin deep dives** – Build specialised handlers for Rank Math, LiteSpeed Cache, Divi, Modern Events Calendar, WP Engine Telemetry, WooCommerce Analytics to replace unsupported namespace alerts.
- **Credentialed scanning** – Support application passwords / OAuth for sites that restrict anonymous REST access.
- **Batch scanning + scheduling** – Allow multiple domains to be queued and scanned concurrently with aggregated reporting.
- **Insights & scoring** – Highlight security or content exposure risks (e.g., user endpoints enabled, debug routes).
- **UI enhancements** – Add filters, saved scans, and richer plugin dashboards (route grouping, schema diffs).
- **Data export** – Extend beyond CSV (JSON, PDF summaries) and optional S3 upload.
- **DevOps** – Dockerise services, add CI workflows for lint/test/build, and configure log rotation.

---

## Contributing

1. Create a feature branch.
2. Run `pnpm lint` (future addition) and `pnpm --filter frontend run build` before committing.
3. Submit a PR with context, screenshots, and testing notes.

---

## License

MIT © 2025 Justin Thompson
