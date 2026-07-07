# Refactor Priority Fast Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the first fast-wins refactor batch by reducing complexity in `gatherExposure`, `deriveFailureCategory`, `AdminMaintenanceSection`, and `HomepageInsightsPanel`, then re-run Fallow to re-rank the remaining backlog.

**Architecture:** Keep behavior unchanged and favor extraction over rewrites. The first two tasks isolate branch-heavy logic into small pure helpers with direct unit coverage, while the frontend tasks split repeated render decisions into small local helpers or leaf components without changing props or data flow.

**Tech Stack:** JavaScript, React, Vitest, Jest, Fallow.

---

### Task 1: Refactor `gatherExposure` into small pure helpers

**Files:**
- Create: `frontend/src/services/scan.test.js`
- Modify: `frontend/src/services/scan.js`

- [ ] **Step 1: Write failing unit coverage for the exposure shapes that currently force all the inline branching**

```js
import { describe, expect, it } from 'vitest';
import { gatherExposure } from './scan.js';

describe('gatherExposure', () => {
  it('derives the open user sample and wp total header', () => {
    expect(
      gatherExposure({
        rootResult: { ok: true },
        userProbe: {
          ok: true,
          status: 200,
          headers: { 'x-wp-total': '17' },
          data: [{ id: 1, slug: 'admin', name: 'Admin' }]
        },
        settingsProbe: { ok: false, status: 401 },
        xmlrpcProbe: { status: 405 },
        robotsProbe: { ok: true, status: 200 },
        sitemapProbe: { ok: false, status: 404 },
        uploadsProbe: { status: 403, ok: false }
      })
    ).toEqual({
      restApiAvailable: true,
      userEnumeration: {
        open: true,
        statusCode: 200,
        total: 17,
        sample: { id: 1, slug: 'admin', name: 'Admin' }
      },
      settingsExposed: { open: false, statusCode: 401 },
      xmlrpc: { enabled: true, statusCode: 405 },
      robotsTxt: { available: true, statusCode: 200 },
      sitemapXml: { available: false, statusCode: 404 },
      uploads: { indexable: false, statusCode: 403 }
    });
  });

  it('falls back to null sample and disabled xmlrpc when probes are absent', () => {
    expect(
      gatherExposure({
        rootResult: { ok: false },
        userProbe: { ok: false, status: 403, headers: {}, data: [] },
        settingsProbe: null,
        xmlrpcProbe: null,
        robotsProbe: null,
        sitemapProbe: null,
        uploadsProbe: null
      })
    ).toMatchObject({
      restApiAvailable: false,
      userEnumeration: { open: false, statusCode: 403, total: null, sample: null },
      settingsExposed: { open: false, statusCode: null },
      xmlrpc: { enabled: false, statusCode: null },
      robotsTxt: { available: false, statusCode: null },
      sitemapXml: { available: false, statusCode: null },
      uploads: { statusCode: null }
    });
  });
});
```

- [ ] **Step 2: Run the new frontend service test and verify it fails because `gatherExposure` is not exported yet**

Run: `pnpm --filter frontend exec vitest run src/services/scan.test.js`
Expected: FAIL with an export error for `gatherExposure`.

- [ ] **Step 3: Extract the probe-specific branches into small helpers and export `gatherExposure` for direct tests**

```js
function pickUserSample(userProbe) {
  return Array.isArray(userProbe?.data) && userProbe.data.length > 0
    ? userProbe.data[0]
    : null;
}

function summarizeUserEnumeration(userProbe) {
  return {
    open: userProbe?.ok ?? false,
    statusCode: userProbe?.status ?? null,
    total: parseHeaderInt(userProbe?.headers, 'x-wp-total'),
    sample: pickUserSample(userProbe)
  };
}

function summarizeAvailability(probe, enabledKey) {
  return {
    [enabledKey]: probe?.ok ?? false,
    statusCode: probe?.status ?? null
  };
}

function summarizeXmlrpc(xmlrpcProbe) {
  return {
    enabled: xmlrpcProbe ? xmlrpcProbe.status !== 404 : false,
    statusCode: xmlrpcProbe?.status ?? null
  };
}

export function gatherExposure({ rootResult, userProbe, settingsProbe, xmlrpcProbe, robotsProbe, sitemapProbe, uploadsProbe }) {
  return {
    restApiAvailable: rootResult?.ok ?? false,
    userEnumeration: summarizeUserEnumeration(userProbe),
    settingsExposed: summarizeAvailability(settingsProbe, 'open'),
    xmlrpc: summarizeXmlrpc(xmlrpcProbe),
    robotsTxt: summarizeAvailability(robotsProbe, 'available'),
    sitemapXml: summarizeAvailability(sitemapProbe, 'available'),
    uploads: {
      indexable: uploadsIndexable(uploadsProbe),
      statusCode: uploadsProbe?.status ?? null
    }
  };
}
```

