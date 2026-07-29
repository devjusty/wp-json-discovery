# Configurable Scan Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed core-plus-homepage scanning with configurable capability selections, independent session state, local saved defaults, and status-aware scan navigation.

**Architecture:** A frontend capability registry wraps existing core, homepage, and sitemap runners. Pure registry, persistence, and session-execution modules own selection validation, session transitions, dependency scheduling, and normalized errors; `useScan` coordinates them with React Query-adjacent side effects. `ScanContext` exposes one session and its actions to UI, so form, status, navigation, overview, homepage, and sitemap all use identical capability metadata and lifecycle state.

**Tech Stack:** React 19, TanStack Query, Vitest, Testing Library, Base UI primitives, Vite, existing Express APIs.

---

## File Structure

- Create: `frontend/src/services/scanCapabilities.js` — registry entries, deterministic recommendation, selection and option normalization, section-to-capability lookup.
- Create: `frontend/src/services/scanCapabilities.test.js` — registry recommendation, unknown-selection, options, availability, and section mapping coverage.
- Create: `frontend/src/services/scanPreferences.js` — versioned browser-storage load/save boundary for capability defaults.
- Create: `frontend/src/services/scanPreferences.test.js` — browser-storage restore, invalid-data fallback, and save coverage.
- Create: `frontend/src/services/scanSession.js` — pure session factory, status transitions, error normalization, execution waves, and overall-status calculation.
- Create: `frontend/src/services/scanSession.test.js` — concurrency, dependency, failure, retry, and stale-session behavior coverage.
- Modify: `frontend/src/hooks/useScan.js` — coordinate registry runners into one session and retain core unsupported-namespace persistence/logging.
- Create: `frontend/src/hooks/useScan.test.jsx` — hook-level start, targeted retry, and stale-domain guard coverage.
- Modify: `frontend/src/context/ScanContext.jsx` — expose session, editable settings, saved defaults, and capability actions through existing contexts.
- Modify: `frontend/src/components/molecules/forms/DomainForm.jsx` — add compact scan-settings disclosure and default-save control while retaining domain-first submission.
- Create: `frontend/src/components/molecules/forms/ScanSettingsPanel.jsx` — registry-driven capability controls and capability-specific sitemap options.
- Modify: `frontend/src/components/molecules/forms/DomainForm.stories.jsx` — show recommended settings and saved-default interactions in Storybook.
- Create: `frontend/src/components/molecules/forms/ScanSettingsPanel.test.jsx` — selection, recommended label, option, and disabled-during-run coverage.
- Modify: `frontend/src/components/pages/ScanPage.jsx` — remove independent homepage/sitemap hook lifecycle and supply session actions to scan UI.
- Modify: `frontend/src/components/pages/scan/ScanSidebarNav.jsx` — derive section state from the registry/session instead of `hasScanResult`.
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.jsx` — render session summary and capability statuses/retries.
- Create: `frontend/src/components/pages/scan/AdditionalScansPanel.jsx` — registry-driven optional-scan cards shared by overview.
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.jsx` — route section content from capability state/results and shared run/retry actions.
- Modify: `frontend/src/components/pages/scan/sections/OverviewSection.jsx` — render available WordPress results plus additional-scan controls.
- Modify: `frontend/src/components/pages/scan/sections/HomepageSection.jsx` — show run/rerun/retry from homepage capability state.
- Modify: `frontend/src/components/pages/scan/sections/SitemapSection.jsx` — drive sitemap runner/options from session capability state while retaining WordPress probe context.
- Modify: `frontend/src/components/organisms/panels/SitemapScanPanel.jsx` — make controlled sitemap options and action labels usable by session controls without duplicating lifecycle state.
- Modify tests: `frontend/src/components/pages/ScanPage.test.jsx`, `frontend/src/components/pages/scan/ScanSidebarNav.test.jsx`, `frontend/src/components/pages/scan/ScanStatusStack.test.jsx`, `frontend/src/components/pages/scan/ScanSectionContent.test.jsx`, `frontend/src/components/pages/scan/sections/HomepageSection.test.jsx`, `frontend/src/components/organisms/panels/scanPanelDetails.test.jsx` — replace fixed scan assumptions with session-state assertions.
- Delete after migration: `frontend/src/hooks/useHomepageScan.js`, `frontend/src/hooks/useSitemapScan.js` — their runners remain in existing service/API functions but their separate UI lifecycle is removed.

## Capability Contract

Use these stable IDs and runners throughout every task:

