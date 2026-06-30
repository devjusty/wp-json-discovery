# Event-Class Retention Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable log retention by event class so high-value evidence stays available longer than noisy telemetry without changing the current Turso-backed logging model.

**Architecture:** Keep retention enforcement in the Render API where pruning already happens. Classify log rows by event type, apply a retention policy map with safe defaults, and prune from Turso only after the class-specific retention window is satisfied. Netlify remains display-only; it consumes whatever the API reports after pruning.

**Tech Stack:** Express 5, Turso/libSQL, Node.js, existing logger/prune pipeline in `server/src/logger.js` and `server/src/index.js`.

---

## Scope

This change affects event retention only. It does not change how logs are captured, how heartbeat rows are summarized, or how frontend surfaces display retained data.

The deployment model stays the same:
- Render hosts the API and owns pruning.
- Turso stores the rows being pruned.
- Netlify does not participate in retention decisions.

## Retention Model

Retention is class-based with a baseline fallback.

### High-value classes

These should remain available longer because they are used for debugging and evidence:
- `scan.error`
- `homepage-scan.error`
- `sitemap.scan.error`
- `proxy.error`
- `metrics.heartbeat`

### Noisy classes

These can be retained for a shorter period because they are high-volume or low-signal:
- `proxy.response`
- any other bulk telemetry classes already emitted by the logger

### Default behavior

Unknown classes keep the current retention behavior. If a row does not match a special class rule, the existing prune logic applies unchanged.

## Data Flow

1. The logger continues to persist rows into `activity_logs` in Turso.
2. The prune endpoint in `server/src/index.js` determines which rows are eligible for deletion.
3. A retention helper in `server/src/logger.js` (or a small adjacent config helper) maps event type to a retention window.
4. The prune path deletes only rows older than the class-specific cutoff.
5. The admin heartbeat and log summary views continue to read the same tables and reflect what remains.

## Implementation Shape

### Policy helper

Add a small helper that accepts an event type and returns the retention window for that class.

The helper should:
- recognize exact event classes where needed
- fall back to prefix-based matching for related events when appropriate
- default to the existing retention window when no class matches

### Pruning path

Update the existing activity pruning flow so it evaluates rows against the helper before deletion.

The pruning code should:
- keep the current global retention behavior as the baseline
- apply longer windows to high-value classes
- apply shorter windows to noisy classes
- never shorten retention for critical evidence below the existing baseline unless explicitly configured

### Config

Use code-defined defaults first.

Optional env overrides may be added later if needed, but they are not required for the first pass. This avoids introducing a second configuration system before the class rules are proven useful.

## Error Handling

- Unknown classes must not break pruning.
- Invalid policy values should fall back to the current retention behavior.
- Prune failures should continue to surface as admin/API errors and should not partially delete rows without a consistent rule.

## Testing

Add tests that prove:
- high-value classes survive longer than noisy classes
- unknown classes still use the existing default retention
- the prune path does not delete critical evidence earlier than intended
- the policy helper is deterministic for known event classes

## Acceptance Criteria

- Retention can vary by event class.
- Defaults preserve current behavior for unknown classes.
- Critical evidence classes are retained longer than noisy classes.
- The existing Turso-backed logging flow still works.
- Tests cover the policy helper and pruning behavior.
