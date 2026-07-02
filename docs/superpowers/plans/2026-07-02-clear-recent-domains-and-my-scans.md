# Clear Recent Domains and Saved Scans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-scoped destructive actions to clear the recent-scan list and clear saved scans from the app.

**Architecture:** Add two authenticated delete endpoints in the existing user scan routes: one to wipe only the current user's recent scan rows, and one to wipe only the current user's saved-scan rows. On the frontend, wire a clear button into the Recent scanned domains card and a second clear button into My Scans, both guarded by a confirmation prompt and followed by a refetch of the affected query. This keeps the scopes separate: clearing recent domains will not touch saved scans, and clearing saved scans will also remove the saved-scan notes stored on those rows.

**Tech Stack:** JavaScript, Express, SQLite/Turso, React, TanStack Query, Vitest, Testing Library.

---

### Task 1: Add user-scope cleanup endpoints on the server

**Files:**
- Modify: `server/src/db/userScans.js`
- Modify: `server/src/routes/userScans.js`
- Test: `server/src/__tests__/userScans.test.js`

- [ ] **Step 1: Write the failing tests**

Add coverage for the two cleanup operations and keep the scope explicit:

```js
it('clears only the current user recent scan list', async () => {
  await claimDomain('auth0|scans', 'keep-saved.com');
  await execute('insert into scan_runs (id, user_id, domain, scanned_at, status) values (1, "auth0|scans", "recent-only.com", "2026-06-30T10:00:00.000Z", "success")');

  await clearUserRecentRuns('auth0|scans');

  expect(await getUserRecentRuns('auth0|scans')).toEqual([]);
  expect(await getUserDomains('auth0|scans')).toHaveLength(1);
});

it('clears only the current user saved scans', async () => {
  await claimDomain('auth0|scans', 'saved-only.com', 'note text');
  await clearUserSavedScans('auth0|scans');

  expect(await getUserDomains('auth0|scans')).toEqual([]);
  expect(await getUserRecentRuns('auth0|scans')).toEqual([]);
});
```

Then add route-level coverage for the new DELETE endpoints with `request(app)` so the HTTP contract is locked down.

- [ ] **Step 2: Run the test file and verify it fails**

Run: `pnpm --filter server exec vitest run src/__tests__/userScans.test.js`

Expected: FAIL because `clearUserRecentRuns` / `clearUserSavedScans` and the new route handlers do not exist yet.

- [ ] **Step 3: Add the minimal server implementation**

Implement two helpers in `server/src/db/userScans.js`:

```js
export async function clearUserRecentRuns(userId) {
  await execute('delete from scan_runs where user_id = ?', [userId]);
}

export async function clearUserSavedScans(userId) {
  await execute('delete from scan_ownership where user_id = ?', [userId]);
}
```

Wire them into `server/src/routes/userScans.js` as authenticated DELETE handlers, for example `DELETE /api/user/scans/recent-runs` and `DELETE /api/user/scans`.

- [ ] **Step 4: Run the tests again and verify they pass**

Run: `pnpm --filter server exec vitest run src/__tests__/userScans.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the server cleanup work**

```bash
git add server/src/db/userScans.js server/src/routes/userScans.js server/src/__tests__/userScans.test.js
git commit -m "feat: add user scan cleanup endpoints"
```

### Task 2: Add a clear recent domains action to the scan page

**Files:**
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/components/pages/ScanPage.jsx`
- Modify: `frontend/src/components/pages/scan/RecentDomainsCard.jsx`
- Modify: `frontend/src/components/pages/scan/RecentDomainsCard.test.jsx`
- Modify: `frontend/src/components/pages/ScanPage.test.jsx`

- [ ] **Step 1: Write the failing UI tests**

Add a test that expects the Recent scanned domains card to expose a destructive clear button and to call the clear action when the user confirms:

```jsx
it('shows a clear recent domains action', async () => {
  render(<RecentDomainsCard ... />);

  expect(screen.getByRole('button', { name: /clear recent domains/i })).toBeInTheDocument();
});
```

