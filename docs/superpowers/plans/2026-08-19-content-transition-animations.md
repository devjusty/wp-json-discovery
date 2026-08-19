# Content Transition Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle CSS transitions to four content-swap surfaces that currently teleport with no animation, preventing jarring instant changes.

**Architecture:** Pure CSS transitions using `@starting-style` for entry animations and `grid-template-rows` for expand/collapse. No new dependencies. All animations use existing Tailwind duration utilities (`duration-200`) and inline easing (`ease-out`). Each surface gets `prefers-reduced-motion` handling.

**Tech Stack:** Tailwind CSS v4, tw-animate-css, CSS `@starting-style`, CSS `grid-template-rows` technique.

---

## File Structure

| File | Change |
|------|--------|
| `frontend/src/App.css` | Add `.section-enter` animation class, collapsible transition styles, expand/collapse transitions, reduced-motion overrides |
| `frontend/src/components/pages/scan/ScanSectionContent.jsx` | Wrap switch output in keyed container with `.section-enter` class |
| `frontend/src/components/organisms/panels/HomepageInsightsPanel.jsx` | Add data attributes to CollapsibleContent for CSS-driven animation |
| `frontend/src/components/ui/collapsible.jsx` | Pass through `data-state` attribute from Base UI |
| `frontend/src/components/pages/scan/RecentDomainsCard.jsx` | Always render CardContent wrapper, control visibility via CSS |
| `frontend/src/styles/pages.history.css` | Add expand/collapse transition styles |
| `frontend/src/components/organisms/data/DataTable.jsx` | Add opacity transition wrapper around content swap |

---

### Task 1: Scan Section Crossfade

**Files:**
- Modify: `frontend/src/App.css` (add animation classes)
- Modify: `frontend/src/components/pages/scan/ScanSectionContent.jsx` (wrap output)

- [ ] **Step 1: Add section-enter animation CSS to App.css**

Add after the `.section` rule block (around line 297):

```css
/* Section enter animation */
.section-enter {
  animation: section-enter 200ms ease-out both;
}

@keyframes section-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .section-enter {
    animation: none;
  }
}
```

- [ ] **Step 2: Wrap ScanSectionContent switch output**

In `ScanSectionContent.jsx`, change the switch statement (lines 62-147) to wrap each case return in a keyed container. Replace the bare `switch` block:

```jsx
  return (
    <div key={activeSection} className="section-enter">
      <SwitchBody
        activeSection={activeSection}
        scanResult={scanResult}
        session={session}
        homepageResult={homepageResult}
        sitemap={sitemap}
        recon={recon}
        sitemapSettings={sitemapSettings}
        onScanSettingsChange={onScanSettingsChange}
        onRunCapability={onRunCapability}
        onRetryCapability={onRetryCapability}
        sitemapFilter={sitemapFilter}
        setSitemapFilter={setSitemapFilter}
        unsupportedPlugins={unsupportedPlugins}
        unsupportedIsLoading={unsupportedIsLoading}
        onRefreshUnsupported={onRefreshUnsupported}
        showDomains={showDomains}
      />
    </div>
  );
```

Add a `SwitchBody` function component above `ScanSectionContent` that contains the current switch logic (extract lines 62-147 into it). This keeps the key on the outer wrapper so React remounts the section on tab change, triggering the `@starting-style` animation.

- [ ] **Step 3: Run lint and build**

Run: `pnpm --filter frontend run lint && pnpm --filter frontend run build`
Expected: Both pass with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.css frontend/src/components/pages/scan/ScanSectionContent.jsx
git commit -m "feat: add crossfade animation to scan section swaps"
```

---

### Task 2: Collapsible HTML Preview Animation

**Files:**
- Modify: `frontend/src/App.css` (add collapsible transition styles)
- Modify: `frontend/src/components/ui/collapsible.jsx` (pass data-state)

- [ ] **Step 1: Add collapsible animation CSS to App.css**

Add after the section-enter animation block:

```css
/* Collapsible content transition */
[data-slot="collapsible-content"] {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms ease-out, opacity 200ms ease-out;
  opacity: 0;
}

[data-slot="collapsible-content"][data-open] {
  grid-template-rows: 1fr;
  opacity: 1;
}

