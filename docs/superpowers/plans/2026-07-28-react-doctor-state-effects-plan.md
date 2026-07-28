# React Doctor State and Effect Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the selected chained-effect and state-adjustment React Doctor findings while preserving history, scan-permission, and admin-editor behavior.

**Architecture:** Keep homepage and sitemap mutation state local because no React Query cache consumers exist. Coordinate HistoryPage resets in one effect, derive ScanPage's visible section from current permission, and move admin draft/error and mutation-success state changes to direct callbacks. Inspect rotate-log consumers before deciding whether its cache warning needs a targeted invalidation.

**Tech Stack:** React, React Testing Library, Vitest, TanStack React Query, ESLint, Vite, React Doctor.

---

## File Map

- Modify `frontend/src/components/pages/HistoryPage.jsx`: replace chained page/domain reset effects with one filter-reset effect.
- Test `frontend/src/components/pages/HistoryPage.test.jsx`: cover filter reset clearing selected domain and returning to page one.
- Modify `frontend/src/components/pages/ScanPage.jsx`: derive an access-safe visible section instead of synchronizing section state from `isAdmin` in an effect.
- Test `frontend/src/components/pages/ScanPage.test.jsx`: make the sidebar mock interactive and verify unsupported content is not visible after admin access is absent.
- Modify `frontend/src/components/pages/admin/useAdminEditorState.js`: remove validation/mutation-success synchronization effects; expose draft setters that clear matching validation and pass success callbacks to mutation calls.
- Create `frontend/src/components/pages/admin/useAdminEditorState.test.js`: test validation clearing and create/update success reset behavior with real hook state and controlled mutation doubles.
- Inspect `frontend/src/hooks/useScan.js` and admin log query consumers: only modify if activity-log cache data is actually cached and displayed after rotation.

## Task 1: History Reset Path

**Files:**
- Test: `frontend/src/components/pages/HistoryPage.test.jsx`
- Modify: `frontend/src/components/pages/HistoryPage.jsx:113-119`

- [ ] **Step 1: Add failing regression test**

Add a test that starts on page 2, opens a domain run panel, changes the search query, and asserts page 1 is shown, the domain panel is gone, and the next history request uses the new query with `offset: 0`.

```jsx
it('resets page and selected domain together when filters change', async () => {
  fetchScanHistory
    .mockResolvedValueOnce(buildHistoryResponse({
      items: [{ domain: 'example.com', lastStatus: 'success' }],
      total: 25
    }))
    .mockResolvedValueOnce(buildHistoryResponse({
      items: [{ domain: 'filtered.com', lastStatus: 'success' }],
      total: 1
    }));
  fetchDomainScanHistory.mockResolvedValue({ runs: [] });

  window.history.replaceState({}, '', '/?page=2');
  renderPage();
  await screen.findByText('example.com');

  await userEvent.click(screen.getByRole('button', { name: 'View runs' }));
  await screen.findByText(/Recent runs for example.com/i);
  await userEvent.type(screen.getByRole('textbox', { name: 'Search domains' }), 'filtered');

  await waitFor(() => {
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.queryByText(/Recent runs for example.com/i)).not.toBeInTheDocument();
    expect(fetchScanHistory).toHaveBeenLastCalledWith(expect.objectContaining({
      q: 'filtered',
      offset: 0
    }));
  });
});
```

- [ ] **Step 2: Run the focused test and capture the existing behavior**

Run: `pnpm --filter frontend exec vitest run src/components/pages/HistoryPage.test.jsx --browser.enabled=false`

Expected: the behavior test passes or exposes an existing regression; the React Doctor diagnostic still reports the chained-effects finding. The test protects behavior while the static diagnostic supplies the refactor's red signal.

- [ ] **Step 3: Replace two effects with one filter-reset effect**

Replace the two effects at lines 113-119 with:

```jsx
  useEffect(() => {
    setPage(1);
    setActiveDomain('');
  }, [query, sort, includeFailed]);
```

Do not include `page` in this dependency list. Pagination must not clear an actively selected domain unless a filter changes.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `pnpm --filter frontend exec vitest run src/components/pages/HistoryPage.test.jsx --browser.enabled=false`

Expected: all HistoryPage tests pass.

## Task 2: Scan Permission-Derived Section

