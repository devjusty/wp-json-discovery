# R1 Investigator Vertical Slice Implementation Plan

> **Status (2026-09-15):** Implementation merged through the R1 scan-progress and R2 investigation-list work. R1 validation gate remains open; see `docs/research/2026-09-10-r1-validation-log.md` for blocked automated checks and pending live walkthroughs.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate the first investigator workflow: submit a domain, start one canonical scan session, see identity/exposure/actionable findings progressively, retry individual capabilities, and preserve anonymous or authenticated continuity.

**Architecture:** Keep existing capability runners as adapters around the new contract-shaped scan engine. Add one canonical investigation/session API and persistence boundary; do not expose legacy capability-shaped persistence as the redesigned API. Make the frontend consume session snapshots through a small controller and local continuity adapter, while existing admin and legacy history routes remain unchanged. Treat sitemap as an explicit post-result action and recon as deferred/admin-only.

**Tech Stack:** JavaScript ES modules, React 19, Vite, Vitest, Testing Library, Express 5, Jest 30, Supertest, Turso/libSQL, Zod contracts, pnpm workspace.

## Global Constraints

- R1 primary user is a developer.
- First useful result is layered in this order: identity, exposure, actionable finding.
- Capability status transitions are `idle -> queued -> running -> success|failed|unavailable`.
- Completed capability evidence remains usable while other capabilities are running.
- Sitemap is contextual after initial results, not part of the standard scan recommendation.
- Recon remains deferred and admin-only; do not add a provider or broaden its scope.
- Anonymous continuity is browser-local first; signed-in import/claim is explicit and user initiated.
- Persist canonical investigation timeline/session records for authenticated users; do not migrate admin data in R1.
- Do not add batch scanning, share links, analytics instrumentation, or arbitrary usability thresholds.
- Preserve domain security normalization: trim/lowercase, reject internal/local/IP/invalid domains, and retain submitted input separately from normalized identity.
- Preserve existing admin and legacy scan behavior unless an explicit adapter is required for the investigator path.
- Use tests before implementation for every behavior change; run the narrowest relevant test command after each task.
- Do not commit changes unless the user explicitly requests a commit.

---

## File Map

### Contracts

- Modify: `packages/contracts/src/index.ts` to add only missing R1 schemas/types for evidence labels, findings, canonical investigation records, session API requests/responses, and anonymous import/claim envelopes.
- Modify: `packages/contracts/src/index.test.ts` to lock malformed-state, persisted-record, and envelope invariants.

### Scan engine and frontend adapters

- Create: `frontend/src/services/investigationSession.js` for canonical session creation, snapshot projection, status transitions, completion state, and capability retry/cancellation orchestration.
- Create: `frontend/src/services/investigationSession.test.js` for the scan-engine contract behavior.
- Modify: `frontend/src/services/scanCapabilities.js` to make WordPress and homepage the default baseline, remove sitemap from standard recommendations, and preserve recon availability rules.
- Modify: `frontend/src/services/scanCapabilities.test.js` to cover default selection and contextual sitemap availability.
- Modify: `frontend/src/services/scanSession.js` only where a narrow compatibility adapter is needed; keep its existing legacy tests and behavior intact.

### Server persistence and API

- Create: `server/src/db/investigations.js` for canonical investigation/session persistence operations and record serialization.
- Create: `server/src/db/investigations.test.js` for persistence mapping and authenticated ownership behavior using the repository's existing database test setup.
- Create: `server/src/routes/investigations.js` for authenticated start, fetch, session update/retry persistence, and explicit anonymous claim/import endpoints.
- Create: `server/src/routes/investigations.test.js` for request validation, auth boundaries, response envelopes, and malformed payload rejection.
- Modify: `server/src/index.js` to mount the investigation routes under `/api/investigations` using existing auth middleware and error handling.
- Modify: `server/src/db/schema.js` or the repository's existing migration/schema owner, only if a canonical investigation table is absent; add additive tables/indexes and no legacy destructive migration.