- [ ] **Step 4: Re-run the service test to verify the helper extraction preserved behavior**

Run: `pnpm --filter frontend exec vitest run src/services/scan.test.js`
Expected: PASS.

- [ ] **Step 5: Commit the exposure helper refactor**

```bash
git add frontend/src/services/scan.js frontend/src/services/scan.test.js
git commit -m "refactor: simplify exposure derivation"
```

### Task 2: Replace `deriveFailureCategory` branching with grouped match helpers

**Files:**
- Modify: `server/src/logger.js`
- Modify: `server/src/__tests__/logger.test.js`

- [ ] **Step 1: Add failing tests for the specific category groups that should survive the refactor**

```js
it('classifies cloudflare and captcha failures as blocked_waf', () => {
  expect(
    deriveFailureCategory({
      message: 'Attention required by Cloudflare captcha',
      status: 403
    })
  ).toBe('blocked_waf');
});

it('classifies request timeouts as timeout', () => {
  expect(
    deriveFailureCategory({
      error: 'AbortError: request timed out',
      status: 504
    })
  ).toBe('timeout');
});

it('classifies wp-json 404 responses as non_wordpress', () => {
  expect(
    deriveFailureCategory({
      message: 'GET /wp-json/ returned 404',
      status: 404
    })
  ).toBe('non_wordpress');
});
```

- [ ] **Step 2: Run the server logger tests before changing the classifier**

Run: `pnpm --filter wp-json-discovery-server test -- --runTestsByPath src/__tests__/logger.test.js`
Expected: PASS before the refactor or fail only if the new cases expose existing gaps.

- [ ] **Step 3: Move the phrase matching into grouped constant lists and tiny predicate helpers**

```js
const WAF_MARKERS = [
  'cloudflare',
  'captcha',
  'you have been blocked',
  'attention required',
  'ray id',
  'mod_security',
  'modsecurity',
  'web application firewall',
  'waf',
  'request blocked',
  'blocked by security',
  'rate limit',
  'too many requests',
  'bot protection',
  'sucuri',
  'incapsula',
  'akamai'
];

const AUTH_403_MARKERS = [
  'auth',
  'unauthorized',
  'forbidden',
  'access denied',
  'permission denied',
  'login required',
  'credentials',
  'restricted'
];

const NETWORK_MARKERS = [
  'fetch failed',
  'failed to reach target domain',
  'failed to fetch homepage',
  'failed to fetch sitemap',
  'failed to fetch page details',
  'failed to fetch',
  'networkerror',
  'socket hang up',
  'enotfound',
  'eai_again',
  'econnrefused',
  'econnreset',
  'ehostunreach',
  'enetunreach',
  'etimedout',
  'getaddrinfo',
  'und_err_connect_timeout'
];

function includesAny(haystack, values) {
  return values.some((value) => haystack.includes(value));
}

function isAuth403(status, haystack) {
  return status === 403 && includesAny(haystack, AUTH_403_MARKERS);
}

export function deriveFailureCategory(payload = {}) {
  // keep the existing message/details/status normalization
  if (includesAny(haystack, WAF_MARKERS)) return 'blocked_waf';
  if (status === 401 || code === 'auth_required' || isAuth403(status, haystack)) return 'auth_required';
  if (includesAny(haystack, ['timed out', 'timeout', 'aborterror'])) return 'timeout';
  if (includesAny(haystack, NETWORK_MARKERS)) return 'network_failure';
  if (status === 404 && haystack.includes('/wp-json/')) return 'non_wordpress';
  if (haystack.includes('unexpected response from the wordpress api')) return 'non_wordpress';
  if (Number.isFinite(status) && status >= 400) return 'upstream_http_error';
  return 'unknown';
}
```

- [ ] **Step 4: Re-run the logger tests to verify the grouped matcher still classifies the same failures**

Run: `pnpm --filter wp-json-discovery-server test -- --runTestsByPath src/__tests__/logger.test.js`
Expected: PASS.

- [ ] **Step 5: Commit the logger classifier refactor**

```bash
git add server/src/logger.js server/src/__tests__/logger.test.js
git commit -m "refactor: simplify failure categorization"
```

### Task 3: Split `AdminMaintenanceSection` status and result rendering into focused helpers

**Files:**
- Modify: `frontend/src/components/pages/admin/sections/AdminMaintenanceSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminMaintenanceSection.test.jsx`

- [ ] **Step 1: Extend the existing test with remote-db and local-db result assertions that lock in the current branches**

