# Square Surface Radius Design

## Goal

Align frontend structural surfaces with the investigative design direction by
removing rounded corners from controls, cards, panels, tables, dialogs, and
other non-pill surfaces.

## Radius Rules

- Structural surfaces use `0px`: cards, controls, inputs, dialogs, tables,
  panels, and layout surfaces.
- Status badges, namespace pills, and explicitly pill-shaped indicators keep
  `999px`.
- Circular avatars and circular icon treatments keep `50%`.
- No structural surface retains `4px`, `6px`, `8px`, `10px`, or `12px`
  radius values.

## Implementation

- Set `--radius-md`, `--radius-lg`, and `--control-border-radius` to `0px`.
- Replace direct structural radius literals in `App.css`,
  `styles/components.controls.css`, and `styles/pages.history.css` with `0`
  or the square structural tokens.
- Preserve pill and circle declarations explicitly, including namespace and
  status badges.
- Do not add a global override that could affect third-party primitives or
  semantic exceptions.

## Verification

- Run focused Storybook tests with accessibility checks for existing Button,
  DomainForm, HistoryPage, InvestigationsPage, and ScanStatusStack stories.
- Preview affected stories through Storybook at desktop and mobile widths.
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Run the Impeccable detector and confirm no structural radius advisories
  remain in the targeted files; remaining advisories must be intentional pill
  or circle exceptions only.
- Inspect mobile layout for control and card regressions.

## Acceptance Criteria

1. Structural surfaces render square corners consistently.
2. Pills remain pill-shaped and circular elements remain circular.
3. No unrelated spacing, color, typography, or behavior changes occur.
4. Existing Storybook stories, typecheck, lint, and build remain healthy.
5. The change does not modify `robots.txt`, `llms.txt`, or unrelated scan
   behavior.
