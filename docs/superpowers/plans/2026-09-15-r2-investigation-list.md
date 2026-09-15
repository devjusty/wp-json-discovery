# R2 Investigation List Implementation Plan

> **Status (2026-09-15):** Implemented and merged in PR #37. Browser smoke validation and broader R1 gate evidence remain separate open work; see `docs/research/2026-09-10-r1-validation-log.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace legacy My Scans with an investigation list that resumes local or owned persisted investigations directly in scanner workspace.

**Architecture:** Add purpose-built, owner-scoped investigation summaries at `GET /api/investigations`; summaries derive display counts from each investigation's latest persisted session without returning histories. Add an Investigations page that combines at most one browser-local snapshot with authenticated summaries. Pass a selected persistent investigation ID through scan-shell state so `ScanPage` restores explicit Resume selection before remembered session identity.

**Tech Stack:** Express, libSQL, Zod contracts, Vite, React, TypeScript, React Query, Jest, Vitest, Testing Library.

---

## File Structure

- Modify `packages/contracts/src/index.ts`: declare validated, public investigation-list summary and collection response schemas.
- Modify `server/src/db/investigations.js`: query owner-scoped investigation rows with only their latest snapshot and derive summary counts.
- Modify `server/src/db/investigations.test.js`: cover summary ordering, ownership, latest snapshot, no-session state, and derived counts.
- Modify `server/src/routes/investigations.js`: expose authenticated collection route before parameterized routes.
- Modify `server/src/routes/investigations.test.js`: cover collection authentication, response shape, and owner isolation.
- Modify `frontend/src/api/client.js`: fetch and validate collection response using shared contracts.
- Create `frontend/src/components/pages/InvestigationsPage.tsx`: render local and persisted summary rows plus native Resume controls.
- Create `frontend/src/components/pages/InvestigationsPage.test.tsx`: cover anonymous, authenticated, empty, loading, error, unavailable, and ordering states.
- Modify `frontend/src/context/ScanContext.tsx`: hold one explicit selected investigation ID for resume navigation.
- Modify `frontend/src/context/ScanContext.test.tsx`: prove selection set/consume state semantics.
- Modify `frontend/src/components/pages/ScanPage.tsx`: prefer explicit selection during authenticated restoration; clear it only after successful restore.
- Modify `frontend/src/components/pages/ScanPage.test.tsx`: prove explicit Resume wins over remembered identity and failure leaves selection usable.
- Modify `frontend/src/App.tsx`: replace My Scans lazy page, navigation, prefetch, and route with Investigations visible to every user.
- Modify `frontend/index.html` only if Vite requires it after imports/migration; no other legacy saved-scan files change.

### Task 1: Investigation Summary Contract

**Files:**
- Modify: `packages/contracts/src/index.ts:404-416`
- Test: `packages/contracts/src/index.test.ts` (create only if no contract test file exists)

- [ ] **Step 1: Write failing contract tests for valid list data and rejected owner data**

```ts
import { investigationListSchema } from './index.ts';

it('accepts public investigation summaries without owner identity', () => {
  expect(investigationListSchema.parse({
    investigations: [{
      id: 'inv-1',
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      createdAt: '2026-09-15T12:00:00.000Z',
      updatedAt: '2026-09-15T12:01:00.000Z',
      latestSessionId: 'session-1',
      selectedCapabilityCount: 2,
      completedCapabilityCount: 1,
      findingsCount: 3,
    }],
  })).toEqual(expect.any(Object));
});

it('rejects investigation summaries that expose owner identity', () => {
  expect(() => investigationListSchema.parse({
    investigations: [{ id: 'inv-1', ownerId: 'user-1' }],
  })).toThrow();
});
```

- [ ] **Step 2: Run contract test to verify it fails**

Run: `pnpm --filter @wp-json-discovery/contracts test -- --runInBand src/index.test.ts`

Expected: FAIL because `investigationListSchema` does not exist.

- [ ] **Step 3: Add strict public summary schemas**

```ts
export const investigationSummarySchema = z.object({
  id: identifierSchema,
  domain: domainIdentitySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  latestSessionId: identifierSchema.optional(),
  selectedCapabilityCount: z.number().int().min(0),
  completedCapabilityCount: z.number().int().min(0),
  findingsCount: z.number().int().min(0),
}).strict().superRefine((summary, context) => {
  if (Date.parse(summary.updatedAt) < Date.parse(summary.createdAt)) {
    context.addIssue({ code: 'custom', message: 'updatedAt must be on or after createdAt', path: ['updatedAt'] });
  }
  if (summary.completedCapabilityCount > summary.selectedCapabilityCount) {
    context.addIssue({ code: 'custom', message: 'Completed capabilities cannot exceed selected capabilities', path: ['completedCapabilityCount'] });
  }
});
export type InvestigationSummary = z.infer<typeof investigationSummarySchema>;

export const investigationListSchema = z.object({
  investigations: z.array(investigationSummarySchema),
}).strict();
export type InvestigationList = z.infer<typeof investigationListSchema>;
```

