# Frontend Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve verified frontend audit findings in accessibility, namespace badge theming, token usage, and production chunking without changing scan behavior or metadata scope.

**Architecture:** Keep fixes at their current owners: `AppLayout` owns brand semantics, `App.css`/`index.css` own the existing tokenized namespace styles, and `vite.config.js` owns bundling. Extend existing unit and Storybook coverage rather than introducing new test infrastructure. Do not touch `robots.txt` or `llms.txt`.

**Tech Stack:** React 19, TypeScript/JSX, Vite 7, Vitest, Testing Library, Storybook 10, Tailwind CSS.

---

## File Map

- Modify `frontend/src/components/templates/AppLayout.tsx`: include visible brand text in the button accessible name.
- Modify `frontend/src/components/templates/AppLayout.test.tsx`: prove button naming and existing navigation behavior.
- Modify `frontend/src/App.css`: use existing typography/radius tokens for namespace badge styles and correct badge contrast.
- Modify `frontend/src/index.css` only if an existing semantic color token cannot meet the corrected namespace badge contrast requirement.
- Modify `frontend/vite.config.js`: add only evidence-backed manual chunks after measuring the current build.
- Modify `frontend/src/components/organisms/summary/ScanSummary` tests or add its nearest existing test: verify namespace badge rendering and status variants if a suitable test seam exists.
- Modify affected Storybook stories only if existing stories cover the changed surface; do not create speculative stories.

## Task 1: Lock Down Brand Accessible Name

**Files:**
- Modify: `frontend/src/components/templates/AppLayout.test.tsx`
- Modify: `frontend/src/components/templates/AppLayout.tsx:28-36`

- [ ] **Step 1: Add failing accessible-name test**

Extend the existing `AppLayout` test suite with:

```tsx
it('includes visible brand title in navigation button accessible name', () => {
  render(
    <AppLayout title="WP JSON Discovery" onNavigate={vi.fn()}>
      <p>Main content</p>
    </AppLayout>
  );

  expect(
    screen.getByRole('button', {
      name: 'Back to main dashboard: WP JSON Discovery'
    })
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused unit test and verify failure**

Run from `frontend`:

```bash
pnpm vitest run src/components/templates/AppLayout.test.tsx --project unit
```

Expected: the new test fails because `aria-label` currently replaces the visible heading text.

- [ ] **Step 3: Implement minimal accessible-name fix**

Change the existing prop in `AppLayout.tsx` to:

```tsx
aria-label={onNavigate ? `Back to main dashboard: ${title}` : undefined}
```

Keep the conditional tag, button type, click handler, icon, and visible `<h1>` unchanged.

- [ ] **Step 4: Run focused test and verify pass**

Run the same focused command. Expected: both `AppLayout` tests pass.

- [ ] **Step 5: Commit isolated accessibility change**

```bash
git add frontend/src/components/templates/AppLayout.tsx frontend/src/components/templates/AppLayout.test.tsx
git commit -m "fix: include brand title in accessible name"
```

## Task 2: Correct Namespace Badge Contrast and Token Drift

**Files:**
- Modify: `frontend/src/App.css:966-989`
- Modify: `frontend/src/index.css` only if a new semantic badge token is required
- Test: nearest existing summary/panel test covering `ScanSummary`; otherwise add a focused render test beside `ScanSummary`

- [ ] **Step 1: Establish the failing contrast condition**

Confirm the current plugin badge declarations resolve to:

```css
background: var(--color-info-bg);
color: var(--color-primary-strong);
```

Use the browser/Lighthouse result as the baseline: `#3b82f6` on `#102338` is `4.32:1` at 12px normal text and fails the `4.5:1` threshold.

- [ ] **Step 2: Select a token-owned replacement**

Use `var(--color-primary)` first. It is the existing lighter blue token intended for readable primary emphasis and should be checked in the browser against `var(--color-info-bg)`. If it does not meet `4.5:1` in the rendered result, add a measured semantic `--color-info-text` hex value beside the existing info tokens in `index.css`; do not use `var(--color-primary-strong)` for this badge.

Choose the value by checking the rendered contrast, not by naming convention. Do not change core, unknown, or warning badge meanings.

- [ ] **Step 3: Replace hard-coded affected style values with existing tokens**

In the namespace badge block, replace the literal `0.75rem` with `var(--font-size-caption)` and replace the literal `999px` values only where the existing pill token is available or where the current design explicitly requires a pill. Preserve the namespace pill shape and spacing.