```js
const CAPABILITY_IDS = {
  WORDPRESS: 'wordpress',
  HOMEPAGE: 'homepage',
  SITEMAP: 'sitemap',
};

// wordpress: runner(domain) => scanDomain(domain)
// homepage: runner(domain) => runHomepageScan({ domain })
// sitemap: runner(domain, options) => runSitemapScan({ domain, ...options })
```

`wordpress` is required and maps `overview`, `exposure`, `performance`, `content`, `core`, `plugins`, and `unsupported`. `homepage` maps `homepage`; `sitemap` maps `sitemap`. Capability metadata uses `value` (1-5) and `cost` (1-5). Recommendation includes available, baseline-eligible capabilities with `value >= cost`; therefore WordPress (`5/2`) and homepage (`4/3`) are recommended, and sitemap (`3/4`) is optional. Sorting by capability ID provides deterministic output when scores tie. Once a session has a domain, every non-admin capability section is navigable: sections for unselected capabilities display `Not run` and offer their scan action, so section-level additional scans are reachable. Before a session exists, scan sections remain disabled.

### Task 1: Add Capability Registry And Local Defaults

**Files:**
- Create: `frontend/src/services/scanCapabilities.js`
- Create: `frontend/src/services/scanCapabilities.test.js`
- Create: `frontend/src/services/scanPreferences.js`
- Create: `frontend/src/services/scanPreferences.test.js`

- [ ] **Step 1: Write failing registry tests for recommendation, selection, options, and sections**

```js
import {
  CAPABILITY_IDS,
  getRecommendedCapabilityIds,
  getSectionCapabilityId,
  normalizeSelection,
} from './scanCapabilities';

it('recommends stable low-cost, high-value baseline capabilities', () => {
  expect(getRecommendedCapabilityIds()).toEqual([
    CAPABILITY_IDS.HOMEPAGE,
    CAPABILITY_IDS.WORDPRESS,
  ]);
});

it('keeps required wordpress and removes unknown capability IDs', () => {
  expect(normalizeSelection({ capabilityIds: ['missing', CAPABILITY_IDS.SITEMAP] }))
    .toMatchObject({ capabilityIds: [CAPABILITY_IDS.SITEMAP, CAPABILITY_IDS.WORDPRESS] });
});

it('clamps sitemap options and maps sections through registry metadata', () => {
  expect(normalizeSelection({
    capabilityIds: [CAPABILITY_IDS.SITEMAP],
    options: { sitemap: { sitemapUrl: ' https://example.com/map.xml ', maxPages: 9999 } },
  }).options.sitemap).toEqual({ sitemapUrl: 'https://example.com/map.xml', maxPages: 50 });
  expect(getSectionCapabilityId('homepage')).toBe(CAPABILITY_IDS.HOMEPAGE);
});
```

- [ ] **Step 2: Run registry tests to verify failure**

Run: `pnpm --filter frontend test -- src/services/scanCapabilities.test.js`

Expected: FAIL because `scanCapabilities.js` does not exist.

- [ ] **Step 3: Implement registry and normalization**

```js
export const CAPABILITY_IDS = {
  WORDPRESS: 'wordpress',
  HOMEPAGE: 'homepage',
  SITEMAP: 'sitemap',
};

export const SCAN_CAPABILITIES = [
  {
    id: CAPABILITY_IDS.WORDPRESS,
    sectionIds: ['overview', 'exposure', 'performance', 'content', 'core', 'plugins', 'unsupported'],
    required: true,
    baselineEligible: true,
    value: 5,
    cost: 2,
    defaultOptions: {},
    normalizeOptions: () => ({}),
    runner: ({ domain }) => scanDomain(domain),
  },
  {
    id: CAPABILITY_IDS.HOMEPAGE,
    sectionIds: ['homepage'],
    required: false,
    baselineEligible: true,
    value: 4,
    cost: 3,
    defaultOptions: {},
    normalizeOptions: () => ({}),
    runner: ({ domain }) => runHomepageScan({ domain }),
  },
  {
    id: CAPABILITY_IDS.SITEMAP,
    sectionIds: ['sitemap'],
    required: false,
    baselineEligible: true,
    value: 3,
    cost: 4,
    defaultOptions: { sitemapUrl: '', maxPages: 50 },
    normalizeOptions: (options = {}) => ({
      sitemapUrl: String(options.sitemapUrl || '').trim(),
      maxPages: Math.min(50, Math.max(1, Number(options.maxPages) || 50)),
    }),
    runner: ({ domain, options }) => runSitemapScan({ domain, ...options }),
  },
];

export function normalizeSelection(selection = {}) {
  const knownIds = new Set(SCAN_CAPABILITIES.map(({ id }) => id));
  const selectedIds = [...new Set(selection.capabilityIds || [])]
    .filter((id) => knownIds.has(id));
  const capabilityIds = SCAN_CAPABILITIES
    .filter(({ id, required }) => required || selectedIds.includes(id))
    .map(({ id }) => id)
    .sort();
  return {
    capabilityIds,
    options: Object.fromEntries(capabilityIds.map((id) => {
      const capability = getCapabilityById(id);
      return [id, capability.normalizeOptions(selection.options?.[id])];
    })),
  };
}
```