Place these after `investigationRecordSchema`. Do not add findings to `ScanSession`; `findingsCount` is a display-only aggregate from current capability results.

- [ ] **Step 4: Run contract test to verify it passes**

Run: `pnpm --filter @wp-json-discovery/contracts test -- --runInBand src/index.test.ts`

Expected: PASS.

### Task 2: Owner-Scoped Summary Repository

**Files:**
- Modify: `server/src/db/investigations.js:1-181`
- Modify: `server/src/db/investigations.test.js:1-239`

- [ ] **Step 1: Write failing repository tests for latest-session summaries**

Add a helper session with selected `wordpress` and `homepage` states. The WordPress success result must contain two legacy findings. Assert the list returns the latest snapshot rather than its initial idle snapshot:

```js
it('lists only owner investigations in newest activity order with latest summary counts', async () => {
  const first = await createInvestigation('owner-a', {
    domain: { submitted: 'first.example', normalized: 'first.example' },
    selectedCapabilities: [{ id: 'wordpress', dependencies: [] }, { id: 'homepage', dependencies: [] }],
  });
  const second = await createInvestigation('owner-a', {
    domain: { submitted: 'second.example', normalized: 'second.example' },
    selectedCapabilities: [],
  });
  await saveInvestigationSession('owner-a', first.investigation.id, completedSession(first.investigation.id));

  await expect(listInvestigationsForUser('owner-a')).resolves.toEqual({
    investigations: [
      expect.objectContaining({ id: second.investigation.id, selectedCapabilityCount: 0, completedCapabilityCount: 0, findingsCount: 0 }),
      expect.objectContaining({ id: first.investigation.id, selectedCapabilityCount: 2, completedCapabilityCount: 2, findingsCount: 2 }),
    ],
  });
});

it('does not include another owners investigation summaries', async () => {
  expect((await listInvestigationsForUser('other-user')).investigations)
    .not.toContainEqual(expect.objectContaining({ domain: expect.objectContaining({ normalized: 'first.example' }) }));
});
```

Use fixed, distinct timestamps passed through a new test helper or update timestamps directly in the test database. Add a separate test asserting an investigation row with no `investigation_sessions` maps to no `latestSessionId` and zero counts.

- [ ] **Step 2: Run repository test to verify it fails**

Run: `pnpm --filter wp-json-discovery-server test -- --runInBand src/db/investigations.test.js`

Expected: FAIL because `listInvestigationsForUser` is not exported.

- [ ] **Step 3: Implement a single-query summary list and safe count derivation**

Import `investigationListSchema`. Add these helpers and export:

```js
function latestSummary(row) {
  if (!row.snapshot_json) {
    return {
      id: row.id,
      domain: { submitted: row.submitted_domain, normalized: row.normalized_domain },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      selectedCapabilityCount: 0,
      completedCapabilityCount: 0,
      findingsCount: 0,
    };
  }

  const session = parse(scanSessionSchema, JSON.parse(row.snapshot_json));
  const successfulStates = Object.values(session.capabilityStates)
    .filter((state) => state.status === 'success');
  const findingsCount = successfulStates.reduce((count, state) => {
    const findings = state.outcome.result?.findings;
    return count + (Array.isArray(findings) ? findings.length : 0);
  }, 0);

  return {
    id: row.id,
    domain: { submitted: row.submitted_domain, normalized: row.normalized_domain },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestSessionId: session.id,
    selectedCapabilityCount: session.selectedCapabilities.length,
    completedCapabilityCount: successfulStates.length,
    findingsCount,
  };
}

export async function listInvestigationsForUser(ownerId) {
  const rows = await queryAll(
    `select investigations.id, investigations.submitted_domain, investigations.normalized_domain,
            investigations.created_at, investigations.updated_at, latest.snapshot_json
       from investigations
       left join investigation_sessions as latest on latest.id = (
         select id from investigation_sessions
          where investigation_id = investigations.id
          order by sequence desc limit 1
       )
      where investigations.owner_id = ?
      order by investigations.updated_at desc, investigations.id desc`,
    [ownerId],
  );
  return parse(investigationListSchema, { investigations: rows.map(latestSummary) });
}
```