```jsx
it('renders local maintenance results with size, WAL, and vacuum details', () => {
  render(
    <AdminMaintenanceSection
      data={{ dbPath: '/tmp/db.sqlite', logs: {} }}
      maintenanceMutation={{
        data: {
          size: { beforeBytes: 200, afterBytes: 120 },
          walCheckpoint: { busy: 0, log: 4, checkpointed: 4 },
          vacuumRan: true,
          integrity: { ok: true, status: 'ok' },
          maintenanceAt: '2026-07-06T10:00:00.000Z'
        },
        error: null,
        isError: false,
        isPending: false,
        mutate: vi.fn()
      }}
    />
  );

  expect(screen.getByText(/Size/i)).toBeInTheDocument();
  expect(screen.getByText(/WAL checkpoint/i)).toBeInTheDocument();
  expect(screen.getByText('Completed')).toBeInTheDocument();
});

it('renders remote maintenance results with mode instead of local sqlite details', () => {
  render(
    <AdminMaintenanceSection
      data={{ dbPath: 'https://example.turso.io', logs: {} }}
      maintenanceMutation={{
        data: {
          mode: 'turso',
          integrity: { ok: false, error: 'remote check failed' },
          maintenanceAt: '2026-07-06T10:00:00.000Z'
        },
        error: null,
        isError: false,
        isPending: false,
        mutate: vi.fn()
      }}
    />
  );

  expect(screen.getByText('Mode')).toBeInTheDocument();
  expect(screen.queryByText(/WAL checkpoint/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Error: remote check failed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused maintenance component test before refactoring the JSX**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/sections/AdminMaintenanceSection.test.jsx`
Expected: PASS or expose any missing current branch coverage that the refactor should preserve.

- [ ] **Step 3: Extract the repeated stat cells and result branches into local helpers**

```jsx
function StatItem({ label, children }) {
  return (
    <div className="stat-grid__item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function MaintenanceResultStats({ isRemoteDb, maintenanceData }) {
  if (isRemoteDb) {
    return (
      <StatItem label="Mode">{maintenanceData.mode || 'turso'}</StatItem>
    );
  }

  return (
    <>
      <StatItem label="Size">
        {formatBytes(maintenanceData.size?.beforeBytes)} → {formatBytes(maintenanceData.size?.afterBytes)}
      </StatItem>
      <StatItem label="WAL checkpoint">{formatWalSummary(maintenanceData.walCheckpoint)}</StatItem>
      <StatItem label="Vacuum">{maintenanceData.vacuumRan ? 'Completed' : 'Skipped'}</StatItem>
    </>
  );
}

function renderIntegrityStatus(integrity) {
  return integrity?.ok
    ? integrity?.status ?? 'ok'
    : `Error: ${integrity?.error ?? 'unknown'}`;
}
```

- [ ] **Step 4: Re-run the maintenance component test to verify the extracted helpers did not change output**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/sections/AdminMaintenanceSection.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit the maintenance section refactor**

```bash
git add frontend/src/components/pages/admin/sections/AdminMaintenanceSection.jsx frontend/src/components/pages/admin/sections/AdminMaintenanceSection.test.jsx
git commit -m "refactor: simplify maintenance section rendering"
```

### Task 4: Break `HomepageInsightsPanel` into section-level render helpers

**Files:**
- Create: `frontend/src/components/organisms/panels/HomepageInsightsPanel.test.jsx`
- Modify: `frontend/src/components/organisms/panels/HomepageInsightsPanel.jsx`

- [ ] **Step 1: Add dedicated tests for the empty and populated rendering paths instead of relying only on the broad organism suite**

```jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomepageInsightsPanel from './HomepageInsightsPanel.jsx';

describe('HomepageInsightsPanel', () => {
  it('renders empty-state copy when each insights bucket is empty', () => {
    render(
      <HomepageInsightsPanel
        insights={{ meta: [], comments: [], assets: [], scripts: [], frameworks: [], other: [] }}
        htmlPreview=""
      />
    );

    expect(screen.getByText('No framework hints detected.')).toBeInTheDocument();
    expect(screen.getByText('No plugin or theme asset paths detected.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'HTML preview' })).not.toBeInTheDocument();
  });

  it('renders asset matches and the HTML preview toggle when signals exist', () => {
    render(
      <HomepageInsightsPanel
        insights={{
          meta: [{ name: 'generator', content: 'WordPress 6.8.1' }],
          comments: ['cached by edge'],
          assets: [{
            path: '/wp-content/plugins/akismet/akismet.js',
            count: 2,
            type: 'plugin',
            matches: [{ id: 'akismet', label: 'Akismet' }]
          }],
          scripts: ['webpack'],
          frameworks: ['WordPress'],
          other: ['emoji support']
        }}
        htmlPreview="<html>preview</html>"
      />
    );

    expect(screen.getByRole('button', { name: 'HTML preview' })).toBeInTheDocument();
    expect(screen.getByText('Akismet')).toBeInTheDocument();
    expect(screen.getByText('generator')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new panel-specific test before splitting the render logic**

Run: `pnpm --filter frontend exec vitest run src/components/organisms/panels/HomepageInsightsPanel.test.jsx`
Expected: PASS after the component refactor is complete.

- [ ] **Step 3: Extract `hasSignals`, asset rendering, and list rendering into small local units**

```jsx
function hasInsightSignals(insights) {
  return [
    insights.meta,
    insights.comments,
    insights.assets,
    insights.scripts,
    insights.frameworks,
    insights.other
  ].some((items) => (items?.length ?? 0) > 0);
}

