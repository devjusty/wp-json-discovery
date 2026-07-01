# shadcn Hybrid Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the frontend to shadcn/ui primitives while keeping the current atomic imports stable during the transition.

**Architecture:** `frontend/src/components/ui/` becomes the primitive layer, `frontend/src/components/atoms/` becomes thin compatibility adapters, and new screen work should import `components/ui` directly. Migrate dense admin surfaces first so the highest-signal tables, dialogs, and forms get the new visual language before the broader app shell and scan pages.

**Tech Stack:** React, shadcn/ui, Base UI primitives, React Testing Library, Vitest, ESLint, Vite.

---

### Task 1: Add shadcn primitives and collapse atomic wrappers

**Files:**
- Create: `frontend/src/components/ui/card.jsx`
- Create: `frontend/src/components/ui/table.jsx`
- Create: `frontend/src/components/ui/dialog.jsx`
- Create: `frontend/src/components/ui/alert-dialog.jsx`
- Create: `frontend/src/components/ui/badge.jsx`
- Create: `frontend/src/components/ui/separator.jsx`
- Create: `frontend/src/components/ui/tooltip.jsx`
- Create: `frontend/src/components/ui/skeleton.jsx`
- Create: `frontend/src/components/ui/tabs.jsx`
- Create: `frontend/src/components/ui/input.jsx`
- Create: `frontend/src/components/ui/textarea.jsx`
- Create: `frontend/src/components/ui/select.jsx`
- Create: `frontend/src/components/ui/checkbox.jsx`
- Create: `frontend/src/components/ui/switch.jsx`
- Create: `frontend/src/components/ui/dropdown-menu.jsx`
- Create: `frontend/src/components/ui/sheet.jsx`
- Create: `frontend/src/components/ui/popover.jsx`
- Create: `frontend/src/components/ui/command.jsx`
- Modify: `frontend/src/components/atoms/Button.jsx`
- Modify: `frontend/src/components/atoms/Card.jsx`
- Modify: `frontend/src/components/atoms/TextInput.jsx`
- Test: `frontend/src/components/atoms/adapter.test.jsx`

- [ ] **Step 1: Write the failing adapter test**

```jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Button from './Button.jsx';
import { Card, CardContent, CardHeader } from './Card.jsx';
import TextInput from './TextInput.jsx';

describe('atomic adapters', () => {
  it('exposes shadcn slots while preserving the old atom API', () => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <Card as="article">
          <CardHeader>Title</CardHeader>
          <CardContent>Body</CardContent>
        </Card>
        <TextInput aria-label="Query" />
      </>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('data-slot', 'button');
    expect(screen.getByRole('article')).toHaveAttribute('data-slot', 'card');
    expect(screen.getByLabelText('Query')).toHaveAttribute('data-slot', 'input');
  });
});
```

- [ ] **Step 2: Run the test to prove the current wrappers are still legacy-driven**

Run: `pnpm --filter frontend exec vitest run src/components/atoms/adapter.test.jsx`

Expected: FAIL because the atomic wrappers still render custom classes instead of delegating to the shadcn primitives.

- [ ] **Step 3: Add the shadcn primitives and rewrite the atom adapters**

Run: `npx shadcn@latest add card table dialog alert-dialog badge separator tooltip skeleton tabs input textarea select checkbox switch dropdown-menu sheet popover command -c frontend`

Then update the adapters so the old imports stay stable:

```jsx
// frontend/src/components/atoms/Button.jsx
import PropTypes from 'prop-types';
import { Button as UiButton } from '../ui/button.jsx';

const VARIANT_MAP = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  destructive: 'destructive',
  link: 'link'
};

const SIZE_MAP = {
  sm: 'sm',
  md: 'default',
  lg: 'lg'
};

function Button({ variant = 'primary', size = 'md', ...props }) {
  return (
    <UiButton
      variant={VARIANT_MAP[variant] ?? 'default'}
      size={SIZE_MAP[size] ?? 'default'}
      {...props}
    />
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'destructive', 'link']),
  size: PropTypes.oneOf(['sm', 'md', 'lg'])
};

export default Button;

// frontend/src/components/atoms/Card.jsx
import PropTypes from 'prop-types';
import { Card as UiCard, CardHeader as UiCardHeader, CardContent as UiCardContent, CardFooter as UiCardFooter } from '../ui/card.jsx';

export function Card({ as = 'section', className, children, ...props }) {
  const Component = as || 'section';
  return <Component className={className} {...props}>{children}</Component>;
}

export const CardHeader = UiCardHeader;
export const CardContent = UiCardContent;
export const CardActions = UiCardFooter;

// frontend/src/components/atoms/TextInput.jsx
import PropTypes from 'prop-types';
import { Input } from '../ui/input.jsx';

function TextInput({ size = 'md', ...props }) {
  return <Input data-size={size} {...props} />;
}
```

