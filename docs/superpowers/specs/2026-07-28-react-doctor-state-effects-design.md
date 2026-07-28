# React Doctor State and Effect Cleanup

## Scope

Address the selected React Doctor groups for mutation cache invalidation, chained effects, and all seven state-adjusted-after-prop-change findings. Leave unrelated React Doctor groups unchanged.

The homepage and sitemap scan hooks expose local mutation state rather than React Query cache data. Their cache-invalidation findings will remain unchanged unless inspection finds a real cached consumer. The `rotateLogsMutation` path will receive the same targeted inspection.

## Architecture

- Keep homepage and sitemap results in their existing local mutation state.
- In `HistoryPage`, coordinate filter changes through one reset path so pagination and selected-domain state do not update through a chain of effects.
- In `ScanPage`, preserve the transition that moves a user out of the unsupported section when admin access is lost, while avoiding unnecessary prop-derived state adjustment.
- In `useAdminEditorState`, move validation clearing close to draft updates and mutation-success resets close to mutation completion callbacks where the existing mutation APIs support it.
- Preserve existing query invalidation, toast, logging, error, and loading behavior.

## Data Flow

1. Changing history filters or sort state resets page and active domain together.
2. Editing a plugin or theme draft clears only that draft's related validation error.
3. Successful create/update mutations reset the affected editor state and retain existing query refresh behavior.
4. Losing admin access changes the active section only when the previous state was admin and the current state is not.
5. Homepage and sitemap scan results continue to flow through existing local mutation consumers.

## Validation and Tests

Add focused regression coverage before implementation changes where practical:

- History filter changes reset page and selected domain without chained effect behavior.
- Admin editor draft changes clear the matching validation error.
- Successful create/update operations reset only intended draft, modal, editing, and mutation state.
- Permission downgrade exits the unsupported section; unrelated permission changes do not.

Run React Doctor after each logical fix and confirm selected findings decrease. Run focused tests, frontend lint, and production build. The existing unrelated full-suite failures remain out of scope and must be reported if still present.

## Non-Goals

- Do not fix unused files, defaultProps, sequential awaits, array lookups, or other React Doctor groups.
- Do not introduce React Query cache keys for local homepage or sitemap mutation state without a confirmed consumer.
- Do not rewrite the admin editor as a reducer or state machine.
- Do not suppress findings unless a behavior-preserving refactor is technically unsafe and the reason is documented.
