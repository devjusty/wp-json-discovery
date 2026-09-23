# WP JSON Discovery Investigation Architecture

## Status

Approved design direction. This document supersedes the page-oriented implementation direction in `2026-09-23-frontend-redesign-design.md` and its associated implementation plan.

## Goal

Rebuild WP JSON Discovery around a shared investigation domain and domain-owned modules so the investigator workflow, admin workflow, scan execution, persistence, and evidence model have clear seams that can be migrated incrementally.

This is a full-stack architecture target. Existing frontend pages, server routes, scan runners, and persistence implementations are migration inputs rather than architectural constraints.

## Architectural Choice

Use domain-first vertical slices.

1. Define shared investigation, capability, finding, evidence, persistence, and authorization contracts.
2. Implement lifecycle and adapter seams around existing scan behavior.
3. Build the investigator workflow on those seams.
4. Build the admin workflow on the same domain model with separate authorization and navigation.
5. Migrate remaining functionality incrementally.

This avoids a frontend-only reskin that preserves endpoint-shaped assumptions and avoids a speculative backend rewrite that delays user value.

## Domain Model

The system centers on an `Investigation`, not on a route, page, or scan endpoint.

An investigation contains:

- submitted URL
- normalized URL
- redirect chain
- immutable observation timeline
- scan sessions
- capability runs
- findings
- evidence references

A `ScanSession` represents one execution attempt. Each `CapabilityRun` is independent and follows explicit state transitions:

```text
queued -> running -> success
                  -> failed
                  -> unavailable
```

The investigation lifecycle owns:

- URL normalization
- capability scheduling
- partial-result rules
- retry eligibility
- finding and evidence aggregation
- persistence synchronization
- anonymous-to-authenticated claiming

The UI renders projections of this model. It does not reconstruct lifecycle state from endpoint-specific responses.

## Module Architecture

New modules use ownership and behavior rather than atomic-design categories.

```text
frontend/src/
  domain/
    investigation/
      model.ts
      lifecycle.ts
      reducer.ts
      selectors.ts
      evidence.ts
    findings/
      ranking.ts
      grouping.ts

  application/
    investigation/
      start.ts
      retry.ts
      resume.ts
      claim.ts
    ports/
      capability-runner.ts
      investigation-store.ts
      auth-session.ts

  adapters/
    capabilities/
    persistence/
    http/

  ui/
    shell/
    investigation/
    investigations/
    admin/
    primitives/
```

Module responsibilities:

- `domain/` is framework-free and deterministic. It owns invariants, transitions, selection, ranking, and evidence rules.
- `application/` coordinates use cases through narrow ports. It owns commands such as start, retry, resume, and claim.
- `adapters/` handles HTTP, storage, authentication, and integration with existing scanner implementations.
- `ui/` renders domain read models and dispatches application commands.
- `ui/primitives/` contains reusable visual controls only. It has no domain behavior and cannot import feature modules.

New code must not add `atoms`, `molecules`, `organisms`, `templates`, or `pages` directories. Existing atomic modules remain temporarily when migration cost is not justified. They are migration targets, not patterns for new work.

Routes and pages become thin composition boundaries. A page may select a view model, provide application commands, and compose modules. It must not own scan execution, persistence branching, retry rules, or response normalization.

Each new module should expose a small interface and hide meaningful implementation complexity. Do not create abstractions with only one implementation unless they protect a real seam such as persistence, capability execution, or authorization.

## Capability Execution

Every scan capability is represented by a common runner interface:

```ts
type CapabilityRunner = {
  name: CapabilityName
  run(input: CapabilityInput): Promise<CapabilityResult>
}
```

The coordinator runs capabilities independently and records immutable outcomes. Existing scan runners become adapters behind this interface and migrate one capability at a time.

Capability outcomes distinguish:

- `success`: useful result and evidence available
- `failed`: execution attempted but errored; may be retryable
- `unavailable`: cannot run in current context; no false retry affordance

Completed results remain available while other capabilities run or retry.

## Contracts and Validation

`packages/contracts` owns shared Zod schemas and inferred transport types. Zod already exists there and current capability/session schemas establish the intended discriminated-union pattern.

Data flow across trust boundaries:

```text
untrusted API or storage input
  -> Zod contract schema
  -> validated transport value
  -> explicit mapper
  -> domain model
  -> UI read model
```

Validate at these boundaries:

- server request payloads
- server API responses
- local storage and session restoration
- persisted investigation snapshots
- capability result envelopes
- relevant authentication/session claims

Domain modules consume validated values. They do not accept raw `unknown` payloads or endpoint-shaped data.

Transport contracts and domain models remain separate. A schema's inferred type is not automatically the domain model. Explicit mappers preserve freedom to evolve wire format and domain behavior independently.

Invalid contract data becomes a typed operational error such as `contract-invalid`. It must not silently become an empty result or a generic failed scan.

Zod is not required inside every React component, reducer, or internal function. TypeScript handles trusted internal values; Zod protects external boundaries.

## Persistence

Persistence uses one application-facing interface:

