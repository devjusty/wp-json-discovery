# R2 Investigation List Design

## Goal

Replace legacy My Scans with an investigation list that lets users find and directly resume their current local or persisted investigation.

## Scope

This first R2 slice delivers the investigation list and direct resume only. Timeline browsing, section retry from a historical session, and notes remain the next R2 slice.

All new frontend files use `.ts` or `.tsx`. Existing frontend files touched for this slice migrate to TypeScript when practical and scoped to this work.

## Navigation

- Replace the `My scans` navigation item and page with `Investigations`.
- Show the navigation item to authenticated and anonymous users.
- Preserve the legacy saved-scan API and stored data, but do not display it on the new page.
- Do not add search, filters, pagination, deletion, or saved-scan migration in this slice.

## List Content

Each investigation row shows:

- Normalized domain
- Findings count from its latest session
- Completed capability count and selected capability count
- Last activity timestamp
- Resume action

Rows sort by last activity descending.

### Anonymous Investigation

- Read the one existing anonymous investigation snapshot from local storage.
- Show it first when present and label it `Local`.
- Show it to anonymous users as the only resumable row.
- Show it to signed-in users until it is claimed, followed by persisted rows.
- Never send the anonymous snapshot to the list endpoint.

### Authenticated Investigations

- Add authenticated `GET /api/investigations`.
- Return purpose-built summary records rather than full session histories.
- A summary contains investigation identity, domain, created and updated timestamps, latest-session identity, and latest-session counts required by the list.
- Derive summary counts from the latest persisted session snapshot.
- Enforce ownership in the database query. A user cannot learn another user's investigation identity or summary.

## Resume Behavior

- Selecting Resume routes to the existing scanner workspace.
- An explicit selected investigation ID lives in scan-shell state.
- Scanner loading prioritizes that explicit selection over its remembered authenticated investigation ID.
- The scanner fetches the selected record, hydrates its latest session, restores its domain into shared scan state, and opens the workspace directly.
- Resume failure leaves the list intact and exposes a retryable error. It does not remove local storage or overwrite the currently loaded scanner session.
- A summary without a latest session is non-resumable and displays its unavailable state instead of a broken action.

## States And Accessibility

- Use native buttons for Resume and preserve keyboard navigation through rows.
- Use loading and error status text while data is requested.
- Empty anonymous state explains that a scan creates a local investigation.
- Empty authenticated state explains that completed or started scans appear here.
- Distinguish `Local`, loading, unavailable, and error states with visible text, not color alone.

## Testing

- Server route and repository coverage verifies authentication, owner scoping, ordering, latest-session summary derivation, and investigations without a latest session.
- Client coverage verifies anonymous-only rendering, authenticated local-plus-persisted ordering, empty and failure states, and direct resume selection.
- Browser smoke covers anonymous resume, persisted resume, and an account that cannot see another account's records.

## Out Of Scope

- Historical section retry
- Notes
- Search, filters, pagination, deletion
- Legacy saved-scan migration or deletion
- Canonical finding/evidence contract changes
