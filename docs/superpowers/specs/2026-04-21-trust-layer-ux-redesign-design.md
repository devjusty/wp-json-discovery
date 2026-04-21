# Trust-Layer UX Redesign (Phase 1) Design Spec

- **Date:** 2026-04-21
- **Project:** wp-json-discovery
- **Primary persona:** Internal admin/power-user
- **Primary outcome:** Better data trust across Scan, History, and Admin surfaces
- **Phase 1 KPI:** `<5%` scans with unresolved consistency warnings (rolling window)

## 1) Problem Statement

Current product surfaces can diverge in how they represent scan truth:

- Scan, History, and Admin/DB views can show mismatched plugin/theme evidence.
- Known plugin/theme catalog management is harder than it needs to be for admins.
- Source provenance and freshness are not consistently visible, which lowers trust.

The redesign must make trust state explicit, preserve fast core scans, and support richer analysis without degrading primary workflows.

## 2) Goals and Non-Goals

### Goals

1. Introduce a trust-first information architecture and domain workflow.
2. Make plugin/theme catalog add/edit flows fast and reliable.
3. Add WordPress repository enrichment with provenance and freshness indicators.
4. Introduce a deterministic consistency engine for cross-surface checks.
5. Add opt-in deep sitemap/content auditing for SEO and competitor reconnaissance.
6. Migrate with compatibility safeguards and medium-risk phased rollout.

### Non-Goals (Phase 1)

1. Full replacement of all legacy storage paths in one release.
2. Real-time streaming trust checks on every UI interaction.
3. Unbounded deep crawling that can impact core scan SLA.

## 3) Product IA and Navigation

New top-level product sections:

1. **Workspace** — trust queue, active alerts, recent mismatches.
2. **Domains** — per-domain timeline + trust panel + evidence breakdown.
3. **Catalog** — plugin/theme CRUD, enrichment status, mapping confidence.
4. **Insights** — trend views, warning categories, drift summaries.
5. **Operations** — logs, DB health, queue status, remediation actions.

## 4) Trust-First Domain Flow

Domain detail page flow (top to bottom):

1. **Trust status card** (`pass`, `warning`, `blocked`, `unknown`).
2. **Consistency checks panel** (`scan vs history`, `scan vs catalog`, freshness drift).
3. **Plugin/theme evidence table** with source, timestamp, confidence, and conflict markers.
4. **Optional deep audit panel** for sitemap/content findings and status.

The first panel answers, "Can I trust this result right now?" before deeper diagnostics.

## 5) Data Model: Hybrid Canonical Truth

### 5.1 Canonical Core

Introduce a canonical per-run envelope (logical contract): `ScanTrustEnvelope`.

Required fields:

- `envelopeId`
- `domain`
- `scanRunId`
- `scannedAt`
- `coreFindings` (plugin/theme findings and probe summaries)
- `trustInputs` (evidence for consistency calculations)
- `schemaVersion`

This envelope is the canonical source for trust-critical comparison and reconciliation.

### 5.2 View-Specific Enrichments

History/Admin/Insights projections remain, but must reference:

- `envelopeId`
- `schemaVersion`
- projection metadata (`projectedAt`, `projectionVersion`)

This keeps existing surface flexibility while preventing silent drift from canonical truth.

### 5.3 Catalog Provenance Contract

Each plugin/theme field that can influence trust carries:

- `source`: `manual | repo | derived`
- `updatedAt`
- `confidence` (optional numeric score or normalized label)
- `sourceRef` (optional origin reference, for example WP slug/source endpoint)

UI trust badges derive from this contract, not from implicit assumptions.

## 6) Consistency Engine

Introduce deterministic rule execution over canonical + projected data.

### 6.1 Rule Classes (Phase 1)

1. `SCAN_HISTORY_MISMATCH`
2. `SCAN_CATALOG_MISMATCH`
3. `CATALOG_FRESHNESS_DRIFT`
4. `RUN_TO_RUN_TRUST_DRIFT`

### 6.2 Output Contract

Each check emits:

- `ruleCode`
- `severity`: `info | warn | blocking`
- `status`: `open | resolved | ignored`
- `entityRef` (domain, plugin/theme, run)
- `reason`
- `remediationHint`
- `emittedAt`

### 6.3 Resolution Semantics

- **Open** warnings count toward KPI numerator.
- **Resolved** warnings are retained for audit history.
- **Ignored** requires explicit operator action and actor metadata.

## 7) Catalog UX and Workflows

### 7.1 List View

- Search by slug/name/namespace.
- Filters by source, confidence, stale state, and status.
- Bulk operations for selected records.
- Visible stale/fresh badges from enrichment freshness data.

### 7.2 Quick Add

- Slug-first form.
- Autocomplete from WP repository enrichment source.
- Prefill namespaces and metadata when confidence is sufficient.

### 7.3 Edit Drawer

- Edit version policy, namespace mappings, aliases, notes, conflict rules.
- Show provenance inline for each mutable field.

### 7.4 Diff Before Save

- Preview changed fields and expected trust-check impact.
- Confirm write with explicit operator intent.

## 8) WordPress Repository Enrichment

### 8.1 Enrichment Inputs

- Public WordPress repository metadata for known plugin slugs.
- Stored metadata includes `fetchedAt`, freshness state, and stable identity reference.

### 8.2 Behavior

- Enrichment is best-effort and non-blocking.
- If unavailable, catalog remains editable with explicit stale-state indicators.
- Enrichment recency drives freshness-related consistency checks.

### 8.3 Safety and Trust

