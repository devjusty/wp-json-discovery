# R0 Research Brief

Date: 2026-09-09

This brief supports R0 capability decisions. It does not report user research that did not happen. It separates repository observations, design assumptions, and research still required.

## Existing scan-log observations

Repository evidence: `server/data/activity.log` contains 16 recent records at review time. It includes successful scan completions, scan timeout and authentication-required failures, a blocked cross-host redirect, invalid sitemap-host validation, successful and unavailable recon outcomes, an activity prune, a plugin-registry mutation, and an admin-disabled response. Domain values are intentionally omitted here.

Client-event allowlisting and payload route validation happen in `server/src/index.js`; the logger implementation (`server/src/logger.js`) derives failure categories, suppresses repeated errors, sanitizes strings/objects, summarizes large text, and persists accepted records to file and DB. `server/src/utils/activityRetention.js` applies event-specific retention plus count limits. These are operational safeguards, not proof of frequency, user value, or workflow success.

Observed implementation implications:

- Failure states are meaningful and varied: timeout, auth restriction, network/redirect policy, validation, missing provider configuration, and disabled admin configuration.
- Scan completion is compacted for persistence, so stored history is a summary and not a complete capability evidence archive.
- The current log contains records with production-like and fixture-like values. This is an interpretation of their shape; provenance of each record is not encoded.
- `metrics.heartbeat` is periodic and aggregate. It is not a user-level funnel or usability measure.

Sources: `server/data/activity.log`, `server/src/logger.js`, `server/src/utils/activityRetention.js`, `server/src/index.js`.

## Privacy-preserving workflow-event observations

No privacy-preserving product-event dataset was found. Current allowlisted operational events include scan start/complete/error, homepage and sitemap completion/error, unsupported persistence attempts, and log operations. They may include normalized domains in operational storage. This is not evidence that users opened sections, retried capabilities, found a useful result, or returned to an investigation.

Design assumption for R0 validation, not an observed fact: measure workflow mechanics with coarse events such as scan started, first useful finding, capability settled, section opened, retry requested/completed, scan abandoned, and investigation reopened. Keep events free of domain names, payloads, HTML, raw URLs, notes, email addresses, and finding text. Aggregate or hash only where there is a documented need. Do not add instrumentation in this task.

Source constraints: `docs/product-redesign-brief.md` requests privacy-preserving events; `server/src/index.js` and `server/src/logger.js` describe current operational event handling; no analytics schema or event export was found.

## Task walkthrough and interview notes

No interviews, moderated tests, or user-provided walkthrough notes are present in this repository. The following is a static walkthrough reconstructed from current routes/components and approved redesign decisions. It is a hypothesis to validate, not an observed user account.

### Opening a scan

Current path: `App.jsx` routes to `ScanPage`; `DomainForm` accepts a domain and starts `useScan`; `scanCapabilities.js` normalizes selection and always includes WordPress; `scanSession.js` creates the session. The redesign assumes one domain field plus one standard action is lower friction than current optional capability settings. Validate time to first useful result and invalid-domain recovery with representative investigators.

### Finding evidence

Current path: `ScanSectionContent.jsx` maps session results into Overview, Exposure, Performance, Content, Homepage, Sitemap, Core, Plugins, and Unsupported panels. Evidence includes response statuses, timings, routes, counts, headers, extracted signals, and inference-like plugin/theme matches. The redesign assumes users need an intent-based summary first, with first-level evidence inline and large traces/details on demand. Validate whether labels for observed, inferred, possible, and unavailable prevent overclaiming.

### Recovering from partial failure

Current path: `executeScanSession` runs independent capabilities with `Promise.allSettled`; failed dependencies become unavailable; `retryCapability` retries only failed/unavailable selected capabilities; `ScanStatusStack` and sections expose status/retry UI. Log evidence confirms timeout, auth, validation, provider-unavailable, and admin-disabled cases exist. The redesign assumes completed evidence should remain usable while a failed section is retried. Validate whether users understand the difference between failed, unavailable, and not run.

### Returning to prior investigations