Define `getCapabilityById`, `getRecommendedCapabilityIds`, `getRecommendedSelection`, `getSectionCapabilityId`, `getCapabilityDependencies`, and `getCapabilityRunners` in this module. `getCapabilityDependencies()` returns an object built from each entry's `dependencies` array. `getCapabilityRunners()` returns an object whose keys are capability IDs and whose values call the entry runner with `{ domain, options }`. Import only existing `scanDomain`, `runHomepageScan`, and `runSitemapScan`; do not alter API routes or existing scan service behavior.

- [ ] **Step 4: Run registry tests to verify pass**

Run: `pnpm --filter frontend test -- src/services/scanCapabilities.test.js`

Expected: PASS.

- [ ] **Step 5: Write failing storage tests**

```js
import { loadScanPreferences, saveScanPreferences } from './scanPreferences';

it('restores a valid versioned selection from local storage', () => {
  localStorage.setItem('wp-json-discovery.scan-preferences.v1', JSON.stringify({
    version: 1,
    capabilityIds: ['sitemap'],
    options: { sitemap: { maxPages: 12 } },
  }));
  expect(loadScanPreferences().capabilityIds).toContain('sitemap');
});

it('falls back to recommendations when stored data is malformed', () => {
  localStorage.setItem('wp-json-discovery.scan-preferences.v1', '{bad json');
  expect(loadScanPreferences().capabilityIds).toEqual(expect.arrayContaining(['wordpress', 'homepage']));
});
```

- [ ] **Step 6: Run storage tests to verify failure**

Run: `pnpm --filter frontend test -- src/services/scanPreferences.test.js`

Expected: FAIL because `scanPreferences.js` does not exist.

- [ ] **Step 7: Implement versioned local preference boundary**

```js
const STORAGE_KEY = 'wp-json-discovery.scan-preferences.v1';

export function loadScanPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.version !== 1) return getRecommendedSelection();
    return normalizeSelection(stored);
  } catch {
    return getRecommendedSelection();
  }
}

export function saveScanPreferences(selection) {
  const normalized = normalizeSelection(selection);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...normalized }));
  return normalized;
}
```

`getRecommendedSelection()` must include `getRecommendedCapabilityIds()` and normalized default options. Do not store domain, result, status, or errors.

- [ ] **Step 8: Run service tests and commit**

Run: `pnpm --filter frontend test -- src/services/scanCapabilities.test.js src/services/scanPreferences.test.js`

Expected: PASS.

```bash
git add frontend/src/services/scanCapabilities.js frontend/src/services/scanCapabilities.test.js frontend/src/services/scanPreferences.js frontend/src/services/scanPreferences.test.js
git commit -m "feat: add scan capability defaults"
```

### Task 2: Build Pure Scan Session And Execution Planner

**Files:**
- Create: `frontend/src/services/scanSession.js`
- Create: `frontend/src/services/scanSession.test.js`

- [ ] **Step 1: Write failing session transition and execution tests**

