# Square Surface Radius Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove structural rounded corners from frontend surfaces while preserving intentional pills and circular indicators.

**Architecture:** Keep the existing CSS ownership and token layer. Set shared structural radius tokens to `0px`, then replace direct structural radius literals in the three owning stylesheet areas. Preserve `999px` for status/namespace pills and `50%` for circular avatars or icons; do not add a global override that could affect third-party or intentionally rounded content.

**Tech Stack:** CSS custom properties, React/Vite frontend, Storybook 10, Vitest, Impeccable detector.

---

## File Map

- Modify `frontend/src/index.css`: make shared structural radius tokens square.
- Modify `frontend/src/App.css`: replace structural radius literals and preserve pill/circle exceptions.
- Modify `frontend/src/styles/components.controls.css`: remove direct control rounding.
- Modify `frontend/src/styles/pages.history.css`: remove direct structural rounding while retaining pill indicators.
- Inspect existing Storybook stories, without creating new stories unless an existing surface lacks coverage.
- No application behavior, route logic, or metadata files change.

## Task 1: Square Shared Radius Tokens

**Files:**
- Modify: `frontend/src/index.css:105-108`

- [ ] **Step 1: Confirm token consumers and baseline declarations**

From `frontend`, run:

```bash
rg -n -- "--radius-md|--radius-lg|--control-border-radius|border-radius" src/index.css src/App.css src/styles/components.controls.css src/styles/pages.history.css
```

Confirm the three shared structural tokens currently resolve to `12px`, `16px`, and `10px` respectively, and record intentional `999px`/`50%` exceptions.

- [ ] **Step 2: Set structural tokens to square values**

Update `frontend/src/index.css`:

```css
--radius-md: 0px;
--radius-lg: 0px;
--control-border-radius: 0px;
```

Do not change pill or circular declarations in this file.

- [ ] **Step 3: Run the detector and inspect remaining declarations**

Run:

```bash
../.agents/skills/impeccable/scripts/impeccable detect src
```

Expected: token-based structural radius advisories disappear or reduce; remaining radius findings must be direct literals requiring selector-level review.

- [ ] **Step 4: Commit token migration**

```bash
git add frontend/src/index.css
git commit -m "style: square structural radius tokens"
```

## Task 2: Remove Structural Rounding From App Styles

**Files:**
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Classify every App.css radius declaration**

Run:

```bash
rg -n -C 2 "border-radius" src/App.css
```

Classify each declaration using these exact rules:

- `0px` for cards, controls, inputs, dialogs, tables, panels, and structural surfaces.
- `999px` only for status badges, namespace pills, and explicitly pill-shaped indicators.
- `50%` only for circular avatars or icons.
- No remaining structural `4px`, `6px`, `8px`, `10px`, or `12px` values.

- [ ] **Step 2: Replace structural literals at their owning selectors**

For each structural selector identified in Step 1, replace the radius with `0px` or an already-square structural token. For example, a structural rule must become:

```css
.surface {
  border-radius: 0;
}
```

Do not change these intentional forms:

```css
border-radius: 999px;
```

Do not alter spacing, colors, typography, layout, or interaction behavior in this task.

- [ ] **Step 3: Re-scan for forbidden structural values**

Run:

```bash
rg -n "border-radius:\s*(4|6|8|10|12)px|var\(--radius-(md|lg)\)|var\(--control-border-radius\)" src/App.css
```

Expected: no direct structural values remain; token references are allowed only if their values are now `0px`. Inspect any match before proceeding.

- [ ] **Step 4: Commit App.css migration**

```bash
git add frontend/src/App.css
git commit -m "style: square app surfaces"
```

## Task 3: Square Controls and History Surfaces

**Files:**
- Modify: `frontend/src/styles/components.controls.css`
- Modify: `frontend/src/styles/pages.history.css`

- [ ] **Step 1: Inspect direct radius declarations in both stylesheet areas**

Run:

```bash
rg -n -C 2 "border-radius" src/styles/components.controls.css src/styles/pages.history.css
```

Identify direct `10px` control/history values, token references now resolving to `0px`, the history `999px` pill, and any `50%` circular indicator.

- [ ] **Step 2: Replace structural control and history radii**

Set direct structural `10px` values and structural token references to `0px`. Preserve the history pill declaration as `999px` and any circular indicator as `50%`.

Example structural result:

```css
.control,
.history-panel {
  border-radius: 0;
}
```

- [ ] **Step 3: Run repository-wide radius classification**

Run:

```bash
rg -n "border-radius" src
```

Every nonzero result must be either `999px` for an explicitly pill-shaped indicator or `50%` for a circular avatar/icon. Existing component-library classes are in scope for review only when they render these application surfaces; do not rewrite generated third-party class strings.

- [ ] **Step 4: Commit control and history migration**

```bash
git add frontend/src/styles/components.controls.css frontend/src/styles/pages.history.css
git commit -m "style: square controls and history surfaces"
```

## Task 4: Verify Visual Surfaces and Static Quality

**Files:**
- No test or Storybook source changes expected.

- [ ] **Step 1: Run focused Storybook tests**

Use the connected Storybook MCP runner with accessibility enabled for these discovered story IDs:

- `components-atoms-button--primary`
- `components-atoms-button--secondary`
- `components-atoms-button--ghost`
- `components-molecules-forms-domainform--uncontrolled`
- `components-molecules-forms-domainform--scan-settings-expanded`
- `components-pages-historypage--default`
- `components-pages-historypage--with-runs-open`
- `pages-investigationspage--empty`
- `components-pages-scan-scanstatusstack--idle`
- `components-pages-scan-scanstatusstack--scanning`
- `components-pages-scan-scanstatusstack--homepage-running`
- `components-pages-scan-scanstatusstack--with-errors`

Expected: no new component or accessibility failures. If the known Vitest browser-provider startup failure persists, capture it separately from story failures.

- [ ] **Step 2: Preview affected stories**

Use Storybook preview for Button, DomainForm, HistoryPage, InvestigationsPage, and ScanStatusStack stories. Inspect desktop and 390px mobile viewport states. Confirm cards, controls, inputs, dialogs, tables, and panels are square while status/namespace pills remain pill-shaped.

- [ ] **Step 3: Run static checks**

From `frontend`, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Expected: build succeeds; lint has no new errors; existing warnings are compared against the seven-warning baseline.

- [ ] **Step 4: Run Impeccable detector and radius audit**

Run:

```bash
../.agents/skills/impeccable/scripts/impeccable detect src
rg -n "border-radius" src
```

Expected: no structural rounded values remain in the targeted stylesheet areas. Any remaining advisory must be an intentional pill/circle exception or documented generated-library styling.

- [ ] **Step 5: Review diff and status**

Run:

```bash
git diff --check
git status --short
git log --oneline -6
```

Confirm only planned CSS changes are present and no `robots.txt`, `llms.txt`, scan logic, or unrelated user changes were modified.
