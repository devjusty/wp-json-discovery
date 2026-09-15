# Frontend Audit Fixes Design

## Goal

Address verified frontend application-quality findings from the UI audit without
changing the product scope or repairing unrelated `robots.txt`/`llms.txt`
metadata findings.

## Scope

- Fix the brand button accessible-name mismatch in `AppLayout`.
- Fix namespace badge contrast while preserving its investigative status color.
- Reduce confirmed token drift in styles touched by these fixes, using existing
  semantic tokens where the mapping is unambiguous.
- Reduce production bundle-size risk through evidence-based Vite chunking.
- Preserve current behavior, responsive layout, and visual hierarchy.

Out of scope:

- `robots.txt` and `llms.txt`.
- Broad CSS migration or visual redesign.
- Updating design documentation's radius policy until implementation intent is
  confirmed separately.

## Design

### Accessible brand control

Keep the existing conditional `button`/`div` structure and navigation behavior.
When the brand is a button, give it an accessible name containing both its
action and visible title, such as `Back to main dashboard: WP JSON Discovery`.
The visible heading remains unchanged.

### Namespace badges

Keep badge variants and semantic meanings unchanged. Add or adjust the owning
namespace badge token/class so normal 12px text reaches at least WCAG AA's
4.5:1 contrast ratio against its rendered background. Prefer a token-level
change over scattered per-badge literals.

### Token cleanup

Use existing font-size and radius tokens for values directly involved in the
affected surfaces. Do not normalize every literal in `App.css` or invent new
configuration for values that already have a clear owner. Preserve deliberate
size hierarchy and current compact controls.

### Bundle splitting

Inspect the build output and dependency graph before changing Vite config. Use
route or dependency boundaries already present in the application. Add only
manual chunking that produces a measurable improvement and does not duplicate
or eagerly load route code.

## Verification

- Run focused Storybook tests for affected shared components, then the broad
  Storybook test suite if focused tests pass.
- Run `pnpm lint`.
- Run `pnpm typecheck`.
- Run `pnpm build` and record chunk-size changes.
- Run Lighthouse accessibility snapshot and confirm contrast and
  label-content-name failures are resolved.
- Confirm no changes to `robots.txt` or `llms.txt` behavior.

## Acceptance Criteria

1. Brand button accessible name includes visible brand text and action.
2. Namespace badges meet at least 4.5:1 contrast for normal text.
3. No new lint, typecheck, build, or Storybook failures.
4. Bundle output improves or has a documented evidence-based reason not to
   change chunking.
5. Existing scan navigation, responsive layout, and status semantics remain
   intact.
