# R1 Scan Progress Summary Design

## Goal

Make scan progress compact and durable while fixing the restored-session header state on mobile and desktop.

All new frontend source and test files use TypeScript extensions. Existing files touched by this change are migrated from `.jsx` to `.tsx` with focused boundary types; unrelated frontend files remain unchanged.

## Scope

This change covers the four initial scan capabilities only:

- Identity
- Exposure
- Homepage
- WordPress API

Sitemap remains a separate, post-scan capability action and is not included in initial progress.

## UI Design

Add a dedicated `ScanProgress` component in the existing frontend component structure. The component receives the current state for each initial capability and renders one segmented bar with four labeled segments.

Each segment supports these states:

- `pending`
- `running`
- `complete`
- `unavailable`
- `failed`

The bar remains visible after the scan completes as a compact result summary. Segments are informational, not interactive. Retry controls remain in the detailed capability panels, where users can see the failure context before retrying.

The bar must provide an accessible text summary that does not depend on color, such as the number of completed capabilities and any unavailable or failed capabilities. Existing detailed statuses remain available in the results content.

On mobile, the domain input and scan button stack vertically. The domain input remains a single-line control with an approximate 48px height, preserving touch usability without the current excessive vertical height.

## State And Restoration

When an anonymous or authenticated investigation is restored, the app must hydrate `currentScanDomain` from the restored session. The header must show the restored domain instead of `Current scan: none yet`.

The progress component should derive its display from the same canonical session capability state used by the existing scan flow. It must not maintain an independent progress state.

## Testing

Add focused frontend tests covering:

- Four capability labels and fixed segment order
- Pending, running, complete, unavailable, and failed rendering
- Accessible progress summary and non-color status cues
- Completed bar remaining visible after scan completion
- Restored session populating the current scan domain in the header
- Mobile layout rules for stacked input and button and single-line input sizing

Run the focused unit project and the frontend build. If the full browser suite is run, ensure Playwright Chromium is installed first.

## Out Of Scope

- Sitemap progress integration
- New evidence contracts or provenance normalization
- Changes to retry semantics
- Next.js migration
- Authenticated ownership behavior changes
- Visual redesign beyond the progress summary and mobile domain form layout