```js
import {
  createScanSession,
  executeScanSession,
  normalizeScanError,
  retryCapability,
} from './scanSession';

it('runs independent selected capabilities concurrently and preserves partial success', async () => {
  const starts = [];
  const session = createScanSession('example.com', { capabilityIds: ['wordpress', 'homepage'], options: {} });
  const result = await executeScanSession(session, {
    wordpress: async () => { starts.push('wordpress'); return { root: true }; },
    homepage: async () => { starts.push('homepage'); throw new Error('offline'); },
  });
  expect(starts).toEqual(expect.arrayContaining(['wordpress', 'homepage']));
  expect(result.overallStatus).toBe('incomplete');
  expect(result.capabilities.wordpress.status).toBe('success');
  expect(result.capabilities.homepage.status).toBe('failed');
});

it('marks a dependent capability unavailable when dependency fails', async () => {
  const session = createScanSession('example.com', { capabilityIds: ['wordpress', 'sitemap'], options: {} }, {
    sitemap: ['wordpress'],
  });
  const result = await executeScanSession(session, {
    wordpress: async () => { throw new Error('blocked'); },
    sitemap: async () => ({ shouldNotRun: true }),
  });
  expect(result.capabilities.sitemap).toMatchObject({ status: 'unavailable', error: { code: 'dependency_failed' } });
});

it('normalizes retryable errors and retries only requested capability', async () => {
  expect(normalizeScanError(new Error('No route'))).toEqual({ code: 'scan_failed', message: 'No route', retryable: true });
  const runners = { homepage: vi.fn().mockResolvedValue({ title: 'Home' }) };
  const retried = await retryCapability({
    ...createScanSession('example.com', { capabilityIds: ['wordpress', 'homepage'], options: {} }),
    capabilities: {
      wordpress: { status: 'success', result: { root: true }, error: null },
      homepage: { status: 'failed', result: null, error: { code: 'scan_failed', retryable: true } },
    },
  }, 'homepage', runners);
  expect(runners.homepage).toHaveBeenCalledOnce();
  expect(retried.capabilities.wordpress).toMatchObject({ status: 'success', result: { root: true } });
});
```

- [ ] **Step 2: Run session tests to verify failure**

Run: `pnpm --filter frontend test -- src/services/scanSession.test.js`

Expected: FAIL because `scanSession.js` does not exist.

- [ ] **Step 3: Implement immutable session helpers and dependency waves**

```js
export function createScanSession(domain, selection, dependencies = {}) {
  const normalizedSelection = normalizeSelection(selection);
  return {
    domain,
    selection: normalizedSelection,
    overallStatus: 'idle',
    capabilities: Object.fromEntries(normalizedSelection.capabilityIds.map((id) => [id, {
      status: 'idle', result: null, error: null,
    }])),
    dependencies,
  };
}

export function normalizeScanError(error) {
  return {
    code: error?.code || 'scan_failed',
    message: error?.message || 'Scan failed. Try again.',
    retryable: error?.retryable !== false,
  };
}
```

Implement `executeScanSession(session, runners, onChange)` by repeatedly collecting queued capabilities whose dependencies are successful, setting the wave to `running`, and awaiting `Promise.allSettled`. Apply each fulfilled/rejected result independently, notify `onChange` after every state change, and mark capabilities whose dependency failed or is unavailable as `unavailable` with `{ code: 'dependency_failed', message: 'Required scan did not complete.', retryable: false }`. If no runnable work remains, derive `complete` only when all selected capabilities succeed; otherwise derive `incomplete`. `retryCapability` must reset only target status/result/error, execute target runner once, and recalculate overall status. Do not mutate prior session objects.

- [ ] **Step 4: Add stale session token coverage and implementation**

```js
it('ignores updates from an invalidated execution token', async () => {
  const updates = [];
  const token = { active: false };
  await executeScanSession(session, { wordpress: async () => ({ root: true }) }, (next) => updates.push(next), token);
  expect(updates).toEqual([]);
});
```

Add an optional `{ active }` execution token argument; return the completed internal state but suppress `onChange` calls when it is inactive. This lets the React coordinator prevent old-domain results entering a new session.

- [ ] **Step 5: Run session tests and commit**

Run: `pnpm --filter frontend test -- src/services/scanSession.test.js`

Expected: PASS.

```bash
git add frontend/src/services/scanSession.js frontend/src/services/scanSession.test.js
git commit -m "feat: add scan session execution model"
```

### Task 3: Coordinate Capabilities Through `useScan`

**Files:**
- Modify: `frontend/src/hooks/useScan.js`
- Create: `frontend/src/hooks/useScan.test.jsx`
- Delete: `frontend/src/hooks/useHomepageScan.js`
- Delete: `frontend/src/hooks/useSitemapScan.js`

- [ ] **Step 1: Write failing coordinator-hook tests with runner mocks**

```jsx
it('starts selected runners and exposes independent capability results', async () => {
  mockRunners.wordpress.mockResolvedValue({ namespaces: [] });
  mockRunners.homepage.mockResolvedValue({ source: { title: 'Home' } });
  const { result } = renderHook(() => useScan());

  await act(() => result.current.startScan('example.com', {
    capabilityIds: ['wordpress', 'homepage'], options: {},
  }));

  await waitFor(() => expect(result.current.session.overallStatus).toBe('complete'));
  expect(result.current.session.capabilities.homepage.result.source.title).toBe('Home');
});

it('invalidates an earlier domain execution before it can overwrite current session', async () => {
  let resolveFirst;
  mockRunners.wordpress
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ namespaces: ['second'] });
  const { result } = renderHook(() => useScan());
  act(() => { result.current.startScan('first.example', { capabilityIds: ['wordpress'], options: {} }); });
  await act(() => result.current.startScan('second.example', { capabilityIds: ['wordpress'], options: {} }));
  await act(() => resolveFirst({ namespaces: ['first'] }));
  expect(result.current.session.domain).toBe('second.example');
  expect(result.current.session.capabilities.wordpress.result.namespaces).toEqual(['second']);
});
```

