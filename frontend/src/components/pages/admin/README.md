# Admin Page Architecture

This folder is organized to keep the admin page maintainable as sections and editor flows grow.

## Files at a glance

- `AdminPage.jsx`
  - Top-level page orchestration.
  - Owns high-level UI state (active section, filters, expanded rows).
  - Wires query hooks, derived data hooks, and section state builder.

- `useAdminQueries.js`
  - React Query data fetching + mutation definitions.
  - Handles cache invalidation policy after writes.

- `useAdminData.js`
  - Derived/computed data for rendering (filtering, sorting, summaries).
  - Pure view-model shaping on top of query data.

- `useAdminEditorState.js`
  - Plugin/theme editor flows (draft state, validation, modal controls).
  - Mutation success side effects (reset/close behavior).

- `sectionsState.js`
  - Builds grouped state contract consumed by section renderers.
  - Keeps `AdminPage` -> section boundary explicit and stable.

- `AdminSections.jsx`
  - Thin wrapper for shared loading/error status cards.
  - Delegates actual section content rendering.

- `AdminSectionContent.jsx`
  - Dispatcher that selects which section renderer to call.

- `AdminSectionPrimitives.jsx`
  - Shared UI primitives used by section renderers (`SectionSuspense`, loading/status cards).

- `section-renderers/`
  - `coreSections.jsx`: non-catalog sections (db/domains/logs/etc).
  - `catalogManagers.jsx`: plugin/theme catalog + manager sections.

- `sections/`
  - Presentational section components.
  - Prefer keeping section-specific UI concerns localized here.

## Practical conventions

- Put fetch/mutation behavior in hooks (`useAdminQueries`, `useAdminEditorState`), not JSX files.
- Put sorting/filtering/aggregation in `useAdminData`.
- Keep renderer modules mostly as mapping layers from grouped state -> section props.
- If a section branch gets large, split it into a dedicated renderer module in `section-renderers/`.
