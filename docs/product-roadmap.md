# WP JSON Discovery Product Roadmap

## Goal
Deliver the best scanner-first WordPress discovery experience with strong triage tooling, while keeping optional scheduling and alerting as secondary tracks.

## Planning assumptions
- Team: 1-2 engineers.
- Existing Express + Turso (libSQL) + React stack is the starting point, not a rewrite constraint.
- Focus on practical, shippable increments with low operational risk.

## From-scratch redesign track

The product reset is documented in [`product-redesign-brief.md`](product-redesign-brief.md). It replaces the current frontend-first assumption with a coordinated frontend and backend rewrite, while requiring a complete working slice before broad migration.

### Phase R0: Capability inventory and contracts

- Inventory every current investigator and admin capability.
- Measure privacy-preserving workflow events, scan logs, and failure cost.
- Validate high-value and low-frequency workflows with representative users.
- Define canonical concepts: investigation, scan session, capability, finding, evidence, availability, and retry.
- Decide which capabilities are retained, redesigned, deferred, or removed.

### Phase R1: Core scan-to-understanding loop

- Build direct-open investigator entry with one domain field and standard scan action.
- Normalize URL identity while retaining submitted URL and redirect evidence.
- Rebuild scan orchestration around independently observable capability states.
- Deliver progressive results, partial failure handling, section retry, and evidence-level labels.
- Deliver intent-based summary, inline evidence expansion, authenticated persistence, and local anonymous continuity.
- Add the compact investigator shell and searchable investigation list.

### Phase R2: Investigator workspace migration

- Migrate validated report sections into the investigation section rail.
- Add contextual tools, assets, history, and comparison only after their capability inventory case is clear.
- Adapt dense evidence surfaces for mobile without hiding investigative depth.
- Verify keyboard, screen-reader, zoom, reduced-motion, and narrow-width workflows.

### Phase R3: Admin workspace migration

- Build dedicated `/admin` shell and operational inbox.
- Migrate unsupported namespace, asset, registry, scan health, retention, and maintenance workflows.
- Keep item-level evidence review as default; add only validated bulk actions.
- Add server-side authentication and authorization for admin operations and private history.

### Deferred redesign options

- Controlled read-only share links with expiration and revocation.
- JSON, Markdown, or PDF exports.
- Batch scanning and queued multi-domain workflows.
- Full change comparison after stable evidence identifiers exist.

## Current status (March 2026)
- Completed:
  - Turso-first persistence migration (unsupported plugins, activity logs, scan history, plugin/theme registries).
  - Scan + History + Admin UI overhaul with dark-default theme and modular sections.
  - Domains tracked now sourced from scan history (includes attempted/failed scans).
  - Asset-only plugin signal workflow wired into Unsupported -> Plugin Manager create/edit flow.
  - Turso diagnostics surfaced in Admin DB section (health/stats/usage/instances) with graceful fallback.
  - Logging guardrails implemented: compact `scan.complete` payloads, `proxy.response` sampling/gating, archive retention cleanup on rotate.
- In progress:
  - Security-header analysis panel for Homepage scan.
  - Additional retention/observability refinements.

## P0 (Highest Value, Near-Term)

### 1) Data retention + storage guardrails
- Outcome: stable long-running operation and predictable storage usage.
- Scope:
  - Configurable retention by category (activity, scans, heartbeat).
  - Hard caps + warning thresholds in Data Health card.
  - Auto-prune jobs with audit entries.
- Effort: 2-4 days.
- Dependencies: current prune + maintenance endpoints.

### 2) Homepage security-header analysis
- Outcome: immediate visibility into CSP/HSTS/XFO/XCTO and related header posture.
- Scope:
  - Parse and normalize key security headers in homepage scan responses.
  - Add security header panel with critical-missing summary and values.
  - Keep storage/logging compact with summary-only persistence.
- Effort: 2-3 days.
- Dependencies: homepage scan response model and scan UI panels.