`findingsCount` may only count arrays named `findings` on successful capability result objects. Unknown result shapes count as zero. Do not return `owner_id`, snapshots, session history, or any other user’s rows.

- [ ] **Step 4: Run repository test to verify it passes**

Run: `pnpm --filter wp-json-discovery-server test -- --runInBand src/db/investigations.test.js`

Expected: PASS.

### Task 3: Investigation Collection Route

**Files:**
- Modify: `server/src/routes/investigations.js:3-103`
- Modify: `server/src/routes/investigations.test.js:1-353`

- [ ] **Step 1: Write failing route tests for collection access and isolation**

```js
it('returns only the authenticated users investigation summaries', async () => {
  const response = await request(buildApp({ sub: 'route-owner' })).get('/api/investigations');

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expect.objectContaining({
    status: 'success',
    data: expect.objectContaining({ investigations: expect.any(Array) }),
  }));
  expect(response.body.data.investigations.every((item) => !('ownerId' in item))).toBe(true);
});

it('requires authentication before listing investigations', async () => {
  expect((await request(buildApp()).get('/api/investigations')).status).toBe(401);
});
```

Seed an investigation owned by `route-other` and assert it is absent from `route-owner` response.

- [ ] **Step 2: Run route test to verify it fails**

Run: `pnpm --filter wp-json-discovery-server test -- --runInBand src/routes/investigations.test.js`

Expected: FAIL because `GET /api/investigations` is interpreted as `GET /:id` or returns 404.

- [ ] **Step 3: Add collection route before `/:id`**

Import `listInvestigationsForUser`, then add directly after `router.post('/')`:

```js
router.get('/', wrapAsync(async (req, res) => {
  const record = await listInvestigationsForUser(requireUser(req));
  res.json(envelope(req, record));
}));
```

Keep this route before `router.get('/:id')`. Do not change individual read, save, or claim behavior.

- [ ] **Step 4: Run route test to verify it passes**

Run: `pnpm --filter wp-json-discovery-server test -- --runInBand src/routes/investigations.test.js`

Expected: PASS.

### Task 4: Typed Client Collection API

**Files:**
- Modify: `frontend/src/api/client.js:294-335`
- Test: `frontend/src/api/client.test.js`

- [ ] **Step 1: Write failing client test for validated collection data**

```js
it('fetches validated investigation summaries', async () => {
  fetch.mockResolvedValue(jsonResponse({
    status: 'success', requestId: 'request-1', data: { investigations: [] },
  }));

  await expect(fetchInvestigations()).resolves.toEqual({ investigations: [] });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/investigations'), expect.any(Object));
});
```

Follow existing client-test fetch setup. Add a malformed collection response test that rejects with `Invalid investigation response`.

- [ ] **Step 2: Run client test to verify it fails**

Run: `pnpm --filter frontend exec vitest run --project unit src/api/client.test.js`

Expected: FAIL because `fetchInvestigations` is not exported.

- [ ] **Step 3: Add validated collection request**

Import `investigationListSchema` with existing contracts, then add:

```js
export async function fetchInvestigations() {
  return requestInvestigation('/api/investigations', undefined, investigationListSchema);
}
```

Keep `requestInvestigation` as the shared envelope/error parser. Do not call `/api/user/scans`.

- [ ] **Step 4: Run client test to verify it passes**

Run: `pnpm --filter frontend exec vitest run --project unit src/api/client.test.js`

Expected: PASS.

### Task 5: Investigation List Page

**Files:**
- Create: `frontend/src/components/pages/InvestigationsPage.tsx`
- Create: `frontend/src/components/pages/InvestigationsPage.test.tsx`
- Modify: `frontend/src/App.tsx:12-38,62-92,203-223`

- [ ] **Step 1: Write failing page tests for local and persisted rows**

Mock `useAuth0`, `fetchInvestigations`, and `loadAnonymousInvestigation`. Test real page behavior:

```tsx
it('shows one Local row to anonymous users and resumes it in scanner workspace', () => {
  mockedLoadAnonymousInvestigation.mockReturnValue(localSnapshot('local.example'));
  const onResumeLocal = vi.fn();
  render(<InvestigationsPage onResumeLocal={onResumeLocal} />);

  expect(screen.getByText('Local')).toBeInTheDocument();
  expect(screen.getByText('local.example')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /resume local.example/i })).toBeEnabled();
});

it('prepends Local before newest authenticated summaries', async () => {
  mockedFetchInvestigations.mockResolvedValue({ investigations: [summary('remote.example')] });
  mockedLoadAnonymousInvestigation.mockReturnValue(localSnapshot('local.example'));
  render(<InvestigationsPage isAuthenticated onResumeLocal={vi.fn()} onResumeInvestigation={vi.fn()} />);

  const rows = await screen.findAllByRole('row');
  expect(rows[1]).toHaveTextContent('local.example');
  expect(rows[2]).toHaveTextContent('remote.example');
});

it('shows an unavailable state instead of Resume without latest session', async () => {
  mockedFetchInvestigations.mockResolvedValue({ investigations: [summary('empty.example', { latestSessionId: undefined })] });
  render(<InvestigationsPage isAuthenticated onResumeLocal={vi.fn()} onResumeInvestigation={vi.fn()} />);
  expect(await screen.findByText(/no resumable session/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /resume empty.example/i })).not.toBeInTheDocument();
});
```

Also cover request loading, request error with Retry, anonymous empty guidance, and authenticated empty guidance. Assert domain, findings count, `completed / selected` capability count, and last activity are rendered in every resumable row.

- [ ] **Step 2: Run page test to verify it fails**

Run: `pnpm --filter frontend exec vitest run --project unit src/components/pages/InvestigationsPage.test.tsx`

Expected: FAIL because `InvestigationsPage` does not exist.

- [ ] **Step 3: Implement a self-contained typed investigation page**

Implement props:

```ts
type InvestigationsPageProps = {
  headerActions?: ReactNode;
  isAuthenticated: boolean;
  onResumeLocal: () => void;
  onResumeInvestigation: (investigationId: string) => void;
};
```

Use `loadAnonymousInvestigation()` once on mount and `useQuery` with `enabled: isAuthenticated` for `fetchInvestigations`. Construct a local display row directly from the stored session:

```ts
const completedCapabilityCount = Object.values(snapshot.record.session.capabilityStates)
  .filter((state) => state.status === 'success').length;
const findingsCount = Object.values(snapshot.record.session.capabilityStates)
  .filter((state) => state.status === 'success')
  .reduce((count, state) => count + (Array.isArray(state.outcome.result?.findings) ? state.outcome.result.findings.length : 0), 0);
```

Render native `<button type="button">Resume</button>` controls with accessible names containing their domain. Render a table or semantic list with visible status text: `Local`, `Loading investigations`, `Could not load investigations`, and `No resumable session`. Local is always first. Persistent records remain server order. Do not introduce clear/delete actions, search, filters, pagination, notes, or legacy saved-scan calls.

Use existing `AppLayout` and existing UI primitives only with properties already present in their current usage. Migrate no unrelated component.

- [ ] **Step 4: Replace app navigation and route**

In `App.tsx`, change page identity from `my-scans` to `investigations`; lazily import `./components/pages/InvestigationsPage`; always render an `Investigations` navigation button; prefetch it on focus/hover. Render:

```tsx
<InvestigationsPage
  headerActions={headerActions}
  isAuthenticated={isAuthenticated}
  onResumeLocal={() => setActivePage('scan')}
  onResumeInvestigation={(investigationId) => {
    selectInvestigation(investigationId);
    setActivePage('scan');
  }}
/>
```

Task 6 adds `selectInvestigation`; until then typecheck is expected to fail after this step. Remove the `MyScansPage` lazy import and route. Do not delete `MyScansPage.jsx`, its tests, or `/api/user/scans`.

- [ ] **Step 5: Run page test to verify it passes**

Run: `pnpm --filter frontend exec vitest run --project unit src/components/pages/InvestigationsPage.test.tsx`

Expected: PASS.

### Task 6: Explicit Resume Selection And Scanner Restoration

**Files:**
- Modify: `frontend/src/context/ScanContext.tsx:26-117`
- Modify: `frontend/src/context/ScanContext.test.tsx`
- Modify: `frontend/src/components/pages/ScanPage.tsx:48-147`
- Modify: `frontend/src/components/pages/ScanPage.test.tsx:356-432`

- [ ] **Step 1: Write failing context and scanner tests**

Add a context test:

```tsx
it('stores one explicit investigation selection until it is cleared', async () => {
  render(<ScanProvider><ShellProbe /></ScanProvider>);
  await userEvent.click(screen.getByRole('button', { name: 'select inv-explicit' }));
  expect(screen.getByTestId('selected-investigation')).toHaveTextContent('inv-explicit');
});
```

Add scanner tests:

```tsx
it('resumes explicit selected investigation before remembered identity', async () => {
  mocks.loadAuthenticatedInvestigationId.mockReturnValue('inv-remembered');
  mocks.selectedInvestigationId = 'inv-explicit';
  mocks.fetchInvestigation.mockResolvedValue(record('inv-explicit', 'explicit.example'));
  renderScanner({ isAuthenticated: true });
  await waitFor(() => expect(mocks.fetchInvestigation).toHaveBeenCalledWith('inv-explicit'));
  expect(mocks.fetchInvestigation).not.toHaveBeenCalledWith('inv-remembered');
});

it('keeps explicit selection after resume failure and shows retryable error', async () => {
  mocks.selectedInvestigationId = 'inv-explicit';
  mocks.fetchInvestigation.mockRejectedValue(new Error('Unavailable'));
  renderScanner({ isAuthenticated: true });
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not be resumed/i);
  expect(mocks.clearSelectedInvestigation).not.toHaveBeenCalled();
});
```

Add a test for a record without `latestSession`, asserting it produces the same non-destructive error path.

- [ ] **Step 2: Run context and scanner tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run --project unit src/context/ScanContext.test.tsx src/components/pages/ScanPage.test.tsx`

Expected: FAIL because selection state and explicit restoration do not exist.

- [ ] **Step 3: Add one selected-investigation state to scan shell**

Extend `ScanShellContextValue` and provider:

```ts
selectedInvestigationId: string;
selectInvestigation: (investigationId: string) => void;
clearSelectedInvestigation: () => void;
```

Use `useState('')`; `selectInvestigation` sets its string argument and `clearSelectedInvestigation` sets `''`. Add them to `shellValue`. Do not persist selected ID to local storage.

- [ ] **Step 4: Prefer selected ID during authenticated restoration**

In `ScanPage`, read `selectedInvestigationId` and `clearSelectedInvestigation` from shell context. In the authenticated restoration effect:

```ts
const investigationId = selectedInvestigationId || loadAuthenticatedInvestigationId();
if (!investigationId) return undefined;
const wasExplicitSelection = Boolean(selectedInvestigationId);
```

After `fetchInvestigation`, retain current hydration/domain/persistence behavior. Call `clearSelectedInvestigation()` only after a selected record has a latest session, hydrates successfully, and is installed with `setInvestigatorSession`. Do not clear selection in `catch`, for a missing latest session, or when effect is cancelled. Include `selectedInvestigationId` and `clearSelectedInvestigation` in dependencies.

- [ ] **Step 5: Run context and scanner tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run --project unit src/context/ScanContext.test.tsx src/components/pages/ScanPage.test.tsx src/components/pages/InvestigationsPage.test.tsx`

Expected: PASS.

### Task 7: Focused Verification And Browser Smoke

**Files:**
- No product changes

- [ ] **Step 1: Run server regression suite**

Run: `pnpm --filter wp-json-discovery-server test -- --runInBand src/db/investigations.test.js src/routes/investigations.test.js`

Expected: PASS.

- [ ] **Step 2: Run focused frontend regression suite**

Run: `pnpm --filter frontend exec vitest run --project unit src/api/client.test.js src/context/ScanContext.test.tsx src/components/pages/InvestigationsPage.test.tsx src/components/pages/ScanPage.test.tsx src/services/anonymousInvestigations.test.js src/services/investigationSession.test.js`

Expected: PASS.

- [ ] **Step 3: Run frontend static gates**

Run: `pnpm --filter frontend run typecheck`

Expected: PASS.

Run: `pnpm --filter frontend run lint`

Expected: PASS.

Run: `pnpm --filter frontend run build`

Expected: PASS; existing bundle-size warning may remain.

- [ ] **Step 4: Check patch integrity**

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 5: Browser smoke tests**

Run frontend/server with `pnpm dev`. Verify:

1. Signed out: `Investigations` navigation opens; one stored anonymous scan appears first with `Local`, all counts, last activity, and keyboard-operable Resume.
2. Signed out: Resume opens scanner with that snapshot’s domain/results.
3. Signed in: local row remains first, owned persisted rows follow newest-first; no other account’s row appears.
4. Signed in: Resume a persisted row. Scanner fetches selected ID, restores latest session/domain, and does not instead show remembered investigation.
5. A persisted summary without latest session shows `No resumable session`, never a broken Resume control.
6. Force collection or resume request failure in browser devtools; visible error remains and existing list/local data stays intact.

Record blocked browser checks if test users or multi-account credentials are unavailable.
