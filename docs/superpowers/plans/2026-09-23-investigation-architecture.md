# Investigation Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move WP JSON Discovery toward a domain-first full-stack architecture with explicit investigation lifecycle, capability, persistence, evidence, shell, and authorization seams while preserving current behavior during migration.

**Architecture:** Introduce framework-free investigation modules and application commands around existing capability runners and investigation routes. Validate external data at adapter seams with Zod schemas owned by `packages/contracts`; map validated transport values into domain models before UI consumption. Migrate one vertical slice at a time, leaving old atomic modules usable until their consumers move.

**Tech Stack:** TypeScript, React 19, Vite, Express, PostgreSQL/SQLite persistence already used by the repository, Zod 4 in `@wp-json-discovery/contracts`, Vitest, Jest, Storybook, TanStack Query, Auth0.

---

## File Map

Create new files only in these target areas:

- `frontend/src/domain/investigation/model.ts`: framework-free investigation, session, capability, finding, and evidence types.
- `frontend/src/domain/investigation/lifecycle.ts`: deterministic state transitions and invariant enforcement.
- `frontend/src/domain/investigation/selectors.ts`: read-model selectors for progress, partial reports, retryability, and evidence.
- `frontend/src/domain/findings/ranking.ts`: deterministic consequence/evidence/novelty ranking.
- `frontend/src/application/ports/capability-runner.ts`: capability execution seam.
- `frontend/src/application/ports/investigation-store.ts`: local/remote persistence seam.
- `frontend/src/application/ports/auth-session.ts`: authenticated/anonymous identity seam.
- `frontend/src/application/investigation/start.ts`, `retry.ts`, `resume.ts`, `claim.ts`: use-case commands.
- `frontend/src/adapters/capabilities/legacyCapabilityRunner.ts`: adapter around `scanCapabilities.js`.
- `frontend/src/adapters/persistence/localInvestigationStore.ts`, `remoteInvestigationStore.ts`: validated persistence adapters.
- `frontend/src/adapters/http/investigationTransport.ts`: Zod validation and transport-to-domain mapping.
- `frontend/src/ui/shell/AppShell.tsx`, `InvestigatorShell.tsx`, `AdminShell.tsx`: route-level shell composition.
- `frontend/src/ui/investigation/InvestigatorOverview.tsx`, `InvestigatorFindings.tsx`, `EvidenceDisclosure.tsx`, `InvestigatorSectionSelector.tsx`.
- `frontend/src/ui/admin/AdminInbox.tsx`: operational inbox without bulk actions.

Modify these existing seams:

- `packages/contracts/src/index.ts`: add shared transport schemas only where existing schemas do not cover migrated state.
- `frontend/src/services/investigationSession.js`: delegate to the new lifecycle/use cases, then delete duplicated transitions after consumers migrate.
- `frontend/src/services/scanCapabilities.js`: preserve runner behavior while exposing the runner adapter.
- `frontend/src/App.tsx`: thin route composition and shell selection.
- `frontend/src/components/pages/ScanPage.tsx`: remove lifecycle/persistence orchestration incrementally.
- `frontend/src/components/pages/InvestigationsPage.tsx`: consume investigation list read models.
- `frontend/src/components/pages/AdminPage.tsx`: compose `AdminShell` and inbox while retaining existing queries.
- `server/src/routes/investigations.ts`: route through application seams without changing public behavior in first slice.
- `server/src/db/investigations.ts`: expose persistence implementation behind the server application interface.
- `frontend/src/theme.css`, `frontend/src/App.css`: semantic investigative tokens and shell layout rules.

Tests and stories are colocated with new modules. Existing tests for `investigationSession`, `ScanPage`, routes, DB, `AppLayout`, `ScanStatusStack`, and admin pages remain regression coverage.

## Task 1: Establish Contract Inventory And Domain Model

