# Session-only scan coordination

Scan coordination exposes a Session interface only: callers use the Scan Session plus start / run / retry, and read capability state via `session.capabilities.<id>`. Capability-named projections (`scanResult`, `homepageResult`, and kin) are removed from the public surface so WordPress and homepage are not privileged over other Capabilities.

Capability Outcomes (persist, log, invalidate) are declared with each Capability as `onSettled`, invoked by the coordinator with injected ports when that Capability reaches a terminal status. User toasts are not Outcomes — a single Session completion notice fires when an execute batch finishes, while status UI updates continuously from the Scan Session.

The React coordinator (`useScan`) owns tokens, merge, Outcomes, and the completion notice; the pure session engine (`scanSession`) keeps wave/status logic; `ScanContext` stays a thin adapter. Activity-log rotation moves out of the scan coordinator. Unifying settings and session options is deferred.

## Considered options

- Keep WordPress/homepage projections for convenience — rejected: teaches a privileged model and fights equal Capabilities.
- Fire per-Capability success toasts — rejected: noisy during concurrent runs; “Scan complete” wrongly implied whole-session done.
- Push Outcomes into `scanSession.execute` — rejected: would thicken the pure engine’s interface with React ports.
- Fold settings/session dual-store into this change — deferred: separate deepening; tracked as follow-up work.
