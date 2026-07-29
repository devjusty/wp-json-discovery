# Configurable Scan Workflow Design

## Summary

Replace the current fixed scan flow with a capability-driven workflow. The
initial scan should use a system-recommended baseline, allow users to adjust
the selected scans before starting, and expose additional scans after the
initial run. Each selected scan runs independently and reports its own state.

The first implementation focuses on frontend orchestration and UI state. It
keeps existing server endpoints and avoids redesigning scan history or account
preferences.

## Goals

- Give users a useful recommended baseline without requiring configuration.
- Let users override scan selection before each run.
- Save selected scan defaults in browser storage for anonymous users.
- Establish an account-sync-compatible settings contract without adding an
  account preference API in this iteration.
- Run independent scans concurrently and preserve partial results.
- Make section availability reflect capability state rather than whole-scan
  completion.
- Allow users to run or rerun additional scans from the overview and relevant
  result sections.
- Keep existing server scan endpoints working unchanged.

## Non-goals

- New server scan endpoints.
- Account preference persistence or sync implementation.
- Scan-history redesign.
- Credentialed, batch, scheduled, or scored scans.
- Broad visual redesign unrelated to scan selection and state.

## User Workflow

1. User enters a domain.
2. The scan settings disclosure shows capabilities with the recommended
   baseline preselected.
3. User may select or deselect capabilities and save the selection as their
   default.
4. Starting a scan snapshots the selected capabilities and their options.
5. Selected capabilities run concurrently unless metadata declares a
   dependency.
6. Results become available as individual capabilities complete.
7. Failed capabilities remain visible with an actionable retry control.
8. Overview and relevant sections expose additional scan and rerun controls.

Saved defaults use browser local storage first. The stored shape must be
versioned and contain capability IDs and capability options, not domains,
results, or transient status. When account synchronization is introduced, the
same shape can be sent to the account preference API.

## Capability Registry

Create one registry in the frontend service/orchestration layer. Each
capability entry defines:

- Stable capability ID.
- Display label and concise description.
- Result section ID.
- Estimated cost or cost class.
- Runner function.
- Dependencies, when applicable.
- Whether it is eligible for the recommended baseline.
- Availability rules.
- Default options and option validation.

The registry is the source of truth for scan settings, default recommendation,
execution planning, status rendering, section availability, and additional
scan navigation. UI components must not maintain separate hardcoded lists of
scan capabilities.

The recommendation algorithm chooses a baseline from capability metadata and
cost/value rules. It must have a deterministic fallback if metadata is
incomplete. The exact scoring formula belongs in the implementation plan and
must be covered by registry tests.

Existing core, homepage, and sitemap behavior should initially be wrapped as
capability runners. Sitemap options such as URL override and maximum pages
remain capability-specific options.

## Scan Session State

`ScanContext` owns the active domain and current scan session. `useScan`
becomes the session coordinator instead of representing only the fixed core
scan.

The session contains:

- Active domain.
- Snapshot of selected capability IDs.
- Snapshot of capability options.
- Per-capability state.
- Per-capability result or normalized error.
- Overall session state.

Per-capability states are:

- `idle`
- `queued`
- `running`
- `success`
- `failed`
- `unavailable`

Overall session states are:

- `idle`
- `running`
- `complete`
- `incomplete`

Any selected capability failure makes the overall session `incomplete`, while
successful capability results remain usable. Unavailable capabilities are
distinct from failures and should explain why they cannot run.

Starting a scan snapshots selection and options. Later settings changes cannot
mutate an active session. Changing domains invalidates the previous session so
results from different domains cannot appear together.

## Execution

The coordinator builds an execution plan from the selected capabilities and
their dependencies. Independent capabilities run concurrently. Dependencies
must complete successfully before dependent capabilities run; a blocked
dependent capability becomes `unavailable` with a clear reason.

A runner failure is normalized to:

```js
{
  code,
  message,
  retryable,
}
```

Retrying a capability reruns only that capability, updates only its result and
status, and recalculates the overall session state.

The existing API routes remain unchanged in this phase. The coordinator may
call the current core, homepage, and sitemap client/service functions through
small runner adapters.

## UI Changes

### Initial Form

- Keep domain input as the primary control.
- Add a compact `Scan settings` disclosure.
- Preselect the recommended baseline and label it `Recommended`.
- Show concise value and cost hints for optional capabilities.
- Provide `Save as default` for the current selection.
- Prevent settings changes from changing an active session.

### Status

Replace separate main-scan and homepage status cards with one session summary
and per-capability statuses. The summary shows running, complete, or
incomplete state. Per-capability entries show progress, success, failure, or
unavailability and expose retry when appropriate.

### Navigation

Sidebar availability is driven by capability state. Completed sections are
available immediately, failed sections remain navigable, and unavailable
sections explain their prerequisite or reason. The sidebar must not disable all
sections merely because another capability is still running.

### Additional Scans

Overview includes an `Additional scans` panel. Relevant sections may also
expose scan or rerun controls. Both surfaces use registry metadata and invoke
the same coordinator path, avoiding separate lifecycle logic.

## Error Handling

- Continue independent capabilities after a failure.
- Preserve successful results and make them navigable.
- Mark the overall session `incomplete` when any selected capability fails.
- Provide retry for retryable failures.
- Distinguish failure, unavailable, and not-yet-run states.
- Clear or invalidate stale results on domain changes.
- Validate stored capability IDs and ignore unknown IDs safely.
- Fall back to deterministic recommended defaults if stored settings are
  malformed or unavailable.

## Testing Strategy

### Registry

- Recommended baseline is deterministic.
- Selection validation removes unknown capability IDs.
- Defaults and options are validated.
- Dependencies and availability rules are represented correctly.

### Coordinator

- Selected capabilities execute concurrently when independent.
- Dependencies gate dependent capabilities.
- One failure does not cancel independent capabilities.
- Partial success produces `incomplete` overall state.
- Retry updates only the targeted capability.
- Domain changes invalidate stale session data.

### UI

- Recommended settings are preselected.
- Saved defaults persist and restore from browser storage.
- Malformed or obsolete stored settings fall back safely.
- Settings are snapshotted on start.
- Navigation reflects per-capability state.
- Partial results and failed sections remain usable.
- Additional scan and retry controls invoke the coordinator.

Existing scan, homepage, sitemap, server, lint, and frontend build checks
remain regression gates.

## Implementation Boundaries

First implementation includes:

- Capability registry.
- Session coordinator and state model.
- Local default persistence.
- Initial settings UI.
- Status-aware sidebar, status stack, and result sections.
- Homepage and sitemap integration with the session model.

First implementation excludes:

- Server endpoint changes.
- Account preference API changes.
- Scan history changes.
- New scan types.
- General visual redesign.

## Open Implementation Decisions

The implementation plan must resolve, with tests and existing code patterns:

- Exact capability IDs and registry location.
- Recommendation scoring and cost classes.
- Dependency representation and blocked-state behavior.
- Versioned local-storage key and migration behavior.
- Whether account sync gets a no-op adapter or only a documented future
  boundary.
- Exact result-shape adapter needed to expose existing core, homepage, and
  sitemap data through session state.