Add a ScanPage test that verifies the page wires a clear callback into the card and refetches the recent-scans query after the clear completes.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm --filter frontend exec vitest run src/components/pages/scan/RecentDomainsCard.test.jsx src/components/pages/ScanPage.test.jsx
```

Expected: FAIL because the clear action and callback plumbing do not exist yet.

- [ ] **Step 3: Add the minimal frontend implementation**

In `frontend/src/api/client.js`, add a helper that calls the new server endpoint:

```js
export async function clearUserRecentRuns() {
  const result = await request('/api/user/scans/recent-runs', { method: 'DELETE' });
  if (!result.ok) {
    throw new Error('Failed to clear recent domains');
  }
  return result.data;
}
```

In `ScanPage.jsx`, pass a new `onClearRecentDomains` handler into `RecentDomainsCard` that confirms, calls the helper, then refetches `recentUserScansQuery` and `savedScansQuery` so the merged list stays current.

In `RecentDomainsCard.jsx`, add a small destructive button in the card header that triggers `onClearRecentDomains` when present. Keep the existing merged row layout intact.

- [ ] **Step 4: Run the tests again and verify they pass**

Run:

```bash
pnpm --filter frontend exec vitest run src/components/pages/scan/RecentDomainsCard.test.jsx src/components/pages/ScanPage.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit the scan-page work**

```bash
git add frontend/src/api/client.js frontend/src/components/pages/ScanPage.jsx frontend/src/components/pages/scan/RecentDomainsCard.jsx frontend/src/components/pages/scan/RecentDomainsCard.test.jsx frontend/src/components/pages/ScanPage.test.jsx
git commit -m "feat: clear recent domains from scan page"
```

### Task 3: Add a clear saved scans action to My Scans

**Files:**
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/components/pages/MyScansPage.jsx`
- Modify: `frontend/src/components/pages/MyScansPage.test.jsx`

- [ ] **Step 1: Write the failing UI test**

Add a test that expects the page to show a destructive clear button and to call the saved-scans clear helper when the user confirms:

```jsx
it('shows a clear my saved scans action', async () => {
  render(<MyScansPage ... />);

  expect(screen.getByRole('button', { name: /clear my saved scans/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter frontend exec vitest run src/components/pages/MyScansPage.test.jsx`

Expected: FAIL because the button and clear flow do not exist yet.

- [ ] **Step 3: Add the minimal implementation**

In `frontend/src/api/client.js`, add:

```js
export async function clearUserSavedScans() {
  const result = await request('/api/user/scans', { method: 'DELETE' });
  if (!result.ok) {
    throw new Error('Failed to clear saved scans');
  }
  return result.data;
}
```

In `MyScansPage.jsx`, add a header/button action that confirms before calling the helper, then refetches the scans query so the table clears immediately.

- [ ] **Step 4: Run the test again and verify it passes**

Run: `pnpm --filter frontend exec vitest run src/components/pages/MyScansPage.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit the My Scans work**

```bash
git add frontend/src/api/client.js frontend/src/components/pages/MyScansPage.jsx frontend/src/components/pages/MyScansPage.test.jsx
git commit -m "feat: clear saved scans from my scans"
```

### Task 4: Verify the whole change set

**Files:**
- All touched files

- [ ] **Step 1: Run focused verification**

Run:

```bash
pnpm --filter server exec vitest run src/__tests__/userScans.test.js
pnpm --filter frontend exec vitest run src/components/pages/scan/RecentDomainsCard.test.jsx src/components/pages/ScanPage.test.jsx src/components/pages/MyScansPage.test.jsx
pnpm --filter frontend exec eslint src/components/pages/ScanPage.jsx src/components/pages/scan/RecentDomainsCard.jsx src/components/pages/MyScansPage.jsx src/api/client.js
pnpm --filter frontend run build
```

Expected: all green.

- [ ] **Step 2: Commit the final verification pass if anything was adjusted**

```bash
git status --short
```

Use this only to confirm the final file set is intentional.
