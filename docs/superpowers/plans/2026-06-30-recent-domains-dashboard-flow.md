# Recent Domains Dashboard Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge saved and recent scans in the dashboard recent-domains view, move save state into that feed, and make My Scans rows navigate back to the dashboard with a scan-again action.

**Architecture:** Keep this frontend-only. Add one small merge helper that normalizes `recent-runs` and saved scans into a single feed the dashboard can render. The recent-domains card will show saved state inline and surface save actions for unsaved items, while My Scans will reuse the existing scan-page navigation callbacks to jump back to the dashboard and optionally rescan the selected domain.

**Tech Stack:** React, React Query, existing API client helpers, existing button components, Vitest, @testing-library/react.

---

### Task 1: Merge dashboard scans into one feed

**Files:**
- Create: `frontend/src/utils/scanFeed.js`
- Create: `frontend/src/utils/scanFeed.test.js`
- Modify: `frontend/src/components/pages/ScanPage.jsx`

- [ ] **Step 1: Write the failing test**

```js
import { mergeRecentScans } from './scanFeed.js';

describe('mergeRecentScans', () => {
  it('merges saved scans and recent runs into one sorted feed with saved state', () => {
    const recentRuns = [
      { domain: 'unsaved.example.com', lastScannedAt: '2026-06-30T12:00:00.000Z', lastStatus: 'ok' },
      { domain: 'saved.example.com', lastScannedAt: '2026-06-30T10:00:00.000Z', lastStatus: 'failed' }
    ];

    const savedScans = [
      { domain: 'saved.example.com', saved_at: '2026-06-30T09:30:00.000Z', notes: 'keep this' },
      { domain: 'older-saved.example.com', saved_at: '2026-06-30T11:15:00.000Z', notes: '' }
    ];

    expect(mergeRecentScans(recentRuns, savedScans)).toEqual([
      {
        domain: 'unsaved.example.com',
        isSaved: false,
        savedAt: null,
        notes: null,
        lastScannedAt: '2026-06-30T12:00:00.000Z',
        lastStatus: 'ok'
      },
      {
        domain: 'older-saved.example.com',
        isSaved: true,
        savedAt: '2026-06-30T11:15:00.000Z',
        notes: '',
        lastScannedAt: null,
        lastStatus: null
      },
      {
        domain: 'saved.example.com',
        isSaved: true,
        savedAt: '2026-06-30T09:30:00.000Z',
        notes: 'keep this',
        lastScannedAt: '2026-06-30T10:00:00.000Z',
        lastStatus: 'failed'
      }
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend run test -- src/utils/scanFeed.test.js`

Expected: FAIL because `frontend/src/utils/scanFeed.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```js
function toTimestamp(value) {
  const time = new Date(value ?? '').getTime();
  return Number.isFinite(time) ? time : 0;
}

export function mergeRecentScans(recentRuns = [], savedScans = []) {
  const recentByDomain = new Map(recentRuns.map((run) => [run.domain, run]));
  const savedByDomain = new Map(savedScans.map((scan) => [scan.domain, scan]));
  const domains = new Set([...recentByDomain.keys(), ...savedByDomain.keys()]);

  return [...domains]
    .map((domain) => {
      const recentRun = recentByDomain.get(domain) ?? null;
      const savedScan = savedByDomain.get(domain) ?? null;

      return {
        domain,
        isSaved: Boolean(savedScan),
        savedAt: savedScan?.saved_at ?? null,
        notes: savedScan?.notes ?? null,
        lastScannedAt: recentRun?.lastScannedAt ?? null,
        lastStatus: recentRun?.lastStatus ?? null
      };
    })
    .sort((left, right) => {
      const rightTime = toTimestamp(right.lastScannedAt ?? right.savedAt);
      const leftTime = toTimestamp(left.lastScannedAt ?? left.savedAt);
      return rightTime - leftTime;
    });
}

// In ScanPage.jsx:
import { request } from '../../api/client.js';
import { mergeRecentScans } from '../../utils/scanFeed.js';

const savedScansQuery = useQuery({
  queryKey: ['savedScans'],
  queryFn: async () => {
    const result = await request('/api/user/scans');
    if (!result.ok) {
      throw new Error('Failed to load saved scans');
    }

    return result.data.domains ?? [];
  },
  enabled: isAuthenticated,
  staleTime: 30000
});

const recentDomains = useMemo(
  () => mergeRecentScans(recentUserScansQuery.data?.items ?? [], savedScansQuery.data ?? []),
  [recentUserScansQuery.data, savedScansQuery.data]
);

