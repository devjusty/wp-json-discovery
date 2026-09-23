# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the shared investigative visual system, ship the hybrid investigator workflow, then migrate investigations and admin into separate shells.

**Architecture:** Preserve existing scan contracts and capability runners. Move presentation and state orchestration behind focused shell, status, evidence, and report components; keep `ScanPage.tsx` as a thin composition root during migration. Build the investigator slice before changing broad admin behavior.

**Tech Stack:** React 19, TypeScript/TSX, Vite, Tailwind v4, shadcn-style UI primitives, TanStack Query, Vitest, Testing Library, Storybook, IBM Plex fonts, Hugeicons.

---

## File Map

### Shared system and shell

- Modify `frontend/src/theme.css`: add semantic dark-workspace, status, density, focus, and breakpoint tokens without changing existing primitive APIs.
- Modify `frontend/src/components/templates/AppLayout.tsx`: compose compact global header, report canvas, desktop contextual navigation, and mobile section selector.
- Modify `frontend/src/App.tsx`: reduce global navigation to `New scan`, `Investigations`, and account/help; route admin into its own shell while preserving authorization checks.
- Modify `frontend/src/App.css`: style the shell layout, report max width, responsive behavior, focus treatment, and reduced-motion behavior using theme tokens.
- Create `frontend/src/components/templates/InvestigatorShell.tsx`: define investigator-specific navigation and report layout inputs.
- Create `frontend/src/components/templates/AdminShell.tsx`: define the independent admin frame and navigation slot.

### Investigator workflow

- Modify `frontend/src/components/pages/ScanPage.tsx`: retain scan orchestration and replace direct layout decisions with `InvestigatorShell` and report components.
- Modify `frontend/src/components/pages/scan/ScanSidebarNav.tsx`: expose the canonical investigator sections and capability-aware navigation state.
- Modify `frontend/src/components/pages/scan/ScanStatusStack.tsx`: render queued, running, complete, partial, failed, and unavailable states with explicit labels and scoped retry actions.
- Create `frontend/src/components/pages/scan/InvestigatorOverview.tsx`: render intent-based summary and top findings.
- Create `frontend/src/components/pages/scan/InvestigatorFindings.tsx`: render prioritized findings with evidence labels.
- Create `frontend/src/components/pages/scan/EvidenceDisclosure.tsx`: render one expandable evidence presentation with observed/inferred/request-trace/absence metadata.
- Create `frontend/src/components/pages/scan/InvestigatorSectionSelector.tsx`: provide the mobile sticky section selector.
- Modify `frontend/src/services/investigationSession.js`: preserve independent capability updates and add any missing explicit partial-state derivation required by the UI.

### Tests and stories

- Modify `frontend/src/components/templates/AppLayout.test.tsx`: cover global shell, navigation labeling, and mobile navigation trigger.
- Create `frontend/src/components/templates/InvestigatorShell.test.tsx`: cover section navigation and report layout slots.
- Modify `frontend/src/components/pages/scan/ScanStatusStack.test.tsx`: cover all capability statuses and retry behavior.
- Create `frontend/src/components/pages/scan/InvestigatorOverview.test.tsx`: cover intent summary and partial evidence.
- Create `frontend/src/components/pages/scan/EvidenceDisclosure.test.tsx`: cover disclosure semantics and evidence labels.
- Modify `frontend/src/components/pages/InvestigationsPage.tsx`: migrate rows from table-only presentation to the shared report language after the vertical slice is stable.
- Modify `frontend/src/components/pages/InvestigationsPage.test.tsx`: cover local/remote rows, empty state, loading, retry, and resume actions after migration.
- Create `frontend/src/components/pages/admin/AdminInbox.tsx`: render operational inbox items without changing existing data queries.
- Modify `frontend/src/components/pages/AdminPage.tsx`: compose `AdminShell` and `AdminInbox`, retaining existing section implementations during migration.
- Create `frontend/src/components/pages/admin/AdminInbox.test.tsx`: cover item status, evidence preview, and navigation to existing admin sections.
- Create `frontend/src/components/templates/InvestigatorShell.stories.tsx`, `frontend/src/components/pages/scan/InvestigatorOverview.stories.tsx`, `frontend/src/components/pages/scan/EvidenceDisclosure.stories.tsx`, `frontend/src/components/templates/AdminShell.stories.tsx`, and `frontend/src/components/pages/admin/AdminInbox.stories.tsx` for loading, partial, failure, unavailable, and complete states.