Make sure any generated shadcn files that import icons use `hugeicons` instead of `lucide-react`, and keep `frontend/src/components/ui/button.jsx` as the canonical base primitive unless the CLI emits a local diff for it.

- [ ] **Step 4: Run the adapter test again and then lint the adapter files**

Run:

```bash
pnpm --filter frontend exec vitest run src/components/atoms/adapter.test.jsx
pnpm --filter frontend exec eslint src/components/atoms/Button.jsx src/components/atoms/Card.jsx src/components/atoms/TextInput.jsx src/components/ui/*.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit the adapter layer**

```bash
git add frontend/src/components/ui frontend/src/components/atoms/Button.jsx frontend/src/components/atoms/Card.jsx frontend/src/components/atoms/TextInput.jsx frontend/src/components/atoms/adapter.test.jsx
git commit -m "feat: add shadcn adapter layer"
```

### Task 2: Migrate admin surfaces to shadcn tables, dialogs, and form controls

**Files:**
- Modify: `frontend/src/components/pages/admin/sections/AdminPluginManagerSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminUnsupportedSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminSupportedPluginsSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminSupportedThemesSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminThemeManagerSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminDomainsSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminLogsSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminDbSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminAssetsSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminMaintenanceSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminHeartbeatSection.jsx`
- Test: `frontend/src/components/pages/AdminPage.test.jsx`
- Test: `frontend/src/components/pages/admin/sections/AdminPluginManagerSection.test.jsx`
- Test: `frontend/src/components/pages/admin/sections/AdminUnsupportedSection.test.jsx`

- [ ] **Step 1: Write the failing admin regression tests**

```jsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

it('opens a shadcn alert dialog before deleting a plugin', async () => {
  const user = userEvent.setup();
  render(<AdminPluginManagerSection {...pluginManagerProps} />);

  await user.click(screen.getByRole('button', { name: 'Delete' }));

  expect(await screen.findByRole('alertdialog', { name: /delete plugin/i })).toBeInTheDocument();
});

