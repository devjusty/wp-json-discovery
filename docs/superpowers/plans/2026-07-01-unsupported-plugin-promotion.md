# Unsupported Plugin Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins promote unsupported namespace rows into the plugin registry by opening the existing plugin editor prefilled from the namespace signal.

**Architecture:** Keep this frontend-only. The unsupported namespace table will get a row-level `Promote` action that reuses the same `handleCreatePluginFromSuggestion()` path already used by the asset-signal chips. No new registry mutation flow is needed: the existing editor opens with a namespace-based draft, and `useAdminData()` already removes unsupported entries once a matching supported plugin namespace exists.

**Tech Stack:** React, existing admin section renderers, React Query, Vitest, @testing-library/react.

---

### Task 1: Wire namespace promotion into the unsupported table

**Files:**
- Modify: `frontend/src/components/pages/admin/sections/AdminUnsupportedSection.jsx`
- Modify: `frontend/src/components/pages/admin/section-renderers/coreSections.jsx`
- Modify: `frontend/src/components/pages/AdminPage.jsx`

- [ ] **Step 1: Add the failing row-action test expectation**

```jsx
// In AdminPage.test.jsx, extend the unsupported-plugin test coverage with a namespace row.
// The important behavior is that clicking the row button opens the existing plugin modal
// with a namespace-based draft already filled in.

await userEvent.click(screen.getByRole('button', { name: 'Unsupported plugins' }));
await screen.findByRole('heading', { name: 'Unsupported plugins' });

await userEvent.click(screen.getByRole('button', { name: 'Promote wc/v3' }));

const dialog = await screen.findByRole('dialog', { name: 'Add plugin' });
expect(within(dialog).getByLabelText('ID')).toHaveValue('wc');
expect(within(dialog).getByLabelText('Label')).toHaveValue('Wc');
expect(within(dialog).getByLabelText('Plugin URL')).toHaveValue('https://wordpress.org/plugins/wc/');
expect(within(dialog).getByLabelText('Namespaces (comma or newline separated)')).toHaveValue('wc/v3');
expect(within(dialog).getByLabelText('Asset hints (comma or newline separated)')).toHaveValue('');
```

- [ ] **Step 2: Run the test to verify it fails before the UI wiring exists**

Run: `pnpm --filter frontend exec vitest run src/components/pages/AdminPage.test.jsx`

Expected: FAIL because the unsupported namespace row does not yet have a promote action wired to the plugin editor.

- [ ] **Step 3: Add the row button and thread the existing promotion handler through the render path**

```jsx
// frontend/src/components/pages/admin/sections/AdminUnsupportedSection.jsx
import { namespaceToSlug } from '../drafts.js';

<Button
  type="button"
  size="sm"
  variant="ghost"
  aria-label={`Promote ${plugin.namespace}`}
  onClick={() => onCreatePluginFromSuggestion({
    kind: 'namespace',
    namespace: plugin.namespace,
    slug: namespaceToSlug(plugin.namespace)
  })}
>
  Promote
</Button>

// frontend/src/components/pages/admin/section-renderers/coreSections.jsx
return createElement(UnsupportedSection, {
  unsupportedEntries: unsupported.unsupportedEntries,
  unsupportedNamespacePrefix: unsupported.unsupportedNamespacePrefix,
  setUnsupportedNamespacePrefix: unsupported.setUnsupportedNamespacePrefix,
  unsupportedSort: unsupported.unsupportedSort,
  setUnsupportedSort: unsupported.setUnsupportedSort,
  filteredUnsupportedEntries: unsupported.filteredUnsupportedEntries,
  unknownPluginAssetHints: unsupported.unknownPluginAssetHints,
  onCreatePluginFromAsset: unsupported.handleCreatePluginFromAsset,
  onCreatePluginFromSuggestion: unsupported.handleCreatePluginFromSuggestion
});

// frontend/src/components/pages/AdminPage.jsx
unsupported: {
  unsupportedEntries,
  unsupportedNamespacePrefix,
  setUnsupportedNamespacePrefix,
  unsupportedSort,
  setUnsupportedSort,
  filteredUnsupportedEntries,
  unknownPluginAssetHints,
  handleCreatePluginFromAsset,
  handleCreatePluginFromSuggestion
}
```

- [ ] **Step 4: Run the test to verify the row opens the prefilled editor**

Run: `pnpm --filter frontend exec vitest run src/components/pages/AdminPage.test.jsx`

Expected: PASS, including the new namespace promotion assertion.

- [ ] **Step 5: Commit the UI wiring**

```bash
git add frontend/src/components/pages/AdminPage.jsx frontend/src/components/pages/admin/section-renderers/coreSections.jsx frontend/src/components/pages/admin/sections/AdminUnsupportedSection.jsx frontend/src/components/pages/AdminPage.test.jsx
git commit -m "feat: promote unsupported namespaces from admin"
```

### Task 2: Verify unsupported cleanup still happens automatically

**Files:**
- Test: `frontend/src/components/pages/admin/useAdminData.test.js`

- [ ] **Step 1: Confirm the existing cleanup regression already covers namespace promotion**

```js
expect(result.current.unsupportedEntries.map((entry) => entry.namespace)).toEqual(['yoast/v1']);
```

- [ ] **Step 2: Keep the assertion focused on the supported-plugin namespace prefix filter**

```js
it('hides an unsupported namespace once the promoted plugin declares it', () => {
  const { result } = renderHook(() => useAdminData(buildInput({
    unsupportedNamespacePrefix: '',
    supportedPlugins: [
      {
        id: 'wc',
        namespaces: ['wc/v3'],
        assetHints: []
      }
    ]
  })));

  expect(result.current.unsupportedEntries.map((entry) => entry.namespace)).toEqual(['yoast/v1']);
});
```

- [ ] **Step 3: Run the focused admin data test if you add the regression**

Run: `pnpm --filter frontend exec vitest run src/components/pages/admin/useAdminData.test.js`

Expected: PASS.

- [ ] **Step 4: Final verification**

Run:

```bash
pnpm --filter frontend exec vitest run src/components/pages/AdminPage.test.jsx
pnpm --filter frontend exec eslint src/components/pages/AdminPage.jsx src/components/pages/admin/useAdminData.js src/components/pages/admin/useAdminEditorState.js src/components/pages/admin/sections/AdminUnsupportedSection.jsx src/components/pages/admin/section-renderers/coreSections.jsx
```

Expected: all checks pass.
