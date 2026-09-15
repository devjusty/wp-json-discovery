# Codex R1 Fix Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR #34's R1 investigator flow correct at its API, security, runner, hydration, retry, evidence, and ordering boundaries, then verify it and update the PR with evidence.

**Architecture:** Keep canonical investigation/session contracts as the source of truth. Add explicit response and legacy-result adapters at API and capability-runner boundaries, keep persistence/auth/domain validation on the server, and keep browser-local continuity ordering in its storage service. Fix active-session recovery and recent-domain routing in the page controller without migrating legacy scan routes or admin workflows.

**Tech Stack:** JavaScript ES modules, React 19, Vite, Vitest, Jest, Express 5, Turso/libSQL, Zod contracts, pnpm workspace, GitHub CLI.

## Global Constraints

- Preserve R1 order: identity, exposure, actionable findings.
- Preserve canonical capability lifecycle: `idle -> queued -> running -> success|failed|unavailable` and retain completed evidence during later failures/retries.
- Preserve browser-local anonymous continuity; authenticated import remains explicit and server ownership derives from authenticated identity.
- Normalize and validate domains server-side with existing `sanitizeDomain`; never trust caller-provided normalized identity.
- Preserve legacy scan routes and legacy result consumers through adapters; do not promote capability-shaped legacy payloads into the canonical API.
- Unavailable retry must distinguish transient runner availability from permanent dependency failure; do not mark every unavailable result retryable.
- Do not add analytics, batch scans, share links, recon provider work, admin migration, or speculative compatibility APIs.
- Use TDD with focused regression tests before implementation; use existing package scripts and test conventions.
- No commit or push until verification passes and the user explicitly requests integration; final PR update must state any remaining blockers honestly.

## File Map

**Modify:**
- `frontend/src/api/client.js` — parse investigation records and saved session records with their respective schemas.
- `frontend/src/api/client.test.js` — prove session-save response parsing and failure behavior.
- `server/src/routes/investigations.js` — canonicalize and validate submitted domains for start and claim requests.
- `server/src/routes/investigations.test.js` — reject unsafe/mismatched domains and prove no persistence call occurs.
- `frontend/src/services/scan.js` — expose a mapper from the existing WordPress scan payload to canonical identity, exposure, and findings.
- `frontend/src/services/wordpressCapabilityResult.js` — pure legacy-to-canonical WordPress result mapper.
- `frontend/src/services/wordpressCapabilityResult.test.js` — mapper contract and no-false-claim tests.
- `frontend/src/services/scanCapabilities.js` — apply mapper at WordPress runner boundary and classify unavailable retry metadata.
- `frontend/src/services/scanCapabilities.test.js` — test production runner output shape and retry classification.
- `frontend/src/services/anonymousInvestigations.js` — replace timestamp-only ordering with monotonic snapshot revision plus terminal-state tie-break.
- `frontend/src/services/anonymousInvestigations.test.js` — test same-timestamp progress/terminal writes and revision persistence.
- `frontend/src/services/investigationSession.js` — add recovery for interrupted queued/running snapshots and preserve retryable/error invariants.
- `frontend/src/services/investigationSession.test.js` — test interrupted-session recovery and dependency versus runner unavailable retry behavior.
- `frontend/src/components/pages/ScanPage.jsx` — recover hydrated active sessions and route recent-domain rescans through canonical submit/controller.
- `frontend/src/components/pages/ScanPage.test.jsx` — test anonymous/authenticated reload recovery and recent-domain replacement.
- `frontend/src/components/pages/scan/ScanStatusStack.jsx` — render retry only from canonical retry metadata while handling unavailable states correctly.
- `frontend/src/components/pages/scan/ScanStatusStack.test.jsx` — test transient unavailable retry and permanent dependency unavailability.
- `frontend/src/utils/evidence.js` — normalize canonical evidence references using finding/identity `evidenceLevel` while retaining legacy entry-level status.
- `frontend/src/utils/evidence.test.js` — dual-format evidence normalization tests.
- `frontend/src/components/pages/scan/sections/OverviewSection.jsx` — pass canonical finding metadata into evidence normalization without changing legacy display semantics.
- `frontend/src/components/pages/scan/sections/scanSectionCards.test.jsx` — prove canonical actionable findings and evidence labels render.
- `docs/research/2026-09-10-r1-validation-log.md` — append fix-wave verification and preserve explicit R1 gate status.