[data-slot="collapsible-content"] > * {
  overflow: hidden;
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  [data-slot="collapsible-content"] {
    transition: opacity 150ms ease-out;
    grid-template-rows: unset;
  }

  [data-slot="collapsible-content"]:not([data-open]) {
    display: none;
  }

  [data-slot="collapsible-content"][data-open] {
    grid-template-rows: unset;
  }
}
```

- [ ] **Step 2: Verify collapsible.jsx passes data-state**

The Base UI `CollapsiblePrimitive.Panel` already exposes `data-open`/`data-closed` attributes. The current wrapper at `frontend/src/components/ui/collapsible.jsx:15-18` spreads all props through, so `data-open` should already be present. Verify by inspecting the rendered DOM — no code change needed unless Base UI uses a different attribute name.

- [ ] **Step 3: Run lint and build**

Run: `pnpm --filter frontend run lint && pnpm --filter frontend run build`
Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: add expand/collapse transition to collapsible panels"
```

---

### Task 3: RecentDomainsCard Expand/Collapse Animation

**Files:**
- Modify: `frontend/src/components/pages/scan/RecentDomainsCard.jsx` (always render wrapper)
- Modify: `frontend/src/styles/pages.history.css` (add transition styles)

- [ ] **Step 1: Restructure RecentDomainsCard to always render CardContent wrapper**

Change the conditional render (lines 76-129) from:

```jsx
{isExpanded ? (
  <CardContent>...</CardContent>
) : null}
```

To:

```jsx
<div className={`recent-domains-card__body ${isExpanded ? 'recent-domains-card__body--open' : ''}`}>
  <CardContent>
    {isLoading ? (
      <p className="card__meta">Loading recent domains…</p>
    ) : items.length === 0 ? (
      <p className="card__meta">No recent authenticated scans recorded yet.</p>
    ) : (
      <ul className="recent-domains-list">
        {items.map((item) => (
          <li key={item.domain}>
            {/* ... existing item content ... */}
          </li>
        ))}
      </ul>
    )}
  </CardContent>
</div>
```

- [ ] **Step 2: Add expand/collapse transition CSS to pages.history.css**

Add after the `.recent-domains-card--collapsed` rule (line 145):

```css
.recent-domains-card__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms ease-out, opacity 250ms ease-out;
  opacity: 0;
}

.recent-domains-card__body--open {
  grid-template-rows: 1fr;
  opacity: 1;
}

.recent-domains-card__body > * {
  overflow: hidden;
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .recent-domains-card__body {
    transition: opacity 150ms ease-out;
    grid-template-rows: unset;
  }

  .recent-domains-card__body:not(.recent-domains-card__body--open) {
    display: none;
  }

  .recent-domains-card__body--open {
    grid-template-rows: unset;
  }
}
```

- [ ] **Step 3: Run lint and build**

Run: `pnpm --filter frontend run lint && pnpm --filter frontend run build`
Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pages/scan/RecentDomainsCard.jsx frontend/src/styles/pages.history.css
git commit -m "feat: add expand/collapse transition to recent domains card"
```

---

### Task 4: DataTable Collapse Cross-Fade

**Files:**
- Modify: `frontend/src/App.css` (add transition styles for card content)

- [ ] **Step 1: Add cross-fade transition to DataTable content**

Add after the `.card__content--expanded` rule (line 309):

```css
/* DataTable content cross-fade */
.card__content--collapsed,
.card__content--expanded {
  transition: opacity 200ms ease-out;
}

.card__content--collapsed {
  opacity: 0.7;
}

.card__content--expanded {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .card__content--collapsed,
  .card__content--expanded {
    transition: none;
  }
}
```

- [ ] **Step 2: Run lint and build**

Run: `pnpm --filter frontend run lint && pnpm --filter frontend run build`
Expected: Both pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: add cross-fade transition to DataTable collapse"
```

---

### Task 5: Verify All Animations

- [ ] **Step 1: Run full build**

Run: `pnpm --filter frontend run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Run lint**

Run: `pnpm --filter frontend run lint`
Expected: No lint errors.

- [ ] **Step 3: Manual verification checklist**

Verify each animation in the browser:
1. Switch between scan sections — content should fade in with subtle upward slide
2. Toggle HTML preview collapsible — should expand/collapse smoothly with opacity
3. Toggle recent domains card — should expand/collapse smoothly with opacity
4. Toggle DataTable collapse — content should cross-fade between states
5. Enable `prefers-reduced-motion: reduce` in browser DevTools — all animations should be reduced to opacity-only or disabled

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: polish animation transitions after verification"
```