- No enrichment failure can mark a domain as `pass` by default.
- Enrichment unavailability degrades trust to `warning` or `unknown` when applicable.

## 9) Opt-In Deep Sitemap/Content Auditing

### 9.1 Execution Model

- Explicitly enabled per domain.
- Async job lifecycle: `queued`, `running`, `completed`, `failed`, `capped`.
- Budget controls: page cap, time cap, include/exclude rules.

### 9.2 Separation from Core Scan

- Deep audit artifacts are linked to the canonical run but stored separately.
- Core scan completion and SLA are independent from deep audit completion.

### 9.3 Output

- Structured post/page findings for SEO and competitive content reconnaissance.
- Results surfaced in domain deep-audit panel and Insights.

## 10) Error Handling and Degraded Modes

1. **Repo enrichment unavailable**
   - Keep catalog operations available.
   - Show stale/unknown source indicators.

2. **Consistency execution unavailable**
   - Trust state becomes `unknown` (not `pass`).
   - Surface failure reason in Operations.

3. **Deep audit failure**
   - Report job as `failed` with reason.
   - Never block core scan result publication.

4. **Projection lag**
   - Expose projection staleness badge and last projection timestamp.

## 11) Testing Strategy

### 11.1 Contract Tests

- `ScanTrustEnvelope` schema versioning and required fields.
- Projection link integrity (`envelopeId`, `schemaVersion`).

### 11.2 Consistency Engine Tests

- Rule-level tests for each mismatch class.
- Severity and status transition tests.
- Regression tests for known cross-surface mismatch scenarios.

### 11.3 UI Tests

- Catalog quick-add and edit-drawer flows.
- Provenance badges and stale indicators.
- Diff-before-save rendering and confirmation.

### 11.4 Integration Tests

- Deep audit lifecycle transitions.
- Non-blocking behavior relative to core scan.

## 12) Rollout and Migration Plan

### 12.1 Phase A: Introduce Canonical Core + Dual Write

- Write `ScanTrustEnvelope` alongside legacy structures.
- Keep legacy readers intact.
- Log divergence between new and legacy interpretations.

### 12.2 Phase B: Surface-by-Surface Read Migration

1. Operations + Insights read from canonical-linked projections.
2. Domains detail trust panel reads canonical + consistency output.
3. History rollups transition last.

### 12.3 Phase C: Legacy Write Reduction

- Remove legacy-only writes only after stability window and KPI performance.
- Keep compatibility readers until post-cutover monitoring confirms safety.

## 13) Observability and Operations

Expose in Operations/Insights:

- `unresolved_consistency_warning_rate`
- warning counts by rule code and severity
- catalog stale ratio
- deep-audit queue depth and failure rate
- projection lag metrics

Add catalog change audit trail: actor, timestamp, changed fields, provenance delta.

## 14) Acceptance Criteria (Phase 1)

1. Admins can add/edit plugin/theme records quickly in one guided flow.
2. Provenance and freshness are visible anywhere trust-critical data is shown.
3. Cross-surface mismatches are detected and shown with remediation hints.
4. Core scan throughput remains stable while deep audit runs asynchronously.
5. KPI remains under threshold: `<5%` unresolved consistency warnings in rolling window.

## 15) Risks and Mitigations

1. **Migration drift risk**
   - Mitigation: dual-write and divergence logs before cutover.

2. **Enrichment source volatility**
   - Mitigation: stale-state handling and explicit degraded trust states.

3. **Operator overload from warnings**
   - Mitigation: severity tiers, grouped remediation, queue prioritization.

4. **Deep audit resource usage**
   - Mitigation: strict budgets, opt-in toggle, queue instrumentation.

## 16) Implementation Boundaries for Planning Step

This design intentionally constrains Phase 1 to:

- trust-layer model + consistency engine,
- catalog UX and provenance upgrade,
- repo enrichment integration,
- opt-in deep audit infrastructure,
- phased migration instrumentation.

Out-of-scope expansions should be proposed as subsequent specs.

## 17) Frontend Component Audit Integration

A focused component audit was completed after this spec draft to align Phase 1 design intent with current UI implementation constraints.

- Supplemental audit: `docs/superpowers/specs/2026-04-21-frontend-components-current-state-audit.md`

This audit confirms the direction in this design and adds practical constraints for planning:

1. Reuse admin hook/renderer modular boundaries; do not collapse logic back into monolithic JSX sections.
2. Introduce a shared frontend trust contract before major section UI migrations.
3. Include catalog component consolidation work (shared modal/list primitives) as part of Phase 1 catalog UX scope.
4. Treat current sitemap scan UI as a precursor and evolve it into an asynchronous deep-audit lifecycle surface.
5. Preserve existing debug visibility while adding trust summaries and remediation-first affordances.

## 18) Architecture Audit Delta (Frontend Non-Component + Server)

The supplemental audit was expanded to include high-level frontend non-component architecture and server implementation surfaces:

- `docs/superpowers/specs/2026-04-21-frontend-components-current-state-audit.md` (Sections 9-12)

This confirms additional planning constraints:

1. The backend currently favors synchronous scan endpoints and log-derived scan history; trust-layer entities should be introduced before cross-surface UI migration.
2. Deep sitemap/content audit should shift from request-bound execution to job lifecycle APIs to support reliable trust semantics.
3. Plugin/theme registry persistence should be extended for provenance/freshness/confidence and auditability to satisfy catalog trust goals.
4. Frontend `services/context/api/hooks` should gain trust adapters first, then component surfaces should migrate onto those contracts.
5. Existing heartbeat/error diagnostics provide a strong safety rail for phased rollout monitoring.
