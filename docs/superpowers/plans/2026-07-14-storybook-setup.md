# Storybook Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Storybook 10 setup for `frontend/`, wire it into app styling/runtime needs, and replace stock scaffold stories with repo-specific stories.

**Architecture:** Keep Storybook focused on leaf UI and workflow components, not the full app shell. Load the same global fonts and CSS tokens used by the app so stories match production styling, then add colocated stories near components with auto-titled metadata and one explicit `CssCheck` story that proves a real computed style from source CSS.

**Tech Stack:** JavaScript, React 19, Vite, Storybook 10, `storybook/test`, MSW (`msw` + `msw-storybook-addon`), Vitest.

---

### Task 1: Wire Storybook preview and runtime globals

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/.storybook/preview.jsx`

- [ ] **Step 1: Add Storybook runtime deps**

Install packages Storybook setup expects for MSW support:

```bash
pnpm --filter frontend add -D msw msw-storybook-addon
```

- [ ] **Step 2: Replace stock preview with repo globals**

```jsx
import { initialize, mswLoader } from 'msw-storybook-addon';

import '../src/index.css';
import '../src/App.css';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';

initialize({ onUnhandledRequest: 'bypass' });

const preview = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Story />
      </div>
    ),
  ],
  loaders: [mswLoader],
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
};

export default preview;
```

- [ ] **Step 3: Verify preview file still imports app CSS first**

Run:

```bash
pnpm --filter frontend exec storybook dev -p 6006
```

Expected: Storybook starts cleanly and stories inherit app fonts, Tailwind tokens, and dark theme colors.

### Task 2: Add colocated repo stories

**Files:**
- Create: `frontend/src/components/atoms/Button.stories.jsx`
- Create: `frontend/src/components/atoms/TextInput.stories.jsx`
- Create: `frontend/src/components/molecules/forms/DomainForm.stories.jsx`
- Create: `frontend/src/components/organisms/panels/UnsupportedPluginsPanel.stories.jsx`
- Modify: `frontend/src/components/atoms/Button.jsx` only if story args expose a missing prop

- [ ] **Step 1: Write Button stories, including CssCheck**

Use auto-title from file path, `component: Button`, and tags `['ai-generated', 'needs-work']`.

```jsx
import { expect } from 'storybook/test';

import Button from './Button.jsx';

export default {
  component: Button,
  tags: ['ai-generated', 'needs-work'],
};

export const Primary = {
  args: {
    children: 'Start scan',
    variant: 'primary',
  },
};

export const CssCheck = {
  args: {
    children: 'Primary token check',
    variant: 'primary',
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    await expect(button).toHaveStyle({ backgroundColor: 'rgb(96, 165, 250)' });
  },
};
```

- [ ] **Step 2: Write TextInput stories**

Cover `sm` and `md` sizes with plain `args`, no custom harness.

- [ ] **Step 3: Write DomainForm stories**

Add one uncontrolled story with `initialDomain`, one controlled story, and one interaction story that uses `fn()` from `storybook/test` plus `play` to submit `https://example.com/path` and assert normalized output is `example.com`.

- [ ] **Step 4: Write UnsupportedPluginsPanel stories**

Cover `isLoading`, empty list, and populated list states. Use stable sample timestamps and at least one story with `showDomains: true`.

- [ ] **Step 5: Run Storybook Vitest project**

Run:

```bash
pnpm --filter frontend exec vitest --project storybook run
```

Expected: pass after stories and preview are wired.

### Task 3: Remove stock scaffold stories

**Files:**
- Delete: `frontend/src/stories/Button.jsx`
- Delete: `frontend/src/stories/Button.stories.js`
- Delete: `frontend/src/stories/Header.jsx`
- Delete: `frontend/src/stories/Header.stories.js`
- Delete: `frontend/src/stories/Page.jsx`
- Delete: `frontend/src/stories/Page.stories.js`
- Delete: `frontend/src/stories/button.css`
- Delete: `frontend/src/stories/header.css`
- Delete: `frontend/src/stories/page.css`
- Delete: `frontend/src/stories/Configure.mdx`
- Delete: `frontend/src/stories/assets/*`

- [ ] **Step 1: Remove sample content only after repo stories exist**

Delete Storybook starter files so `frontend/src/components/**` stories are only source of truth.

- [ ] **Step 2: Re-run Storybook build and lint**

Run:

```bash
pnpm --filter frontend run build
pnpm --filter frontend run build-storybook
pnpm --filter frontend run lint
```

Expected: all pass with no references to deleted scaffold files.

### Task 4: Final smoke check

**Files:**
- No code changes expected

- [ ] **Step 1: Confirm final Storybook state**

Run:

```bash
pnpm --filter frontend exec vitest --project storybook run
pnpm --filter frontend run build
```

Expected: green. If any story needs a small fix, keep it colocated with its component file.
