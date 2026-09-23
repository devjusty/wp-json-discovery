# Frontend Redesign Design

## Status

Approved brainstorming direction. Implementation is intentionally not covered by this document.

## Goal

Rebuild WP JSON Discovery frontend around a faster investigator workflow, then migrate the full product shell and admin workspace without losing the existing scan capabilities or trust model.

The redesign is a product reset, not a visual reskin. The first proof point is a complete scan-to-understanding loop: a user starts a scan, sees useful progressive results, understands findings through evidence, recovers from partial failure, and can return to the investigation.

## Scope Order

Work proceeds in three phases:

1. Visual system and hybrid shell.
2. Investigator vertical slice.
3. Full shell migration, including the dedicated admin workspace.

The phases are ordered to prevent each screen from inventing its own visual and interaction rules, while still proving the primary workflow before broad migration.

## Product Concepts

- An **investigation** is the durable container for one domain and its immutable observation timeline.
- A **scan session** is one execution within an investigation.
- A scan session contains independent capabilities. Each capability has its own status, result, error, or unavailable state.
- A **finding** is a prioritized interpretation of observed site behavior or exposure.
- **Evidence** records whether support is observed, inferred, a request trace, or an absence.
- URL normalization preserves the submitted URL and redirect chain.
- Subdomains remain separate investigations unless the system has explicit evidence that they are equivalent.

## Phase 1: Visual System and Hybrid Shell

### Visual language

Keep the dark investigative workspace and current typography direction: IBM Plex Sans for interface text and IBM Plex Mono for URLs, paths, payloads, and IDs. Keep square structural surfaces and restrained elevation. Use one accent for interaction, neutral colors for facts, amber for uncertainty or attention, and red for verified risk. Meaning must never depend on color alone.

Establish shared tokens in `frontend/src/theme.css` for:

- surface hierarchy
- borders and separators
- text roles
- status roles
- spacing and density
- focus indicators
- responsive breakpoints

Shared primitives remain the default implementation path. Add primitives only where the existing set cannot express the shell or its states.

### Hybrid shell

- Compact global header with brand, `New scan`, `Investigations`, and account/help.
- Main report canvas with a readable maximum width.
- Compact contextual navigation for Overview, Findings, Evidence, Assets, and History.
- Command shortcut entry point for navigation, without making command search mandatory.
- Mobile sticky section selector replacing the contextual side panel.
- Visible focus states, skip navigation, keyboard operation, announced status changes, responsive layouts, and reduced-motion behavior.

The shell is an investigator workspace. Admin navigation remains separate and is not folded into this phase.

## Phase 2: Investigator Vertical Slice

### User flow

1. User enters a domain and submits one standard scan action.
2. The system normalizes the URL while retaining the submitted URL and redirect chain.
3. The system creates one investigation and one active scan session.
4. The interface renders stable capability stages: queued, running, complete, partial, failed, and unavailable.
5. Completed capability results remain visible while other capabilities continue.
6. Partial results render as an actionable report rather than a generic error.
7. Failed or blocked sections support independent retry.
8. The overview organizes results by intent: what this site is, what it exposes, what to inspect next, and what failed or changed.
9. Findings display evidence labels: observed, inferred, request trace, or absence.
10. One expandable evidence presentation exposes supporting request and result details without losing report context.
11. Authenticated investigations auto-save remotely; anonymous investigations retain local continuity.
12. Each investigation permits one active scan session at a time.

### Frontend ownership

`ScanPage` becomes orchestration rather than the home for every concern. Scan/session state moves into focused hooks or services. Report sections become focused components with explicit inputs. Existing scan APIs and contracts remain authoritative unless a missing lifecycle or evidence field prevents the required states.

### Required proof

- A new scan reaches a useful partial result.
- Completed sections remain stable while later capabilities run.
- A failed section retries independently.
- Refresh preserves the investigation.
- A finding opens supporting evidence without losing navigation context.

## Phase 3: Full Shell Migration

### Investigations

Migrate `InvestigationsPage` into the hybrid shell and use the same report language, status vocabulary, evidence labels, and responsive rules as the investigator workspace.

### Admin workspace

Create a dedicated `/admin` shell with separate navigation. Admin opens on an operational inbox rather than a spreadsheet-first dashboard. Initial item types are:

- unsupported namespaces
- discovered assets
- failed scans
- maintenance items

Each item opens evidence-first detail with source, request/result context, status, and next action. Existing capabilities migrate incrementally: unsupported namespaces, assets, registry, scan health, retention, and maintenance. Preserve authorization gates and add server-side authorization wherever current behavior relies too heavily on frontend gating. Defer bulk actions until item-level triage is proven.

### Explicitly deferred

- expiring share links
- JSON, Markdown, and PDF exports
- batch scanning
- full comparison workflows
- bulk admin actions before item-level triage is validated

## State and Error Model

Capability status is explicit and independently rendered. A completed result is not replaced by a later capability's error. Errors distinguish failed execution from blocked or unavailable capability. Retry is scoped to the affected capability and does not reset successful evidence. The interface uses stable stage presentation rather than an event log or a stream of transient toasts.

## Validation

Run typecheck and lint after each structural milestone. Run the frontend build before phase completion. Add focused tests for state transitions, retry behavior, persistence, and evidence rendering. Add Storybook stories for shell states and shared primitives. Perform desktop and mobile walkthroughs covering new scan, partial failure, retry, refresh, and investigation navigation.

Browser or server test infrastructure that is unavailable remains explicitly reported as blocked; unavailable tooling is never treated as a passing gate. Existing R1 validation debt and the four pending authorized live walkthroughs remain open until separately completed.

## Success Measures

- Time to first useful finding.
- Completion and partial-recovery rate.
- Time to understand a finding.
- Reduced navigation and abandonment.
- Successful section retry.
- Repeat investigations with preserved context.

## Non-Goals

This document does not authorize implementation yet, does not rewrite existing contracts speculatively, and does not repair unrelated stale product metadata. It defines the sequence and acceptance shape for the frontend redesign only.
