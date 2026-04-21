# Frontend Components Current-State Audit

- **Date:** 2026-04-21
- **Project:** wp-json-discovery
- **Scope reviewed:** `frontend/src/components/**/*` plus high-level `frontend/src/{services,context,api,hooks,config}` and `server/src/**/*`
- **Purpose:** Capture implementation-relevant findings to ground the trust-layer redesign spec in current UI architecture, frontend data orchestration, and backend delivery constraints.

## 1) What Exists Today (Strengths)

1. **Clear page-level separation**
   - `ScanPage`, `HistoryPage`, and `AdminPage` are distinct shells with shared `AppLayout` framing.
   - The current app already supports cross-navigation between scan, history, and admin contexts.

2. **Admin architecture is already modularized**
   - Admin data fetching, derivation, and editor workflows are split into hooks and renderers (`useAdminQueries`, `useAdminData`, `useAdminEditorState`, renderer modules).
   - This provides a strong insertion point for a trust-layer view model without rewriting every section component.

3. **Catalog workflow foundation exists**
   - Plugin/theme CRUD is implemented with inline edit + modal create flows.
   - Unsupported namespace and unknown-asset discovery are already connected to plugin creation entry points.

4. **Deep scan precursor exists for sitemap analysis**
   - Scan surface includes a sitemap scan panel + page table with basic SEO/schema flags.
   - This is a practical base for the planned opt-in deep audit system.

5. **Core UI primitives are consistent**
   - Reusable atoms (`Button`, `Card`, `TextInput`) and table primitives are applied across pages.
   - Existing CSS class patterns make an incremental visual refit feasible.

## 2) Architecture Constraints and Risks

1. **Admin orchestration is still state-heavy at the page root**
   - `AdminPage` owns many UI state slices and passes a broad grouped state contract into section renderers.
   - This is maintainable today but will become brittle once trust statuses, warning filters, and reconciliation actions are added unless state is further segmented by domain concern.

2. **Cross-surface trust model is not yet represented in components**
   - Scan, History, and Admin each render local response shapes.
   - There is no shared canonical envelope or UI contract for consistency warnings/provenance.

3. **Snapshot-backed sections are read-centric, not trust-centric**
   - Admin snapshot loading covers unsupported/logs/heartbeat/assets, but panels do not unify around a single trust verdict or mismatch queue.
   - Users still infer trust from separate cards/tables instead of one explicit decision surface.

4. **Catalog edits are manual-first and source-light**
   - Plugin/theme forms rely on direct text entry for IDs/namespaces/signals.
   - Provenance source, freshness, and confidence are not first-class editable/displayed fields.

5. **Sitemap scan is synchronous and session-scoped**
   - Current sitemap flows are run directly from scan UI and render immediate results.
   - There is no queued lifecycle (`queued/running/completed/failed/capped`) or persisted job tracking aligned with planned deep audit operations.

## 3) UX and Flow Findings Against Phase 1 Goals

1. **Trust status is implicit, not explicit**
   - No dedicated trust status card (`pass/warning/blocked/unknown`) currently anchors scan/history/admin workflows.

2. **Mismatch visibility is fragmented**
   - Evidence appears in multiple places (scan summary, unsupported tables, history cards, admin logs), but there is no consolidated consistency panel tying them together.

3. **Catalog maintenance is usable but not optimized for speed**
   - Current create/edit works, but lacks slug-autocomplete, enrichment preview, diff-before-save, and impact preview.

4. **Debug payloads are surfaced, but operator guidance is light**
   - Raw JSON is exposed in multiple areas (helpful for debugging) but not paired with stronger remediation cues for trust failures.

5. **Navigation taxonomy differs from proposed IA**
   - Existing nav is task/page based (Scan, History, Admin + section tabs), while proposed IA is outcome-based (`Workspace`, `Domains`, `Catalog`, `Insights`, `Operations`).

## 4) Duplication and Refactor Opportunities (Directly Relevant)

1. **Modal/editor duplication in catalog managers**
   - Plugin and theme manager sections duplicate modal and focus-trap logic.
   - Consolidating shared registry modal/editor primitives should be part of implementation scope to reduce risk during trust/provenance field additions.

2. **Formatting/helper duplication**
   - Byte/date/JSON formatting logic is repeated across admin and scan components.
   - Shared trust/evidence formatting helpers should be centralized before or alongside trust-badge rollout.

3. **Parallel table/filter patterns**
   - Supported plugin/theme sections implement near-identical search/sort/expand UI.
   - A generic catalog list pattern would speed delivery of enrichment/freshness/confidence columns.

