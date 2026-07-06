# Refactor Priority Fast Wins Design

**Goal:** Turn the recent Fallow complexity and hotspot report into a concrete refactor order optimized for fast wins rather than maximum risk reduction.

**Architecture:** This design does not introduce product behavior changes. It defines a sequencing strategy for targeted refactors across existing frontend and server modules, starting with isolated high-complexity functions and medium-size UI components before attempting central shell or server entrypoint rewrites.

**Tech Stack:** JavaScript, React, Express, Fallow.

---

## Scope

This design covers only refactor prioritization and sequencing:
- Rank current complexity and hotspot findings for quick cleanup value
- Bias toward isolated functions and medium-size components
- Defer large, central, or high-blast-radius files until later passes
- Establish a recommended execution sequence for the first refactor batch

It does not define the detailed implementation steps for each refactor or change runtime behavior.

## Chosen Approach

Use a smallest-first prioritization model.

Why this approach:
- It delivers visible complexity reduction quickly.
- It keeps the first refactors local and easier to verify.
- It avoids starting with `server/src/index.js` or other broad files where cleanup cost and regression risk are much higher.
- It creates cleaner extraction patterns that can later be reused on the larger hotspots.

## Alternatives Considered

1. Risk-reduction-first ordering.
- Best for attacking the highest hotspot scores immediately, but too slow and risky for a fast-wins pass.

2. Frontend roadmap-first ordering.
- Better aligned to recent UI work, but it can skip smaller backend wins that are easier to finish quickly.

3. Recommended: smallest-first ordering.
- Best balance of speed, safety, and measurable complexity reduction.

## Priority Rules

Use these rules to keep the ordering consistent:
- Favor single functions or components under roughly 150 lines before files above 250 to 300 lines.
- Favor frontend-only or isolated utility refactors before shared shell, app bootstrap, or server entrypoint changes.
- Favor work with low to medium fan-in before highly reused modules.
- Treat high CRAP plus moderate size as a strong quick-win signal.
- Defer files with broad caller reach even when their hotspot scores are higher.

## Concrete Priority List

### 1. `frontend/src/services/scan.js` `gatherExposure`
- Critical complexity in a `36` line function makes this the clearest quick win.
- Likely refactor shape: extract condition grouping or mapping helpers and flatten branch logic.

### 2. `server/src/logger.js` `deriveFailureCategory`
- Extremely high cyclomatic complexity inside an `84` line function.
- Likely refactor shape: move category rules into smaller helpers or a table-driven classifier.

### 3. `frontend/src/components/pages/admin/sections/AdminMaintenanceSection.jsx`
- Critical complexity with manageable size (`106` lines).
- Likely refactor shape: extract repeated UI branches and reduce inline conditional rendering.

### 4. `frontend/src/components/organisms/panels/HomepageInsightsPanel.jsx`
- Critical CRAP score with moderate size (`133` lines).
- Likely refactor shape: split data formatting from section rendering and isolate branch-heavy subviews.

### 5. `frontend/src/components/pages/admin/AdminSidebarNav.jsx`
- Hotspot score is elevated while the main function remains moderate in size.
- Likely refactor shape: extract nav item rendering and active-state decision helpers.

### 6. `frontend/src/components/pages/admin/sections/AdminDomainsSection.jsx`
- Good medium-size frontend target with enough churn to justify cleanup.
- Likely refactor shape: split action controls, list rendering, and empty/loading states.

### 7. `frontend/src/components/molecules/forms/DomainForm.jsx`
- Smaller and safer than the larger shell-level hotspots.
- Likely refactor shape: extract validation/display helpers and simplify conditional form rendering.

## Deferred Targets

These should wait until the fast-wins batch is complete:
- `server/src/index.js`
- `frontend/src/App.jsx`
- `frontend/src/components/pages/ScanPage.jsx`
- `frontend/src/components/pages/admin/sections/AdminDbSection.jsx`
- `frontend/src/components/organisms/panels/SitemapScanPanel.jsx`

Why these are deferred:
- They are large, central, or both.
- Their blast radius is wider.
- They are more likely to need multi-step extraction plans rather than a single contained cleanup.

## Refactor Sequence

Recommended execution order:
1. Complete the two function-level wins: `gatherExposure` and `deriveFailureCategory`.
2. Complete two medium frontend component wins: `AdminMaintenanceSection.jsx` and `HomepageInsightsPanel.jsx`.
3. Re-run `fallow health --hotspots --complexity --format json --quiet --explain`.
4. Re-rank the remaining list using the new complexity and hotspot output.
5. Decide whether to continue with the remaining fast wins or shift to a larger hotspot such as `SitemapScanPanel.jsx` or `AdminDbSection.jsx`.

## Error Handling

This is planning-only work, so no new runtime paths are introduced.

Refactor-specific guardrails:
- Preserve existing behavior while reducing branching.
- Prefer extraction over semantic rewrites in the first pass.
- If a file proves more coupled than expected, stop and move it down the queue rather than expanding scope mid-pass.

## Testing

Each refactor should keep verification local and cheap:
- Add or update focused tests around the touched function or component.
- Prefer targeted assertions for branch-heavy logic over broad snapshot churn.
- Run focused frontend or server tests for the affected files.
- Re-run `fallow health --hotspots --complexity --format json --quiet --explain` after each batch to confirm the intended improvement.
- Run the normal lint or build checks required by the touched area before merging.

## Success Criteria

- The first refactor batch reduces complexity in at least the top two function-level quick wins.
- At least two medium-size frontend components become easier to read and test.
- No deferred broad-scope hotspot is pulled in prematurely.
- Fallow reports lower complexity risk in the completed targets after the batch is done.