**Files:**
- Test: `frontend/src/components/pages/ScanPage.test.jsx`
- Modify: `frontend/src/components/pages/ScanPage.jsx:47-58,199-214`

- [ ] **Step 1: Make the sidebar testable and add failing permission coverage**

Change the mocked sidebar to expose section buttons and render the passed active section:

```jsx
vi.mock('./scan/ScanSidebarNav.jsx', () => ({
  default: ({ activeSection, onSectionChange }) => (
    <nav aria-label="Scan navigation">
      <span data-testid="active-section">{activeSection}</span>
      <button type="button" onClick={() => onSectionChange('unsupported')}>
        Unsupported
      </button>
    </nav>
  )
}));
```

Add a test that renders `ScanPage` with `isAdmin`, clicks `Unsupported`, rerenders with `isAdmin={false}`, and expects `active-section` to show `overview`.

```jsx
it('shows overview when unsupported section loses admin access', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ScanPage isAdmin isAuthenticated />
    </QueryClientProvider>
  );

  await userEvent.click(screen.getByRole('button', { name: 'Unsupported' }));
  expect(screen.getByTestId('active-section')).toHaveTextContent('unsupported');

  view.rerender(
    <QueryClientProvider client={queryClient}>
      <ScanPage isAdmin={false} isAuthenticated />
    </QueryClientProvider>
  );

  expect(screen.getByTestId('active-section')).toHaveTextContent('overview');
});
```

- [ ] **Step 2: Run the focused test and capture the current permission behavior**

Run: `pnpm --filter frontend exec vitest run src/components/pages/ScanPage.test.jsx --browser.enabled=false`

Expected: the existing tests pass; the new assertion documents the permission behavior that the derived section must preserve while the React Doctor diagnostic remains present.

- [ ] **Step 3: Derive an access-safe visible section**

Remove `useRef` from the React import and delete `prevIsAdmin` plus its effect. Add:

```jsx
  const visibleSection = !isAdmin && activeSection === 'unsupported'
    ? 'overview'
    : activeSection;
```

Pass `visibleSection` to `ScanSidebarNav` and `ScanSectionContent`. Keep `activeSection` state and `setActiveSection` for normal navigation. Ensure the sidebar's `activeSection` and content's `activeSection` both use the derived value.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `pnpm --filter frontend exec vitest run src/components/pages/ScanPage.test.jsx --browser.enabled=false`

Expected: all ScanPage tests pass, including the permission downgrade regression.

## Task 3: Admin Editor Draft and Mutation State

**Files:**
- Create: `frontend/src/components/pages/admin/useAdminEditorState.test.js`
- Modify: `frontend/src/components/pages/admin/useAdminEditorState.js:1-124,270-292`

- [ ] **Step 1: Add failing hook tests**

Use `renderHook` with controlled mutation doubles. Each double must expose `mutate`, `reset`, `isSuccess`, and `isPending`; `mutate` captures its payload and callback without automatically invoking it.

Add tests for these behaviors:

```js
it('clears plugin validation when plugin draft changes', () => {
  const { result } = renderHook(() => useAdminEditorState(buildOptions()));

  act(() => result.current.handlePluginSave());
  expect(result.current.pluginValidationError).toBe('Plugin ID is required.');

  act(() => result.current.setPluginDraft((draft) => ({ ...draft, id: 'new-plugin' })));
  expect(result.current.pluginValidationError).toBe('');
});

it('resets plugin create state from mutation success callback', () => {
  const options = buildOptions();
  const { result } = renderHook(() => useAdminEditorState(options));

  act(() => result.current.handleOpenCreatePluginModal());
  act(() => result.current.setPluginDraft({ ...createEmptyPluginDraft(), id: 'new-plugin', label: 'New plugin' }));
  act(() => result.current.handlePluginSave());

  const success = options.createPluginMutation.mutate.mock.calls[0][1].onSuccess;
  act(() => success());

  expect(result.current.showCreatePluginModal).toBe(false);
  expect(result.current.pluginDraft).toEqual(createEmptyPluginDraft());
  expect(options.createPluginMutation.reset).toHaveBeenCalledTimes(1);
});
```

Repeat the success callback assertion for plugin update, theme create, and theme update, checking `editingPluginId` or `editingThemeId` is cleared only for update flows and the matching modal closes only for create flows.