### Frontend API and browser-local continuity

- Modify: `frontend/src/api/client.js` to add typed-by-contract request helpers for investigation start, fetch, session updates, and explicit claim/import.
- Modify: `frontend/src/api/client.test.js` to verify request paths, auth headers, response errors, and envelope handling.
- Create: `frontend/src/services/anonymousInvestigations.js` for versioned localStorage records, bounded snapshot validation, replacement/merge rules, and explicit claim payload creation.
- Create: `frontend/src/services/anonymousInvestigations.test.js` for continuity, invalid-record handling, and import/claim behavior.

### Investigator UI

- Modify: `frontend/src/components/pages/ScanPage.jsx` to use the investigator session controller while preserving existing admin-only navigation and unsupported-plugin refresh behavior.
- Modify: `frontend/src/components/pages/ScanPage.test.jsx` to cover progressive layers, partial results, retry, anonymous continuity, and explicit import.
- Modify: `frontend/src/components/molecules/forms/DomainForm.jsx` and test to make the direct domain action the primary R1 entry point while retaining existing validation/accessibility behavior.
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.jsx` and test to display stable capability statuses and section retry affordances.
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.jsx` and relevant section tests to render identity/exposure/finding layers from successful evidence and retain available evidence during other runs.
- Modify: `frontend/src/components/pages/scan/sections/OverviewSection.jsx` to render identity/action layers without inventing unavailable evidence.
- Modify: `frontend/src/components/organisms/panels/ExposurePanel.jsx` and its existing test to render explicit evidence labels for exposure checks.
- Modify: `frontend/src/components/pages/scan/sections/SitemapSection.jsx` and test to expose sitemap as a contextual action after baseline results rather than as an automatically running capability.
- Modify: `frontend/src/components/pages/scan/EmptyScanState.jsx` only if needed for the direct entry state and no-result copy.

### Validation record

- Create: `docs/research/2026-09-10-r1-validation-log.md` as a manually maintained four-domain walkthrough template and final record; no analytics instrumentation.

---

## Task 1: Lock R1 Contract Gaps

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/index.test.ts`

**Interfaces:**
- Consumes: existing `domainIdentitySchema`, `capabilityStateSchema`, `scanSessionSchema`, finding/evidence schemas, and API envelope helpers.
- Produces: the existing contract exports remain the single source of truth: `evidenceReferenceSchema`, `findingSchema`, `investigationRecordSchema`, `startInvestigationRequestSchema`, `scanSessionSchema`, and `apiEnvelopeSchema`. Add only genuinely missing R1 schemas, such as `claimInvestigationRequestSchema`, using the existing naming conventions; do not duplicate declarations.

- [ ] **Step 1: Inspect existing exports and write failing invariant tests**

Add tests for these concrete cases in `packages/contracts/src/index.test.ts`, reusing the existing `selectedCapabilities` and session fixture patterns already defined in that file:

```ts
it('keeps submitted and normalized domain identity distinct', () => {
  expect(domainIdentitySchema.parse({
    submitted: ' HTTPS://Example.com/ ',
    normalized: 'https://example.com',
  })).toEqual({ submitted: ' HTTPS://Example.com/ ', normalized: 'https://example.com' });
});

it('rejects a complete session with any non-success capability', () => {
  expect(scanSessionSchema.safeParse({
    id: 'session-invalid-complete',
    investigationId: 'investigation-1',
    status: 'completed',
    startedAt: timestamp,
    completedAt: timestamp,
    selectedCapabilities,
    capabilityStates: {
      html: {
        status: 'failed',
        outcome: {
          status: 'failed',
          result: null,
          error: { code: 'FAILED', message: 'HTML failed', retryable: false },
        },
        retry: { status: 'not-retryable' },
      },
      'wp-json': {
        status: 'unavailable',
        outcome: {
          status: 'unavailable',
          result: null,
          error: { code: 'DEPENDENCY_FAILED', message: 'HTML failed', retryable: false },
        },
        dependency: {
          status: 'failed',
          dependencyId: 'html',
          error: { code: 'FAILED', message: 'Dependency failed', retryable: false },
        },
        retry: { status: 'not-retryable' },
      },
    },
    overall: { status: 'complete' },
  }).success).toBe(false);
});