## Task 1: Establish Semantic Theme Tokens

**Files:**
- Modify: `frontend/src/theme.css`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/components/templates/AppLayout.test.tsx`

- [ ] **Step 1: Write a token contract test**

Add a test that mounts the layout and asserts the document uses the existing dark theme plus named semantic classes for surface and status roles. The test should inspect class names and computed CSS custom properties only through the DOM contract, not hard-coded color values.

```tsx
it('exposes investigative surface and status roles', () => {
  render(<AppLayout title="Test" />);
  const root = document.querySelector('.app');
  expect(root).toHaveClass('app');
  expect(root).toHaveAttribute('data-theme', 'investigative');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter frontend test -- src/components/templates/AppLayout.test.tsx`

Expected: FAIL because `data-theme="investigative"` is not yet rendered.

- [ ] **Step 3: Add semantic token groups**

Add named variables to both `:root` and `.dark` in `frontend/src/theme.css` for `--surface-canvas`, `--surface-panel`, `--surface-raised`, `--text-primary`, `--text-secondary`, `--status-neutral`, `--status-attention`, `--status-risk`, `--status-success`, `--focus-ring`, `--content-max`, and `--shell-gap`. Keep `--radius: 0` and map the semantic values to existing OKLCH values rather than adding a second palette.

Add `.app[data-theme='investigative']` to `frontend/src/App.css`, set `color-scheme: dark`, and use the semantic variables for canvas, panels, text, focus outlines, and spacing. Add a `@media (prefers-reduced-motion: reduce)` rule that sets transition and animation durations to `0ms` for shell motion.

- [ ] **Step 4: Add the layout data attribute and rerun the test**

Render `data-theme="investigative"` on the root `<div className="app">` in `AppLayout.tsx`.

Run: `pnpm --filter frontend test -- src/components/templates/AppLayout.test.tsx`

Expected: PASS.

- [ ] **Step 5: Verify styling and commit**

Run: `pnpm --filter frontend lint`

Expected: PASS with no new lint errors.

Commit: `git add frontend/src/theme.css frontend/src/App.css frontend/src/components/templates/AppLayout.tsx frontend/src/components/templates/AppLayout.test.tsx && git commit -m "style: add investigative theme tokens"`

## Task 2: Build Hybrid Investigator Shell

**Files:**
- Create: `frontend/src/components/templates/InvestigatorShell.tsx`
- Create: `frontend/src/components/pages/scan/InvestigatorSectionSelector.tsx`
- Modify: `frontend/src/components/templates/AppLayout.tsx`
- Modify: `frontend/src/components/pages/scan/ScanSidebarNav.tsx`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/components/templates/InvestigatorShell.test.tsx`

- [ ] **Step 1: Write shell behavior tests**

Cover: desktop navigation renders section buttons; active section gets `aria-current="page"`; unavailable sections remain labeled; mobile trigger opens a named navigation region; report content renders in the main landmark.

```tsx
it('renders contextual navigation and report content', async () => {
  const user = userEvent.setup();
  render(
    <InvestigatorShell
      activeSection="overview"
      sections={[{ id: 'overview', label: 'Overview' }, { id: 'findings', label: 'Findings' }]}
      onSectionChange={vi.fn()}
    >
      <p>Report</p>
    </InvestigatorShell>,
  );
  expect(screen.getByRole('main')).toHaveTextContent('Report');
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('button', { name: /open sections/i }));
  expect(screen.getByRole('navigation', { name: /investigation sections/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter frontend test -- src/components/templates/InvestigatorShell.test.tsx`

Expected: FAIL because `InvestigatorShell` and the section selector do not exist.

- [ ] **Step 3: Implement shell components**

Define these explicit types in `InvestigatorShell.tsx`:

```ts
export type InvestigatorSection = {
  id: string;
  label: string;
  disabled?: boolean;
  unavailable?: boolean;
};

export type InvestigatorShellProps = {
  activeSection: string;
  sections: InvestigatorSection[];
  onSectionChange: (id: string) => void;
  children: ReactNode;
  headerActions?: ReactNode;
  onNavigate?: (page: string) => void;
};
```

Compose `AppLayout` with a report `<main>`, a desktop `<nav aria-label="Investigation sections">`, and `InvestigatorSectionSelector` for narrow screens. Use existing `Button`, `Sheet`, and `Separator` primitives. Render unavailable text explicitly and never use color as the only state signal.

- [ ] **Step 4: Wire existing scan navigation into the shell**

Make `ScanSidebarNav` emit the canonical section list and preserve its existing capability disabling and admin filtering. `ScanPage` should pass the selected section and handler into `InvestigatorShell` while leaving scan execution unchanged.

- [ ] **Step 5: Run focused tests and lint**

Run: `pnpm --filter frontend test -- src/components/templates/InvestigatorShell.test.tsx src/components/pages/scan/ScanSidebarNav.test.tsx`

Expected: PASS.

Run: `pnpm --filter frontend lint`

Expected: PASS.

- [ ] **Step 6: Commit shell work**

Commit: `git add frontend/src/components/templates/InvestigatorShell.tsx frontend/src/components/pages/scan/InvestigatorSectionSelector.tsx frontend/src/components/templates/AppLayout.tsx frontend/src/components/pages/scan/ScanSidebarNav.tsx frontend/src/App.css frontend/src/components/templates/InvestigatorShell.test.tsx && git commit -m "feat: add hybrid investigator shell"`

## Task 3: Make Capability Progress and Partial Recovery Explicit

**Files:**
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.tsx`
- Modify: `frontend/src/services/investigationSession.js`
- Test: `frontend/src/components/pages/scan/ScanStatusStack.test.tsx`
- Test: `frontend/src/services/investigationSession.test.js`

- [ ] **Step 1: Add failing status coverage**

Add tests for queued, running, success, failed, unavailable, and mixed partial sessions. Assert that successful capability content remains present when another capability fails, retry appears only for retryable failure/unavailable states, and status text is available without color.

```tsx
it('keeps successful capability visible beside retryable failure', () => {
  render(
    <ScanStatusStack
      session={{ capabilityStates: {
        wordpress: { status: 'success', outcome: { result: { findings: [] } } },
        homepage: { status: 'failed', outcome: { error: { message: 'Timed out', retryable: true } } },
      } }}
      onRetryCapability={vi.fn()}
    />,
  );
  expect(screen.getByText(/WordPress API: Complete/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /retry homepage/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and verify the missing behavior**

Run: `pnpm --filter frontend test -- src/components/pages/scan/ScanStatusStack.test.tsx src/services/investigationSession.test.js`

Expected: FAIL for any status transition not represented by the existing component or session helper.

- [ ] **Step 3: Add explicit overall-state derivation**

In `investigationSession.js`, derive `partial` when at least one selected capability is successful and at least one selected capability is failed or unavailable. Preserve existing capability outcomes during later updates. Export the existing session update path unchanged, adding only the derived overall status field needed by the presentation.

- [ ] **Step 4: Render stable progressive status**

In `ScanStatusStack.tsx`, map `success` to `Complete`, preserve `queued` and `running`, map mixed capability results to `Partial results`, and render failed/unavailable details in independently labeled status regions. Keep retry callbacks scoped to the capability ID and keep `aria-live="polite"` on progress rather than individual repeated alerts.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter frontend test -- src/components/pages/scan/ScanStatusStack.test.tsx src/services/investigationSession.test.js`

Expected: PASS.

Commit: `git add frontend/src/components/pages/scan/ScanStatusStack.tsx frontend/src/services/investigationSession.js frontend/src/components/pages/scan/ScanStatusStack.test.tsx frontend/src/services/investigationSession.test.js && git commit -m "feat: clarify partial scan recovery states"`

## Task 4: Add Intent Summary and Evidence Presentation

**Files:**
- Create: `frontend/src/components/pages/scan/InvestigatorOverview.tsx`
- Create: `frontend/src/components/pages/scan/InvestigatorFindings.tsx`
- Create: `frontend/src/components/pages/scan/EvidenceDisclosure.tsx`
- Modify: `frontend/src/components/pages/ScanPage.tsx`
- Test: `frontend/src/components/pages/scan/InvestigatorOverview.test.tsx`
- Test: `frontend/src/components/pages/scan/EvidenceDisclosure.test.tsx`
- Test: `frontend/src/utils/evidence.test.js`

- [ ] **Step 1: Write finding and evidence tests**

Define the component inputs before implementation:

```ts
type EvidenceKind = 'observed' | 'inferred' | 'request-trace' | 'absence';

type EvidenceItem = {
  kind: EvidenceKind;
  label: string;
  detail?: string;
  request?: { method: string; url: string; status?: number };
};

type Finding = {
  id: string;
  title: string;
  consequence: 'high' | 'medium' | 'low';
  summary: string;
  evidence: EvidenceItem[];
};
```

Test that overview renders the four intent groups, findings are ordered by consequence, and evidence disclosure is collapsed initially and exposes request/result details after activation.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm --filter frontend test -- src/components/pages/scan/InvestigatorOverview.test.tsx src/components/pages/scan/EvidenceDisclosure.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement evidence disclosure**

Use a native `<details>`/`<summary>` structure or the documented existing disclosure primitive. Render a text evidence-kind label in every state. Render request method, URL, and response status in IBM Plex Mono when a request trace exists. Do not render raw result bodies by default; expose them only inside the expanded region.

- [ ] **Step 4: Implement overview and findings**

Render sections titled `What this site is`, `What it exposes`, `Inspect next`, and `Scan notes`. Render neutral facts separately from attention/risk findings. Use explicit severity labels and icons alongside any status color. Each finding owns its evidence disclosure.

- [ ] **Step 5: Connect existing results without changing scan contracts**

In `ScanPage.tsx`, adapt existing capability results through a local mapper at the composition boundary. Keep the mapper pure and return empty intent groups when a capability has no result. Do not move API requests or duplicate capability runners into the presentation components.

- [ ] **Step 6: Run tests, typecheck, and commit**

Run: `pnpm --filter frontend test -- src/components/pages/scan/InvestigatorOverview.test.tsx src/components/pages/scan/EvidenceDisclosure.test.tsx src/components/pages/ScanPage.test.tsx`

Expected: PASS.

Run: `pnpm --filter frontend typecheck`

Expected: PASS.

Commit: `git add frontend/src/components/pages/scan/InvestigatorOverview.tsx frontend/src/components/pages/scan/InvestigatorFindings.tsx frontend/src/components/pages/scan/EvidenceDisclosure.tsx frontend/src/components/pages/ScanPage.tsx frontend/src/components/pages/scan/InvestigatorOverview.test.tsx frontend/src/components/pages/scan/EvidenceDisclosure.test.tsx frontend/src/utils/evidence.test.js && git commit -m "feat: present investigator findings with evidence"`

## Task 5: Verify Persistence, Retry, and Responsive Workflow

**Files:**
- Modify: `frontend/src/components/pages/ScanPage.test.tsx`
- Modify: `frontend/src/services/anonymousInvestigations.test.js`
- Modify: `frontend/src/components/templates/AppLayout.test.tsx`
- Create: `frontend/src/components/pages/scan/InvestigatorWorkflow.stories.tsx`
- Create: `frontend/src/components/templates/InvestigatorShell.stories.tsx`
- Create: `frontend/src/components/pages/scan/InvestigatorOverview.stories.tsx`
- Create: `frontend/src/components/pages/scan/EvidenceDisclosure.stories.tsx`

- [ ] **Step 1: Add workflow regression tests**

Cover these exact scenarios with existing test helpers and mocked API/client calls:

1. Submit domain and create one active session.
2. Receive a successful capability update, then a failed capability update; successful result remains rendered.
3. Click retry for the failed capability; only that capability transitions to running and then complete.
4. Save anonymous session and reload; submitted and normalized domain values restore.
5. Authenticated save failure writes the local fallback and shows a non-destructive persistence warning.

- [ ] **Step 2: Run the tests and fix only workflow regressions**

Run: `pnpm --filter frontend test -- src/components/pages/ScanPage.test.tsx src/services/anonymousInvestigations.test.js src/components/templates/AppLayout.test.tsx`

Expected: PASS. If existing assertions encode the old sidebar or toast behavior, update them to assert stable status/report behavior instead of restoring old presentation.

- [ ] **Step 3: Add Storybook state coverage**

Create `InvestigatorWorkflow.stories.tsx` with stories named `Idle`, `Running`, `PartialWithRetry`, `Complete`, `Unavailable`, and `AnonymousResume`. Create the shell, overview, and disclosure stories listed in the file map using the same fixture sessions, not live requests. Each story must expose visible status text and keyboard-reachable actions.

- [ ] **Step 4: Run frontend validation**

Run: `pnpm --filter frontend lint && pnpm --filter frontend typecheck && pnpm --filter frontend build`

Expected: all three commands PASS. Record any known browser/server test infrastructure blockers separately; do not convert them to passes.

- [ ] **Step 5: Commit vertical slice**

Commit: `git add frontend/src/components/pages/ScanPage.test.tsx frontend/src/services/anonymousInvestigations.test.js frontend/src/components/templates/AppLayout.test.tsx frontend/src/components/pages/scan/InvestigatorWorkflow.stories.tsx && git commit -m "test: verify investigator workflow recovery"`

## Task 6: Migrate Investigations and Admin Shells

**Files:**
- Create: `frontend/src/components/templates/AdminShell.tsx`
- Create: `frontend/src/components/templates/AdminShell.stories.tsx`
- Create: `frontend/src/components/pages/admin/AdminInbox.tsx`
- Create: `frontend/src/components/pages/admin/AdminInbox.test.tsx`
- Create: `frontend/src/components/pages/admin/AdminInbox.stories.tsx`
- Modify: `frontend/src/components/pages/InvestigationsPage.tsx`
- Modify: `frontend/src/components/pages/InvestigationsPage.test.tsx`
- Modify: `frontend/src/components/pages/AdminPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add admin shell and inbox tests**

Test that `AdminShell` exposes a separately labeled admin navigation region and that `AdminInbox` renders unsupported namespaces, discovered assets, failed scans, and maintenance items with status, evidence preview, and next action. Test that no bulk action appears before item-level triage is implemented.

- [ ] **Step 2: Implement `AdminShell` and `AdminInbox`**

Define item input as:

```ts
type AdminInboxItem = {
  id: string;
  kind: 'unsupported-namespace' | 'discovered-asset' | 'failed-scan' | 'maintenance';
  title: string;
  status: 'new' | 'attention' | 'resolved';
  evidence: string;
  actionLabel: string;
  onAction: () => void;
};
```

Render one item per row/card with text status, evidence preview, and one next action. Keep data loading in existing admin hooks/query modules; `AdminInbox` receives prepared items.

- [ ] **Step 3: Compose existing admin sections under the new shell**

Wrap `AdminPage.tsx` in `AdminShell`, map current unsupported/assets/scan health/maintenance data into inbox items, and preserve existing section routes for detailed views. Keep existing editor and mutation hooks unchanged unless tests identify an authorization defect.

- [ ] **Step 4: Migrate investigations presentation**

Replace table-only visual hierarchy in `InvestigationsPage.tsx` with responsive investigation rows that retain domain, finding count, capability completion, last activity, local/remote state, and resume action. Reuse the same status labels and report-width tokens as the investigator shell.

- [ ] **Step 5: Update app-level navigation and test migration**

Keep `App.tsx` authorization checks. Route investigator pages through the global shell and admin through `AdminShell`. Update page tests for loading, error/retry, empty, local, remote, and admin-only behavior.

- [ ] **Step 6: Run complete frontend proof and commit**

Run: `pnpm --filter frontend test -- src/components/pages/InvestigationsPage.test.tsx src/components/pages/admin/AdminInbox.test.tsx src/components/pages/AdminPage.test.tsx`

Expected: PASS.

Run: `pnpm --filter frontend lint && pnpm --filter frontend typecheck && pnpm --filter frontend build && pnpm --filter frontend build-storybook`

Expected: all commands PASS.

Commit: `git add frontend/src/components/templates/AdminShell.tsx frontend/src/components/templates/AdminShell.stories.tsx frontend/src/components/pages/admin/AdminInbox.tsx frontend/src/components/pages/admin/AdminInbox.test.tsx frontend/src/components/pages/admin/AdminInbox.stories.tsx frontend/src/components/pages/InvestigationsPage.tsx frontend/src/components/pages/InvestigationsPage.test.tsx frontend/src/components/pages/AdminPage.tsx frontend/src/App.tsx frontend/src/App.css && git commit -m "feat: migrate investigations and admin shells"`

## Final Review Checklist

- [ ] `frontend/src/theme.css` owns semantic design tokens; components do not introduce one-off palette values.
- [ ] Investigator shell uses one canonical section vocabulary across desktop and mobile.
- [ ] Capability statuses distinguish queued, running, complete, partial, failed, and unavailable.
- [ ] Successful evidence persists while another capability fails or retries.
- [ ] Finding severity and evidence kind are textual and not color-only.
- [ ] Anonymous and authenticated persistence paths remain intact.
- [ ] Admin has separate navigation and evidence-first inbox behavior.
- [ ] Existing authorization checks remain active, with server-side authorization follow-up called out where required.
- [ ] Typecheck, lint, build, focused tests, and Storybook build have recorded results.
- [ ] Browser/server infrastructure blockers remain documented rather than hidden.