## Task 1: Fix Investigation API Response Contracts

**Files:** Modify `frontend/src/api/client.js`, `frontend/src/api/client.test.js`.

**Interfaces:**
- `startInvestigation()`, `fetchInvestigation()`, and `claimAnonymousInvestigation()` continue returning parsed `investigationRecordSchema` data.
- `saveInvestigationSession(investigationId, session)` returns parsed `sessionRecordSchema` data because `POST /api/investigations/:id/sessions/:sessionId` returns `{ status: 'success', data: { recordType: 'session', session, persistedAt } }`.
- Keep envelope validation and server error extraction shared; only payload schema selection changes.

- [ ] **Step 1: Write failing API tests.** Add a mocked successful session-save response containing `recordType: 'session'`, `session`, and `persistedAt`; assert `saveInvestigationSession()` returns it. Add a malformed session payload test asserting `Invalid investigation response`.
- [ ] **Step 2: Run focused test and verify failure.** Run `pnpm --filter frontend exec vitest run src/api/client.test.js`; expected current implementation rejects the valid session response because it parses it as an investigation record.
- [ ] **Step 3: Implement schema-specific response parsing.** Add a small `requestInvestigation(path, options, dataSchema = investigationRecordSchema)` helper parameter or a dedicated `requestInvestigationSession()` helper. Use `sessionRecordSchema` only for `saveInvestigationSession`; keep all other callers on `investigationRecordSchema`.
- [ ] **Step 4: Run focused tests and typecheck.** Run `pnpm --filter frontend exec vitest run src/api/client.test.js` and `pnpm --filter frontend run typecheck`; both must pass.

## Task 2: Enforce Server-Side Domain Identity

**Files:** Modify `server/src/routes/investigations.js`, `server/src/routes/investigations.test.js`.

**Interfaces:**
- Use existing `sanitizeDomain` from `server/src/utils/domain.js` as server authority.
- Start request: validate request shape, sanitize `input.domain.submitted`, reject when sanitizer returns null, and pass `{ submitted: input.domain.submitted, normalized: sanitized.normalized }` to `createInvestigation`.
- Claim request: validate the browser record, sanitize `input.domain.submitted`, require the sanitized normalized value to match the submitted record's normalized identity, then pass a reconstructed canonical domain to `claimAnonymousInvestigation`.
- Error remains a normal validation envelope with no database write.

- [ ] **Step 1: Add failing route tests.** Mock persistence functions and send start/claim requests containing `http://localhost`, an IP/private host, malformed labels, and a valid submitted URL with a forged normalized domain. Assert 4xx, sanitizer rejection, and zero create/claim calls. Add a valid URL normalization test asserting persistence receives server-derived normalized identity.
- [ ] **Step 2: Run route tests and verify failure.** Run `pnpm --filter wp-json-discovery-server exec jest src/routes/investigations.test.js --runInBand`; current route passes unsafe or forged domain values through.
- [ ] **Step 3: Implement one route-local canonicalization helper.** Call `sanitizeDomain(input.domain.submitted)` after contract parsing. Replace caller normalized data with sanitized output; for claim, reject mismatch rather than silently mutating browser evidence. Do not duplicate sanitizer rules.
- [ ] **Step 4: Run route/domain tests and typecheck.** Run `pnpm --filter wp-json-discovery-server exec jest src/routes/investigations.test.js src/utils/domain.test.js --runInBand`, `pnpm --filter wp-json-discovery-server run typecheck`, and `pnpm --filter wp-json-discovery-server run lint`.

