# Full-Width Shell Nav Badge Refresh Design

**Goal:** Remove the app shell width cap, flatten the left navigation chrome, make the homepage source signals badge denser, and add small icons to primary navigation items.

**Architecture:** The layout change stays in the frontend shell and shared navigation components only. `App.css` will stop constraining the root container and page shell widths, while `AppLayout.jsx`, `ScanSidebarNav.jsx`, and `AdminSidebarNav.jsx` will keep their current behavior but get flatter rail styling and icon-backed labels. `HomepageSourcePanel.jsx` keeps the same data source and summary logic, but its nav summary badge becomes a tighter, higher-contrast status chip so the homepage source item reads more clearly in the scan rail.

**Tech Stack:** React, Vite, shadcn `Badge`, shadcn `Button`, hugeicons.

---

## Scope

This design covers only presentation and small UX refinements:
- Full-width desktop shell
- Flatter left-hand navigation styling
- Icon decoration for primary menu items
- Compact homepage source signals badge styling

It does not change routing, scan data, admin data, or backend behavior.

## Chosen Approach

Use the existing shell and nav structure, but relax the outer width constraints and restyle the nav rail in place.

Why this approach:
- It preserves the current layout relationships and page structure.
- It avoids a larger navigation rewrite while still making the app feel more open.
- It keeps the badge and icon work local to the components that already own those signals.

## Alternatives Considered

1. Only remove the width cap.
- Lowest risk, but leaves the left rail and badge treatment visually inconsistent.

2. Full shell refresh with new sidebar components.
- Better long-term consistency, but too broad for this pass.

3. Recommended: full-width shell plus targeted nav/badge polish.
- Best balance of impact and scope.

## Component Changes

### `frontend/src/App.css`
- Remove the `max-width` constraint from `#root`.
- Remove the width cap on the main header/body shell so the page can expand to the viewport.
- Keep the existing padding and sticky sidebar behavior so the layout still breathes.
- Flatten the left rail by removing border-radius-heavy treatment from the sidebar wrapper and its nav items.

### `frontend/src/components/templates/AppLayout.jsx`
- Keep the current `Sheet`-based mobile nav.
- Preserve the header actions and auth area.
- Ensure the desktop shell no longer inherits a centered max-width feel.

### `frontend/src/components/pages/scan/ScanSidebarNav.jsx`
- Add small icons to the primary scan navigation items.
- Keep the homepage summary badge, but restyle it as a compact signal chip instead of a soft pill.
- Leave secondary actions like History and Admin readable and text-forward.

### `frontend/src/components/pages/admin/AdminSidebarNav.jsx`
- Add icons to the top-level admin navigation buttons.
- Keep the nested anchor list text-only so the detail navigation stays dense and scannable.
- Remove any remaining rounded chrome from the active nav treatment.

### `frontend/src/components/organisms/panels/HomepageSourcePanel.jsx`
- Keep the homepage source data and status badge logic.
- Restyle the signals badge used in the scan rail context so it feels like a compact count/status indicator.
- Avoid changing the data source or the meaning of the badge text.

## Data Flow

No new data paths are introduced.
- Layout width changes are purely CSS.
- Icon selection is static and tied to the existing nav labels.
- The homepage signals badge still reads from `homepageNavSummary`.

## Error Handling

No new runtime error paths are expected.
- If an icon is unavailable, use the closest icon from the same hugeicons set rather than adding a new dependency.
- If the navigation summary is empty, keep the current fallback behavior instead of inventing a new badge state.

## Testing

Add or update tests so the change is locked in:
- Assert the app shell still renders the sidebar and header actions after the width cap is removed.
- Assert scan and admin nav labels remain intact when icons are added.
- Assert the homepage source summary badge still renders with the same text and sits in the expected nav item slot.
- Run focused frontend tests for the touched components.
- Run focused ESLint on the touched frontend files.
- Run `pnpm --filter frontend run build` and confirm the app still builds cleanly.

## Success Criteria

- The desktop app shell spans the available width instead of stopping at a centered max width.
- The left navigation feels flatter and less pill-like.
- Primary nav items have small icons that improve scanning without adding clutter.
- The homepage source signals badge is denser and clearer.
- Tests, lint, and production build still pass.