it('renders unsupported namespaces as a real table', () => {
  render(<AdminUnsupportedSection {...unsupportedProps} />);

  expect(screen.getByRole('table', { name: /unsupported plugins/i })).toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByRole('button', { name: 'Promote wc/v3' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify the current admin markup is still custom markup**

Run: `pnpm --filter frontend exec vitest run src/components/pages/AdminPage.test.jsx src/components/pages/admin/sections/AdminPluginManagerSection.test.jsx src/components/pages/admin/sections/AdminUnsupportedSection.test.jsx`

Expected: FAIL because delete confirmation still uses `window.confirm` and the unsupported section still renders div-based rows.

- [ ] **Step 3: Replace the admin row/table/dialog/form markup with shadcn primitives**

Use the new `components/ui` layer directly in these screens:

```jsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
```

Use `Table` for plugin/theme/domain/unsupported lists, `Dialog` for create/edit modals, `AlertDialog` for destructive deletes, `Badge` for counts and statuses, `Tooltip` for timestamps, `Separator` for section breaks, and `Input`/`Textarea`/`Select` for inline filters and editor fields. Keep the existing data flow and mutations; only swap the presentation layer.

- [ ] **Step 4: Re-run the admin tests and lint the touched admin files**

Run:

```bash
pnpm --filter frontend exec vitest run src/components/pages/AdminPage.test.jsx src/components/pages/admin/sections/AdminPluginManagerSection.test.jsx src/components/pages/admin/sections/AdminUnsupportedSection.test.jsx
pnpm --filter frontend exec eslint src/components/pages/AdminPage.jsx src/components/pages/AdminPage.test.jsx src/components/pages/admin/sections/AdminPluginManagerSection.jsx src/components/pages/admin/sections/AdminUnsupportedSection.jsx src/components/pages/admin/sections/AdminSupportedPluginsSection.jsx src/components/pages/admin/sections/AdminSupportedThemesSection.jsx src/components/pages/admin/sections/AdminThemeManagerSection.jsx src/components/pages/admin/sections/AdminDomainsSection.jsx src/components/pages/admin/sections/AdminLogsSection.jsx src/components/pages/admin/sections/AdminDbSection.jsx src/components/pages/admin/sections/AdminAssetsSection.jsx src/components/pages/admin/sections/AdminMaintenanceSection.jsx src/components/pages/admin/sections/AdminHeartbeatSection.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit the admin migration slice**

```bash
git add frontend/src/components/pages/AdminPage.jsx frontend/src/components/pages/AdminPage.test.jsx frontend/src/components/pages/admin/sections/AdminPluginManagerSection.jsx frontend/src/components/pages/admin/sections/AdminPluginManagerSection.test.jsx frontend/src/components/pages/admin/sections/AdminUnsupportedSection.jsx frontend/src/components/pages/admin/sections/AdminUnsupportedSection.test.jsx frontend/src/components/pages/admin/sections/AdminSupportedPluginsSection.jsx frontend/src/components/pages/admin/sections/AdminSupportedThemesSection.jsx frontend/src/components/pages/admin/sections/AdminThemeManagerSection.jsx frontend/src/components/pages/admin/sections/AdminDomainsSection.jsx frontend/src/components/pages/admin/sections/AdminLogsSection.jsx frontend/src/components/pages/admin/sections/AdminDbSection.jsx frontend/src/components/pages/admin/sections/AdminAssetsSection.jsx frontend/src/components/pages/admin/sections/AdminMaintenanceSection.jsx frontend/src/components/pages/admin/sections/AdminHeartbeatSection.jsx
git commit -m "feat: migrate admin surfaces to shadcn"
```

### Task 3: Move shell and scan pages onto shadcn primitives, then verify the frontend

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/templates/AppLayout.jsx`
- Modify: `frontend/src/components/pages/ScanPage.jsx`
- Modify: `frontend/src/components/pages/MyScansPage.jsx`
- Modify: `frontend/src/components/pages/HistoryPage.jsx`
- Modify: `frontend/src/components/pages/admin/AdminSidebarNav.jsx`
- Modify: `frontend/src/components/pages/scan/RecentDomainsCard.jsx`
- Modify: `frontend/src/components/pages/scan/ScanSidebarNav.jsx`
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.jsx`
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.jsx`
- Test: `frontend/src/components/pages/HistoryPage.test.jsx`
- Test: `frontend/src/components/pages/MyScansPage.test.jsx`
- Test: `frontend/src/components/templates/AppLayout.test.jsx`

- [ ] **Step 1: Write the failing shell/page regression tests**

```jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

it('renders saved scans as a shadcn table with an accessible name', () => {
  render(<MyScansPage {...props} />);

  expect(screen.getByRole('table', { name: 'Saved scans' })).toBeInTheDocument();
});

it('renders scan history filters and rows inside shadcn layout cards', () => {
  render(<HistoryPage {...props} />);

  expect(screen.getByRole('table', { name: 'Scan history' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Search domains' })).toBeInTheDocument();
});

it('keeps the app shell navigation usable in a shadcn sheet on small screens', () => {
  render(<AppLayout {...props} />);

  expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to confirm the shell is still using the older page chrome**

Run: `pnpm --filter frontend exec vitest run src/components/pages/HistoryPage.test.jsx src/components/pages/MyScansPage.test.jsx src/components/templates/AppLayout.test.jsx`

Expected: FAIL because the shell still uses the legacy table/card/navigation patterns.

- [ ] **Step 3: Replace the shell and page chrome with shadcn `Sheet`, `Tabs`, `Table`, `Badge`, `Skeleton`, and `Separator`**

Keep the current routing and data queries, but move the presentation to the new primitives:

```jsx
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
```

Use `Sheet` for the app/sidebar navigation on narrow layouts, `Tabs` for page-level section switching where the current custom nav is just a mode switch, `Table` for `HistoryPage` and `MyScansPage`, `Badge` for status chips, `Skeleton` for loading states, and `Separator` to break dense metadata groups. Keep `AdminSidebarNav` and the scan page side nav in sync with the new shell so the current page affordances stay consistent.

- [ ] **Step 4: Run the page tests, then the frontend lint and build checks**

Run:

```bash
pnpm --filter frontend exec vitest run src/components/pages/HistoryPage.test.jsx src/components/pages/MyScansPage.test.jsx src/components/templates/AppLayout.test.jsx src/components/pages/AdminPage.test.jsx
pnpm --filter frontend exec eslint src/App.jsx src/components/templates/AppLayout.jsx src/components/pages/ScanPage.jsx src/components/pages/MyScansPage.jsx src/components/pages/HistoryPage.jsx src/components/pages/admin/AdminSidebarNav.jsx src/components/pages/scan/RecentDomainsCard.jsx src/components/pages/scan/ScanSidebarNav.jsx src/components/pages/scan/ScanSectionContent.jsx src/components/pages/scan/ScanStatusStack.jsx
pnpm --filter frontend run build
pnpm --filter frontend run lint
```

Expected: all checks pass.

- [ ] **Step 5: Commit the shell migration**

```bash
git add frontend/src/App.jsx frontend/src/components/templates/AppLayout.jsx frontend/src/components/pages/ScanPage.jsx frontend/src/components/pages/MyScansPage.jsx frontend/src/components/pages/HistoryPage.jsx frontend/src/components/pages/admin/AdminSidebarNav.jsx frontend/src/components/pages/scan/RecentDomainsCard.jsx frontend/src/components/pages/scan/ScanSidebarNav.jsx frontend/src/components/pages/scan/ScanSectionContent.jsx frontend/src/components/pages/scan/ScanStatusStack.jsx frontend/src/components/pages/HistoryPage.test.jsx frontend/src/components/pages/MyScansPage.test.jsx frontend/src/components/templates/AppLayout.test.jsx
git commit -m "feat: move shell pages onto shadcn"
```
