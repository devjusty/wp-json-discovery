# WP JSON Discovery

Internal investigative utility for profiling a WordPress domain from public surfaces (REST, HTML, SEO, DNS).

## Language

### Scan coordination

**Scan Session**:
The live coordination record for one domain investigation: selected capabilities, each capability's status/result/error, and overall status.
_Avoid_: scan result (ambiguous), scan run (ambiguous with a single capability), job

**Capability**:
One independently runnable investigative probe within a Scan Session (e.g. WordPress API, homepage, sitemap, recon). All capabilities are equal in the session model.
_Avoid_: scan type, plugin (when meaning a probe), privileged scan

**Session interface**:
The surface callers use for coordination: the Scan Session plus start / run / retry actions. Callers read capability state only via `session.capabilities.<id>` — never via capability-named projections on the context. Owned by the React scan coordinator (today `useScan`); `ScanContext` is only a thin adapter; pure wave/status logic stays in the session engine (`scanSession`).
_Avoid_: scanResult, homepageResult, scanError, homepageError as public coordination fields

**Capability Outcome**:
Side effects that run when a Capability reaches a terminal status (success, failure, or unavailable) — persistence, activity logging, cache invalidation. Declared with that Capability (alongside its runner) and invoked by the Scan Session coordinator with injected runtime ports; the coordinator never hardcodes a Capability by name. Excludes user toasts.
_Avoid_: WordPress reporting inside the coordinator, reportWordpressSuccess / reportWordpressError as coordinator concerns

**Session completion notice**:
A single user-facing toast (or equivalent) shown when an execute batch finishes, summarizing Scan Session outcome. Status UI updates continuously from the Scan Session as each Capability settles; per-Capability toasts are not used for normal completion.
_Avoid_: “Scan complete” toast tied only to the WordPress Capability, per-Capability success toasts during a multi-Capability run