- [ ] **Step 2: Run the new hook tests and capture the current callback gap**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/useAdminEditorState.test.js --browser.enabled=false`

Expected: the validation-clearing assertion may pass through the existing effect, but the mutation-success callback assertion fails because the current `mutate` calls do not receive per-call callbacks. The React Doctor state-adjustment findings remain present.

- [ ] **Step 3: Replace effect-driven draft validation clearing with wrapped setters**

Remove `useEffect` from the import. Add stable setters near the existing reset callbacks:

```js
  const updatePluginDraft = useCallback((nextDraft) => {
    setPluginValidationError('');
    setPluginDraft(nextDraft);
  }, []);

  const updateThemeDraft = useCallback((nextDraft) => {
    setThemeValidationError('');
    setThemeDraft(nextDraft);
  }, []);
```

Remove the plugin/theme validation effects. Return `updatePluginDraft` and `updateThemeDraft` under the existing public names `setPluginDraft` and `setThemeDraft` so consuming editor components require no API change.

- [ ] **Step 4: Move mutation-success resets into per-call callbacks**

Remove the four mutation-success effects. Add explicit callbacks at each `mutate` call:

```js
    const resetAfterCreate = {
      onSuccess: () => {
        resetPluginDraft();
        setShowCreatePluginModal(false);
        createPluginMutation.reset();
      }
    };

    if (editingPluginId) {
      updatePluginMutation.mutate({ id: editingPluginId, payload }, {
        onSuccess: () => {
          resetPluginDraft();
          setEditingPluginId(null);
          updatePluginMutation.reset();
        }
      });
    } else {
      createPluginMutation.mutate(payload, resetAfterCreate);
    }
```

Use equivalent callbacks for theme create/update. Keep `useAdminQueries` mutation-level invalidation callbacks untouched; per-call callbacks only reset local editor state.

- [ ] **Step 5: Run the hook tests and confirm they pass**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/useAdminEditorState.test.js --browser.enabled=false`

Expected: all hook state and callback tests pass.

- [ ] **Step 6: Run existing admin tests**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin --browser.enabled=false`

Expected: existing admin tests pass with no editor interaction regressions.

## Task 4: Mutation Cache Consumer Check

**Files:**
- Inspect: `frontend/src/hooks/useScan.js`
- Inspect: `frontend/src/components/pages/admin/useAdminQueries.js`
- Inspect: admin log data wiring and tests

- [ ] **Step 1: Confirm rotate-log data ownership**

Trace `rotateLogsMutation` from `useScan.js` through its consumers. If activity logs are fetched by a React Query key, add only that key to the mutation's `onSuccess` invalidation and add a focused invalidation test. If logs are passed through local admin data state, make no code change and record the finding as an intentional local-state false positive.

- [ ] **Step 2: Run the exact relevant admin data test**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/useAdminData.test.js src/components/pages/admin/sections/AdminLogsSection.test.jsx --browser.enabled=false`

Expected: existing activity-log derivation and rotate/prune UI behavior remains unchanged. If no cache consumer exists, no invalidation assertion is added.

## Task 5: React Doctor and Project Verification

**Files:**
- No additional source files unless verification exposes a regression in the selected scope.

- [ ] **Step 1: Run selected focused tests together**

Run: `pnpm --filter frontend exec vitest run src/components/pages/HistoryPage.test.jsx src/components/pages/ScanPage.test.jsx src/components/pages/admin/useAdminEditorState.test.js --browser.enabled=false`

Expected: all selected regression tests pass.

- [ ] **Step 2: Run React Doctor**

Run: `npx react-doctor@latest --verbose`

Expected: the chained-effects and state-adjusted-after-prop-change findings addressed by this plan are absent or reduced. Homepage/sitemap cache findings remain only if no cache consumers exist. Unrelated groups remain untouched.

- [ ] **Step 3: Run frontend lint**

Run: `pnpm --filter frontend run lint`

Expected: exit 0 with no new lint errors.

- [ ] **Step 4: Run frontend build**

Run: `pnpm --filter frontend run build`

Expected: exit 0; existing chunk-size warnings may remain.

- [ ] **Step 5: Check diff scope**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only planned source/test/spec/plan files are newly changed in this work, with pre-existing unrelated worktree changes preserved.