## 5) Test Coverage Snapshot (Components Scope)

1. **Present tests exist for key page shells and some admin/scan pieces**
   - Tests cover `AdminPage`, `HistoryPage`, select admin sections/hooks, and scan section/nav/status rendering.

2. **Coverage gaps for Phase 1 trust work**
   - No component-level tests currently validate cross-surface trust reconciliation UI.
   - No tests for provenance/freshness badge semantics.
   - No lifecycle tests for asynchronous deep audit job state transitions.

## 6) Implications for the Trust-Layer Redesign Spec

These findings support the existing Phase 1 direction and add concrete implementation constraints:

1. Keep the existing admin modular layering and evolve it with a dedicated trust view-model hook instead of re-merging logic into JSX sections.
2. Introduce a shared frontend trust contract consumed by Scan/History/Admin before redesigning individual section visuals.
3. Treat catalog UX overhaul as both UX and component consolidation work (shared modal, shared list, provenance-aware field components).
4. Upgrade sitemap scan into an operations-aware deep audit flow with persisted job state and explicit separation from core scan completion.
5. Preserve raw JSON debug affordances, but move them behind progressive disclosure once trust summaries and remediation affordances are available.

## 7) Suggested Sequencing Update

1. **Contract first:** add canonical trust envelope adapters + consistency warning model in frontend data hooks.
2. **Then IA shells:** introduce `Workspace/Domains/Catalog/Insights/Operations` routing/navigation skeleton while keeping old sections accessible.
3. **Then section migrations:** move Scan/History/Admin panels into trust-first domain/correlation views.
4. **Then catalog acceleration:** add WP repo enrichment, provenance columns, diff-before-save, and shared manager primitives.
5. **Then deep audit operations:** queue-backed UI and lifecycle visibility in Domains + Operations.

## 8) Evidence Map (Key Files Reviewed)

1. **Page shells and navigation**
   - `frontend/src/components/pages/ScanPage.jsx`
   - `frontend/src/components/pages/HistoryPage.jsx`
   - `frontend/src/components/pages/AdminPage.jsx`
   - `frontend/src/components/pages/scan/ScanSidebarNav.jsx`
   - `frontend/src/components/pages/admin/AdminSidebarNav.jsx`
   - `frontend/src/components/templates/AppLayout.jsx`

2. **Admin modular architecture and data shaping**
   - `frontend/src/components/pages/admin/README.md`
   - `frontend/src/components/pages/admin/useAdminQueries.js`
   - `frontend/src/components/pages/admin/useAdminData.js`
   - `frontend/src/components/pages/admin/useAdminEditorState.js`
   - `frontend/src/components/pages/admin/sectionsState.js`
   - `frontend/src/components/pages/admin/section-renderers/coreSections.jsx`
   - `frontend/src/components/pages/admin/section-renderers/catalogManagers.jsx`

3. **Catalog and unsupported workflows**
   - `frontend/src/components/pages/admin/sections/AdminPluginManagerSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminThemeManagerSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminSupportedPluginsSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminSupportedThemesSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminUnsupportedSection.jsx`
   - `frontend/src/components/pages/admin/drafts.js`

4. **Trust-adjacent telemetry and operations surfaces**
   - `frontend/src/components/pages/admin/sections/AdminDbSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminDomainsSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminHeartbeatSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminAssetsSection.jsx`
   - `frontend/src/components/pages/admin/sections/AdminLogsSection.jsx`

5. **Scan/deep-audit precursor surfaces**
   - `frontend/src/components/pages/scan/ScanSectionContent.jsx`
   - `frontend/src/components/pages/scan/sections/OverviewSection.jsx`
   - `frontend/src/components/pages/scan/sections/HomepageSection.jsx`
   - `frontend/src/components/pages/scan/sections/SitemapSection.jsx`
   - `frontend/src/components/organisms/panels/SitemapScanPanel.jsx`
   - `frontend/src/components/organisms/panels/SitemapPagesTable.jsx`

6. **Shared primitives and recurring patterns**
   - `frontend/src/components/atoms/Button.jsx`
   - `frontend/src/components/atoms/Card.jsx`
   - `frontend/src/components/atoms/TextInput.jsx`
   - `frontend/src/components/organisms/data/DataTable.jsx`
   - `frontend/src/components/organisms/summary/ScanSummary.jsx`

## 9) Frontend Non-Component Architecture Findings (`src/{services,context,api,hooks,config}`)

1. **Current orchestration is request/session centric, not trust-envelope centric**
   - `ScanContext` combines hook outputs (`useScan`, `useHomepageScan`) and keeps an in-memory active domain.
   - There is no shared persisted frontend model for canonical run truth, projection staleness, or warning state lifecycle.