### 3) Change detection + alerts (deferred)
- Outcome: users are notified only when meaningful changes happen.
- Scope:
  - Persist normalized snapshot hashes per domain.
  - Compute deltas (unsupported namespaces, plugin/theme changes, endpoint failures).
  - Add alert channels (webhook first, Slack/email second).
  - Add alert suppression window to avoid spam.
- Effort: 4-6 days.
- Dependencies: scan snapshots, activity log payloads.

## P1 (High Impact, Next)

### 4) Domain health score + trend view
- Outcome: quick at-a-glance site status and prioritization.
- Scope:
  - Composite score from freshness, failures, unsupported trend, latency trend.
  - Per-domain trend chart and score history.
  - Filters for “degrading” and “needs attention”.
- Effort: 4-6 days.
- Dependencies: heartbeat metrics + scan history.

### 5) Detection confidence and evidence
- Outcome: fewer false positives and faster triage.
- Scope:
  - Per finding confidence score (namespace, asset hint, recurrence, recency).
  - Evidence panel on each finding.
  - “Needs review” state for low-confidence detections.
- Effort: 3-5 days.
- Dependencies: plugin/theme registry + homepage asset aggregation.

### 6) Asset intelligence workflow
- Outcome: unknown assets become usable detection signals quickly.
- Scope:
  - Unknown asset queue with frequency and affected domains.
  - Promote asset -> plugin/theme hint directly from Admin.
  - Preview impact before saving.
- Effort: 3-5 days.
- Dependencies: plugin/theme manager and asset logs.

### 7) Scan profiles (Fast / Standard / Deep)
- Outcome: better control of speed vs coverage.
- Scope:
  - Profile presets for timeout, endpoints, retries, homepage depth.
  - Per-domain profile assignment.
  - Profile override for one-off scans.
- Effort: 2-4 days.
- Dependencies: scan service refactor to parameterized config.

## P2 (Strategic, Platform Maturity)

### 8) API + exports for external reporting
- Outcome: data can feed BI tools and external systems.
- Scope:
  - Filtered API endpoints for trends and findings.
  - CSV/JSON exports with date ranges.
  - API token auth for external consumers.
- Effort: 4-7 days.
- Dependencies: stable schema and retention strategy.

### 9) Multi-user auth + admin audit trail
- Outcome: safer shared operations and accountability.
- Scope:
  - Role-based access (viewer/operator/admin).
  - Action audit log (maintenance, prune, plugin edits, retries).
  - Session/auth hardening.
- Effort: 6-10 days.
- Dependencies: deployment/auth strategy decision.

### 10) Explain-a-finding assistant
- Outcome: less manual interpretation and quicker handoff.
- Scope:
  - Per-namespace “why this was flagged” summary.
  - Suggested candidate plugin mappings and remediation hints.
  - Links to related domains and trend context.
- Effort: 3-5 days.
- Dependencies: confidence model + evidence storage.

## Recommended execution sequence
1. R0 Capability inventory and contracts.
2. R1 Core scan-to-understanding loop.
3. R2 Investigator workspace migration.
4. R3 Admin workspace migration.
5. Resume validated P0/P1 platform work, including retention guardrails and security-header analysis.
6. Reconsider deferred options based on adoption and measured workflow friction.

## Success metrics
- Scanner completion rate for initiated runs (target: >98%).
- Mean time to detect changes (target: <1 scan cycle).
- Alert precision (true actionable alerts / total alerts).
- Storage growth rate after retention controls.
- Time-to-triage for unsupported namespaces.

## Risks and mitigations
- Risk: alert fatigue.
  - Mitigation: delta-only alerts + suppression windows + severity levels.
- Risk: scan load spikes and endpoint blocking.
  - Mitigation: queue concurrency limits, jitter, and backoff.
- Risk: false detections.
  - Mitigation: confidence scoring + evidence transparency + review state.
- Risk: data bloat.
  - Mitigation: retention policies, pruning, and maintenance automation.
