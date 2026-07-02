# Full-Width Shell Nav Badge Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app shell full-width, flatten the left navigation rail, sharpen the homepage source signals badge, and add icons to the scan/admin menu items.

**Architecture:** This is a frontend-only presentation pass. `frontend/src/App.css` owns the shell width and nav-rail geometry, while `ScanSidebarNav.jsx` and `AdminSidebarNav.jsx` own the menu item composition and icon wiring. The badge refinement stays local to the homepage summary chip in `ScanSidebarNav.jsx`, so the summary text stays unchanged while the visual treatment gets denser and easier to scan.

**Tech Stack:** React, Vite, shadcn `Badge`, shadcn `Button`, hugeicons.

---

### Task 1: Remove shell width caps and flatten the left rail

**Files:**
- Modify: `frontend/src/App.css`
- Test: `frontend/src/components/templates/AppLayout.test.jsx`

- [ ] **Step 1: Tighten the existing shell regression around the sidebar sheet**

```jsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppLayout from './AppLayout.jsx';

describe('AppLayout', () => {
  it('opens sidebar navigation in a shadcn sheet', async () => {
    const user = userEvent.setup();

    render(
      <AppLayout title="Admin" sidebar={<div>Sidebar content</div>} onNavigate={vi.fn()}>
        <p>Main content</p>
      </AppLayout>
    );

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    const dialog = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(within(dialog).getByText('Sidebar content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the AppLayout regression before changing CSS**

Run: `pnpm --filter frontend exec vitest run src/components/templates/AppLayout.test.jsx`
Expected: PASS.

- [ ] **Step 3: Remove the centered layout cap and flatten the sidebar shell styles**

```css
/* shell */
#root {
  width: 100%;
  margin: 0;
  padding: 2.5rem 1.5rem 4rem;
}

.app__header,
.app__body {
  max-width: none;
  width: 100%;
}

.sidebar {
  border-radius: 0;
}

.sidebar__link {
  border-radius: 0;
}

.sidebar__sublink {
  border-radius: 0;
}
```

- [ ] **Step 4: Re-run the AppLayout regression and build**

Run: `pnpm --filter frontend exec vitest run src/components/templates/AppLayout.test.jsx && pnpm --filter frontend run build`
Expected: PASS with the existing chunk-size warning if it still appears.

- [ ] **Step 5: Commit the shell-only change**

```bash
git add frontend/src/App.css frontend/src/components/templates/AppLayout.test.jsx
git commit -m "feat: widen the app shell"
```

### Task 2: Add icons and a denser homepage signals badge to the scan rail

**Files:**
- Modify: `frontend/src/components/pages/scan/ScanSidebarNav.jsx`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/components/pages/scan/ScanSidebarNav.test.jsx`

- [ ] **Step 1: Write a regression that still expects the homepage summary chip to render inside the homepage nav item**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScanSidebarNav from './ScanSidebarNav.jsx';

describe('ScanSidebarNav', () => {
  it('renders the homepage summary as a badge inside the homepage nav item', async () => {
    render(
      <ScanSidebarNav
        activeSection="overview"
        hasScanResult
        homepageNavSummary="S200 · M3 · A12 · F1"
        onSectionChange={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenAdmin={vi.fn()}
        isAdmin
      />
    );

    const homepageButton = screen.getByRole('button', { name: 'Homepage source' });
    expect(homepageButton).toBeInTheDocument();
    expect(screen.getByText('S200 · M3 · A12 · F1').closest('[data-slot="badge"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the scan nav test and watch it fail against the current pill styling if needed**

Run: `pnpm --filter frontend exec vitest run src/components/pages/scan/ScanSidebarNav.test.jsx`
Expected: FAIL until the homepage summary chip is upgraded.

- [ ] **Step 3: Add decorative hugeicons to each scan nav item and restyle the homepage summary chip**

```jsx
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, SignalIcon, Shield01Icon, Database02Icon, File01Icon, HistoryIcon } from '@hugeicons/core-free-icons';

// Use a small icon span before each label.
// Keep the icon aria-hidden so the accessible name stays the same.
```

```css
.sidebar__link-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.sidebar__link-content--icon {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.sidebar__link-icon {
  flex: none;
}

.sidebar__link-meta {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding-inline: 0.45rem;
  padding-block: 0.15rem;
}

.sidebar__link-meta--signal {
  border-color: var(--color-primary-light);
  background: var(--overlay-brand-soft);
  color: var(--color-sidebar-text);
}
```

- [ ] **Step 4: Re-run the scan nav regression and build**

Run: `pnpm --filter frontend exec vitest run src/components/pages/scan/ScanSidebarNav.test.jsx && pnpm --filter frontend run build`
Expected: PASS.

- [ ] **Step 5: Commit the scan rail refresh**

```bash
git add frontend/src/components/pages/scan/ScanSidebarNav.jsx frontend/src/components/pages/scan/ScanSidebarNav.test.jsx frontend/src/App.css
git commit -m "feat: refresh the scan navigation rail"
```

### Task 3: Add icons to the admin navigation and keep the rail flat

**Files:**
- Modify: `frontend/src/components/pages/admin/AdminSidebarNav.jsx`
- Create: `frontend/src/components/pages/admin/AdminSidebarNav.test.jsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Write the admin nav regression before adding icons**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminSidebarNav from './AdminSidebarNav.jsx';

describe('AdminSidebarNav', () => {
  it('keeps the primary nav buttons accessible', async () => {
    const user = userEvent.setup();

    render(
      <AdminSidebarNav
        activeSection="db"
        onNavigate={vi.fn()}
        onSetActiveSection={vi.fn()}
        onPrefetchSection={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Go to current scan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View scan history' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Admin (current)' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'View scan history' }));
  });
});
```

- [ ] **Step 2: Run the new admin nav test and confirm the current menu still passes its accessibility contract**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/AdminSidebarNav.test.jsx`
Expected: PASS after the component is updated.

- [ ] **Step 3: Add hugeicons to the top-level admin nav buttons and keep the nested anchors text-only**

```jsx
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, HistoryIcon, Database02Icon, Shield01Icon, File01Icon } from '@hugeicons/core-free-icons';

// Top-level buttons get icons; section anchors stay text-only.
// Use aria-hidden on the icons so the button names stay unchanged.
```

```css
.sidebar__link {
  border-radius: 0;
}

.sidebar__subnav {
  border-left: 0;
  margin-left: 0.25rem;
}

.sidebar__sublink {
  border-radius: 0;
  padding-inline-start: 0.25rem;
}
```

- [ ] **Step 4: Re-run the admin nav test and build**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/AdminSidebarNav.test.jsx && pnpm --filter frontend run build`
Expected: PASS.

- [ ] **Step 5: Commit the admin nav refresh**

```bash
git add frontend/src/components/pages/admin/AdminSidebarNav.jsx frontend/src/components/pages/admin/AdminSidebarNav.test.jsx frontend/src/App.css
git commit -m "feat: add icons to the admin navigation"
```
