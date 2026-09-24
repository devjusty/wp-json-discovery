# Auth Controls in New Shell Design

## Context

The active investigator and admin routes now render `AppShell`. The legacy `AppLayout` still renders `LoginButton` and `UserMenu`, but active pages pass through `AppLayout` with `embedded`, so those controls are not present in the redesigned header.

The existing auth components already contain the required Auth0 behavior. The change should restore that behavior without coupling the generic shell to Auth0 or duplicating authentication state.

## Goals

- Restore login controls to the active `AppShell` header.
- Preserve existing anonymous and authenticated behavior.
- Use compact, avatar-first authenticated presentation where space permits.
- Convert `LoginButton` to TypeScript and retain typed `UserMenu` behavior.
- Keep `AppShell` independent of Auth0.
- Add tests that prove both component behavior and active shell composition.

## Non-goals

- No change to Auth0 configuration, scopes, audiences, or redirect behavior.
- No new authentication abstraction, persistence layer, or provider.
- No redesign of login flows, menu actions, or authorization policy.
- No removal of legacy `AppLayout` auth rendering until import and route verification show it is no longer needed.

## Architecture

`AppShell` gains an optional `authActions?: ReactNode` slot. It renders this slot after the existing `headerActions` within a dedicated header action cluster. `AppShell` remains a presentation component and does not import Auth0 or auth components.

`AppContent` owns composition because it already owns Auth0-derived navigation and page state. It passes the following auth composition to each active shell:

```tsx
<>
  <UserMenu onNavigate={navigateTopLevel} />
  <LoginButton />
</>
```

The shell's visual treatment controls spacing and responsive behavior. Auth components remain responsible only for auth-driven rendering and actions.

Auth controls belong under the current `ui/` presentation structure rather than the legacy atomic-design folders. Their Auth0 behavior remains unchanged; this move establishes the correct ownership for new-shell UI without introducing a new auth abstraction.

## Component Behavior

### LoginButton

- Move `frontend/src/components/atoms/LoginButton.jsx` to `frontend/src/ui/auth/LoginButton.tsx`.
- Type as a zero-prop component.
- While Auth0 is loading, render a disabled outline button labeled `Loading...`.
- When unauthenticated and loaded, render an outline `Log in` button.
- When authenticated, render nothing.
- Invoke `loginWithRedirect()` without changing its current options.

### UserMenu

- Move `frontend/src/components/molecules/UserMenu.tsx` to `frontend/src/ui/auth/UserMenu.tsx`.
- Keep the optional typed `onNavigate` callback.
- Render nothing unless Auth0 reports both an authenticated session and a user.
- Show the user's picture when available; otherwise show name, nickname, email, or `User`.
- Preserve `Investigations` navigation and `Log out` actions.
- Preserve logout return target `window.location.origin`.

## Header Layout

The selected direction is a compact authenticated state:

- Anonymous users see `Log in` at the right edge of the header.
- Authenticated users see the compact user trigger, using avatar first and text fallback.
- Workspace navigation and `New scan` remain distinct from auth controls.
- Auth controls are placed in a separate right-side cluster so workspace actions remain scannable.
- Existing keyboard focus, native button semantics, menu semantics, and accessible labels remain intact.

## Tests and Verification

Add or update tests for:

- `LoginButton`: loading, anonymous, and authenticated states.
- `UserMenu`: unauthenticated absence, authenticated avatar/name fallback, investigations navigation, and logout invocation.
- `AppShell`: auth slot renders after workspace actions and remains optional.
- Active shell composition: login controls are supplied to scan, investigations, history, and admin shell paths.

Run the smallest focused test set first, then:

- `pnpm --filter frontend run lint`
- frontend typecheck command defined by the workspace
- `pnpm --filter frontend run build`

Verify import search after the change before deciding whether legacy `AppLayout` auth imports can be removed.

## Rollout and Compatibility

The change is additive at the shell API level because `authActions` is optional. Existing `AppShell` consumers continue to render unchanged. Legacy `AppLayout` remains compatible during migration. Auth0 behavior and route destinations remain unchanged, limiting the change to header composition and TypeScript typing.
