# WP JSON Discovery Product Roadmap

## Goal
Deliver the best scanner-first WordPress discovery experience with strong triage tooling, while keeping optional scheduling and alerting as secondary tracks.

## Planning assumptions
- Team: 1-2 engineers.
- Current stack remains: Express + Turso (libSQL) + React.
- Focus on practical, shippable increments with low operational risk.

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
1. P0.1 Retention guardrails (finish hardening + operator controls).
2. P1.6 Asset intelligence workflow (build on current asset-only plugin flow).
3. P0.2 Homepage security-header analysis section.
4. P1.7 Scan profiles.
5. P0.3 Change detection + webhook alerts (optional track).
6. Remaining P1/P2 items based on user adoption.

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
