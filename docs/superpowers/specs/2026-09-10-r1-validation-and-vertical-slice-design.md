# R1 Validation and Vertical Slice Design

Date: 2026-09-10

## Decision

Build and validate one real investigator vertical slice before migrating the
rest of the product. The primary user is a developer investigating a
WordPress site. Validation uses structured self-walkthroughs because this is
currently a solo-user internal tool; future users are not an R1 blocker.

## Scope

R1 covers the complete core scan-to-understanding loop:

1. Open directly to one labeled domain field and one standard scan action.
2. Normalize the submitted URL into a canonical domain identity while keeping
   the submitted URL as evidence.
3. Start one scan session for the investigation.
4. Run capabilities independently with stable progressive states.
5. Show results in layers: site identity, public exposure, then actionable
   findings.
6. Keep completed evidence usable while other capabilities run.
7. Support section-level retry for failed or unavailable capabilities.
8. Persist authenticated investigations.
9. Keep anonymous scans in browser-local storage until expiry and support an
   explicit import or claim after sign-in.
10. Offer sitemap scanning contextually after initial results.

Domain recon remains deferred until provider reliability and user value are
validated. R1 does not migrate admin workflows, add batch scanning, add share
links, or add product analytics instrumentation.

## Validation Matrix

Validation uses four permitted domains:

- Healthy WordPress site: baseline identity and exposure flow.
- Plugin-heavy WordPress site: signal density and evidence hierarchy.
- Partially blocked or authentication-restricted site: failure versus
  unavailable states, retained partial results, and retry behavior.
- Non-WordPress site: normalization, honest non-detection, and no false
  WordPress claims.

For each domain, record:

- Time to first useful result.
- Whether identity, exposure, and actionable layers are understandable.
- Whether evidence labels prevent overclaiming.
- Whether partial results remain usable during failure or retry.
- Whether retry behavior is clear and succeeds where expected.
- Whether contextual sitemap scanning is discoverable and appropriate.
- Whether the investigation resumes or imports correctly.
- Navigation, wording, or evidence confusion.

The gate passes when all four cases complete without a blocking workflow
failure and every observed issue is fixed or explicitly deferred with a
rationale. No arbitrary numerical usability threshold is required for this
solo-user gate.

## Technical Boundaries

- Contracts package owns domain identity, scan session, capability states,
  evidence labels, findings, investigation records, and API envelopes.
- Scan engine owns scheduling, dependency propagation, cancellation, retry
  eligibility, and overall status.
- Capability runners own individual probes and do not orchestrate peers.
- Server boundaries own runtime validation, authorization, persistence, and
  response mapping.
- Investigator UI owns progressive status, summary hierarchy, evidence
  expansion, retry controls, and anonymous local continuity.
- Persistence owns the canonical investigation timeline. Legacy
  capability-shaped response projections are not promoted as the new API.

## Proof Requirements

- Contract tests reject malformed states and persisted records.
- Scan-engine tests cover success, failure, unavailable dependencies, retry,
  cancellation, and incomplete sessions.
- Server tests cover normalization, authorization, persistence, and malformed
  payloads.
- UI tests cover progressive results, partial failure, retry, evidence labels,
  local continuity, and import after sign-in.
- Manual validation runs the four-domain matrix after the real slice works.

## Deferred Decisions

- Whether sitemap should become part of the standard scan.
- Whether domain recon belongs in the investigator workspace or admin tools.
- Analytics event schema and instrumentation, pending a clearer need.
- Admin roles, audit requirements, and broader workspace migration.
