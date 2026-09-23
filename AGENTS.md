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

When working on UI components, always use the `wp-json-sb-mcp` MCP tools to access Storybook's component and documentation knowledge before answering or taking any action.

- **CRITICAL: Never hallucinate component properties!** Before using ANY property on a component from a design system (including common-sounding ones like `shadow`, etc.), you MUST use the MCP tools to check if the property is actually documented for that component.
- Query `list-all-documentation` to get a list of all components
- Query `get-documentation` for that component to see all available properties and examples
- Only use properties that are explicitly documented or shown in example stories
- If a property isn't documented, do not assume properties based on naming conventions or common patterns from other libraries. Check back with the user in these cases.
- Use the `get-storybook-story-instructions` tool to fetch the latest instructions for creating or updating stories. This will ensure you follow current conventions and recommendations.
- Check your work by running `run-story-tests`.

Remember: A story name might not reflect the property name correctly, so always verify properties through documentation or example stories before using them.

## Project Structure & Module Organization

- The pnpm workspace splits logic into `server/` (Express proxy, persistence) and `frontend/` (Vite + React client). Run scans through `server/src/index.ts`; persisted artifacts live under `server/data/` (`activity.log`, `unsupported-plugins.json`).
- New work follows domain-first vertical slices, not atomic design. Treat `frontend/src/components/atoms|molecules|organisms|templates|pages` as legacy migration areas: do not add new feature dependencies there. Existing modules may remain until their consumers move.
- Frontend target structure is `domain/` for framework-free deterministic investigation and findings rules, `application/` for use cases and ports, `adapters/` for capability/HTTP/persistence/auth integrations, and `ui/` for shells and feature-focused presentation modules. Keep route files thin composition boundaries.
- Center behavior on the Investigation domain: an investigation owns submitted and normalized URL identity, redirect chain, immutable observations, capability runs, findings, and evidence. A scan session is one attempt. Capability states are `queued`, `running`, `success`, `failed`, or `unavailable`; preserve successful evidence when another capability fails and expose scoped retry only for retryable failures.
- Keep domain modules free of React, browser APIs, HTTP clients, database clients, Auth0, and Zod. Application modules depend on explicit ports. Adapters validate external data and map transport values into domain values before UI receives them.
- Keep Zod schemas and inferred transport types in `packages/contracts`; use `safeParse` at HTTP, local persistence, remote persistence, capability-envelope, and auth-claim seams. Invalid external data becomes a typed contract error, never a silent empty state. Do not add Zod parsing to components, reducers, or selectors.
- Shared helpers remain in `frontend/src/utils/` and API wrappers in `frontend/src/api/` while they are migrated behind adapters. New capability behavior must reuse the existing registry in `frontend/src/services/scanCapabilities.js` through an adapter rather than creating a second registry.
- Admin page orchestration is modularized under `frontend/src/components/pages/admin/` (queries, editor state, section state builder, renderers). Review `frontend/src/components/pages/admin/README.md` before expanding admin features.
- Investigator and admin experiences use separate shells. Investigator UI prioritizes report comprehension, contextual navigation, evidence provenance, responsive behavior, keyboard access, and partial recovery. Admin UI prioritizes an operational inbox and evidence-first item review; do not add bulk actions until item-level actions and authorization are reliable.

## Architecture Rules

- Prefer deep modules: small interfaces with lifecycle, validation, persistence, or execution complexity hidden behind them. Do not introduce a single-implementation abstraction unless it represents a real persistence, capability execution, or authentication seam.
- UI consumes domain read models and commands, not raw API responses. UI modules may compose visual primitives, but visual primitives must not import feature modules or own domain logic.
- Keep local and authenticated persistence behind the same `InvestigationStore` interface. Store selection and anonymous-to-authenticated claim belong in application policy, not page components.
- Server routes parse transport input and format responses; server application modules authorize before mutation, enforce domain rules, and call persistence implementations. Preserve existing endpoint behavior while migration is incremental.
- Do not delete legacy orchestration or atomic modules until import search shows no active consumers and replacement tests prove equivalent behavior.

## Build, Test, and Development Commands

- `pnpm install` – bootstrap all workspaces.
- `pnpm dev` – run Express (default `4100`) and Vite (default `5173`) together for live development.
- `pnpm dev:server` / `pnpm dev:frontend` – focus on a single service; pair with `pnpm --filter frontend run preview` for release-like smoke checks.
- `pnpm --filter frontend run build` – validate the production bundle; required before opening a PR.
- `pnpm --filter frontend run lint` – apply ESLint (ESM/React rules) and catch unused exports.

## Coding Style & Naming Conventions

- Frontend and server code are being incrementally migrated to TypeScript. New files use TypeScript (`.ts`/`.tsx`); migrate touched JavaScript files when needed for the feature. Use ES modules and 2-space indentation. Prefer single quotes and trailing commas when objects span multiple lines.
- UI modules use PascalCase, hooks start with `use`, config constants are SHOUT_CASE (`SUPPORTED_PLUGINS`). Keep visual primitives framework-focused and feature-agnostic; put orchestration in application use cases and domain lifecycle modules, not components.
- Apply ESLint fixes (`--fix`) when practical and retain descriptive log messages via `server/src/logger.js`.

## Testing Guidelines

- Automated suites are being introduced; use Vitest plus `@testing-library/react` for frontend domain/application/UI modules and lightweight HTTP mocks (MSW/nock) for server adapters and routes.
- Colocate tests with the module they exercise using `*.test.ts`, `*.test.tsx`, or existing `*.test.js` naming. Test domain and application behavior through ports and fakes; test adapters at contract seams; test UI from read models and commands; test complete scan workflows separately.
- Required proof for architecture changes: focused tests, frontend lint, frontend typecheck, frontend build, and Storybook build for UI changes when available. Run browser walkthroughs when Playwright/Chromium is available. Report unavailable or blocked tooling as blocked, never passing.
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

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `devjusty/wp-json-discovery` (via `gh`). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