- [ ] **Step 2: Run hook tests to verify failure**

Run: `pnpm --filter frontend test -- src/hooks/useScan.test.jsx`

Expected: FAIL because `useScan` exposes fixed scan fields instead of `session` and accepts only one argument.

- [ ] **Step 3: Refactor `useScan` into coordinator while retaining existing side effects**

```js
const [session, setSession] = useState(null);
const activeTokenRef = useRef(null);

const startScan = async (domain, selection) => {
  const token = { active: true };
  activeTokenRef.current?.active = false;
  activeTokenRef.current = token;
  const nextSession = createScanSession(domain, selection, getCapabilityDependencies());
  setSession(nextSession);
  const completed = await executeScanSession(
    nextSession,
    getCapabilityRunners(),
    setSession,
    token,
  );
  if (!token.active) return completed;
  const wordpress = completed.capabilities.wordpress;
  if (wordpress?.status === 'success') await persistUnsupportedNamespaces(wordpress.result);
  return completed;
};
```

Preserve existing Auth0-gated unsupported namespace persistence, query invalidation, activity logging, toasts, and log-rotation return values. Add `runCapability(id, options)` and `retryCapability(id)` actions that use the same session domain and registry selection/options. `runCapability` must add an unselected available capability to a new selection snapshot before execution. Clean up the old homepage/sitemap hooks only after all imports move to `useScan`.

- [ ] **Step 4: Run hook and existing scan tests**

Run: `pnpm --filter frontend test -- src/hooks/useScan.test.jsx src/services/scan.test.js`

Expected: PASS; `gatherExposure` regression tests remain unchanged.

- [ ] **Step 5: Commit coordinator migration**

```bash
git add frontend/src/hooks/useScan.js frontend/src/hooks/useScan.test.jsx frontend/src/hooks/useHomepageScan.js frontend/src/hooks/useSitemapScan.js
git commit -m "feat: coordinate scans by capability"
```

### Task 4: Expose One Session And Editable Settings From Scan Context

**Files:**
- Modify: `frontend/src/context/ScanContext.jsx`
- Modify: `frontend/src/components/pages/ScanPage.test.jsx`

- [ ] **Step 1: Write failing context-consumer coverage in `ScanPage.test.jsx`**

```jsx
mockScanContextValue = {
  activeDomain: 'example.com',
  session: {
    overallStatus: 'running',
    capabilities: { wordpress: { status: 'success', result: { summary: {} } } },
  },
  scanSettings: { capabilityIds: ['wordpress', 'homepage'], options: {} },
  updateScanSettings: vi.fn(),
  saveScanDefaults: vi.fn(),
  startScan: vi.fn(),
  runCapability: vi.fn(),
  retryCapability: vi.fn(),
};

it('passes one session and shared capability actions to scan content', () => {
  render(<ScanPage />);
  expect(screen.getByTestId('scan-section-content')).toHaveTextContent('running');
});
```

- [ ] **Step 2: Run page test to verify failure**

Run: `pnpm --filter frontend test -- src/components/pages/ScanPage.test.jsx`

Expected: FAIL because the page still receives separate core, homepage, and sitemap props.

- [ ] **Step 3: Implement context-owned settings and session boundary**

```jsx
const [scanSettings, setScanSettings] = useState(loadScanPreferences);

const updateScanSettings = (next) => setScanSettings(normalizeSelection(next));
const saveScanDefaults = () => setScanSettings(saveScanPreferences(scanSettings));

const handleStartScan = (domain) => {
  setActiveDomain(domain);
  return startScan(domain, scanSettings);
};
```

Expose `session`, `scanSettings`, `updateScanSettings`, `saveScanDefaults`, `runCapability`, and `retryCapability` through the existing results context. Remove fields that represent separate homepage lifecycle. Keep active page/domain ownership unchanged. Invalidate the displayed session synchronously when a new domain begins; the hook token remains the asynchronous guard.

- [ ] **Step 4: Run page test and commit**

Run: `pnpm --filter frontend test -- src/components/pages/ScanPage.test.jsx`

Expected: PASS.

