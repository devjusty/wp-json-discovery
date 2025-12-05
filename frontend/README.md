# Frontend Overview

This package houses the Vite + React client for WP JSON Discovery. It renders scan results from the Express proxy, surfaces plugin insights, and orchestrates the crawl workflow.

## Scripts

```bash
pnpm dev:frontend        # Start Vite on http://localhost:5173 with HMR
pnpm --filter frontend run build   # Production build (called from repo root in CI)
pnpm --filter frontend run lint    # ESLint (React rules + import order)
pnpm --filter frontend run preview # Serve the production build locally
```

Launch the shared dev environment with `pnpm dev` from the repo root to boot both the proxy and this client. The Admin tab surfaces unsupported namespaces, recent logs, registry data, and homepage asset paths aggregated from scans.

## Environment Variables

- Copy `.env.example` to `.env` in this folder to set `VITE_API_BASE_URL` for local development.
- Vite automatically loads `.env`, `.env.local`, and mode-specific files—restart `pnpm dev` after updates.

## Structure

```
frontend/src/
├── api/               # REST wrappers for proxy endpoints (`proxy`, `scan`, `unsupported-plugins`)
├── components/
│   ├── atoms/         # Pure UI primitives (buttons, badges, status chips)
│   ├── molecules/     # Small compositions (domain form, pill groups)
│   ├── organisms/     # Data-heavy widgets (results table, plugin matrices)
│   ├── templates/     # Layout scaffolding
│   └── pages/         # Top-level routes/views
├── config/            # `plugins.js` (namespace registry), `themes.js` (theme signals), default table schemas
├── services/          # `scan.js` orchestrates crawling, normalization, and logging
├── utils/             # CSV helpers, formatting, timing utilities
└── styles/            # Global stylesheets and tokens (if present)
```

Follow the atomic boundaries: keep domain logic inside services/config, and render-only concerns inside components.

## Styling & State

- Global state lives in hook-based providers under `components/templates`—prefer composition over new global stores.
- Use 2-space indentation and single quotes. Keep CSS modules or styled components colocated with their owner.
- Accessibility: ensure interactive molecules/organisms expose keyboard focus rings and ARIA labels.

## Testing

- Unit/integration tests belong under `frontend/src/__tests__/` or next to the component (`ComponentName.test.js`).
- Use `@testing-library/react` for rendering assertions and `vitest` for the test runner.
- When adding scan orchestration tests, mock the API wrappers under `frontend/src/api/`.

## Unsupported Namespace Research

When a scan surfaces a new namespace:

1. Confirm it in the UI plugin sidebar and inspect `server/data/unsupported-plugins.json`.
2. Run `pnpm context7 -- "/wordpress/plugins/<namespace>"` to gather docs, repo links, and feature notes.
3. Extend `frontend/src/config/plugins.js` with the new namespace metadata, update display copy as needed, then rerun the scan to ensure the unsupported list is empty.

## Troubleshooting

- **Blank results** – Verify the proxy is on `http://localhost:4100` and Vite was launched with the same base URL.
- **CORS errors** – The proxy handles cross-origin requests; ensure `VITE_API_BASE_URL` is unset or matches the proxy origin.
- **Build warnings** – Run `pnpm --filter frontend run lint -- --fix` to autofix stylistic issues before committing.
- **Admin tab empty** – Ensure backend admin endpoints are enabled (`ADMIN_ENABLED` not set to `false`) and the server is on `4100`.
