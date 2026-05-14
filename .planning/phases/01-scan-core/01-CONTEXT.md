# Phase 1: Scan Core - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the scan entry and the first proof-of-WordPress results view: a user can submit a domain, move into a dedicated results view, and immediately confirm wp-json evidence with a minimal, verdict-first presentation. The phase stops short of broader plugin/theme, SEO, and homepage source exploration.

</domain>

<decisions>
## Implementation Decisions

### Scan landing state
- **D-01:** After a domain is submitted, the experience should shift to a dedicated results view rather than leaving the user in the current inline scan flow.
- **D-02:** The dedicated view should be result-first and minimal: WordPress verdict, wp-json proof, a few key facts, and scan metadata.

### Scope boundaries
- **D-03:** Treat plugin/theme clues, SEO/metadata, and homepage HTML/source exploration as later-phase work unless they are needed as supporting signals behind the core verdict.
- **D-04:** Defer the exact WordPress proof threshold, raw-vs-summarized evidence density, and failure-state wording to planning/research.

### the agent's Discretion
- View composition, component reuse, routing mechanics, and how secondary scan controls are de-emphasized in the dedicated view.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 1 goal, mode, and success criteria.
- `.planning/REQUIREMENTS.md` — DISC-01 and DISC-02 traceability.
- `.planning/PROJECT.md` — product framing, core value, constraints, and out-of-scope boundaries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/pages/ScanPage.jsx` — existing scan shell with domain form, sidebar nav, recent domains, status stack, and scan-result wiring.
- `frontend/src/services/scan.js` — domain scan pipeline that already collects `/wp-json/` root data, namespaces, routes, core collections, plugin matches, unsupported namespaces, exposure, and performance metadata.
- `frontend/src/components/pages/HistoryPage.jsx` — established history/search/pagination patterns for revisiting previous scans.
- `frontend/src/components/pages/AdminPage.jsx` — existing admin shell and lazy-loaded section pattern for operational surfaces.
- `server/src/index.js` — existing WordPress proxy plus homepage-scan, history, and admin/log endpoints that Phase 1 can build on.

### Established Patterns
- React Query is already used for scan history and unsupported-plugin data.
- The UI is organized as a scan shell with sidebar navigation plus card-based content sections.
- The server already proxies WordPress requests and records scan/log data with JSON responses.

### Integration Points
- `ScanPage` and `ScanContext` are the primary frontend touchpoints for changing the scan landing/result experience.
- `scanDomain()` is the main client-side scan orchestrator.
- `/api/homepage-scan` is available if Phase 1 needs homepage evidence surfaced in the core flow.

</code_context>

<specifics>
## Specific Ideas

- The core scan experience should feel result-first and immediately confirm WordPress evidence.
- Phase 1 should stay minimal rather than turning into a broad investigative dashboard.

</specifics>

<deferred>
## Deferred Ideas

- WordPress proof threshold and which exact signals constitute a confident "appears to be WordPress" verdict.
- How much raw route/core collection data should remain visible versus summarized.
- Auth-restricted, unreachable, and non-WordPress failure-state wording and treatment.
- Whether homepage HTML/source clues should be promoted into Phase 1 or remain a Phase 2 concern.

</deferred>

---

*Phase: 1-Scan Core*
*Context gathered: 2026-05-14*