```bash
git add frontend/src/context/ScanContext.jsx frontend/src/components/pages/ScanPage.test.jsx
git commit -m "feat: expose unified scan session context"
```

### Task 5: Add Pre-Scan Settings UI

**Files:**
- Create: `frontend/src/components/molecules/forms/ScanSettingsPanel.jsx`
- Create: `frontend/src/components/molecules/forms/ScanSettingsPanel.test.jsx`
- Modify: `frontend/src/components/molecules/forms/DomainForm.jsx`
- Modify: `frontend/src/components/molecules/forms/DomainForm.stories.jsx`

- [ ] **Step 1: Verify supported Storybook/component APIs before UI edits**

Run the repository-required `wp-json-sb-mcp` operations when that MCP server is available:

1. `list-all-documentation`
2. `get-documentation` for Checkbox, Collapsible, Button, and TextInput
3. `get-storybook-story-instructions`

Expected: documented property names and current story conventions. Use only confirmed properties. If the MCP server remains unavailable, inspect existing local Checkbox and Collapsible usage and record that the required server check could not run; do not invent component props.

- [ ] **Step 2: Write failing settings-panel tests**

```jsx
it('shows recommended entries selected and lets user add sitemap', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ScanSettingsPanel settings={recommendedSettings} onChange={onChange} disabled={false} />);

  expect(screen.getByText('Recommended')).toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: /sitemap/i }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    capabilityIds: expect.arrayContaining(['sitemap']),
  }));
});

it('prevents editing settings while a session runs', () => {
  render(<ScanSettingsPanel settings={recommendedSettings} onChange={vi.fn()} disabled />);
  expect(screen.getByRole('checkbox', { name: /homepage/i })).toBeDisabled();
});
```

- [ ] **Step 3: Run settings test to verify failure**

Run: `pnpm --filter frontend test -- src/components/molecules/forms/ScanSettingsPanel.test.jsx`

Expected: FAIL because `ScanSettingsPanel.jsx` does not exist.

- [ ] **Step 4: Implement registry-driven controls and wire DomainForm**

```jsx
export function ScanSettingsPanel({ settings, onChange, disabled }) {
  return SCAN_CAPABILITIES.map((capability) => {
    const selected = settings.capabilityIds.includes(capability.id);
    return (
      <label key={capability.id}>
        <Checkbox
          checked={selected}
          disabled={disabled || capability.required}
          onCheckedChange={(checked) => onChange(toggleCapability(settings, capability.id, checked))}
        />
        <span>{capability.label}</span>
        {isRecommended(capability) && <span>Recommended</span>}
        <span>{capability.description}</span>
        <span>{capability.costHint}</span>
      </label>
    );
  });
}
```

Put disclosure state in `DomainForm`; pass `settings`, `onSettingsChange`, `onSaveDefault`, and `isSessionRunning` from `ScanPage`. Preserve the current normalization on submit and primary Start scan button. Render sitemap URL and max-page inputs only when sitemap is selected, using normalized values from `settings.options.sitemap`. Do not mutate `settings` while `isSessionRunning` is true. Add stories for recommended defaults and configured sitemap options.

- [ ] **Step 5: Run UI tests and story checks**

Run: `pnpm --filter frontend test -- src/components/molecules/forms/ScanSettingsPanel.test.jsx`

Expected: PASS.

Run the available Storybook test command from the instructions obtained in Step 1.

Expected: DomainForm stories pass with no accessibility or interaction regression.

- [ ] **Step 6: Commit settings UI**

```bash
git add frontend/src/components/molecules/forms/ScanSettingsPanel.jsx frontend/src/components/molecules/forms/ScanSettingsPanel.test.jsx frontend/src/components/molecules/forms/DomainForm.jsx frontend/src/components/molecules/forms/DomainForm.stories.jsx
git commit -m "feat: add configurable scan settings"
```

### Task 6: Migrate Scan Results, Status, Navigation, And Additional Runs

