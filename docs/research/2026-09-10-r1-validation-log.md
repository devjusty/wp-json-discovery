# R1 Validation Log

Date: 2026-09-10
Task: 7, contract-level and end-to-end verification
Status: R1 gate NOT PASSED

## Scope and Evidence Rules

This record separates automated verification from live walkthrough evidence. No authorized live domains or walkthrough sessions were available during this run, so the four manual scenarios remain pending. No manual result is inferred from unit tests, build output, or source inspection.

No analytics instrumentation was added.

## Automated Verification

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS | Contracts build/typecheck, frontend typecheck, and server typecheck completed with exit 0. |
| `pnpm --filter @wp-json-discovery/contracts test -- --run` | PASS | 1 test file, 34 tests passed. |
| `pnpm --filter frontend test -- --run` | BLOCKED | Browser Vitest could not launch because Playwright Chromium executable is missing at `/Users/justinthompson/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`. Also reports mixed `vitest`/`@vitest/browser` versions. |
| `pnpm --filter frontend exec vitest run --project unit` | FLAKY/FAIL on first run | 54 files, 267 tests; 264 passed and 3 failed in `AdminPage.test.jsx`, each waiting for `Database`. |
| `pnpm --filter frontend exec vitest run --project unit --reporter=basic` | PASS | 54 test files, 267 tests passed. The preceding differing result is retained as a repeatability concern. |
| `pnpm --filter wp-json-discovery-server test -- --runInBand` | BLOCKED | Package script appends `--`; Jest interpreted `--runInBand` as a test pattern and found no tests. Exit 1. |
| `pnpm --filter wp-json-discovery-server exec jest --runInBand` | BLOCKED | 16 suites failed before execution with `Cannot use import statement outside a module`; server Jest ESM configuration/environment issue. |
| `pnpm --filter frontend run build` | PASS | Vite production build completed with exit 0. Existing chunk-size warning for a minified chunk over 500 kB remains. |

Automated failures are recorded, not hidden. No production defect was isolated from these command-level failures, so no production code was changed in Task 7.

## Four-Domain Walkthroughs

Each scenario must be performed against a domain the operator is authorized to inspect. Required observations: first useful result, identity comprehension, exposure comprehension, actionable comprehension, evidence-label accuracy, partial-result usability, retry clarity and success, sitemap discoverability, resume/import correctness, and navigation/wording/evidence confusion.

### 1. Healthy WordPress

Status: PENDING. No authorized live walkthrough performed.

| Check | Result |
| --- | --- |
| First useful result | Pending live walkthrough |
| Identity layer understandable | Pending live walkthrough |
| Exposure layer understandable | Pending live walkthrough |
| Actionable layer understandable | Pending live walkthrough |
| Evidence labels accurate | Pending live walkthrough |
| Partial-result usability | Pending live walkthrough |
| Retry clarity and success | Pending live walkthrough |
| Sitemap discoverability | Pending live walkthrough |
| Resume/import correctness | Pending live walkthrough |
| Navigation, wording, or evidence confusion | Pending live walkthrough |

### 2. Plugin-Heavy WordPress

Status: PENDING. No authorized live walkthrough performed.

| Check | Result |
| --- | --- |
| First useful result | Pending live walkthrough |
| Identity layer understandable | Pending live walkthrough |
| Exposure layer understandable | Pending live walkthrough |
| Actionable layer understandable | Pending live walkthrough |
| Evidence labels accurate | Pending live walkthrough |
| Partial-result usability | Pending live walkthrough |
| Retry clarity and success | Pending live walkthrough |
| Sitemap discoverability | Pending live walkthrough |
| Resume/import correctness | Pending live walkthrough |
| Navigation, wording, or evidence confusion | Pending live walkthrough |

### 3. Partially Blocked or Authentication-Restricted

Status: PENDING. No authorized live walkthrough performed.

| Check | Result |
| --- | --- |
| First useful result | Pending live walkthrough |
| Identity layer understandable | Pending live walkthrough |
| Exposure layer understandable | Pending live walkthrough |
| Actionable layer understandable | Pending live walkthrough |
| Evidence labels accurate | Pending live walkthrough |
| Partial-result usability | Pending live walkthrough |
| Retry clarity and success | Pending live walkthrough |
| Sitemap discoverability | Pending live walkthrough |
| Resume/import correctness | Pending live walkthrough |
| Navigation, wording, or evidence confusion | Pending live walkthrough |

### 4. Non-WordPress

