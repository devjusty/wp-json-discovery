# Product Redesign Brief

## Decision

Rebuild frontend and backend together around a simpler investigator workflow and a separate admin workspace. Re-evaluate every current capability rather than carrying the existing product forward by default.

This is a product reset, not a visual reskin. The first release must prove the complete scan-to-understanding loop with real scan behavior before migrating every existing report and tool.

## TypeScript Strategy

Introduce TypeScript incrementally as part of the redesign, not as a separate big-bang migration afterward. The redesign creates natural boundaries for new contracts while allowing legacy JavaScript to keep running during the transition.

Migration shape:

1. Add TypeScript configuration and type-check commands for frontend and backend without requiring immediate conversion of existing files.
2. Build new redesign modules as `.ts` and `.tsx` files. Keep untouched legacy JavaScript operational.
3. Type high-value boundaries first: scan sessions, capability outcomes, API request and response contracts, progressive scan states, investigations, and admin operations.
4. Convert legacy modules when the redesign touches them instead of creating a separate conversion pass.
5. Increase strictness gradually, with migrated areas reaching `strict: true` before broader adoption.

TypeScript types do not replace runtime validation. Server boundaries must still validate domains, authentication data, persisted records, and API payloads at runtime.

## Product Model

- **Investigator workspace**: low-friction domain discovery for developers, marketers, security analysts, SEO researchers, and designers.
- **Admin workspace**: `/admin` shell for operational triage, registries, assets, scan history, health, and system controls.
- **Investigation**: one canonical domain with an immutable timeline of scan observations.
- **Scan session**: one active scan for an investigation, made of independently running capabilities with explicit status, result, error, or unavailable state.
- **Finding**: an actionable conclusion grouped by investigator question and linked to its supporting evidence.
- **Evidence**: observed data, inference, request trace, or explicit absence/unavailability. Evidence must never imply that an unavailable probe found nothing.

URL normalization creates a canonical target identity for common protocol and hostname variants. The submitted URL and redirect chain remain evidence. Subdomains remain separate targets unless evidence establishes canonical equivalence.

## Investigator Workflow

1. Open directly to one domain field and one standard scan action.
2. Normalize the submitted domain or URL automatically and start the scan without configuration ceremony.
3. Show stable progressive scan stages as capabilities settle. Do not replace this with an event log or per-capability toast stream.
4. Keep completed evidence usable while remaining capabilities run.
5. If a capability fails or is blocked, show the partial report, label the state explicitly, and offer section-level retry.
6. Land on an intent-based signal summary: what the site is, what is exposed, what deserves inspection, and what changed.
7. Rank findings by consequence, evidence quality, and novelty. Expand first-level evidence inline; use dedicated detail views only for large payloads or traces.
8. Keep one active scan per investigation. Users can leave and resume; background concurrency and batch work are separate workflows.
9. Auto-save scans into the domain investigation for authenticated users. Anonymous scans remain locally available until sign-in or expiry; sign-in is optional and never blocks the first scan.

## Navigation

Global investigator shell stays small:

- New scan
- Investigations
- Account and help

Each investigation has a compact section rail that can include Overview, Findings, Evidence, Assets, History, and contextual Tools. Mobile replaces the rail with a sticky section selector and converts dense tables into stacked evidence rows without removing investigative capability.

## Admin Workflow

`/admin` uses a dedicated shell and navigation. Admin home is an operational inbox showing unresolved unsupported namespaces, newly discovered assets, failed scans, and maintenance actions before metrics or configuration.

Admin triage is evidence-first and item-oriented: inspect one item, review its source context and affected domains, take an action, and mark it resolved. Safe bulk actions can be added where repetition is proven, but spreadsheet management is not the default.

## Trust, Accessibility, and Visual Language

- Separate observed, strongly inferred, possible, and unknown states with plain labels.
- Use a dark investigative workspace with restrained surfaces and one interactive accent.
- Use neutral styling for facts, amber for uncertainty or attention, and red only for verified risk. Never rely on color alone.
- Use one readable sans family for UI and deliberate monospace for URLs, paths, payloads, and identifiers.
- Use native controls, visible focus states, skip navigation, keyboard-complete workflows, announced dynamic status, and responsive reflow at narrow widths.
- Keep motion restrained and honor reduced-motion preferences.

## Capability Reset

Before removing or retaining current features, build an evidence-led capability inventory using:

- Privacy-preserving product events such as scan starts, stage completion or failure, section opens, retries, and time to first useful result.
- Existing scan and activity logs, without collecting domain names or payloads as product analytics.
- Short interviews or task tests with representative investigators and admins.

The redesign must preserve no capability merely because it exists. It must also avoid deleting rare but high-value investigative paths without validating their use and failure cost.

## First Vertical Slice

The first slice includes the complete core loop:

- Opening screen and labeled domain input.
- URL normalization and one standard scan action.
- Progressive capability status.
- Partial failure and section retry.
- Intent-based summary with evidence-level labels.
- One expandable evidence presentation.
- Investigation persistence and return to the investigation list.

The backend rewrite should establish stable domain concepts rather than expose legacy capability-shaped response projections. Scan behavior, persistence, retry, and availability states must be testable independently from presentation.

## Success Measures

- Time to first useful finding.
- Scan completion and partial-recovery rates.
- Time to correctly understand a finding.
- Unnecessary navigation and abandoned scans.
- Successful retry of failed capabilities.
- Repeat investigation use.

## Deferred Roadmap Options

- Controlled, read-only share links with expiration and revocation.
- Export files such as JSON, Markdown, or PDF.
- Batch scanning and queued multi-domain workflows.
- Full comparison and change-detection workflows after stable evidence identifiers exist.
