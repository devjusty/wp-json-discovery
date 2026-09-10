# R0 Contracts and Capability Inventory Design

## Goal

Prepare the frontend and backend rewrite with shared domain contracts, explicit capability semantics, runtime validation, and evidence-led migration boundaries before building the redesigned UI.

## Scope

R0 is one bounded design-and-contract package. It covers:

- An inventory of current investigator and admin capabilities.
- Canonical concepts for investigations, scan sessions, capabilities, findings, evidence, availability, and retry.
- Redesigned API request and response contracts.
- Runtime validation rules at trust boundaries.
- Migration seams for current JavaScript services and future TypeScript modules.
- Lightweight research using logs, privacy-preserving product events, and a small number of task walkthroughs or interviews.
- R0 exit criteria and measures for R1 readiness.

R0 does not redesign the UI, migrate the whole repository to TypeScript, formalize every legacy API response, or implement deferred sharing, exports, batch scanning, or comparison features.

## Architecture

Create a workspace package named `@wp-json-discovery/contracts` under `packages/contracts`. The package owns Zod schemas and inferred TypeScript types only. It does not own transport, authentication, retries, persistence, or UI behavior.

The package compiles to ESM JavaScript plus declaration files. This lets the current Node JavaScript server consume runtime schemas without requiring Node to execute TypeScript directly, while Vite can consume the typed package from the frontend.

Frontend and server remain responsible for their local orchestration. Shared contracts are introduced at matching seams in `scanSession` and `scanCapabilities` without rewriting their existing behavior. New redesign production modules use `.ts` and `.tsx`; legacy modules are converted only when redesign work touches them.

## Contract Scope

R0 defines redesigned API contracts only. Existing capability-shaped response projections remain legacy implementation details and are not frozen as the future API. Legacy inputs are validated when a migration slice touches their boundary.

Initial schemas and inferred types cover:

- Canonical domain identity and submitted-versus-normalized URL evidence.
- Investigation identity, ownership, timestamps, and scan history references.
- Scan session lifecycle and progressive overall status.
- Capability identity, dependencies, availability, execution status, and retry state.
- Findings with consequence, evidence level, novelty, and supporting evidence references.
- Redesigned API request and response envelopes.
- Persisted investigation and session records.

Use discriminated unions for state-bearing values so unavailable, failed, partial, and successful outcomes remain distinguishable. Keep schemas at trust boundaries; do not create schemas for every internal helper or UI prop.

## Validation Flow

The following is the intended R1 flow, not a claim about R0 runtime wiring. R0 validates the frontend session seam and server domain boundary only. API request/response, persistence, authentication, and capability-outcome validation are defined by these schemas but remain deferred until redesigned server surfaces exist in R1.

1. The investigator submits a domain.
2. Frontend normalizes the domain and sends the redesigned request shape.
3. [R1] Server validates the request with the shared schema before scan work begins.
4. [R1] Server emits capability outcomes using shared outcome schemas.
5. [R1] Persistence validates investigation and session records before writes and after reads.
6. [R1] Frontend validates received payloads before rendering.
7. [R1] Malformed responses become explicit unavailable or error evidence rather than silent rendering failures.

TypeScript types do not replace runtime validation. Domains, authentication data, persisted records, and API payloads remain untrusted at their respective boundaries.

## Research

Record R0 findings in one dated brief: `docs/research/2026-09-09-r0-research-brief.md`.

The brief should combine:

- Existing scan logs and privacy-preserving workflow-event observations.
- A few task walkthroughs or interviews focused on opening a scan, finding useful evidence, recovering from partial failure, and returning to prior investigations.
- Capability decisions: retained, redesigned, deferred, or removed.
- Observed workflow friction and confidence level for each conclusion.

Do not collect unnecessary personal data. Research informs prioritization and contracts; it does not become a new analytics subsystem in R0.

## Migration Seams

- `@wp-json-discovery/contracts` is the only shared frontend/server dependency introduced for domain contracts.
- Current service behavior remains intact while shared types and schemas are added at boundaries.
- New API handlers consume and return contract schemas.
- Existing JavaScript can import compiled runtime schemas without conversion.
- TypeScript strictness increases per migrated area; project-wide strict mode is not an R0 requirement.
- Frontend and server must each consume at least one shared contract before R0 closes.

## Testing

Contract tests cover:

- Valid redesigned requests and responses.
- Malformed external domain and API input.
- Successful, partial, failed, and unavailable capability outcomes.
- Retry state and dependency propagation.
- Persisted-record validation on both write and read.
- Frontend handling of malformed or unavailable payloads.
- ESM runtime imports from the current JavaScript server.

Existing scan behavior tests remain authoritative for unchanged orchestration. R0 does not require converting those tests to TypeScript.

## Success Criteria

R0 is complete when:

- Every current investigator and admin capability is classified as retained, redesigned, deferred, or removed.
- Canonical domain concepts and redesigned API contracts are documented and implemented.
- Zod schemas compile to ESM and declarations, with inferred types available to both workspaces.
- R0 runtime validation at the frontend session and server domain seams is covered by tests; API, persistence, auth, and capability-outcome wiring remain R1 work.
- Shared contracts are consumed by both frontend and server at real boundaries.
- One research brief records available log/event observations, static walkthrough hypotheses, and the explicit absence of human validation evidence.
- R1 can begin without inventing session, capability, finding, evidence, or availability semantics during UI implementation.

R1 success measures should prioritize time-to-useful-finding, scan completion, comprehension of evidence levels, recovery from partial failure, navigation friction, and repeat investigation use.