Status: PENDING. No authorized live walkthrough performed.

| Check | Result |
| --- | --- |
| First useful result | Pending live walkthrough |
| Identity layer understandable | Pending live walkthrough |
| Exposure layer understandable | Pending live walkthrough |
| Actionable layer understandable | Pending live walkthrough |
| Evidence labels accurate | Pending live walkthrough |
| Partial-result usability | Pending live walkthrough |
| Retry clarity and success | Pending live walkthrough |
| Sitemap discoverability | Pending live walkthrough |
| Resume/import correctness | Pending live walkthrough |
| Navigation, wording, or evidence confusion | Pending live walkthrough |

## R1 Gate Decision

R1 gate: **NOT PASSED**.

Reason: all four required walkthroughs are pending. The brief requires four completed walkthroughs with no blocking workflow failure before marking the gate passed. Automated proof is partial: typecheck, contracts, frontend unit rerun, and frontend build passed; browser tests are environment-blocked; requested server test command and direct feasible server test command are blocked by invocation/configuration issues; one frontend unit run was non-repeatable.

Next validation action: run the four authorized walkthroughs, replace each pending row with observed evidence, record any issue with owning code path and disposition, then reassess the gate.

## Command Output Appendix

Exact command lines and concise verbatim output/status excerpts for blocked or failed commands:

### Frontend Browser Vitest

Command: `pnpm --filter frontend test -- --run`

Status: exit 1.

```text
Error: browserType.launch: Executable doesn't exist at /Users/justinthompson/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell
Looks like Playwright was just installed or updated. Please run the following command to download new browsers:
pnpm exec playwright install
Test Files   (63)
Tests        no tests
Errors       1 error
```

Additional exact warning: `Loaded vitest@3.2.6 and @vitest/browser@3.2.7. Running mixed versions is not supported and may lead into bugs`.

### Frontend Unit Fallback, First Run

Command: `pnpm --filter frontend exec vitest run --project unit`

Status: exit 1.

```text
Failed Tests 3
FAIL |unit| src/components/pages/AdminPage.test.jsx > AdminPage integration > switches between major admin sections from the sidebar
TestingLibraryElementError: Unable to find role="heading" and name "Database"
Test Files   1 failed | 53 passed (54)
Tests        3 failed | 264 passed (267)
```

### Server Package Test Command

Command: `pnpm --filter wp-json-discovery-server test -- --runInBand`

Status: exit 1.

```text
No tests found, exiting with code 1
Pattern: --runInBand - 0 matches
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] wp-json-discovery-server@0.0.1 test: `NODE_OPTIONS=--experimental-vm-modules jest -- --runInBand`
Exit status 1
```

### Server Direct Jest Fallback

Command: `pnpm --filter wp-json-discovery-server exec jest --runInBand`

Status: exit 1.

```text
Jest encountered an unexpected token
SyntaxError: Cannot use import statement outside a module
Test Suites: 16 failed, 16 total
Tests:       0 total
```

The full command outcomes remain summarized in the table above. Passing results are not inferred for blocked or failed commands.

## Fix-Wave Verification

Date: 2026-09-11
Task: 8, full verification of shared working tree
Status: R1 gate NOT PASSED