## Task 3: Adapt Legacy WordPress Results to Canonical Findings

**Files:** Create `frontend/src/services/wordpressCapabilityResult.js`, `frontend/src/services/wordpressCapabilityResult.test.js`; modify `frontend/src/services/scan.js`, `frontend/src/services/scanCapabilities.js`, and `frontend/src/services/scanCapabilities.test.js`.

**Interfaces:**
- Add pure `toWordpressCapabilityResult(legacyResult, domainIdentity)` returning the existing legacy fields plus canonical:
  - `identity: { value, evidence, evidenceLevel, source, reason }`.
  - `findings: Finding[]` with stable IDs, consequence, `evidenceLevel`, summary, and evidence references.
  - canonical exposure records/reasons where legacy exposure data supports them.
- Mapper must never infer WordPress identity from a missing or failed response. Successful `/wp-json/` response may produce observed identity from the response/site URL fields; otherwise identity is unavailable with explicit reason.
- Evidence references remain `{ id, capabilityId, locator }`; status comes from enclosing `evidenceLevel`.
- `SCAN_CAPABILITIES[WORDPRESS].runner` returns mapped output, while existing `scanDomain()` consumers still receive legacy fields.

- [ ] **Step 1: Write mapper tests.** Cover a representative successful `scanDomain()` result, a result with no identity source, exposure records, and a failed/empty result. Assert canonical identity, at least one actionable finding for supported exposure evidence, stable evidence references, and no false WordPress claim when source data is absent.
- [ ] **Step 2: Run mapper/capability tests and verify failure.** Run `pnpm --filter frontend exec vitest run src/services/scanCapabilities.test.js src/services/wordpressCapabilityResult.test.js`; current runner lacks canonical identity/findings.
- [ ] **Step 3: Implement mapper at runner boundary.** Keep network probing and legacy result construction intact in `scan.js`. Export the pure mapper from `wordpressCapabilityResult.js`; map only in the WordPress capability runner, using the already normalized domain identity supplied by the engine.
- [ ] **Step 4: Run focused scan tests and typecheck.** Run `pnpm --filter frontend exec vitest run src/services/scan.test.js src/services/scanCapabilities.test.js src/services/wordpressCapabilityResult.test.js src/services/wordpressCapabilityOutcome.test.js`, then frontend typecheck/lint.

## Task 4: Make Snapshot Ordering Monotonic

**Files:** Modify `frontend/src/services/anonymousInvestigations.js`, `frontend/src/services/anonymousInvestigations.test.js`.

**Interfaces:**
- Stored v1 records gain an internal numeric `revision` that is monotonic for writes in this browser; old v1 records without revision remain readable with revision `0`.
- `saveAnonymousInvestigation(snapshot)` accepts optional `snapshot.revision` from the engine/controller, otherwise derives a safe next revision from current storage.
- Newer revision wins. Equal revision uses terminal precedence `failed|unavailable|success > running|queued > idle`; equal terminal state keeps the later deterministic serialized snapshot only when its content differs.
- Persisted contract payload remains valid; revision is storage metadata, not part of `sessionRecordSchema`.

- [ ] **Step 1: Add fake-timer regression tests.** Freeze time, save queued/running snapshot, save failed/completed snapshot at identical `persistedAt`, and assert terminal snapshot remains. Add reload test proving revision survives storage round trip and an old no-revision record is upgraded safely.
- [ ] **Step 2: Run focused tests and verify failure.** Run `pnpm --filter frontend exec vitest run src/services/anonymousInvestigations.test.js`; current timestamp comparison rejects the equal-millisecond terminal snapshot.
- [ ] **Step 3: Implement revision and deterministic tie-break.** Keep schema validation and storage-failure behavior. Strip/ignore storage metadata before contract validation and return normalized snapshot with metadata needed by the controller.
- [ ] **Step 4: Run focused tests and lint.** Run the focused test file, frontend typecheck, and frontend lint.

