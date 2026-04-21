# Repository Guidelines

## Design Context

### Users
- WP JSON Discovery serves mixed WordPress practitioners: developers, marketers, security analysts, SEO researchers, and designers.
- The product is an internal investigative utility used to quickly profile a domain and extract actionable clues from public surfaces.
- Primary job-to-be-done: enter a domain and rapidly understand what the site is running and exposing, including plugin/theme signals, SEO structure, rendered HTML/source indicators, and public `wp-json` evidence.

### Brand Personality
- The product should feel intelligent, whimsical, and elegant.
- Emotional target: investigative focus.
- Because this is an internal tool (not a marketing surface), design should prioritize function, intuitive workflows, and performance over promotional presentation.

### Aesthetic Direction
- Theme direction is dark-first.
- There are no fixed brand colors yet; choose palettes that preserve readability and hierarchy for dense analysis workflows.
- No explicit reference products were provided.
- Anti-reference implication: avoid marketing-style visual treatments and decorative flourishes that reduce scanning speed or clarity.

### Design Principles
- Investigative clarity first: prioritize fast signal extraction, strong hierarchy, and obvious data grouping.
- Functional elegance: keep components refined and polished, but optimized for utility and speed.
- Intelligent whimsy, used sparingly: add personality without competing with analysis tasks.
- Dark-mode legibility: maintain high contrast, clear focus states, and durable readability across complex tables and panels.
- Keyboard-first navigation: every primary action and section path should be reachable and understandable without a mouse.

## Project Structure & Module Organization
- The pnpm workspace splits logic into `server/` (Express proxy, persistence) and `frontend/` (Vite + React client). Run scans through `server/src/index.js`; persisted artifacts live under `server/data/` (`activity.log`, `unsupported-plugins.json`).
- React follows atomic design: `frontend/src/components/atoms|molecules|organisms|templates|pages` compose the UI, while `frontend/src/services/scan.js` orchestrates crawl logic and `frontend/src/config/plugins.js` defines plugin namespaces.
- Shared helpers sit in `frontend/src/utils/` and API wrappers in `frontend/src/api/`. Keep new modules aligned with this layering to avoid bypassing the design system.
- Admin page orchestration is modularized under `frontend/src/components/pages/admin/` (queries, editor state, section state builder, renderers). Review `frontend/src/components/pages/admin/README.md` before expanding admin features.

## Build, Test, and Development Commands
- `pnpm install` – bootstrap all workspaces.
- `pnpm dev` – run Express (default `4100`) and Vite (default `5173`) together for live development.
- `pnpm dev:server` / `pnpm dev:frontend` – focus on a single service; pair with `pnpm --filter frontend run preview` for release-like smoke checks.
- `pnpm --filter frontend run build` – validate the production bundle; required before opening a PR.
- `pnpm --filter frontend run lint` – apply ESLint (ESM/React rules) and catch unused exports.

## Coding Style & Naming Conventions
- JavaScript only (no TypeScript); use ES modules and 2-space indentation. Prefer single quotes and trailing commas when objects span multiple lines.
- Components use PascalCase, hooks start with `use`, config constants are SHOUT_CASE (`SUPPORTED_PLUGINS`). Keep atom-level primitives free of domain logic; push orchestration into services.
- Apply ESLint fixes (`--fix`) when practical and retain descriptive log messages via `server/src/logger.js`.

## Testing Guidelines
- Automated suites are being introduced; target `vitest` + `@testing-library/react` under `frontend/src/__tests__/` and lightweight HTTP mocks (MSW/nock) for `server/`.
- Name test files `*.test.js`; group by feature to mirror atomic layers (e.g., `components/organisms/ResultsTable/ResultsTable.test.js`).
- Until the harness lands, document manual scan cases (auth-gated sites, HTML responses, plugin-heavy domains) in PR notes and attach failing logs from `server/data/activity.log`.
- Future coverage priorities:
  - Automate API/scan-service contract tests and add CI hooks.
  - Build credentialed scanning (application passwords / OAuth) so locked-down sites are supported.
  - Implement batch scanning + scheduling plus richer plugin insights/dashboards for high-value plugins (Rank Math, LiteSpeed, Divi, Modern Events Calendar, WP Engine telemetry, WooCommerce analytics).

## Commit & Pull Request Guidelines
- Current snapshot lacks Git history; adopt Conventional Commit style (`feat: add rank math telemetry handler`) in imperative mood. Group related changes per commit and include log/sample output when relevant.
- PRs should state motivation, implementation notes, verification steps, and screenshots/GIFs for UI changes (expanded tables, new plugin panels, etc.). Link to any tracked unsupported namespace IDs and confirm lint/build commands were run.

## Logging & Operational Notes
- Review `server/data/activity.log` after scans to spot slow endpoints or HTML fallbacks; rotate or trim the file when it approaches megabyte scale.
- Homepage scans now log full asset paths and unknown matches; aggregate via `pnpm --filter wp-json-discovery-server db:assets` or the Admin “Homepage assets” tab to keep `plugins.js`/`themes.js` current.
- Capture newly unsupported namespaces via the API (`/api/unsupported-plugins`) and update `frontend/src/config/plugins.js` alongside corresponding fetch/render logic to keep the persisted list actionable.