This fix-wave run verified the current shared working tree. No source files were changed during verification. The working tree remains uncommitted; the branch is `feat/r1-investigator-vertical-slice` at `4ff852d` and tracks `origin/feat/r1-investigator-vertical-slice`.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS | Contracts build/typecheck, frontend typecheck, and server typecheck completed with exit 0. |
| `pnpm --filter @wp-json-discovery/contracts test -- --run` | PASS | 1 test file, 34 tests passed. |
| `pnpm --filter frontend exec vitest run --project unit src/api/client.test.js src/services/scan.test.js src/services/scanCapabilities.test.js src/services/wordpressCapabilityResult.test.js src/services/anonymousInvestigations.test.js src/services/investigationSession.test.js src/services/scanSession.test.js src/components/pages/ScanPage.test.jsx src/components/pages/scan/ScanStatusStack.test.jsx src/components/pages/scan/sections/scanSectionCards.test.jsx src/utils/evidence.test.js src/context/ScanContext.test.jsx src/hooks/useScan.test.jsx` | PASS | 13 test files, 154 tests passed. |
| `pnpm --filter wp-json-discovery-server exec jest --runInBand src/routes/investigations.test.js src/utils/domain.test.js src/__tests__/network.test.js src/__tests__/securityHeaders.test.js src/__tests__/auth.test.js src/__tests__/deploymentGuardrails.test.js` | BLOCKED | 6 requested suites failed before execution on `Cannot use import statement outside a module`; 0 tests ran. |
| `pnpm --filter frontend run lint` | PASS | ESLint completed with exit 0. |
| `pnpm --filter wp-json-discovery-server run lint` | PASS | ESLint completed with exit 0. |
| `pnpm --filter frontend run build` | PASS | Vite production build completed with exit 0. Existing warning remains for a minified chunk over 500 kB. |
| `git diff --check` | PASS | No whitespace errors reported. |
| `pnpm --filter frontend exec vitest run --project unit --reporter=basic` | FAIL | 56 files ran; 306 tests passed and 2 failed in unrelated `AdminPage.test.jsx` cases waiting for `Database`. |
| `pnpm --filter frontend test -- --run` | BLOCKED | Browser Vitest could not launch: Playwright Chromium executable is missing. It also reports mixed `vitest@3.2.6` and `@vitest/browser@3.2.7`. |
| `pnpm --filter wp-json-discovery-server test -- --runInBand` | BLOCKED | Package script inserts `--`; Jest treated `--runInBand` as a test pattern and found no tests. |
| `pnpm --filter wp-json-discovery-server exec jest --runInBand` | BLOCKED | Full server suite failed before execution: 16 suites failed with Jest ESM parsing errors, 0 tests ran. |

### Fix-Wave Finding Coverage

The focused frontend run covered the requested P1/P2 fix areas: API response parsing; active-session hydration recovery; production legacy-to-canonical capability mapping; unavailable-versus-retryable distinction; recent-domain canonical rescan; monotonic anonymous ordering; canonical evidence-level handling; server domain sanitization and normalized-value distrust; and the canonical mapper ownership boundary in `wordpressCapabilityResult.js`.

These results are automated evidence only. They do not establish live behavior, remote Turso contention behavior, or browser coverage.

## R1 Gate Status After Fix Wave

R1 gate remains **NOT PASSED**. Four authorized live walkthroughs are still pending, and remote Turso contention remains unverified. Browser coverage remains unavailable because Chromium is not installed and Vitest packages are mismatched. Server coverage remains unavailable because the repository Jest setup does not execute its ESM tests. The two unrelated `AdminPage` unit failures reproduce in the current full unit run and remain open.

No live walkthrough, server runtime coverage, or remote database result is inferred from passing typechecks, focused tests, lint, or build output.

### Targeted Command Reproduction

Frontend command runs from repository root through `--filter frontend`; paths are relative to the frontend workspace:

```text
pnpm --filter frontend exec vitest run --project unit src/api/client.test.js src/services/scan.test.js src/services/scanCapabilities.test.js src/services/wordpressCapabilityResult.test.js src/services/anonymousInvestigations.test.js src/services/investigationSession.test.js src/services/scanSession.test.js src/components/pages/ScanPage.test.jsx src/components/pages/scan/ScanStatusStack.test.jsx src/components/pages/scan/sections/scanSectionCards.test.jsx src/utils/evidence.test.js src/context/ScanContext.test.jsx src/hooks/useScan.test.jsx
```

Frontend files: `src/api/client.test.js`, `src/services/scan.test.js`, `src/services/scanCapabilities.test.js`, `src/services/wordpressCapabilityResult.test.js`, `src/services/anonymousInvestigations.test.js`, `src/services/investigationSession.test.js`, `src/services/scanSession.test.js`, `src/components/pages/ScanPage.test.jsx`, `src/components/pages/scan/ScanStatusStack.test.jsx`, `src/components/pages/scan/sections/scanSectionCards.test.jsx`, `src/utils/evidence.test.js`, `src/context/ScanContext.test.jsx`, `src/hooks/useScan.test.jsx`.

Server command runs from repository root through `--filter wp-json-discovery-server`; paths are relative to the server workspace:

```text
pnpm --filter wp-json-discovery-server exec jest --runInBand src/routes/investigations.test.js src/utils/domain.test.js src/__tests__/network.test.js src/__tests__/securityHeaders.test.js src/__tests__/auth.test.js src/__tests__/deploymentGuardrails.test.js
```

Server files: `src/routes/investigations.test.js`, `src/utils/domain.test.js`, `src/__tests__/network.test.js`, `src/__tests__/securityHeaders.test.js`, `src/__tests__/auth.test.js`, `src/__tests__/deploymentGuardrails.test.js`.
