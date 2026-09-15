# R1 Scan Progress Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace verbose initial scan status cards with a persistent accessible four-segment summary, restore the current domain in the header, and reduce mobile domain-form height.

**Architecture:** Keep capability state in the existing investigation session. Refactor the scan status presentation so `ScanProgress` owns only the compact four-capability summary while existing detailed sections remain responsible for evidence and retry actions. Expose restored investigator domain through the scan shell context so the app header has one display source for both legacy and investigator scans.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Testing Library, existing CSS and UI components.

**TypeScript Scope:** New source and test files use `.tsx`. Existing `.jsx` files touched by this plan are renamed to `.tsx` and receive focused prop/state types. Unrelated frontend files remain JavaScript until separately migrated.

---

### Task 1: Migrate Touched Scan Components To TypeScript

**Files:**
- Rename: `frontend/src/components/pages/scan/ScanStatusStack.jsx` to `frontend/src/components/pages/scan/ScanStatusStack.tsx`
- Rename: `frontend/src/components/pages/scan/ScanStatusStack.test.jsx` to `frontend/src/components/pages/scan/ScanStatusStack.test.tsx`
- Rename: `frontend/src/components/pages/ScanPage.jsx` to `frontend/src/components/pages/ScanPage.tsx`
- Rename: `frontend/src/components/pages/ScanPage.test.jsx` to `frontend/src/components/pages/ScanPage.test.tsx`

- [ ] **Step 1: Rename touched scan files and preserve import paths**

Rename only the files listed above. Keep runtime behavior unchanged and let Vite resolve extensionless imports.

- [ ] **Step 2: Add focused types without broad frontend migration**

Type component props, event handlers, and local scan-state values needed by TypeScript. Preserve existing runtime validation and avoid converting unrelated imported JavaScript modules.

- [ ] **Step 3: Run scan-page and status tests plus typecheck**

Run:

```bash
pnpm --filter frontend exec vitest run --project unit src/components/pages/ScanPage.test.tsx src/components/pages/scan/ScanStatusStack.test.tsx
pnpm --filter frontend run typecheck
```

Expected: PASS. This establishes the migration baseline before adding the new component.

### Task 2: Add Failing Progress Summary Tests

**Files:**
- Create: `frontend/src/components/pages/scan/ScanProgress.test.tsx`
- Create later: `frontend/src/components/pages/scan/ScanProgress.tsx`

- [ ] **Step 1: Write tests for fixed segment order and all states**

Create tests that render the existing investigator `capabilityStates` shape, which currently uses `wordpress` and `homepage` for the initial scan. The visible `Identity`, `Exposure`, and `WordPress API` segments are derived from the WordPress capability; the visible `Homepage` segment is derived from the Homepage capability. Do not invent `identity` or `exposure` runner IDs.

Assert these behaviors:

```jsx
it('renders four initial capabilities in product order', () => {
  render(<ScanProgress capabilityStates={states} />);

  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    expect.stringContaining('Identity'),
    expect.stringContaining('Exposure'),
    expect.stringContaining('Homepage'),
    expect.stringContaining('WordPress API')
  ]);
});

it.each(['pending', 'running', 'complete', 'unavailable', 'failed'])(
  'represents %s without relying on color',
  (status) => {
    render(<ScanProgress capabilityStates={statesWith(status)} />);

    expect(screen.getByText(new RegExp(status, 'i'))).toBeInTheDocument();
  }
);

it('keeps completed summary visible and exposes aggregate progress', () => {
  render(<ScanProgress capabilityStates={allCompleteStates} />);

  expect(screen.getByRole('status')).toHaveTextContent('4 of 4');
  expect(screen.getByText('Identity')).toBeInTheDocument();
  expect(screen.getByText('WordPress API')).toBeInTheDocument();
});
```

Use `success` as the source-session equivalent of display state `complete`; map `idle`/missing to `pending`. Keep assertions focused on user-visible behavior. Do not add retry buttons to this component.

- [ ] **Step 2: Run the new test and verify it fails for the missing component**

Run:

```bash
pnpm --filter frontend exec vitest run --project unit src/components/pages/scan/ScanProgress.test.tsx
```

Expected: FAIL because `ScanProgress` does not yet render the required four-segment summary.

### Task 3: Implement Progress Summary And Status Refactor

**Files:**
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.tsx`
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.test.tsx`
- Modify: `frontend/src/components/pages/ScanPage.tsx`
- Modify: `frontend/src/components/pages/scan/ScanProgress.tsx`

- [ ] **Step 1: Implement `ScanProgress` with a fixed capability model**

Define one ordered configuration in `ScanProgress.jsx` containing the four visible segments and their source capability data. Normalize existing investigator statuses to the display states `pending`, `running`, `complete`, `unavailable`, and `failed`. Derive completed count from normalized state; treat unavailable and failed as terminal but not complete. Render:

```jsx
<section aria-labelledby="scan-progress-heading">
  <h2 id="scan-progress-heading">Scan progress</h2>
  <p role="status" aria-live="polite">{summary}</p>
  <ol aria-label="Initial scan capabilities">...</ol>
</section>
```

Use visible text or symbols in each segment so unavailable and failed states are distinguishable without color. Preserve the existing `PropTypes` convention.

- [ ] **Step 2: Replace success/action cards while preserving detailed retry behavior**

Refactor `ScanStatusStack` so investigator sessions render `ScanProgress` instead of the current Identity, Exposure, Action, and per-capability success cards. Retain failure/unavailable detail and retry controls only where they are currently the established retry surface. Do not include Sitemap in `ScanProgress`; keep its existing status/action path separate.

Update `ScanStatusStack.test.jsx` assertions that expect the removed stacked success text to assert the compact summary and segment labels instead. Keep tests for retryability, auth hints, and legacy session rendering unchanged unless the refactor requires their selectors to move.