function InsightsList({ items, emptyText }) {
  if (!items || items.length === 0) {
    return <p className="card__meta">{emptyText}</p>;
  }

  return (
    <ul className="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function AssetMatches({ asset }) {
  if (!asset.matches || asset.matches.length === 0) {
    return <p className="card__meta">No known plugin or theme match.</p>;
  }

  return (
    <div className="tag-cloud tag-cloud--compact">
      {asset.matches.map((match) => (
        <span key={`${asset.path}:${match.id}`} className="tag">{match.label}</span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Re-run the dedicated panel test and the broader organism regression**

Run: `pnpm --filter frontend exec vitest run src/components/organisms/panels/HomepageInsightsPanel.test.jsx src/components/organisms/panels/scanOrganisms.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit the homepage insights cleanup**

```bash
git add frontend/src/components/organisms/panels/HomepageInsightsPanel.jsx frontend/src/components/organisms/panels/HomepageInsightsPanel.test.jsx frontend/src/components/organisms/panels/scanOrganisms.test.jsx
git commit -m "refactor: split homepage insights panel"
```

### Task 5: Re-run Fallow and re-rank the remaining quick wins

**Files:**
- Modify: `docs/superpowers/specs/2026-07-06-refactor-priority-fast-wins-design.md`

- [ ] **Step 1: Run the targeted verification commands for the four completed refactors**

Run: `pnpm --filter frontend exec vitest run src/services/scan.test.js src/components/pages/admin/sections/AdminMaintenanceSection.test.jsx src/components/organisms/panels/HomepageInsightsPanel.test.jsx src/components/organisms/panels/scanOrganisms.test.jsx && pnpm --filter wp-json-discovery-server test -- --runTestsByPath src/__tests__/logger.test.js`
Expected: PASS.

- [ ] **Step 2: Run Fallow again to measure the post-refactor complexity and hotspot state**

Run: `npx fallow health --hotspots --complexity --format json --quiet --explain 2>/dev/null || true`
Expected: JSON output with updated `findings`, `hotspots`, and `large_functions`.

- [ ] **Step 3: Update the fast-wins spec with the new ordering for the remaining backlog**

```md
## Post-Batch Re-rank

After completing the first four refactors, update this section with:
- the remaining top three quick wins
- whether `AdminSidebarNav.jsx`, `AdminDomainsSection.jsx`, and `DomainForm.jsx` still stay ahead of the deferred large hotspots
- whether `SitemapScanPanel.jsx` or `AdminDbSection.jsx` now deserves the next dedicated plan
```

- [ ] **Step 4: Re-read the updated spec and verify it reflects the new Fallow output without reopening completed work**

Run: `pnpm --filter frontend exec eslint src/services/scan.js src/components/pages/admin/sections/AdminMaintenanceSection.jsx src/components/organisms/panels/HomepageInsightsPanel.jsx && pnpm --filter wp-json-discovery-server exec eslint src/logger.js`
Expected: PASS.

- [ ] **Step 5: Commit the post-batch re-rank**

```bash
git add docs/superpowers/specs/2026-07-06-refactor-priority-fast-wins-design.md frontend/src/services/scan.js frontend/src/services/scan.test.js frontend/src/components/pages/admin/sections/AdminMaintenanceSection.jsx frontend/src/components/pages/admin/sections/AdminMaintenanceSection.test.jsx frontend/src/components/organisms/panels/HomepageInsightsPanel.jsx frontend/src/components/organisms/panels/HomepageInsightsPanel.test.jsx frontend/src/components/organisms/panels/scanOrganisms.test.jsx server/src/logger.js server/src/__tests__/logger.test.js
git commit -m "refactor: complete first fast-wins batch"
```