```ts
type InvestigationStore = {
  save(investigation: Investigation): Promise<void>
  get(id: string): Promise<Investigation | null>
  list(): Promise<InvestigationSummary[]>
  claim(localId: string, userId: string): Promise<Investigation>
}
```

Adapters include:

- `LocalInvestigationStore` for anonymous continuity
- `RemoteInvestigationStore` for authenticated persistence

A persistence policy selects the active adapter and handles authenticated-save fallback outside UI modules. Anonymous local continuity and authenticated remote persistence remain first-class behavior.

## Server Integration

Server layering mirrors frontend ownership:

```text
routes
  -> authorization
  -> investigation application module
  -> capability coordinator
  -> capability adapters
  -> persistence
```

Domain-oriented operations are the target route shape:

```text
POST /investigations
GET  /investigations
GET  /investigations/:id
POST /investigations/:id/capabilities/:name/retry
GET  /investigations/:id/events
```

Existing endpoints remain usable through adapters while migration proceeds. Contract changes happen only when required by the domain seam, not as a parallel rewrite.

Admin routes are separate from investigator routes. They enforce authorization before application commands execute and never rely on client-side navigation gating as the security boundary.

## UI Shells

Investigator and admin workflows share global product identity but have separate shells.

```text
AppShell
├── InvestigatorShell
│   ├── compact global header
│   ├── contextual section navigation
│   ├── report canvas
│   └── mobile sticky section selector
└── AdminShell
    ├── admin navigation
    ├── operational inbox
    └── evidence-first detail workspace
```

Investigator sections include Overview, Findings, Evidence, Assets, History, and contextual Tools. The report canvas prioritizes understanding over dashboard density.

Admin begins with operational work: unsupported namespaces, discovered assets, failed scans, maintenance items, and registry or retention issues. Existing admin capabilities migrate incrementally behind this shell. Bulk actions wait until item-level review and authorization are reliable.

## Visual System

`frontend/src/theme.css` is the source of semantic visual tokens:

```css
--surface-app
--surface-panel
--surface-raised
--text-primary
--text-secondary
--status-neutral
--status-attention
--status-risk
--status-success
--focus-ring
--content-width
--navigation-width
--control-height
```

Visual rules:

- IBM Plex Sans for interface text.
- IBM Plex Mono for URLs, paths, IDs, and request metadata.
- Square functional surfaces.
- One restrained accent.
- Neutral facts, amber uncertainty, red verified risk.
- Color never carries meaning alone.
- Visible keyboard focus.
- Reduced-motion support.
- Responsive behavior belongs in shell modules, not post-hoc patches.

## Error and Recovery Model

User-facing state is typed by recovery behavior:

- `failed`: attempted but errored; show reason and retry when allowed.
- `unavailable`: cannot run in current context; explain why without a false retry.
- `partial`: at least one useful result exists alongside failed or unavailable capabilities.
- `blocked`: investigation cannot produce a useful result, such as invalid input or authorization failure.
- `offline/local-only`: local state is preserved while remote persistence is unavailable.

UI modules receive state and recovery commands, not exception-shaped control flow.

## Migration Sequence

Migration proceeds through domain-first vertical slices:

1. Extract domain contracts from existing scan behavior.
2. Add capability coordinator and adapters around current runners.
3. Add local and remote persistence ports and adapters.
4. Implement investigator lifecycle and partial recovery.
5. Build investigator shell and report modules.
6. Migrate Investigations to new read models.
7. Add Admin shell and operational inbox.
8. Move remaining admin tools behind the new shell.
9. Delete obsolete page orchestration and atomic modules after consumers move.

Every slice must leave the app runnable. Existing behavior is preserved unless a domain contract intentionally changes it.

## Testing Strategy

Test through module interfaces:

- Domain: lifecycle transitions, retry rules, finding ranking, evidence grouping.
- Application: start, resume, claim, persistence fallback, capability coordination.
- Adapters: API mapping, storage, authentication, existing runner integration.
- UI: shells, navigation, status semantics, evidence disclosure, keyboard behavior.
- Workflow: idle to running to partial to complete, failure to retry to success, refresh to resume.

Required verification for completed slices:

- typecheck
- lint
- focused unit tests
- frontend build
- Storybook build when UI modules change
- representative browser walkthroughs when local browser tooling is available
- server tests when the existing ESM/Jest blocker is resolved

Known validation blockers remain documented and are never reported as passing verification.

## Completion Criteria

The architecture migration is complete when:

- no new code depends on atomic-design directories
- investigator and admin have separate shells
- investigation lifecycle is independent of React
- capabilities support partial recovery and scoped retry
- persistence uses local and remote adapters
- findings expose evidence provenance
- external data is validated at contract boundaries
- admin operations enforce server-side authorization
- obsolete orchestration is removed only after migration consumers pass

## Non-Goals

This architecture does not require:

- rewriting every scanner before shipping the first vertical slice
- replacing all existing UI primitives
- introducing a generic event bus
- introducing a second validation library
- adding exports, batch scans, or full comparison before the core investigation loop is reliable
- deleting legacy atomic modules before their consumers have migrated