## Task 5: Recover Interrupted Sessions and Correct Retry Semantics

**Files:** Modify `frontend/src/services/investigationSession.js`, its tests, `frontend/src/components/pages/scan/ScanStatusStack.jsx`, its tests, and `frontend/src/components/pages/ScanPage.jsx`/tests as needed.

**Interfaces:**
- Add `recoverInvestigationSession(session)` as a pure helper. It converts queued/running capability states from a prior browser/server snapshot into terminal `failed` states with `{ code: 'interrupted', retryable: true }`, retaining any successful capability outcomes and evidence. Top-level status becomes `completed` or `incomplete` according to existing contract semantics, never remains stuck queued/running after hydration.
- `unavailableState()` accepts a reason/code and sets retryability explicitly. `runner_unavailable` is retryable; `dependency_unavailable` is not retryable unless the dependency itself is the selected retry target. Permanent policy/auth unavailability remains non-retryable.
- UI renders retry only when canonical `capability.outcome.error.retryable === true`; it must not invent retryability from status alone.

- [ ] **Step 1: Add engine tests.** Assert recovery preserves successful WordPress evidence, converts queued/running states to retryable interrupted failures, and leaves terminal sessions unchanged. Assert runner-unavailable renders retry control while dependency-unavailable does not.
- [ ] **Step 2: Run focused engine/status tests and verify failure.** Run `pnpm --filter frontend exec vitest run src/services/investigationSession.test.js src/components/pages/scan/ScanStatusStack.test.jsx`; current hydration can leave active sessions stuck and unavailable retry is not exposed consistently.
- [ ] **Step 3: Implement recovery during both anonymous and authenticated hydration.** Call recovery before `setInvestigatorSession`; persist the recovered snapshot so reload is no longer stuck. Do not auto-run network work during hydration; user invokes retry explicitly.
- [ ] **Step 4: Implement explicit unavailable classification.** Preserve dependency propagation from the engine and make runner lookup/temporary availability errors retryable only where retry can actually rerun a capability.
- [ ] **Step 5: Run focused tests, typecheck, and lint.** Require engine/status/page tests, frontend typecheck, and frontend lint to pass.

## Task 6: Route Recent-Domain Rescans Through Canonical Flow

**Files:** Modify `frontend/src/components/pages/ScanPage.jsx`, `frontend/src/components/pages/ScanPage.test.jsx`, and `frontend/src/components/pages/scan/RecentDomainsCard.jsx` only if prop naming or testability requires it.

**Interfaces:**
- `RecentDomainsCard.onRescan` receives a canonical controller callback, not legacy `startScan`.
- Rescan submits the selected domain through the same `handleInvestigatorSubmit` path as the main form, replacing the visible canonical session and starting a new investigation/session as appropriate for auth state.
- Existing recent-domain refresh/save/clear behavior remains unchanged.

- [ ] **Step 1: Add failing page tests.** Click a recent-domain rescan and assert canonical start is called, legacy `startScan` is not called, the displayed domain changes immediately, and old session results are not shown as the new run.
- [ ] **Step 2: Run focused page tests and verify failure.** Run `pnpm --filter frontend exec vitest run src/components/pages/ScanPage.test.jsx`; current callback uses legacy startScan.
- [ ] **Step 3: Wire canonical callback.** Pass a callback that calls `handleInvestigatorSubmit(domain, domain)` or equivalent normalized/submitted pair. Clear/reset relevant transient retry/error state through the same guarded submit path.
- [ ] **Step 4: Run page/status/section tests and typecheck.** Run the focused page suite plus frontend typecheck/lint.

## Task 7: Normalize Canonical Evidence Correctly

**Files:** Modify `frontend/src/utils/evidence.js`, `frontend/src/components/pages/scan/sections/OverviewSection.jsx`, and related tests.