Use the existing semantic color token in `.namespace-pill__badge--plugin` and retain its existing background and border tokens.

- [ ] **Step 4: Add or update focused rendering coverage**

Render a summary fixture containing core, plugin, and unknown namespaces. Assert that all three labels and their status classes remain present. If the existing summary test harness cannot render this component without unrelated scan context, add a small test for the class-generation helper only if one already exists; otherwise rely on Lighthouse for contrast and do not create a mock-heavy test.

- [ ] **Step 5: Run focused tests and detector**

Run:

```bash
pnpm vitest run --project unit
../.agents/skills/impeccable/scripts/impeccable detect src
```

Expected: unit tests pass and detector reports no new anti-patterns. Existing advisory notes may remain if unrelated.

- [ ] **Step 6: Commit badge and token change**

```bash
git add frontend/src/App.css frontend/src/index.css frontend/src/components/organisms/summary frontend/src/components/organisms/panels
git commit -m "fix: improve namespace badge contrast"
```

Stage only files actually changed by this task.

## Task 3: Measure and Improve Production Chunking

**Files:**
- Modify: `frontend/vite.config.js` only if measurement identifies a safe split
- Do not modify application route behavior in `frontend/src/App.tsx`

- [ ] **Step 1: Capture current production bundle baseline**

Run from `frontend`:

```bash
pnpm build
```

Record the entry chunk, route chunks, and Vite warnings. Use the generated `dist/assets` names and sizes, not the previous audit values, as the current baseline.

- [ ] **Step 2: Identify shared dependency concentration**

Inspect the build output and Vite module graph to determine whether the oversized entry is caused by shared runtime dependencies or a route import that is accidentally eager. Confirm that `App.tsx` lazy imports remain dynamic and that no route module is imported statically from the shell.

- [ ] **Step 3: Add only safe manual chunks when justified**

If shared dependencies dominate the entry, add deterministic vendor groups in `frontend/vite.config.js` under `build.rollupOptions.output.manualChunks`, using package-name checks for dependencies already shared by multiple routes. Keep route modules in their existing lazy chunks. Do not split a dependency group that would be loaded on every route into multiple duplicate chunks.

If the entry is already mostly required shell code or manual chunks do not reduce initial bytes, make no Vite change and record that evidence in the implementation summary; the acceptance criterion allows a documented no-change decision.

- [ ] **Step 4: Rebuild and compare output**

Run `pnpm build` again. Expected: no new Vite warnings, or a documented reason why warning thresholds remain despite a safe split. Confirm the app still serves and route chunks remain emitted.

- [ ] **Step 5: Commit only if chunking improves safely**

```bash
git add frontend/vite.config.js
git commit -m "perf: split shared frontend bundles"
```

Do not create a commit if measurement proves no safe config change exists; include the no-change result in the final report instead.

## Task 4: Run Storybook and Full Frontend Verification

**Files:**
- No source changes expected unless verification exposes a regression.

- [ ] **Step 1: Discover affected Storybook stories**

Use the live Storybook documentation IDs already discovered. Run focused tests for `Button` and any story that renders summary/status badges. Do not invent story IDs; use IDs returned by `wp-json-sb-mcp`.

- [ ] **Step 2: Run focused Storybook tests**

Use `wp-json-sb-mcp_run-story-tests` with the affected story IDs and accessibility checks enabled. Expected: pass with no new accessibility violations.

- [ ] **Step 3: Run broad Storybook tests**

Run the complete Storybook test suite after focused tests pass. Expected: no failures. If the suite still reports the known infrastructure issue, capture the exact failure and distinguish it from component failures.

- [ ] **Step 4: Run static verification**

Run from `frontend`:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Expected: no new errors; existing lint warnings must be compared against the baseline seven warnings.

- [ ] **Step 5: Run Lighthouse accessibility snapshot**

Load the running frontend at `http://localhost:5173`, run a desktop accessibility snapshot, and verify:

- `color-contrast` passes for namespace badges.
- `label-content-name-mismatch` passes for the brand button.
- No new accessibility failures appear.

Do not treat the intentionally out-of-scope `robots.txt` or `llms.txt` findings as implementation failures.

- [ ] **Step 6: Review final diff and status**

Run:

```bash
git status --short
git diff --check
git log --oneline -5
```

Confirm only planned frontend changes are present and unrelated user changes remain untouched.