2. **Scan flow already has good probe parallelization, but no reconciliation contract**
   - `services/scan.js` runs multiple probes in parallel and composes performance/exposure/plugin matching summaries.
   - Cross-surface mismatch detection is not represented here; logic produces per-run summaries only.

3. **Sitemap/deep audit remains direct mutation-driven**
   - `useSitemapScan` calls `/api/sitemap-scan` and expects immediate payload completion.
   - No queued job IDs, polling, cancellation, or persisted lifecycle state (`queued/running/completed/failed/capped`) currently exists.

4. **API layer has solid baseline ergonomics but coarse trust semantics**
   - `api/client.js` centralizes request handling, headers, and admin key injection.
   - Error normalization is mostly message-level; no typed trust-state/error taxonomy for UI remediation prioritization.

5. **Registry/catalog source model is still manual-first**
   - `config/plugins.js` and `config/themes.js` remain primary structured sources; large static plugin registry indicates maintenance burden.
   - No first-class frontend representation of provenance fields (`source`, `sourceRef`, `confidence`, `freshness`) in config contracts yet.

## 10) Server High-Level Findings (`server/src`)

1. **Backend foundation is capable but currently optimized for synchronous scans**
   - `server/src/index.js` exposes scan/proxy/homepage/sitemap/admin routes with strong validation and logging.
   - Deep sitemap scan endpoint is synchronous request/response today; async job queue primitives are not present.

2. **Data model is robust for current product, but missing trust-layer entities**
   - `db/client.js` migrations define unsupported plugins, activity logs, scan domains/runs, and plugin/theme registries.
   - There are no canonical trust envelope/projection/mismatch tables yet.

3. **Scan history is log-derived, which creates coupling**
   - `logger.js` writes activity logs and derives `scan_domains`/`scan_runs` through log persistence.
   - This is practical but couples history integrity to logging pipeline behavior.

4. **Registry persistence supports admin CRUD and startup seeding**
   - `utils/pluginRegistry.js` seeds DB from frontend config, then serves DB-backed plugin/theme CRUD.
   - Save operations currently replace table contents (`delete + insert`), which may complicate future per-field provenance diffs without additional audit structure.

5. **Security/ops posture is good baseline for internal use**
   - Domain sanitization, redirect host constraints, admin API key gating, and rate limiting are in place.
   - Admin diagnostics include Turso health/control-plane checks and log/maintenance endpoints, which can power Operations views.

## 11) Cross-Layer Implications for Phase 1 Sequencing

1. **Introduce canonical trust entities in server before full UI trust migration**
   - Add backend envelope + mismatch persistence first so Scan/History/Admin can read a shared source of truth.

2. **Decouple deep audit from synchronous request lifecycle**
   - Move `/api/sitemap-scan` toward job submission + lifecycle APIs before exposing trust-critical deep-audit status in Domains/Operations.

3. **Evolve registry model to support provenance-aware edits**
   - Extend plugin/theme schema and API contracts to carry per-field provenance/freshness/confidence and change audit metadata.

4. **Keep existing observability as migration safety net**
   - Reuse heartbeat/error-category/suppression signals and divergence logging to monitor trust-layer rollout risk.

5. **Plan frontend adapters, then component migrations**
   - Add `services/api/hooks` trust adapters first; migrate page components after adapter contracts are stable.

## 12) Additional Evidence Map (Non-Component Frontend + Server)

1. **Frontend context/hooks/services/api/config**
   - `frontend/src/context/ScanContext.jsx`
   - `frontend/src/services/scan.js`
   - `frontend/src/services/logger.js`
   - `frontend/src/hooks/useScan.js`
   - `frontend/src/hooks/useHomepageScan.js`
   - `frontend/src/hooks/useSitemapScan.js`
   - `frontend/src/api/client.js`
   - `frontend/src/api/admin.js`
   - `frontend/src/config/core.js`
   - `frontend/src/config/plugins.js`
   - `frontend/src/config/themes.js`

2. **Server routing, persistence, and infra utilities**
   - `server/src/index.js`
   - `server/src/db/client.js`
   - `server/src/logger.js`
   - `server/src/sitemap.js`
   - `server/src/utils/pluginRegistry.js`
   - `server/src/utils/plugins.js`
   - `server/src/utils/html.js`
   - `server/src/utils/fetch.js`
   - `server/src/utils/domain.js`
   - `server/src/middleware/adminAuth.js`
   - `server/src/middleware/errorHandler.js`
   - `server/src/middleware/rateLimiter.js`