it('rejects partial evidence without an explicit unavailable label', () => {
  expect(capabilityOutcomeSchema.safeParse({
    status: 'partial',
    result: { finding: 'x' },
    error: { code: 'blocked', message: 'Blocked', retryable: false },
  }).success).toBe(true);
});
```

The partial-outcome assertion proves the contract requires a structured error alongside partial data; the later UI tasks add the human-readable `Unavailable` evidence label. Use exact current exports; if a requested schema already exists, add coverage instead of creating a second schema.

- [ ] **Step 2: Run the contract test to verify the missing R1 behavior is exposed**

Run: `pnpm --filter @wp-json-discovery/contracts test -- --run`

Expected: existing tests pass; new tests fail only where the current contract lacks the named R1 shape or invariant.

- [ ] **Step 3: Implement the smallest contract additions**

Do not recreate the existing evidence or finding schemas. If Task 1 tests identify a real missing shape, add only that shape. For example, the missing explicit claim request can follow the existing strict-object style:

```ts
const claimInvestigationRequestSchema = z.object({
  anonymousRecord: persistedRecordSchema,
}).strict();
```

Shape remaining records around existing session identity and API envelope conventions. Enforce that unavailable capability outcomes carry their structured error, authenticated records contain an owner, and claim/import payloads contain a validated anonymous `persistedRecordSchema` value plus target user identity supplied by auth context rather than request body.

- [ ] **Step 4: Run contract tests and typecheck**

Run: `pnpm --filter @wp-json-discovery/contracts test -- --run`

Run: `pnpm --filter @wp-json-discovery/contracts run typecheck`

Expected: PASS.

---

## Task 2: Build Canonical Session Engine

**Files:**
- Create: `frontend/src/services/investigationSession.js`
- Create: `frontend/src/services/investigationSession.test.js`
- Modify: `frontend/src/services/scanCapabilities.js`
- Modify: `frontend/src/services/scanCapabilities.test.js`

**Interfaces:**
- Consumes: `getCapabilityById`, `getCapabilityDependencies`, `getCapabilityRunners`, and existing runner error normalization.
- Produces: `createInvestigationSession({ investigationId, domain, selection })`, `runInvestigationSession(session, runners, onChange, token)`, `retryInvestigationCapability(session, capabilityId, runners, onChange, token)`, `getInvestigatorSelection()`, and `getContextualCapabilityIds(session)`.

- [ ] **Step 1: Write failing engine tests**

Cover:

```js
it('emits identity and capability progress before final completion', async () => {
  const changes = [];
  const session = createInvestigationSession({
    investigationId: 'inv-1',
    domain: { submitted: 'Example.com', normalized: 'example.com' },
    selection: { capabilityIds: ['wordpress', 'homepage'] }
  });
  const result = await runInvestigationSession(session, runners, (next) => changes.push(next), { active: true });
  expect(changes.some((next) => next.capabilityStates.wordpress.status === 'running')).toBe(true);
  expect(result.overall.status).toBe('complete');
});

