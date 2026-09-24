# Auth Controls in New Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore login and authenticated user controls to every active `AppShell` route while moving those UI components out of legacy atomic-design folders.

**Architecture:** Keep `AppShell`, `AdminShell`, and `InvestigatorShell` independent of Auth0 by adding an optional `authActions` React node slot. `AppContent` composes `UserMenu` and `LoginButton`, then passes that composition to each active shell. Auth controls move to `frontend/src/ui/auth/`; behavior and Auth0 configuration remain unchanged.

**Tech Stack:** React 19, TypeScript, Auth0 React SDK, Vitest, Testing Library, Vite, ESLint.

---

## File Map

- Create: `frontend/src/ui/auth/LoginButton.tsx` — typed Auth0 login control.
- Create: `frontend/src/ui/auth/UserMenu.tsx` — authenticated avatar/name menu.
- Create: `frontend/src/ui/auth/LoginButton.test.tsx` — loading, anonymous, and authenticated states.
- Move: `frontend/src/components/molecules/UserMenu.test.tsx` to `frontend/src/ui/auth/UserMenu.test.tsx` — preserve and extend menu behavior coverage.
- Move: `frontend/src/components/atoms/LoginButton.stories.jsx` to `frontend/src/ui/auth/LoginButton.stories.tsx` — keep Storybook coverage aligned with component ownership.
- Modify: `frontend/src/ui/shell/AppShell.tsx` — add optional auth slot and right-side action cluster.
- Modify: `frontend/src/ui/shell/AdminShell.tsx` — forward `authActions`.
- Modify: `frontend/src/ui/shell/InvestigatorShell.tsx` — forward `authActions`.
- Modify: `frontend/src/App.tsx` — compose auth controls and pass them to all active shell routes.
- Modify: `frontend/src/App.css` — style action/auth grouping and narrow-width wrapping using existing shell tokens.
- Create or modify: `frontend/src/ui/shell/AppShell.test.tsx` — verify optional auth slot and ordering.
- Modify: `frontend/src/ui/shell/routeComposition.test.tsx` — verify shell-level auth slot survives scan, history, investigations, and admin compositions.
- Delete after import migration: `frontend/src/components/atoms/LoginButton.jsx`, `frontend/src/components/atoms/LoginButton.stories.jsx`, `frontend/src/components/molecules/UserMenu.tsx`, `frontend/src/components/molecules/UserMenu.test.tsx`.

### Task 1: Move Auth Controls Into `ui/auth`

**Files:**
- Create: `frontend/src/ui/auth/LoginButton.tsx`
- Create: `frontend/src/ui/auth/LoginButton.test.tsx`
- Move: `frontend/src/components/atoms/LoginButton.stories.jsx` to `frontend/src/ui/auth/LoginButton.stories.tsx`
- Move: `frontend/src/components/molecules/UserMenu.tsx` to `frontend/src/ui/auth/UserMenu.tsx`
- Move: `frontend/src/components/molecules/UserMenu.test.tsx` to `frontend/src/ui/auth/UserMenu.test.tsx`
- Delete: old component paths after all imports are updated

- [ ] **Step 1: Add failing LoginButton state tests**

Create `frontend/src/ui/auth/LoginButton.test.tsx` with mocked `useAuth0` state and assertions for the three contract states:

```tsx
const loginWithRedirect = vi.fn();
const authState = { isLoading: false, isAuthenticated: false, loginWithRedirect };

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => authState,
}));

it('shows disabled loading state', () => {
  authState.isLoading = true;
  render(<LoginButton />);
  expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
});

it('logs in when anonymous', async () => {
  const user = userEvent.setup();
  authState.isLoading = false;
  authState.isAuthenticated = false;
  render(<LoginButton />);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(loginWithRedirect).toHaveBeenCalledTimes(1);
});

it('renders nothing when authenticated', () => {
  authState.isAuthenticated = true;
  render(<LoginButton />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `pnpm --filter frontend exec vitest run src/ui/auth/LoginButton.test.tsx`

Expected: FAIL because `LoginButton.tsx` does not exist yet.

- [ ] **Step 3: Move and type LoginButton**

Create `frontend/src/ui/auth/LoginButton.tsx` with the existing behavior and no props:

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';

function LoginButton() {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <Button variant="outline" size="sm" disabled>Loading...</Button>;
  }

  if (isAuthenticated) return null;

  return <Button variant="outline" size="sm" onClick={() => loginWithRedirect()}>Log in</Button>;
}

export default LoginButton;
```