Current path: admin-only `HistoryPage` searches/paginates domain summaries and runs; authenticated users have `MyScansPage` and recent runs; user scans and notes are stored through `server/src/routes/userScans.js` and `userNotes.js`. The redesign assumes history should be an authenticated investigation timeline, while anonymous scans remain locally available until expiry. Validate ownership expectations, resume behavior, and whether domain-level history is sufficient.

## Capability decisions supported by evidence

- Retain REST, homepage, and core supporting probes because they directly implement the product job described in `CONTEXT.md` and the first vertical slice in `docs/product-redesign-brief.md`.
- Redesign scan coordination, findings/evidence, history, persistence, unsupported triage, registries, and asset intelligence because current code exposes capability-shaped panels and admin tables, while approved design requires canonical investigations, evidence quality, progressive status, and item-oriented admin triage.
- Defer domain recon because it is admin-only and externally configured; the log shows provider unavailability, but contains no value or usage evidence.
- Retain maintenance, retention, and operational logs because they protect system reliability and already expose explicit failure/retention behavior; keep them outside investigator flow.
- Retain authentication boundaries while redesigning their contracts and deployment shape because anonymous scanning, authenticated persistence, and admin authorization are explicit product requirements and security invariants.
- Make no `removed` decision: repository evidence shows implementation and failure paths, but not usage or failure cost. Removal requires validation, especially for rare investigative paths.

## Workflow friction

Repository-supported friction:

- Investigator navigation is section-heavy and WordPress-result-centric even though the approved model treats capabilities equally (`CONTEXT.md`, `ScanSectionContent.jsx`).
- Sitemap is optional and costlier than the recommended baseline, but its controls and results are mixed with the main scan sections (`scanCapabilities.js`, `SitemapSection.jsx`).
- Full history is admin-only, while personal saved scans/recent runs are separate surfaces (`App.jsx`, `HistoryPage.jsx`, `MyScansPage.jsx`).
- Current summaries can encode failed probes as false-like availability values, risking confusion between “not exposed” and “could not check” (`scan.js`).
- Admin has many sections and CRUD tables; the approved brief calls for an operational inbox and evidence-first item review (`AdminPage.jsx`, `docs/product-redesign-brief.md`).

Research hypotheses, not observations:

- Users may need fewer configuration decisions before first scan.
- Users may miss useful completed evidence if progress is represented as navigation rather than a stable progressive session.
- Retry may be hard to trust if dependency-unavailable and direct failure are not explained in plain language.

## Confidence

- High confidence: current capability boundaries, inputs/outputs, routes, auth gates, session transitions, and retention behavior, because they are directly visible in source and tests.
- Medium confidence: operational failure categories, because the log contains examples but is small, mixed-provenance, and not a representative sample.
- Low confidence: user priority, capability usage, time-to-value, comprehension, abandonment, and return behavior, because no interviews, workflow telemetry, or validated product analytics are present.

## Unresolved questions

- Which findings are most valuable to each investigator role, and what qualifies as “first useful finding”?
- Should sitemap be offered as a default capability after measuring cost and recovery value, or remain contextual?
- What evidence threshold justifies reintroducing domain recon, and can its provider be made reliable and permission-safe?
- Which registry and asset actions are frequent enough for bulk operations or export?
- What is the retention and deletion policy for investigation evidence, notes, operational logs, and anonymous local scans?
- How should authenticated users merge anonymous local work with server investigations without duplicating or leaking domains?
- Which admin roles, audit requirements, and deployment constraints replace browser-attached admin API keys?
- Can current compact scan history support meaningful change detection, or must R1 persist stable evidence identifiers first?

## Evidence limitations

This brief uses `docs/scan-capabilities.md`, `CONTEXT.md`, `docs/product-redesign-brief.md`, `frontend/src/services/scanCapabilities.js`, `scanSession.js`, `scan.js`, frontend page/components, server routes, middleware, utilities, logger code, and the current activity log. It does not use personal data, external analytics, interviews, or new instrumentation. Source inspection establishes what the product can do, not whether people use it or whether each capability solves its intended job.