**Files:**
- Modify: `frontend/src/components/pages/ScanPage.jsx`
- Modify: `frontend/src/components/pages/scan/ScanSidebarNav.jsx`
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.jsx`
- Create: `frontend/src/components/pages/scan/AdditionalScansPanel.jsx`
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.jsx`
- Modify: `frontend/src/components/pages/scan/sections/OverviewSection.jsx`
- Modify: `frontend/src/components/pages/scan/sections/HomepageSection.jsx`
- Modify: `frontend/src/components/pages/scan/sections/SitemapSection.jsx`
- Modify: `frontend/src/components/organisms/panels/SitemapScanPanel.jsx`
- Modify: `frontend/src/components/pages/scan/ScanSidebarNav.test.jsx`
- Modify: `frontend/src/components/pages/scan/ScanStatusStack.test.jsx`
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.test.jsx`
- Modify: `frontend/src/components/pages/scan/sections/HomepageSection.test.jsx`
- Modify: `frontend/src/components/organisms/panels/scanPanelDetails.test.jsx`

- [ ] **Step 1: Write failing status and sidebar tests for partial completion**

```jsx
const session = {
  overallStatus: 'incomplete',
  capabilities: {
    wordpress: { status: 'success', result: { summary: {} } },
    homepage: { status: 'failed', error: { message: 'Timed out', retryable: true } },
    sitemap: { status: 'idle', result: null, error: null },
  },
};

it('keeps completed, failed, and unselected sections navigable during a domain session', () => {
  render(<ScanSidebarNav session={session} activeSection="overview" onSelect={vi.fn()} />);
  expect(screen.getByRole('button', { name: /overview/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /homepage/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /sitemap/i })).toBeEnabled();
});

it('renders capability retry without hiding successful scan results', async () => {
  render(<ScanStatusStack session={session} onRetry={retry} />);
  await userEvent.setup().click(screen.getByRole('button', { name: /retry homepage/i }));
  expect(retry).toHaveBeenCalledWith('homepage');
});
```

- [ ] **Step 2: Run migrated component tests to verify failure**

Run: `pnpm --filter frontend test -- src/components/pages/scan/ScanSidebarNav.test.jsx src/components/pages/scan/ScanStatusStack.test.jsx src/components/pages/scan/ScanSectionContent.test.jsx src/components/pages/scan/HomepageSection.test.jsx src/components/organisms/panels/scanPanelDetails.test.jsx`

Expected: FAIL because components still use fixed `hasScanResult`, homepage mutation fields, and sitemap hook callback shape.

- [ ] **Step 3: Implement session-driven status and navigation**

```jsx
const capabilityId = getSectionCapabilityId(section.id);
const capability = session?.capabilities[capabilityId] || {
  status: session?.domain ? 'idle' : null,
  result: null,
  error: null,
};
const navigable = Boolean(session?.domain);

<button
  aria-current={activeSection === section.id ? 'page' : undefined}
  disabled={!navigable}
  title={capability?.error?.message}
  onClick={() => onSelect(section.id)}
>
  {section.label}
</button>
```

`ScanStatusStack` must derive one summary from `session.overallStatus` and render every selected capability's queued/running/success/failed/unavailable state. Retry appears only when `status === 'failed' && error.retryable`. The sidebar must leave all scan sections disabled before a domain session, then enable every non-admin capability section once `session.domain` exists; an unselected section receives a synthetic `idle`/`Not run` view state and can invoke `runCapability`. `ScanPage` must stop importing `useSitemapScan`, reset active section when session domain changes, and pass one `session` plus `runCapability`/`retryCapability` to all descendants.

- [ ] **Step 4: Write failing additional-scan and section-action tests**

```jsx
it('runs unselected sitemap from overview additional scans', async () => {
  const user = userEvent.setup();
  render(<AdditionalScansPanel session={session} onRun={runCapability} />);
  await user.click(screen.getByRole('button', { name: /scan sitemap/i }));
  expect(runCapability).toHaveBeenCalledWith('sitemap', expect.any(Object));
});