**Files:**
- Create: `frontend/src/domain/investigation/model.ts`
- Create: `frontend/src/domain/investigation/model.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write failing model tests**

Add tests for a complete investigation, a partial session, and evidence provenance. Assert that domain values contain no React, HTTP, database, or Zod imports.

```ts
import { describe, expect, it } from 'vitest';
import { createInvestigation, getCapabilityState } from './model';

describe('investigation model', () => {
  it('creates one investigation with immutable submitted URL identity', () => {
    const investigation = createInvestigation({
      id: 'inv-1',
      submittedUrl: 'HTTP://Example.com/path',
      normalizedUrl: 'https://example.com/path',
      redirectChain: ['HTTP://Example.com/path', 'https://example.com/path'],
      createdAt: '2026-09-23T12:00:00.000Z',
    });

    expect(investigation.submittedUrl).toBe('HTTP://Example.com/path');
    expect(investigation.observationTimeline).toEqual([]);
  });

  it('distinguishes retryable failure from unavailable capability', () => {
    const investigation = createInvestigation({
      id: 'inv-1', submittedUrl: 'https://example.com',
      normalizedUrl: 'https://example.com', redirectChain: [],
      createdAt: '2026-09-23T12:00:00.000Z',
      capabilities: [
        { name: 'wordpress', status: 'failed', error: { code: 'timeout', message: 'Timed out' } },
        { name: 'sitemap', status: 'unavailable', reason: 'robots-policy' },
      ],
    });

    expect(getCapabilityState(investigation, 'wordpress')?.status).toBe('failed');
    expect(getCapabilityState(investigation, 'sitemap')?.status).toBe('unavailable');
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `pnpm --filter frontend exec vitest run src/domain/investigation/model.test.ts`.
Expected: FAIL because `src/domain/investigation/model.ts` does not exist.

- [ ] **Step 3: Implement the framework-free model**

Define `CapabilityStatus = 'queued' | 'running' | 'success' | 'failed' | 'unavailable'`, `EvidenceKind = 'observed' | 'inference' | 'request-trace' | 'absence'`, typed errors, `CapabilityRun`, `Evidence`, `Finding`, `Observation`, and `Investigation`. Export `createInvestigation`, `getCapabilityState`, and `isPartialInvestigation`. Keep construction pure and preserve submitted URL separately from normalized URL.

Extend `packages/contracts/src/index.ts` only for missing transport schemas. Export inferred types from contracts; do not import Zod into frontend domain files.

- [ ] **Step 4: Run model, contract, and type checks**

Run `pnpm --filter frontend exec vitest run src/domain/investigation/model.test.ts`, `pnpm --filter frontend typecheck`, and `pnpm --filter @wp-json-discovery/contracts test`.
Expected: all commands pass.

- [ ] **Step 5: Commit the first seam**

```bash
git add frontend/src/domain/investigation/model.ts frontend/src/domain/investigation/model.test.ts packages/contracts/src/index.ts
git commit -m "feat: add investigation domain model"
```

## Task 2: Move Lifecycle Rules Behind A Deterministic Module

**Files:**
- Create: `frontend/src/domain/investigation/lifecycle.ts`
- Create: `frontend/src/domain/investigation/lifecycle.test.ts`
- Create: `frontend/src/domain/investigation/selectors.ts`
- Create: `frontend/src/domain/investigation/selectors.test.ts`
- Modify: `frontend/src/services/investigationSession.js`

- [ ] **Step 1: Write transition tests before implementation**

Cover queued to running, running to success, running to failed, unavailable without retry, successful result preservation during retry, and partial status when at least one capability succeeds while another fails or is unavailable.

```ts
it('preserves successful evidence while retryable capability fails', () => {
  const after = applyInvestigationEvent(startingInvestigation, {
    type: 'capability-failed',
    capability: 'sitemap',
    error: { code: 'timeout', message: 'Timed out' },
  });

  expect(after.capabilities.wordpress.status).toBe('success');
  expect(after.capabilities.wordpress.result).toBeDefined();
  expect(after.capabilities.sitemap.status).toBe('failed');
  expect(selectInvestigationStatus(after)).toBe('partial');
});
```

- [ ] **Step 2: Run lifecycle tests and verify failure**

Run `pnpm --filter frontend exec vitest run src/domain/investigation/lifecycle.test.ts src/domain/investigation/selectors.test.ts`.
Expected: FAIL because transition and selector functions are absent.

- [ ] **Step 3: Implement transitions and selectors**

Export `applyInvestigationEvent`, `canRetryCapability`, `selectInvestigationStatus`, `selectCapabilityProgress`, `selectRetryableCapabilities`, and `selectEvidence`. Reject invalid transitions with typed `invalid-transition` errors. Mark overall status `complete` only when every selected capability succeeds, `partial` when success coexists with failed/unavailable, `failed` when no capability succeeds and a failure exists, and `blocked` for invalid/auth/unusable start state.

- [ ] **Step 4: Delegate the existing session service**

Update `investigationSession.js` to call lifecycle transitions through a narrow adapter. Preserve its current exported functions and runner behavior. Remove its duplicated finalization status calculation only after old tests prove equivalent outputs. Do not duplicate runners in the domain module.

- [ ] **Step 5: Verify regression coverage and commit**

Run `pnpm --filter frontend exec vitest run src/domain/investigation src/services/investigationSession.test.js`, then `pnpm --filter frontend typecheck`.

```bash
git add frontend/src/domain/investigation frontend/src/services/investigationSession.js
git commit -m "feat: centralize investigation lifecycle"
```

## Task 3: Add Capability, Persistence, And Auth Seams

**Files:**
- Create: `frontend/src/application/ports/capability-runner.ts`
- Create: `frontend/src/application/ports/investigation-store.ts`
- Create: `frontend/src/application/ports/auth-session.ts`
- Create: `frontend/src/adapters/capabilities/legacyCapabilityRunner.ts`
- Create: `frontend/src/adapters/persistence/localInvestigationStore.ts`
- Create: `frontend/src/adapters/persistence/remoteInvestigationStore.ts`
- Create: `frontend/src/adapters/http/investigationTransport.ts`
- Create: tests for each adapter
- Modify: `frontend/src/services/scanCapabilities.js`

- [ ] **Step 1: Define and test narrow interfaces**

Use these interfaces as the external seams:

```ts
export interface CapabilityRunner {
  run(input: { investigation: Investigation; capability: string; signal?: AbortSignal }): Promise<CapabilityResult>;
}

export interface InvestigationStore {
  save(investigation: Investigation): Promise<void>;
  get(id: string): Promise<Investigation | null>;
  list(): Promise<Investigation[]>;
  claim(id: string): Promise<Investigation>;
}

export interface AuthSession {
  getUserId(): string | null;
  getAccessToken(): Promise<string | null>;
}
```

Tests must use in-memory fakes and assert that a use case can run without React, browser storage, fetch, or Auth0.

- [ ] **Step 2: Wrap existing capability runners**

Implement `legacyCapabilityRunner` by adapting the registry in `scanCapabilities.js`. Preserve capability IDs, dependencies, availability, and result shapes. Add no second registry.

- [ ] **Step 3: Validate transport at the HTTP adapter seam**

Use existing contracts schemas with `safeParse`. Map valid transport values to domain values. Map invalid payloads to `{ code: 'contract-invalid', message, cause }`; never convert invalid data into an empty investigation. Keep Zod imports in the adapter/contracts layer only.

- [ ] **Step 4: Implement local and remote stores**

The local adapter wraps existing anonymous investigation persistence. The remote adapter wraps existing authenticated API calls and preserves save/list/get/claim behavior. Both return domain models, not API response objects.

- [ ] **Step 5: Verify adapter seams and commit**

Run `pnpm --filter frontend exec vitest run src/application src/adapters`, `pnpm --filter frontend typecheck`, and existing anonymous investigation tests.

```bash
git add frontend/src/application frontend/src/adapters frontend/src/services/scanCapabilities.js
git commit -m "feat: add investigation adapters and ports"
```

## Task 4: Introduce Application Commands And Server Application Seam

**Files:**
- Create: `frontend/src/application/investigation/start.ts`, `retry.ts`, `resume.ts`, `claim.ts`
- Create: `frontend/src/application/investigation/start.test.ts`, `retry.test.ts`, `resume.test.ts`, `claim.test.ts`
- Create: `server/src/application/investigations.ts`
- Create: `server/src/application/investigations.test.ts`
- Modify: `server/src/routes/investigations.ts`
- Modify: `server/src/db/investigations.ts`

- [ ] **Step 1: Test commands against fakes**

Test `startInvestigation`, `retryCapability`, `resumeInvestigation`, and `claimInvestigation` with fake runner/store/auth dependencies. Assert command results contain domain state and typed errors, including anonymous local fallback and authenticated save failure.

- [ ] **Step 2: Implement frontend commands**

Each command accepts dependencies explicitly, invokes lifecycle transitions, persists through `InvestigationStore`, and returns a read-model-ready domain value. UI must not catch arbitrary exceptions to decide state.

- [ ] **Step 3: Define server application functions**

Expose server functions for create/list/get/save-session/claim. They authorize before mutation, call the existing DB implementation, validate inputs with shared schemas, and return stable error envelopes. Keep route parsing and HTTP response formatting in routes.

- [ ] **Step 4: Route existing endpoints through the seam**

Modify `server/src/routes/investigations.ts` to call the application module without changing endpoint paths or response compatibility in this task. Map authorization, validation, not-found, conflict, and persistence failures explicitly.

- [ ] **Step 5: Verify server behavior and commit**

Run existing investigation route and DB tests. If the repository's known Jest ESM blocker remains, record the exact failure and run the available contract/type checks; do not call blocked tests passing.

```bash
git add frontend/src/application/investigation server/src/application/investigations.ts server/src/routes/investigations.ts server/src/db/investigations.ts
git commit -m "feat: add investigation application commands"
```

## Task 5: Build Domain-Owned Investigator UI And Shells

**Files:**
- Create: `frontend/src/ui/shell/AppShell.tsx`, `InvestigatorShell.tsx`, `AdminShell.tsx`
- Create: `frontend/src/ui/investigation/InvestigatorOverview.tsx`, `InvestigatorFindings.tsx`, `EvidenceDisclosure.tsx`, `InvestigatorSectionSelector.tsx`
- Create: `frontend/src/ui/shell/InvestigatorShell.test.tsx`, `AdminShell.test.tsx`
- Create: `frontend/src/ui/investigation/InvestigatorOverview.test.tsx`, `InvestigatorFindings.test.tsx`, `EvidenceDisclosure.test.tsx`, `InvestigatorSectionSelector.test.tsx`
- Create: matching `.stories.tsx` files beside each UI module
- Modify: `frontend/src/theme.css`, `frontend/src/App.css`, `frontend/src/App.tsx`

- [ ] **Step 1: Write UI tests from read models**

Test that investigator UI renders overview, ranked findings, provenance labels, expandable request trace, partial/retry state, keyboard focus, mobile section selector, and main landmark. Test `AdminShell` has a distinct accessible navigation label from investigator navigation.

- [ ] **Step 2: Add semantic tokens and shells**

Add investigative surface, text, status, focus, content-width, navigation-width, and control-height tokens to `theme.css`. Use IBM Plex Sans/Mono already configured. Add reduced-motion behavior in `App.css`. Shells accept read models and commands; primitives remain visual-only and do not import domain modules.

- [ ] **Step 3: Implement report modules**

`InvestigatorOverview` renders intent groups: what the site is, exposure, inspect next, and changes. `InvestigatorFindings` consumes ranked findings. `EvidenceDisclosure` renders observed/inference/request-trace/absence labels, with request metadata in monospace and raw body collapsed by default. No module accepts raw API payloads.

- [ ] **Step 4: Make routes thin**

Update `App.tsx` to select `InvestigatorShell` or `AdminShell` and preserve existing auth gating. Do not delete atomic modules yet; new code must not add imports from `components/atoms`, `molecules`, `organisms`, or `templates`.

- [ ] **Step 5: Run UI verification and commit**

Run `pnpm --filter frontend exec vitest run src/ui`, `pnpm --filter frontend lint`, `pnpm --filter frontend typecheck`, and `pnpm --filter frontend build`. Run `pnpm --filter frontend build-storybook` when the local Storybook toolchain is available.

```bash
git add frontend/src/ui frontend/src/theme.css frontend/src/App.css frontend/src/App.tsx
git commit -m "feat: add domain-owned investigator shells"
```

## Task 6: Migrate Scan And Investigations Pages To Use Cases

**Files:**
- Modify: `frontend/src/components/pages/ScanPage.tsx`
- Modify: `frontend/src/components/pages/InvestigationsPage.tsx`
- Modify: `frontend/src/services/investigationSession.js`
- Create: `frontend/src/ui/investigation/InvestigatorWorkflow.stories.tsx`
- Modify: existing ScanPage, AppLayout, InvestigationsPage, and anonymous persistence tests

- [ ] **Step 1: Add workflow regression tests**

Cover idle submit, URL normalization preserving submitted URL and redirect chain, concurrent capability progress, successful result retained beside failed capability, scoped retry, anonymous restore, authenticated remote persistence, and claim after sign-in.

- [ ] **Step 2: Replace ScanPage orchestration with commands**

Keep `ScanPage` as a composition root only: select store/auth adapters, call start/retry/resume/claim commands, and pass read models plus callbacks to UI modules. Remove direct normalization, persistence branching, and capability transition calculations from the page after tests pass.

- [ ] **Step 3: Migrate investigations list**

Make `InvestigationsPage` consume `InvestigationStore.list()` read models. Preserve local/remote distinction, findings count, capability status, last activity, and resume action. Render responsive rows/cards through `InvestigatorShell` language, not a new atomic component hierarchy.

- [ ] **Step 4: Add workflow stories**

Create stories for `Idle`, `Running`, `PartialWithRetry`, `Complete`, `Unavailable`, and `AnonymousResume`. Stories use domain fixtures and commands as no-op callbacks; they must not mock raw API payloads.

- [ ] **Step 5: Verify and commit**

Run focused workflow tests, then `pnpm --filter frontend lint`, `pnpm --filter frontend typecheck`, and `pnpm --filter frontend build`.

```bash
git add frontend/src/components/pages/ScanPage.tsx frontend/src/components/pages/InvestigationsPage.tsx frontend/src/services/investigationSession.js frontend/src/ui/investigation/InvestigatorWorkflow.stories.tsx frontend/src/components/pages frontend/src/components/templates
git commit -m "feat: migrate investigator workflow to domain commands"
```

## Task 7: Migrate Admin Inbox And Remaining Server Authorization

**Files:**
- Create: `frontend/src/ui/admin/AdminInbox.tsx`
- Create: `frontend/src/ui/admin/AdminInbox.test.tsx`
- Create: `frontend/src/ui/admin/AdminInbox.stories.tsx`
- Modify: `frontend/src/components/pages/AdminPage.tsx`
- Modify: `server/src/middleware/adminAuth.js`, `server/src/routes/userMe.js`, `server/src/routes/userNotes.js`, `server/src/routes/userScans.js`

- [ ] **Step 1: Test evidence-first inbox rendering**

Provide fixtures for unsupported namespaces, discovered assets, failed scans, and maintenance. Assert each item has status, evidence summary, one item-level action, and no bulk action controls.

- [ ] **Step 2: Implement the inbox module**

Define an `AdminInboxItem` read model with `id`, `kind`, `title`, `status`, `evidence`, and `action`. Render operational priority first and route item actions through existing mutations. Keep registry, retention, and maintenance operations behind authorization.

- [ ] **Step 3: Compose existing admin data**

Update `AdminPage` to provide existing query results to `AdminShell` and `AdminInbox`. Keep existing sections available during migration; do not duplicate queries or silently broaden authorization.

- [ ] **Step 4: Verify authorization and UI**

Run admin/frontend tests, `pnpm --filter frontend lint`, `pnpm --filter frontend typecheck`, `pnpm --filter frontend build`, and available server auth tests. Record any known Jest/ESM or browser-tooling blocker exactly.

```bash
git add frontend/src/ui/admin frontend/src/components/pages/AdminPage.tsx server/src/middleware/adminAuth.js server/src/routes/userMe.js server/src/routes/userNotes.js server/src/routes/userScans.js server/src/application
git commit -m "feat: add evidence-first admin inbox"
```

## Task 8: Remove Obsolete Orchestration And Prove Completion

**Files:**
- Modify: migrated legacy files only after import search confirms no remaining consumers.
- Delete: obsolete orchestration modules and atomic modules only when unused and covered by the final analysis.
- Create: final architecture and workflow tests where a removed seam needs regression proof.

- [ ] **Step 1: Find remaining legacy consumers**

Run `pnpm exec rg "components/(atoms|molecules|organisms|templates)|investigationSession|scanCapabilities" frontend/src server/src` and classify each match as retained adapter, migrated consumer, or obsolete import. Do not delete a file with an active retained consumer.

- [ ] **Step 2: Remove only proven obsolete code**

Delete old orchestration and atomic modules only after their replacement owns the same behavior and focused tests pass. Preserve adapters that still bridge current APIs.

- [ ] **Step 3: Run final checks**

Run `pnpm --filter frontend test`, `pnpm --filter frontend lint`, `pnpm --filter frontend typecheck`, `pnpm --filter frontend build`, `pnpm --filter frontend build-storybook`, `pnpm --filter @wp-json-discovery/contracts test`, and available server tests. Run browser walkthroughs if Playwright/Chromium is installed. Report blocked checks as blocked.

- [ ] **Step 4: Review architecture invariants**

Confirm: domain modules do not import React or adapters; UI does not parse transport payloads; new code adds no atomic dependencies; partial recovery preserves successful evidence; unavailable is not retryable; persistence/auth selection is outside UI; server mutation routes authorize before commands; evidence provenance is visible; investigator and admin shells are separate.

- [ ] **Step 5: Commit cleanup**

```bash
git add frontend/src server/src packages/contracts/src
git commit -m "refactor: complete investigation architecture migration"
```

## Self-Review

- Spec coverage: Tasks 1-2 cover the domain model and lifecycle; Task 3 covers Zod validation, capability execution, persistence, and auth seams; Task 4 covers frontend commands and server routes/authorization; Task 5 covers shells, semantic tokens, evidence, accessibility, and responsive structure; Task 6 covers investigator workflow and persistence continuity; Task 7 covers admin migration; Task 8 covers deletion and completion proof.
- Completeness scan: no deferred work markers or vague test-only instructions are used. Every task names files, commands, expected results, and the behavior under test.
- Type consistency: lifecycle selectors consume `Investigation`; ports return `Investigation`; adapters map transport into `Investigation`; application commands call ports; UI consumes read models and commands. Status values are `queued`, `running`, `success`, `failed`, `unavailable`, with aggregate `complete`, `partial`, `failed`, and `blocked`.
- Scope: old frontend redesign plan is superseded and is not edited. Existing `.gitignore` changes and unrelated worktree changes are not touched.