**Interfaces:**
- `normalizeEvidence(evidence, metadata)` supports two inputs:
  - Legacy entries with per-entry `status`, `source`, and `reason`.
  - Canonical evidence references with no per-entry status, where `metadata.evidenceLevel` supplies status and each reference supplies provenance via `capabilityId`/`locator`.
- Canonical evidence with `evidenceLevel: 'observed'|'corroborated'|'inferred'` is successful and renders its exact label; canonical unavailable metadata renders unavailable with source/reason.
- Preserve deterministic sorting/deduplication and existing legacy evidence tests.

- [ ] **Step 1: Add failing evidence/UI tests.** Assert canonical finding evidence renders `Observed`/`Corroborated`/`Inferred` rather than unavailable, source derives deterministically from capability IDs/locators, and empty canonical evidence remains safe. Preserve a legacy mixed-success/unavailable case.
- [ ] **Step 2: Run focused tests and verify failure.** Run `pnpm --filter frontend exec vitest run src/utils/evidence.test.js src/components/pages/scan/sections/scanSectionCards.test.jsx`; current canonical references are classified unavailable because status is absent from each reference.
- [ ] **Step 3: Implement dual-format normalization.** Detect reference entries by shape, apply metadata evidence level, retain legacy entry statuses, and canonicalize source/reason output before rendering.
- [ ] **Step 4: Run focused section tests and lint/typecheck.** Require evidence, overview, exposure, and integration tests plus frontend lint/typecheck.

## Task 8: Full Verification, Validation Record, and PR Update

**Files:** Modify `docs/research/2026-09-10-r1-validation-log.md`; no source edits in this task unless verification exposes a regression assigned back to the relevant task.

- [ ] **Step 1: Run contract and package verification.** Run `pnpm typecheck`; run contracts tests; run targeted frontend tests covering API, engine, capability mapper, anonymous continuity, page, status, evidence, and scan sections; run targeted server route/domain/investigation tests.
- [ ] **Step 2: Run quality checks.** Run `pnpm --filter frontend run lint`, `pnpm --filter wp-json-discovery-server run lint`, `pnpm --filter frontend run build`, and `git diff --check`.
- [ ] **Step 3: Run broader suites with blockers recorded verbatim.** Run frontend unit fallback, browser tests, and server tests using repository commands. Record missing Playwright Chromium, Vitest/browser mismatch, Jest ESM/argument issues, unrelated AdminPage failures, or activity-pruning failures only if they still reproduce.
- [ ] **Step 4: Update validation log.** Append the fix-wave commit/working-tree verification, Codex finding coverage, and the unchanged R1 gate: four authorized live walkthroughs, remote Turso contention, and any test-infrastructure blockers remain explicit.
- [ ] **Step 5: Review the complete diff and PR.** Inspect `git status`, `git diff --stat`, `git diff`, recent log, remote tracking, and PR #34. After user authorizes integration, commit with a Conventional Commit message, push, and update PR #34 description with fixed findings, verification, and remaining next steps.

## Self-Review Checklist

- [x] P1 API response parsing covered by Task 1.
- [x] P1 active-session hydration recovery covered by Task 5.
- [x] P1 production legacy-to-canonical mapper covered by Task 3.
- [x] P1 unavailable retry distinction covered by Task 5.
- [x] P1 recent-domain canonical rescan covered by Task 6.
- [x] P2 monotonic anonymous ordering covered by Task 4.
- [x] P2 canonical evidence-level handling covered by Task 7.
- [x] P1 server domain sanitization and normalized-value distrust covered by Task 2.
- [x] R1 constraints, legacy compatibility, ownership, and no-speculative-scope rules are repeated in Global Constraints.
- [x] No step depends on an undefined function, schema, fixture, command, or file.
- [x] Mapper ownership is explicit: `wordpressCapabilityResult.js` is created and used at the WordPress runner boundary.