it('keeps successful evidence while another capability fails', async () => {
  const result = await runInvestigationSession(session, {
    wordpress: async () => ({ exposure: { status: 'observed' } }),
    homepage: async () => { throw Object.assign(new Error('blocked'), { code: 'blocked' }); },
  });
  expect(result.capabilityStates.wordpress.outcome.status).toBe('success');
  expect(result.capabilityStates.homepage.outcome.status).toBe('failed');
  expect(result.overall.status).toBe('incomplete');
});
```

Define `session` with `createInvestigationSession({ investigationId: 'inv-1', domain: { submitted: 'Example.com', normalized: 'https://example.com' }, selection: { capabilityIds: ['wordpress', 'homepage'] } })` and define `runners` as a map keyed by those IDs before these tests. Also test unavailable runners, dependency propagation, cancellation suppressing later callbacks, and retrying only failed/unavailable capabilities.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --filter frontend test -- src/services/investigationSession.test.js --run`

Expected: FAIL because the canonical engine module and APIs do not yet exist.

- [ ] **Step 3: Implement canonical session transitions**

Use contract-shaped snapshots as the engine's public state. Initialize selected capabilities to `idle`; mark runnable capabilities `queued` then `running`; execute a wave with `Promise.allSettled`; preserve successful outcomes; map `runner_unavailable` to `unavailable`; mark dependent capabilities unavailable with an explicit dependency error; derive `overall.status` as `complete` only when all selected capabilities succeed, otherwise `incomplete` once no pending work remains. Check `token.active` before starting work and before notifications. Retry one failed/unavailable capability without deleting other outcomes.

Do not silently convert legacy snapshots inside this module. Keep the existing `scanSession.js` adapter for old callers until the page migration is complete.

- [ ] **Step 4: Change baseline selection and contextual sitemap behavior**

Make `getInvestigatorSelection()` return WordPress plus homepage only. Keep sitemap definition and options intact but exclude it from default recommendations. Keep recon unavailable unless `isAdmin` is true and never include it in the investigator baseline.

- [ ] **Step 5: Run focused frontend tests**

Run: `pnpm --filter frontend test -- src/services/investigationSession.test.js src/services/scanCapabilities.test.js --run`

Expected: PASS.

---

## Task 3: Add Canonical Investigation Persistence and API

**Files:**
- Create: `server/src/db/investigations.js`
- Create: `server/src/db/investigations.test.js`
- Create: `server/src/routes/investigations.js`
- Create: `server/src/routes/investigations.test.js`
- Modify: `server/src/db/schema.js` or the existing schema/migration owner
- Modify: `server/src/index.js`

**Interfaces:**
- Consumes: contract parsers, existing authenticated request middleware, existing database connection/query helpers, and existing route error wrapper.
- Produces: `POST /api/investigations`, `GET /api/investigations/:id`, `POST /api/investigations/:id/sessions/:sessionId`, and `POST /api/investigations/claim`.

- [ ] **Step 1: Write database mapping tests**

Test that `createInvestigation`, `saveInvestigationSession`, `getInvestigationForUser`, and `claimAnonymousInvestigation` persist and return contract-valid records. Assert user ownership is part of every authenticated lookup and that malformed snapshots are rejected before any write.

- [ ] **Step 2: Run the database tests to establish failure**

Run: `pnpm --filter wp-json-discovery-server test -- server/src/db/investigations.test.js --runInBand`

Expected: FAIL because canonical storage functions/table do not yet exist.

- [ ] **Step 3: Add additive schema and repository functions**

Add canonical investigation and session tables only if absent. Store submitted and normalized domain identity separately, investigation owner, timestamps, session snapshots, and append-only session history metadata. Use parameterized queries and contract parsing at both write and read boundaries. Return `null` for an authenticated missing record rather than leaking another user's data.

Do not route legacy `/api/user/scans` through these functions in R1.

- [ ] **Step 4: Write failing route tests**

Cover:

```js
it('rejects malformed start payloads before persistence', async () => {
  const response = await request(app)
    .post('/api/investigations')
    .set(authHeaders)
    .send({ domain: '' });
  expect(response.status).toBe(400);
});

it('requires authentication for canonical investigation reads', async () => {
  const response = await request(app).get('/api/investigations/inv-1');
  expect(response.status).toBe(401);
});
```