- [ ] **Step 3: Run focused progress and status tests**

Run:

```bash
pnpm --filter frontend exec vitest run --project unit src/components/pages/scan/ScanProgress.test.jsx src/components/pages/scan/ScanStatusStack.test.jsx
```

Expected: PASS, with no retry controls exposed by `ScanProgress` itself.

### Task 4: Migrate Context, Header, And Domain Form To TypeScript

**Files:**
- Rename: `frontend/src/context/ScanContext.jsx` to `frontend/src/context/ScanContext.tsx`
- Rename: `frontend/src/App.jsx` to `frontend/src/App.tsx`
- Rename: `frontend/src/App.test.jsx` to `frontend/src/App.test.tsx` if created or touched
- Rename: `frontend/src/components/molecules/forms/DomainForm.jsx` to `frontend/src/components/molecules/forms/DomainForm.tsx`
- Rename: `frontend/src/components/molecules/forms/DomainForm.test.jsx` to `frontend/src/components/molecules/forms/DomainForm.test.tsx`

- [ ] **Step 1: Rename touched context, app, and form files**

Rename only files needed by Tasks 5 and 6. Preserve extensionless imports and runtime behavior.

- [ ] **Step 2: Type context, app, and form boundaries**

Add focused types for context values, component props, form events, and callback signatures. Keep existing PropTypes where present for runtime validation; do not migrate unrelated dependencies.

- [ ] **Step 3: Run typecheck before behavior changes**

Run `pnpm --filter frontend run typecheck`. Expected: PASS.

### Task 5: Restore Current Domain In App Header

**Files:**
- Modify: `frontend/src/context/ScanContext.tsx`
- Modify: `frontend/src/components/pages/ScanPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/pages/ScanPage.test.tsx`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Add a failing restoration assertion**

Extend the existing anonymous restoration test to assert that restoring a persisted `wordpress.org` investigation also updates the shell-level current scan domain consumed by the header. Add `App.test.jsx` only if no existing app-level test can render `AppContent`; mock authentication and lazy page dependencies at the same boundary used by the existing frontend test setup. The assertion must fail against the current implementation, which restores `investigatorSession` but leaves `activeDomain` empty.

- [ ] **Step 2: Add one shell-level current-domain setter/source**

Extend `ScanContext` with `investigatorDomain` and `setInvestigatorDomain`. Expose `currentScanDomain` as `scanActiveDomain || investigatorDomain`, keeping legacy `useScan().activeDomain` working. The header display source must not use the typed-but-not-submitted `domain` value.

- [ ] **Step 3: Update all investigator restoration and submission paths**

Set the current scan domain when:

- An anonymous snapshot is restored.
- An authenticated investigation is restored.
- A new investigator session is submitted.
- A claimed anonymous investigation is loaded.

Use the normalized domain identity. Do not change persistence or scan execution behavior.

- [ ] **Step 4: Make the header consume restored domain state**

Change `AppContent` so `Current scan:` reads the unified current-scan domain source. Keep `none yet` only when no scan has been submitted or restored.

- [ ] **Step 5: Run restoration and scan-page tests**

Run:

```bash
pnpm --filter frontend exec vitest run --project unit src/components/pages/ScanPage.test.jsx src/context/ScanContext.test.jsx
```

Expected: PASS, including the restored-domain assertion. If `ScanContext.test.jsx` does not exist, run the existing ScanPage suite and add the smallest context test seam needed to prove the header source.

### Task 6: Reduce Mobile Domain Form Height

**Files:**
- Modify: `frontend/src/App.css`
- Test: `frontend/src/components/molecules/forms/DomainForm.test.tsx`

- [ ] **Step 1: Add a failing DOM/style contract test**

Extend `DomainForm.test.jsx` to assert the input remains a single-line text input and that mobile layout classes are present on the controls wrapper. Keep the label and button accessible by role/name.

- [ ] **Step 2: Apply minimal responsive CSS**

Keep the existing mobile column layout. Set the input’s mobile height through the project’s existing input sizing conventions, targeting approximately 48px without changing desktop sizing. Ensure the button remains full width and the form does not introduce horizontal overflow.

- [ ] **Step 3: Run DomainForm tests and frontend build**

Run:

```bash
pnpm --filter frontend exec vitest run --project unit src/components/molecules/forms/DomainForm.test.tsx
pnpm --filter frontend run build
```

Expected: PASS and successful production build.

### Task 7: Full Focused Verification

**Files:**
- Verify only: all files changed by Tasks 1-4

- [ ] **Step 1: Run the R1 focused unit suite**

Run:

```bash
pnpm --filter frontend exec vitest run --project unit src/components/pages/ScanPage.test.tsx src/components/pages/scan/ScanProgress.test.tsx src/components/pages/scan/ScanStatusStack.test.tsx src/components/molecules/forms/DomainForm.test.tsx src/services/scanSession.test.js src/services/anonymousInvestigations.test.js src/services/investigationSession.test.js src/utils/evidence.test.js
```

Expected: all selected tests pass.

- [ ] **Step 2: Run lint and inspect changed files**

Run:

```bash
pnpm --filter frontend run lint
git diff --check
git status --short
```

Expected: lint and diff checks pass; only intended frontend files and the approved spec/plan are changed.

- [ ] **Step 3: Perform browser smoke checks with Chromium**

Run the frontend and server, then verify:

- Fresh scan shows four compact segments and no verbose success stack.
- Completed scan keeps the four-segment summary visible.
- Failed/unavailable segment has a non-color text cue and retry remains in detailed content.
- Refresh restores the domain in the `Current scan:` header.
- Mobile form stacks input/button and input no longer appears tall.
- Sitemap remains separate from initial four-segment progress.
