# WP JSON Discovery

WP JSON Discovery is a Vite-powered React application backed by a lightweight Express API that scans WordPress sites for publicly exposed REST data. The tool makes it easy to inspect core content, enumerate plugin namespaces, highlight unsupported integrations, and export results for further analysis.

---

## Features

- **Domain scanning** – Probe `/wp-json/` plus popular plugin namespaces, capturing route metadata, response timings, and schema hints.
- **Core content explorer** – Tabular views for posts, pages, categories, tags, and media with sortable columns, pagination, and CSV export.
- **Plugin awareness** – Supports dozens of high-impact plugins (WooCommerce, Jetpack, Elementor, Rank Math, WPForms, Ninja Forms, WP Recipe Maker, etc.) and reports namespace coverage gaps.
- **Unsupported tracking** – Persists unknown namespaces to a shared list so teams can prioritise handler development.
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
```

Environment variables:

- `PORT` (default `4100`) – Express server port
- `VITE_API_BASE_URL` – Override frontend API base URL (defaults to `http://localhost:4100`)

Logs:

- `server/data/activity.log` – JSONL event log
- `server/data/unsupported-plugins.json` – Persisted unsupported namespaces

---

## Testing Strategy

Current validation:

- `pnpm --filter frontend run build` for compile-time verification.
- `node --check server/src/index.js` for syntax validation.
- Manual scanning against a curated list of WordPress domains (public, restricted, plugin-heavy).

Upcoming improvements:

1. **Automated API contract tests** using mocked WordPress responses (e.g., MSW or nock) to verify scan pipeline logic.
2. **Component snapshot tests** (Storybook + Chromatic or Jest + RTL) for key organisms/templates.
3. **End-to-end smoke tests** (Playwright) covering domain submission, result rendering, CSV export.
4. **Performance benchmarks** measuring proxy response times + frontend rendering latency across large datasets.

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