Move the Storybook story beside it, update its import to `./LoginButton`, and use `.tsx` syntax where needed. Move `UserMenu.tsx` and its test unchanged first, then update their relative test import from `./UserMenu` only if the move operation does not preserve it.

- [ ] **Step 4: Run auth component tests**

Run: `pnpm --filter frontend exec vitest run src/ui/auth/LoginButton.test.tsx src/ui/auth/UserMenu.test.tsx`

Expected: PASS for all LoginButton and UserMenu cases, including logout return URL and Investigations navigation.

- [ ] **Step 5: Commit component ownership change**

```bash
git add frontend/src/ui/auth frontend/src/components/atoms frontend/src/components/molecules
git commit -m "refactor: move auth controls into ui"
```

### Task 2: Add Auth Slot To Shells

**Files:**
- Modify: `frontend/src/ui/shell/AppShell.tsx`
- Modify: `frontend/src/ui/shell/AdminShell.tsx`
- Modify: `frontend/src/ui/shell/InvestigatorShell.tsx`
- Create or modify: `frontend/src/ui/shell/AppShell.test.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add failing AppShell slot tests**

Test that auth content is optional and appears after existing header actions:

```tsx
it('renders auth actions after workspace actions', () => {
  render(
    <AppShell
      navigation={{ items: [], activeId: '' }}
      commands={{ onNavigate: vi.fn() }}
      headerActions={<button type="button">New scan</button>}
      authActions={<button type="button">Log in</button>}
    >
      content
    </AppShell>,
  );

  const actions = screen.getByRole('group', { name: 'Header actions' });
  expect(within(actions).getAllByRole('button').map((button) => button.textContent)).toEqual(['New scan', 'Log in']);
});