// Pass `recentDomains` to RecentDomainsCard and remove the standalone SaveScanButton
// from the bottom of the page so save state only lives in the recent feed.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend run test -- src/utils/scanFeed.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/scanFeed.js frontend/src/utils/scanFeed.test.js frontend/src/components/pages/ScanPage.jsx
git commit -m "feat: merge recent and saved scan feeds"
```

### Task 2: Render save state in recent domains

**Files:**
- Modify: `frontend/src/components/pages/scan/RecentDomainsCard.jsx`
- Test: `frontend/src/components/pages/scan/RecentDomainsCard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecentDomainsCard from './RecentDomainsCard.jsx';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: true })
}));

describe('RecentDomainsCard', () => {
  it('shows saved state for saved scans and a save action for unsaved scans', async () => {
    const user = userEvent.setup();
    const onRescan = vi.fn();

    render(
      <RecentDomainsCard
        items={[
          { domain: 'saved.example.com', isSaved: true, savedAt: '2026-06-30T09:30:00.000Z', notes: 'keep this', lastScannedAt: '2026-06-30T10:00:00.000Z', lastStatus: 'failed' },
          { domain: 'unsaved.example.com', isSaved: false, savedAt: null, notes: null, lastScannedAt: '2026-06-30T12:00:00.000Z', lastStatus: 'ok' }
        ]}
        isLoading={false}
        isExpanded={true}
        onToggleExpanded={vi.fn()}
        onOpenHistory={vi.fn()}
        onRescan={onRescan}
      />
    );

    expect(screen.getByText('Saved to My Scans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save to my scans/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /unsaved\.example\.com/i }));
    expect(onRescan).toHaveBeenCalledWith('unsaved.example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend run test -- src/components/pages/scan/RecentDomainsCard.test.jsx`

Expected: FAIL because the card still renders only the existing recent-domain list and does not expose saved state inline.

- [ ] **Step 3: Write the minimal implementation**

```jsx
// Inside the recent-domains row rendering:
{item.isSaved ? (
  <span className="badge badge--success">Saved to My Scans</span>
) : (
  <SaveScanButton domain={item.domain} />
)}

// Keep the domain button or row action calling onRescan(item.domain)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend run test -- src/components/pages/scan/RecentDomainsCard.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pages/scan/RecentDomainsCard.jsx frontend/src/components/pages/scan/RecentDomainsCard.test.jsx
git commit -m "feat: show saved state in recent domains"
```

### Task 3: Add My Scans dashboard navigation and rescan action

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/pages/MyScansPage.jsx`
- Test: `frontend/src/components/pages/MyScansPage.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyScansPage from './MyScansPage.jsx';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: true, isLoading: false })
}));

vi.mock('../../api/client.js', () => ({
  request: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      domains: [
        { domain: 'example.com', saved_at: '2026-06-30T09:30:00.000Z', last_status: 'ok', notes: 'ready' }
      ]
    }
  })
}));

describe('MyScansPage', () => {
  it('lets a user open the dashboard for a scan and rescan from the row', async () => {
    const user = userEvent.setup();
    const onUseDomain = vi.fn();
    const onRescan = vi.fn();

    render(<MyScansPage headerActions={null} onNavigate={vi.fn()} onUseDomain={onUseDomain} onRescan={onRescan} />);

    await user.click(await screen.findByRole('button', { name: /example\.com/i }));
    expect(onUseDomain).toHaveBeenCalledWith('example.com');

    await user.click(screen.getByRole('button', { name: /scan again/i }));
    expect(onRescan).toHaveBeenCalledWith('example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend run test -- src/components/pages/MyScansPage.test.jsx`

Expected: FAIL because `MyScansPage` does not yet expose row-level dashboard/rescan actions.

- [ ] **Step 3: Write the minimal implementation**

```jsx
import { Button } from '@/components/ui/button';

// In App.jsx, pass the callbacks:
<MyScansPage
  headerActions={headerActions}
  onNavigate={setActivePage}
  onUseDomain={(domain) => {
    setDomain(domain);
    setActivePage('scan');
  }}
  onRescan={(domain) => {
    if (!domain) return;
    setDomain(domain);
    setActivePage('scan');
    startScan(domain);
  }}
/>

// In MyScansPage.jsx, render the domain as a button that calls onUseDomain(scan.domain)
// and add a "Scan again" button in the row actions that calls onRescan(scan.domain).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend run test -- src/components/pages/MyScansPage.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/pages/MyScansPage.jsx frontend/src/components/pages/MyScansPage.test.jsx
git commit -m "feat: improve my scans dashboard navigation"
```

### Task 4: Full frontend verification

**Files:**
- None

- [ ] **Step 1: Run the recent-domains and My Scans tests together**

Run: `pnpm --filter frontend run test -- src/utils/scanFeed.test.js src/components/pages/scan/RecentDomainsCard.test.jsx src/components/pages/MyScansPage.test.jsx`

Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `pnpm --filter frontend run build`

Expected: PASS.

- [ ] **Step 3: Commit if needed**

If verification uncovered fixes, commit them with:

```bash
git add frontend/src/**
git commit -m "feat: refine recent domains and my scans navigation"
```
