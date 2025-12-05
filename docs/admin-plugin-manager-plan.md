# Admin Plugin Manager Plan

Goal: manage `frontend/src/config/plugins.js` directly from the Admin UI (add/edit/remove plugins, namespaces, asset hints) and safely persist changes to disk via a backend API.

## Backend
- Add API endpoints under `/api/admin/plugins`:
  - `GET /api/admin/plugins` → return current `SUPPORTED_PLUGINS`.
  - `POST /api/admin/plugins` → create a plugin entry (payload: id, label, description, pluginUrl, namespaces[], assetHints[]).
  - `PUT /api/admin/plugins/:id` → update an existing plugin by id.
  - `DELETE /api/admin/plugins/:id` → remove a plugin by id.
- Implement a write helper that:
  - Loads `plugins.js` via dynamic import.
  - Applies mutations in memory.
  - Writes back a sorted array (stable sort by `label`, then `id`) using the shared sorter utility.
  - Performs basic validation (id uniqueness, namespaces array of strings, assetHints array of strings).
  - Logs an `admin.plugins.updated` event to `activity_logs` with diff summary and timestamp.
- Gate endpoints behind `ADMIN_ENABLED` and optionally a simple shared secret (env var) to avoid accidental writes in non-dev.

## Frontend (Admin UI)
- Add a new Admin section “Plugin Manager” with:
  - Table/grid listing plugins (id, label, namespace count, asset hint count, pluginUrl).
  - Filters/search by id/label/namespace substring.
  - Expandable row to view/edit namespaces and assetHints inline.
  - Add plugin form (id, label, description, pluginUrl, namespaces textarea/chips, assetHints chips).
  - Delete action with confirm dialog.
- Wire CRUD to the new admin APIs with optimistic updates and toasts. After writes, refetch plugins to sync.
- Keep a “Sort & Save” action that triggers the sorter endpoint (or POST with `?sort=true`) to normalize ordering.

## Sorting Helper
- Introduce a shared utility (Node script + exported function) to alphabetize `SUPPORTED_PLUGINS` by `label`, then `id`, and rewrite `plugins.js` with consistent formatting. Expose as `pnpm sort:plugins`.
- Backend write helper should call the same sorter to keep UI actions and CLI behavior aligned.

## Safety & UX
- Surface last-updated timestamp and last editor (from log event) in the UI header.
- Show a diff preview (before/after counts of namespaces/assetHints) before saving edits.
- Provide a “discard changes” reset to reload from disk.
- Log errors to `activity_logs` with `admin.plugins.error` for visibility.