it('renders without auth actions', () => {
  render(<AppShell navigation={{ items: [], activeId: '' }} commands={{ onNavigate: vi.fn() }}>content</AppShell>);
  expect(screen.queryByRole('group', { name: 'Header actions' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run shell tests and verify the new assertions fail**

Run: `pnpm --filter frontend exec vitest run src/ui/shell/AppShell.test.tsx`

Expected: FAIL because `authActions` and the combined header action cluster are not implemented.

- [ ] **Step 3: Implement the optional auth slot**

Extend `AppShellProps` with `authActions?: ReactNode`. Render one right-side cluster only when either action source exists, preserving header-action order:

```tsx
const hasHeaderActions = headerActions || authActions;

{hasHeaderActions ? (
  <div className="investigation-shell__actions" role="group" aria-label="Header actions">
    {headerActions}
    {authActions ? <div className="investigation-shell__auth-actions">{authActions}</div> : null}
  </div>
) : null}
```

Add `authActions?: ReactNode` to `AdminShellProps` and `InvestigatorShellProps`, destructure it, and pass it through to `AppShell`. Do not import Auth0 or auth components into any shell.

- [ ] **Step 4: Add minimal responsive styling**

Update the existing shell rules in `frontend/src/App.css`:

```css
.investigation-shell__actions { display: flex; align-items: center; gap: .75rem; margin-left: auto; }
.investigation-shell__auth-actions { display: inline-flex; align-items: center; gap: .5rem; }
@media (max-width: 700px) {
  .investigation-shell__actions { width: 100%; margin-left: 0; flex-wrap: wrap; }
  .investigation-shell__auth-actions { margin-left: auto; }
}
```

Keep native focus behavior and existing reduced-motion rules intact. Do not add new auth-specific colors or shadows.

- [ ] **Step 5: Run shell tests**

Run: `pnpm --filter frontend exec vitest run src/ui/shell/AppShell.test.tsx src/ui/shell/AdminShell.test.tsx src/ui/shell/InvestigatorShell.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit shell API change**

```bash
git add frontend/src/ui/shell frontend/src/App.css
git commit -m "feat: add auth actions slot to app shells"
```

### Task 3: Compose Auth Controls In Active Routes

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/ui/shell/routeComposition.test.tsx`

- [ ] **Step 1: Add route composition coverage**

Extend shell composition cases so each route receives the same auth slot and preserves workspace action order:

```tsx
const authActions = <><button type="button">User</button><button type="button">Log in</button></>;

expect(within(screen.getByRole('group', { name: 'Header actions' })).getByRole('button', { name: 'Log in' })).toBeInTheDocument();
```

Cover `scan`, `investigations`, `history`, and `admin` through their `InvestigatorShell`/`AdminShell` composition. Keep existing single-main-landmark assertions.

- [ ] **Step 2: Run route composition tests and verify the new assertions fail**

Run: `pnpm --filter frontend exec vitest run src/ui/shell/routeComposition.test.tsx`

Expected: FAIL because route shells do not yet receive `authActions`.

- [ ] **Step 3: Compose authActions in AppContent**

Add imports:

```tsx
import LoginButton from './ui/auth/LoginButton';
import UserMenu from './ui/auth/UserMenu';
```

Build one composition after `navigateTopLevel` is defined:

```tsx
const authActions = (
  <>
    <UserMenu onNavigate={navigateTopLevel} />
    <LoginButton />
  </>
);
```

Pass `authActions={authActions}` to the `AdminShell` branch and all three `InvestigatorShell` branches. Leave legacy page `embedded` rendering unchanged; the active outer shell now owns the header controls.

- [ ] **Step 4: Run route composition and auth tests**

Run: `pnpm --filter frontend exec vitest run src/ui/shell/routeComposition.test.tsx src/ui/auth/LoginButton.test.tsx src/ui/auth/UserMenu.test.tsx`

Expected: PASS, with auth controls present in all active shell paths and absent from unauthenticated UserMenu output.

- [ ] **Step 5: Search imports before deleting old paths**

Run: `rg "components/(atoms/LoginButton|molecules/UserMenu)|LoginButton\.jsx" frontend/src`

Expected: no active imports remain. Story/test references should point to `ui/auth`.

- [ ] **Step 6: Commit active-shell composition**

```bash
git add frontend/src/App.tsx frontend/src/ui/shell/routeComposition.test.tsx
git commit -m "feat: restore auth controls in active shell"
```

### Task 4: Full Verification And Legacy Import Audit

**Files:**
- No new source files; inspect the complete diff and generated test/build output.

- [ ] **Step 1: Run focused Vitest suite**

Run: `pnpm --filter frontend exec vitest run src/ui/auth src/ui/shell/AppShell.test.tsx src/ui/shell/AdminShell.test.tsx src/ui/shell/InvestigatorShell.test.tsx src/ui/shell/routeComposition.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run frontend lint**

Run: `pnpm --filter frontend run lint`

Expected: exit 0 with no unused imports from old component paths.

- [ ] **Step 3: Run frontend typecheck**

Run: `pnpm --filter frontend run typecheck`

Expected: exit 0, including moved story/test TypeScript imports.

- [ ] **Step 4: Build frontend**

Run: `pnpm --filter frontend run build`

Expected: exit 0 and Vite resolves `ui/auth` imports.

- [ ] **Step 5: Verify old atomic auth files are no longer referenced**

Run: `rg "components/(atoms/LoginButton|molecules/UserMenu)|from ['\"].*LoginButton\.jsx" frontend/src || true`

Expected: no results. Confirm the old files were deleted and no unrelated atomic-design components were moved.

- [ ] **Step 6: Commit verification-only cleanup if needed**

If the verification pass requires only import or formatting corrections, commit them as:

```bash
git add frontend/src
git commit -m "test: verify auth controls in new shell"
```

## Self-Review

- Spec coverage: component behavior is covered in Task 1; shell API and layout are covered in Task 2; all active route composition is covered in Task 3; requested verification commands are covered in Task 4.
- Ownership correction: both auth controls and their tests/stories move to `frontend/src/ui/auth`; no new feature code is added to `components/atoms` or `components/molecules`.
- Compatibility: `authActions` remains optional, legacy `AppLayout` remains untouched until import audit, and Auth0 calls/options are preserved.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation steps remain.
- Type consistency: all shell props use `authActions?: ReactNode`; `AppContent` passes `ReactNode`; `LoginButton` is zero-prop; `UserMenu` keeps `onNavigate?: (page: string) => void`.
