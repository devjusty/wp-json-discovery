# Recent Domains and Scan Entry UI Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard’s recent-domains area useful for all authenticated users, surface save actions where scan review happens, and let My Scans rows jump back into the dashboard for exploration or a quick rescan.

**Architecture:** Keep the scan page as the central exploration surface and treat recent scan history as a single authenticated feed, regardless of whether a scan was explicitly saved. The dashboard will merge the user’s recent scan runs with the saved-scan list so the recent-domains card can show a saved state without guessing. The recent-domains card will render the merged items, show save-state affordances inline, and expose a save action for unsaved items. The My Scans page will become a navigation entry point back to the dashboard rather than a dead-end table, with row clicks restoring the selected domain and a separate scan-again action.

**Tech Stack:** React, React Query, existing scan context, existing `request()` API client, current button/card/table components.

---

### Task 1: Expand the recent-domains card for non-admin users

**Files:**
- Modify: `frontend/src/components/pages/ScanPage.jsx`
- Modify: `frontend/src/components/pages/scan/RecentDomainsCard.jsx`
- Test: `frontend/src/components/pages/scan/RecentDomainsCard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecentDomainsCard from './RecentDomainsCard.jsx';

it('shows recent scans and a save action for unsaved items', async () => {
  const user = userEvent.setup();
  let savedDomain = null;
  const onToggleExpanded = () => {};
  const onSave = (domain) => {
    savedDomain = domain;
  };

  render(
    <RecentDomainsCard
      isLoading={false}
      items={[
        {
          domain: 'example.com',
          lastScannedAt: '2026-06-30T12:00:00.000Z',
          saved: false,
        },
      ]}
      isScanning={false}
      isExpanded={true}
      onToggleExpanded={onToggleExpanded}
      onOpenHistory={null}
      onRescan={vi.fn()}
      onSaveScan={onSave}
    />
  );

  expect(screen.getByText('example.com')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /save to my scans/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /save to my scans/i }));
  expect(savedDomain).toBe('example.com');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend run test -- src/components/pages/scan/RecentDomainsCard.test.jsx`

Expected: FAIL because `RecentDomainsCard` does not yet render per-item save actions.

- [ ] **Step 3: Write the minimal implementation**

```jsx
function RecentDomainsCard({ onSaveScan, ...props }) {
  // render recent scans from items, show saved state per item, and show a save button
  // for items that are not already saved.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend run test -- src/components/pages/scan/RecentDomainsCard.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pages/ScanPage.jsx frontend/src/components/pages/scan/RecentDomainsCard.jsx frontend/src/components/pages/scan/RecentDomainsCard.test.jsx
git commit -m "feat: improve recent domains scan actions"
```

### Task 2: Add dashboard navigation from My Scans

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/pages/MyScansPage.jsx`
- Test: `frontend/src/components/pages/MyScansPage.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyScansPage from './MyScansPage.jsx';

it('links scan rows back to the dashboard', async () => {
  const user = userEvent.setup();
  let selectedDomain = null;
  const onUseDomain = (domain) => {
    selectedDomain = domain;
  };

  render(
    <MyScansPage
      headerActions={null}
      onNavigate={() => {}}
      onUseDomain={onUseDomain}
      scans={[
        { domain: 'example.com', saved_at: '2026-06-30T12:00:00.000Z', last_status: 'ok', notes: '' },
      ]}
      loading={false}
      error={null}
    />
  );

  await user.click(screen.getByRole('link', { name: /example\.com/i }));
  expect(selectedDomain).toBe('example.com');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend run test -- src/components/pages/MyScansPage.test.jsx`

Expected: FAIL because the page still renders a static table with no dashboard links.

- [ ] **Step 3: Write the minimal implementation**

```jsx
// In App.jsx, pass a callback that sets the active domain and navigates to 'scan'.
// In MyScansPage.jsx, render each scan domain as a link/button that triggers that callback.
// Add a "Scan again" button that starts a new scan for the selected domain.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend run test -- src/components/pages/MyScansPage.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/pages/MyScansPage.jsx frontend/src/components/pages/MyScansPage.test.jsx
git commit -m "feat: link my scans back to dashboard"
```

### Task 3: Verify the full dashboard flow

**Files:**
- Modify: none expected unless verification finds a regression

- [ ] **Step 1: Run the focused frontend tests**

Run: `pnpm --filter frontend run test -- src/components/pages/scan/RecentDomainsCard.test.jsx src/components/pages/MyScansPage.test.jsx`

Expected: PASS.

- [ ] **Step 2: Run the full frontend build**

Run: `pnpm --filter frontend run build`

Expected: PASS.

- [ ] **Step 3: Manually verify the user flow**

Confirm in the browser:
1. A logged-in non-admin user runs a scan.
2. The recent-domains card shows that scan even if it was not explicitly saved.
3. The recent-domains card shows a save action for unsaved scans.
4. Clicking a My Scans domain returns to the dashboard with that domain loaded.
5. Clicking "Scan again" reruns the domain from My Scans.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify scan history dashboard flow"
```