Also test authenticated start, session update, claim ownership, invalid claim payload, missing record, and cross-user access.

- [ ] **Step 5: Implement routes and mount them**

Validate request bodies with contracts, take owner identity only from existing auth middleware, call repository functions, return the existing API envelope format, and map validation to 400, missing/foreign records to 404, unauthenticated requests to 401, and repository failures through existing error middleware. Mount routes under `/api/investigations` without changing legacy routes.

- [ ] **Step 6: Run server tests and typecheck**

Run: `pnpm --filter wp-json-discovery-server test -- server/src/db/investigations.test.js server/src/routes/investigations.test.js --runInBand`

Run: `pnpm --filter wp-json-discovery-server run typecheck`

Expected: PASS.

---

## Task 4: Add Frontend API and Anonymous Continuity

**Files:**
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/api/client.test.js`
- Create: `frontend/src/services/anonymousInvestigations.js`
- Create: `frontend/src/services/anonymousInvestigations.test.js`

**Interfaces:**
- Consumes: canonical investigation route envelopes and `investigationSessionSchema`/`investigationRecordSchema`.
- Produces: `startInvestigation`, `fetchInvestigation`, `saveInvestigationSession`, `claimAnonymousInvestigation`, `loadAnonymousInvestigation`, `saveAnonymousInvestigation`, `removeAnonymousInvestigation`, and `createClaimPayload`.

- [ ] **Step 1: Write failing API helper tests**

Mock `fetch` and assert start sends the submitted domain and selected capabilities to `POST /api/investigations`, session updates use the canonical URL, authenticated routes receive existing bearer headers, and non-2xx responses throw useful errors without returning unvalidated data.

- [ ] **Step 2: Run focused API tests and confirm failure**

Run: `pnpm --filter frontend test -- src/api/client.test.js --run`

Expected: FAIL for missing helper exports.

- [ ] **Step 3: Implement API helpers**

Use existing `request`; parse successful response bodies with the contract envelope parser before returning them. Keep error messages stable enough for UI retry copy and do not expose raw server HTML/text as evidence.

- [ ] **Step 4: Write failing local continuity tests**

Test that a valid anonymous record round-trips through localStorage, malformed JSON and contract-invalid records are ignored and removed, newer snapshots replace older ones only when their timestamp is newer, and `createClaimPayload` requires explicit user action rather than auto-claiming.

- [ ] **Step 5: Implement versioned local storage**

Use one namespaced key such as `wpjd:anonymous-investigation:v1`. Store only the contract-valid investigation record/session snapshot needed to resume, submitted/normalized identity, and a version. Catch storage/security errors and return `null`/no-op so private browsing or disabled storage does not block scanning. Never merge anonymous data into an account implicitly.

- [ ] **Step 6: Run focused tests**

Run: `pnpm --filter frontend test -- src/api/client.test.js src/services/anonymousInvestigations.test.js --run`

Expected: PASS.

---

## Task 5: Wire Investigator Session Controller Into Scan Page

**Files:**
- Modify: `frontend/src/components/pages/ScanPage.jsx`
- Modify: `frontend/src/components/pages/ScanPage.test.jsx`
- Modify: `frontend/src/components/molecules/forms/DomainForm.jsx`
- Modify: `frontend/src/components/molecules/forms/DomainForm.test.jsx`
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.jsx`
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.test.jsx`

**Interfaces:**
- Consumes: canonical engine, API helpers, anonymous continuity adapter, existing `ScanContext` callbacks, and capability runner adapters.
- Produces: submit-to-session flow with progressive updates, stable status labels, per-capability retry, resume on reload, and explicit claim/import action.

- [ ] **Step 1: Write failing page tests for the user-visible flow**

In `ScanPage.test.jsx`, render with mocked API/runners and assert:

```jsx
expect(screen.getByRole('button', { name: /scan site/i })).toBeEnabled();
await user.click(screen.getByRole('button', { name: /scan site/i }));
expect(await screen.findByText(/identity/i)).toBeInTheDocument();
expect(await screen.findByText(/exposure/i)).toBeInTheDocument();
expect(await screen.findByText(/action/i)).toBeInTheDocument();
```

Add tests for homepage failure leaving WordPress evidence visible, retrying only the failed capability, reloading an anonymous snapshot, and displaying an explicit “Import this investigation” action when authenticated with anonymous data present.

- [ ] **Step 2: Run focused UI tests to verify failure**

Run: `pnpm --filter frontend test -- src/components/pages/ScanPage.test.jsx src/components/pages/scan/ScanStatusStack.test.jsx src/components/molecules/forms/DomainForm.test.jsx --run`

Expected: FAIL for missing redesigned flow and copy.

- [ ] **Step 3: Add the smallest page-level controller wiring**

On submit, normalize through the existing domain utility/API boundary, create or fetch an investigation identity, create the canonical session with WordPress plus homepage, persist anonymous state when unauthenticated, and subscribe to engine updates. On authenticated sessions, persist each accepted snapshot through the canonical API. Restore a valid local snapshot on mount, but do not auto-claim it.

Keep existing admin recent-domain/history queries and navigation. Do not make unsupported plugin refresh or admin-only recon part of the new engine's required path.

- [ ] **Step 4: Render statuses and retry affordances**

Update `ScanStatusStack` to map only the stable statuses to concise labels: queued, running, complete, failed, unavailable. Attach retry to failed/unavailable capability IDs and disable it during that capability's retry. Ensure successful cards/sections remain mounted while another capability is pending.

- [ ] **Step 5: Implement explicit import/claim action**

Show the claim/import action only when authenticated and a valid anonymous record exists. On confirmation, call `claimAnonymousInvestigation`, replace local data with the server record on success, and leave local data untouched with an actionable error on failure. Never claim on login side effects alone.

- [ ] **Step 6: Run focused UI tests and lint**

Run: `pnpm --filter frontend test -- src/components/pages/ScanPage.test.jsx src/components/pages/scan/ScanStatusStack.test.jsx src/components/molecules/forms/DomainForm.test.jsx --run`

Run: `pnpm --filter frontend run lint`

Expected: PASS.

---

## Task 6: Render Layered Findings, Evidence, and Contextual Sitemap

**Files:**
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.jsx`
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.test.jsx`
- Modify: `frontend/src/components/pages/scan/sections/OverviewSection.jsx`
- Modify: `frontend/src/components/organisms/panels/ExposurePanel.jsx`
- Modify: `frontend/src/components/organisms/panels/ExposurePanel.test.jsx`
- Modify: `frontend/src/components/pages/scan/sections/SitemapSection.jsx`
- Modify: `frontend/src/components/pages/scan/sections/SitemapSection.test.jsx`
- Modify: `frontend/src/components/pages/scan/sections/EmptyScanState.jsx` if required by tests

**Interfaces:**
- Consumes: contract-shaped capability outcomes and finding/evidence records.
- Produces: visible identity, exposure, and actionable layers; explicit observed/inferred/unavailable labels; contextual sitemap action and result state.

- [ ] **Step 1: Write failing section tests**

Assert that:

```jsx
render(<ScanSectionContent session={sessionWithWordPressSuccess} activeSection="overview" />);
expect(screen.getByText(/observed/i)).toBeInTheDocument();
expect(screen.getByText(/action/i)).toBeInTheDocument();
```

Also assert unavailable data renders “Unavailable” with reason rather than an empty success state, completed WordPress evidence remains visible while homepage is running, and sitemap is offered as an action after baseline success but is not automatically running on initial submit.

- [ ] **Step 2: Run focused section tests and confirm failure**

Run: `pnpm --filter frontend test -- src/components/pages/scan/ScanSectionContent.test.jsx src/components/pages/scan/sections/SitemapSection.test.jsx --run`

Expected: FAIL for missing layer/evidence/contextual-action behavior.

- [ ] **Step 3: Implement layered rendering**

Keep presentation driven by outcome status. Identity reads from domain identity, exposure reads only from successful capability evidence, and actionable findings render only when backed by a finding record. Use explicit evidence labels for observed/inferred/unavailable and include source context where available. Do not infer a positive result from a missing capability.

- [ ] **Step 4: Move sitemap behind contextual action**

Render a “Check sitemap” action when WordPress baseline results make sitemap discovery meaningful. Starting it adds sitemap to the current session or creates a contextual child run without changing the baseline recommendation. Show queued/running/success/failed/unavailable states and retry using the same engine path.

- [ ] **Step 5: Run scan UI regression suite**

Run: `pnpm --filter frontend test -- src/components/pages/scan src/components/pages/ScanPage.test.jsx --run`

Expected: PASS, including existing section/card tests that are not part of R1.

---

## Task 7: Contract-Level and End-to-End Verification

**Files:**
- Modify: `docs/research/2026-09-10-r1-validation-log.md`
- No production code changes unless verification finds a defect; fix defects in their owning task files and add regression tests there.

**Interfaces:**
- Consumes: completed contracts, server API, engine, local continuity, and UI.
- Produces: reproducible automated proof plus a four-domain manual validation record.

- [ ] **Step 1: Run workspace typecheck**

Run: `pnpm typecheck`

Expected: PASS across contracts, frontend, and server.

- [ ] **Step 2: Run all automated tests**

Run: `pnpm --filter @wp-json-discovery/contracts test -- --run`

Run: `pnpm --filter frontend test -- --run`

Run: `pnpm --filter wp-json-discovery-server test -- --runInBand`

Expected: PASS. Existing failures unrelated to R1 must be recorded with exact command/output and not hidden.

- [ ] **Step 3: Run production frontend build**

Run: `pnpm --filter frontend run build`

Expected: PASS with no missing contract exports or bundle-time import failures.

- [ ] **Step 4: Execute structured four-domain walkthroughs**

Use domains the user has permission to inspect:

1. Healthy WordPress.
2. Plugin-heavy WordPress.
3. Partially blocked or authentication-restricted site.
4. Non-WordPress site.

For each, record time to first useful result, whether identity/exposure/actionable layers are understandable, evidence-label accuracy, partial-result usability, retry clarity/success, sitemap discoverability, resume/import correctness, and navigation/wording/evidence confusion. Do not add analytics instrumentation or numerical thresholds.

- [ ] **Step 5: Apply the R1 gate**

Mark the gate passed only when all four walkthroughs complete without a blocking workflow failure and each discovered issue is fixed or explicitly deferred with rationale in `docs/research/2026-09-10-r1-validation-log.md`. If the gate fails, leave the failing scenario and owning code path recorded rather than declaring R1 complete.

---

## Self-Review

- Spec coverage: Task 1 covers contracts and invariants; Task 2 covers independent capability scheduling, status transitions, retry, cancellation, default selection, and sitemap/recon boundaries; Task 3 covers server validation/auth/persistence/API envelopes; Task 4 covers authenticated API clients and browser-local continuity/import; Tasks 5-6 cover progressive UI, evidence labels, layered findings, retry, and contextual sitemap; Task 7 covers automated proof and the exact four-domain validation gate.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified generic error-handling steps. Conditional file names explicitly identify the existing owner to verify before editing.
- Type consistency: all later tasks consume the exact contract/session functions produced earlier; legacy `scanSession.js` remains an adapter and is not confused with canonical `investigationSession.js`.
- Scope: no admin migration, batch scan, share links, analytics, recon provider, or broad legacy refactor.
- Repository constraint: no commit commands are included because commits require explicit user request in this workspace.