it('offers rerun from homepage section after a successful result', async () => {
  render(<HomepageSection capability={successfulHomepage} onRun={runCapability} />);
  await userEvent.setup().click(screen.getByRole('button', { name: /rerun homepage/i }));
  expect(runCapability).toHaveBeenCalledWith('homepage', {});
});
```

- [ ] **Step 5: Implement shared additional-scan and section actions**

```jsx
export function AdditionalScansPanel({ session, onRun }) {
  return SCAN_CAPABILITIES
    .filter((capability) => !session?.selection.capabilityIds.includes(capability.id))
    .map((capability) => (
      <section key={capability.id}>
        <h3>{capability.label}</h3>
        <p>{capability.description}</p>
        <Button onClick={() => onRun(capability.id, capability.defaultOptions)}>
          Scan {capability.label}
        </Button>
      </section>
    ));
}
```

`OverviewSection` reads WordPress capability result only when WordPress has succeeded and renders `AdditionalScansPanel`. `HomepageSection` receives homepage capability object and displays an empty, running, failed-with-retry, successful-with-rerun, or unavailable state. `SitemapSection` receives both the sitemap capability and the successful WordPress capability result: use the WordPress result only for its existing lightweight sitemap probe/exposure snapshot, and use the sitemap capability only for full crawl state, controls, result, errors, and retry. It must pass controlled `options.sitemapUrl` and `options.maxPages` to `SitemapScanPanel`, enforce the existing server maximum of 50 pages in the input, then call `onRun('sitemap', nextOptions)`. Preserve existing sitemap page table and filtering when result exists. `ScanSectionContent` must select capability result by section mapping and never use separate homepage/sitemap result props.

- [ ] **Step 6: Run migrated component tests**

Run: `pnpm --filter frontend test -- src/components/pages/ScanPage.test.jsx src/components/pages/scan/ScanSidebarNav.test.jsx src/components/pages/scan/ScanStatusStack.test.jsx src/components/pages/scan/ScanSectionContent.test.jsx src/components/pages/scan/sections/HomepageSection.test.jsx src/components/organisms/panels/scanPanelDetails.test.jsx`

Expected: PASS. Tests must assert idle, running, success, failed, and unavailable states rather than a single global scan boolean.

- [ ] **Step 7: Commit result UI migration**

```bash
git add frontend/src/components/pages/ScanPage.jsx frontend/src/components/pages/scan/ScanSidebarNav.jsx frontend/src/components/pages/scan/ScanStatusStack.jsx frontend/src/components/pages/scan/AdditionalScansPanel.jsx frontend/src/components/pages/scan/ScanSectionContent.jsx frontend/src/components/pages/scan/sections/OverviewSection.jsx frontend/src/components/pages/scan/sections/HomepageSection.jsx frontend/src/components/pages/scan/sections/SitemapSection.jsx frontend/src/components/organisms/panels/SitemapScanPanel.jsx frontend/src/components/pages/ScanPage.test.jsx frontend/src/components/pages/scan/ScanSidebarNav.test.jsx frontend/src/components/pages/scan/ScanStatusStack.test.jsx frontend/src/components/pages/scan/ScanSectionContent.test.jsx frontend/src/components/pages/scan/sections/HomepageSection.test.jsx frontend/src/components/organisms/panels/scanPanelDetails.test.jsx
git commit -m "feat: show scan capability results independently"
```

### Task 7: Run Full Regression Verification

**Files:**
- Modify only if verification exposes a regression in files listed by Tasks 1-6.

- [ ] **Step 1: Run complete frontend test suite**

Run: `pnpm --filter frontend test`

Expected: PASS with all service, hook, component, and existing regression tests green.

- [ ] **Step 2: Run frontend lint**

Run: `pnpm --filter frontend lint`

Expected: exit code 0 with no unused imports from removed hooks or stale fixed-scan props.

- [ ] **Step 3: Run production build**

Run: `pnpm --filter frontend build`

Expected: Vite production build completes successfully.

- [ ] **Step 4: Run Storybook regression check**

Run the available Storybook test command documented by the repository's Storybook instructions.

Expected: updated DomainForm stories and existing scan stories load and pass interaction/accessibility checks.

- [ ] **Step 5: Verify server endpoint regression coverage**

Run: `pnpm --filter wp-json-discovery-server test -- src/index.test.js`

Expected: existing `/api/homepage-scan` and `/api/sitemap-scan` tests pass without server changes.

- [ ] **Step 6: Inspect final diff and commit verification-only fixes if needed**

Run: `git diff --check`

Expected: no whitespace errors.

If verification required source changes, stage every feature file modified by the fix and commit:

```bash
git add frontend/src/services frontend/src/hooks/useScan.js frontend/src/context/ScanContext.jsx frontend/src/components/molecules/forms frontend/src/components/pages/ScanPage.jsx frontend/src/components/pages/scan frontend/src/components/organisms/panels/SitemapScanPanel.jsx
git commit -m "fix: harden scan workflow states"
```

## Plan Self-Review

- Spec coverage: Tasks 1-2 implement registry, metadata recommendation, option validation, local storage, session states, dependencies, normalized errors, partial completion, retry, and stale-domain protection. Tasks 3-4 move orchestration and context ownership without server changes. Tasks 5-6 implement settings, default persistence, status-aware navigation, additional scans, and section-level reruns. Task 7 retains build, lint, Storybook, and endpoint regression gates.
- Placeholder scan: no deferred implementation markers; each task lists files, tests, commands, expected results, and concrete API contracts.
- Type consistency: capability IDs, selection shape `{ capabilityIds, options }`, session capability shape `{ status, result, error }`, normalized error shape `{ code, message, retryable }`, and coordinator actions `startScan`, `runCapability`, and `retryCapability` remain consistent across tasks.
