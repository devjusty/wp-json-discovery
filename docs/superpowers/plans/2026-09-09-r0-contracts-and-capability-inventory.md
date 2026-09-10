# R0 Contracts and Capability Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish shared Zod-backed domain contracts, capability inventory decisions, runtime validation, and migration seams for the redesign.

**Architecture:** Add `@wp-json-discovery/contracts` as a workspace package that owns schemas and inferred types, compiling ESM JavaScript and declarations for current Node and Vite consumers. Keep frontend and server orchestration local, introduce shared contracts at narrow existing boundaries, and avoid freezing legacy response projections or changing scan behavior.

**Tech Stack:** pnpm workspaces, TypeScript 6, Zod, Node ESM, Vite, React, Vitest, Jest.

---

## File Map

- Create `packages/contracts/package.json`: workspace package metadata, exports, and scripts.
- Create `packages/contracts/tsconfig.json`: declaration-producing ESM compiler configuration.
- Create `packages/contracts/src/index.ts`: public schemas, inferred types, and validation helpers.
- Create `packages/contracts/src/index.test.ts`: contract schema tests.
- Modify `pnpm-workspace.yaml`: include `packages/contracts`.
- Modify root `package.json`: add R0 validation commands if needed by implementation.
- Modify `frontend/package.json`: consume the contracts package.
- Modify `server/package.json`: consume the contracts package.
- Modify `frontend/src/services/scanSession.js`: adopt shared state types or runtime checks at the existing session seam without changing transitions.
- Modify `server/src/utils/domain.js`: use the shared domain schema at the server input boundary while preserving `sanitizeDomain` behavior.
- Create `docs/research/2026-09-09-r0-research-brief.md`: record log/event observations and walkthrough/interview findings.
- Create `docs/scan-capability-inventory.md`: classify current investigator/admin capabilities and map migration decisions.

### Task 1: Scaffold Contracts Workspace

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: root `package.json`

- [ ] **Step 1: Add the workspace package path**

Update `pnpm-workspace.yaml` so the package list includes:

```yaml
packages:
  - frontend
  - server
  - packages/contracts
```

- [ ] **Step 2: Create package metadata**

Create `packages/contracts/package.json` with ESM exports pointing consumers to compiled output:

```json
{
  "name": "@wp-json-discovery/contracts",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "vitest": "^3.2.6"
  }
}
```

Use the repository's resolved Zod and Vitest versions when installing so the lockfile remains consistent; do not hand-edit lockfile entries.

- [ ] **Step 3: Configure declaration-producing ESM output**

Create `packages/contracts/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Add a temporary public entry point**

Create `packages/contracts/src/index.ts` with a minimal export so the package can build before schemas are added:

```ts
export const CONTRACTS_PACKAGE_VERSION = '0.0.0';
```

- [ ] **Step 5: Install and verify the workspace**

Run:

```bash
pnpm --filter @wp-json-discovery/contracts install
pnpm --filter @wp-json-discovery/contracts run typecheck
pnpm --filter @wp-json-discovery/contracts run build
pnpm install --frozen-lockfile --lockfile-only
```

Expected: package resolution, typecheck, build, and frozen lockfile validation pass; generated `packages/contracts/dist` remains ignored and is not committed.

### Task 2: Implement Shared Schemas and Contract Tests

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/index.test.ts`

- [ ] **Step 1: Define domain and state schemas**

Replace the temporary entry point with schemas and inferred types for the approved contract scope. Use Zod discriminated unions for state-bearing values. The public API must include schemas and types for:

```ts
export const domainIdentitySchema = z.object({
  submitted: z.string().min(1),
  normalized: z.string().min(1),
});

export const capabilityStatusSchema = z.enum([
  'idle',
  'queued',
  'running',
  'success',
  'failed',
  'unavailable',
]);

export const capabilityOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), result: z.unknown(), error: z.null() }),
  z.object({ status: z.literal('failed'), result: z.null(), error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }) }),
  z.object({ status: z.literal('unavailable'), result: z.null(), error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.literal(false),
  }) }),
]);

export type DomainIdentity = z.infer<typeof domainIdentitySchema>;
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;
export type CapabilityOutcome = z.infer<typeof capabilityOutcomeSchema>;
```

Add the remaining schemas for investigation identity, scan session lifecycle, capability selection/dependencies, findings/evidence, redesigned API envelopes, and persisted investigation/session records. Keep result payloads unknown until capability-specific result contracts are designed; do not invent legacy response shapes.

- [ ] **Step 2: Export boundary parsers**

Export `parse` or `safeParse`-based helpers only where they make boundary use clear. The schemas themselves remain public so frontend and server can choose error handling appropriate to their boundary. Do not add fetch, auth, persistence, or retry helpers to this package.

- [ ] **Step 3: Write contract tests first**

In `packages/contracts/src/index.test.ts`, test at minimum:

```ts
import { describe, expect, it } from 'vitest';
import {
  capabilityOutcomeSchema,
  domainIdentitySchema,
} from './index.js';

describe('domainIdentitySchema', () => {
  it('accepts submitted and normalized domain identity', () => {
    expect(domainIdentitySchema.safeParse({
      submitted: 'https://Example.com/',
      normalized: 'example.com',
    }).success).toBe(true);
  });

  it('rejects missing normalized identity', () => {
    expect(domainIdentitySchema.safeParse({ submitted: 'example.com' }).success).toBe(false);
  });
});

describe('capabilityOutcomeSchema', () => {
  it('preserves success, failure, and unavailable states', () => {
    expect(capabilityOutcomeSchema.safeParse({
      status: 'success',
      result: { value: 1 },
      error: null,
    }).success).toBe(true);
    expect(capabilityOutcomeSchema.safeParse({
      status: 'failed',
      result: null,
      error: { code: 'scan_failed', message: 'Failed', retryable: true },
    }).success).toBe(true);
    expect(capabilityOutcomeSchema.safeParse({
      status: 'unavailable',
      result: null,
      error: { code: 'dependency_failed', message: 'Unavailable', retryable: false },
    }).success).toBe(true);
  });
});
```

Add tests for malformed API envelopes, partial sessions, dependency failure, retry state, and persisted-record rejection. Tests must assert failure, not only successful parsing.

- [ ] **Step 4: Run package proof**

Run:

```bash
pnpm --filter @wp-json-discovery/contracts run test
pnpm --filter @wp-json-discovery/contracts run typecheck
pnpm --filter @wp-json-discovery/contracts run build
```

Expected: all contract tests pass, declarations are emitted, and ESM output imports without runtime errors.

### Task 3: Inventory Capabilities and Research Evidence

**Files:**
- Create: `docs/scan-capability-inventory.md`
- Create: `docs/research/2026-09-09-r0-research-brief.md`

- [ ] **Step 1: Inventory current capabilities**

Build `docs/scan-capability-inventory.md` from `docs/scan-capabilities.md`, `CONTEXT.md`, current frontend services, server routes, and admin sections. Classify every current investigator and admin capability as exactly one of `retained`, `redesigned`, `deferred`, or `removed`.

For each capability record:

- Current entry point and implementation path.
- User job supported.
- Current inputs and outputs.
- Dependencies and failure/unavailable behavior.
- Evidence currently exposed.
- R0 decision and R1 migration target.

Include explicit rows for REST discovery, homepage scan, sitemap scan, domain recon, history, unsupported namespaces, plugin/theme registries, asset intelligence, retention, database health, maintenance, and admin authentication/authorization.

- [ ] **Step 2: Record research findings**

Create the research brief with sections for:

- Existing scan-log observations.
- Privacy-preserving workflow-event observations.
- Task walkthrough/interview notes, or an explicit record that human walkthrough/interview evidence is absent, for opening a scan, finding evidence, recovering from partial failure, and returning to prior investigations.
- Capability decisions supported by evidence.
- Workflow friction, confidence level, and unresolved questions.

Do not include personal data or create new analytics code as part of this task.

- [ ] **Step 3: Verify inventory completeness**

Cross-check the inventory against `docs/scan-capabilities.md`, `CONTEXT.md`, `frontend/src/services/scanCapabilities.js`, `frontend/src/services/scanSession.js`, frontend page components, and `server/src/routes`. Every discovered capability must have one classification.

### Task 4: Wire Frontend Contract Seam

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/services/scanSession.js`
- Modify: `frontend/src/services/scanCapabilities.js` only if required by the selected contract seam
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the workspace dependency**

Add:

```json
"@wp-json-discovery/contracts": "workspace:*"
```

to frontend dependencies. Keep existing service imports and runner behavior unchanged.

- [ ] **Step 2: Add boundary validation without changing transitions**

Use the shared schemas at the narrowest existing seam, such as validating a session snapshot before persistence or validating an incoming redesigned payload before rendering. Preserve the current `idle`, `queued`, `running`, `success`, `failed`, and `unavailable` transitions, dependency propagation, retry behavior, and `overallStatus` values.

If a current payload does not match a redesigned schema, do not reshape it silently. Keep it on the legacy path and document the migration seam for R1.

- [ ] **Step 3: Add focused regression tests**

Extend the existing scan-session tests to prove unchanged behavior for:

- Dependency failure becoming unavailable.
- Retry of failed and unavailable capabilities.
- Successful completion and incomplete overall status.
- Callback suppression when the cancellation token is inactive.

Add one test proving malformed contract data is handled as an explicit validation failure rather than rendered as a valid session.

- [ ] **Step 4: Run frontend proof**

Run:

```bash
pnpm --filter @wp-json-discovery/contracts run build
pnpm --filter frontend run test
pnpm --filter frontend run typecheck
pnpm --filter frontend run lint
pnpm --filter frontend run build
```

Expected: focused unit tests, typecheck, lint, and build pass. If browser tests are blocked by missing Chromium, report that environment limitation separately.

### Task 5: Wire Server Domain Boundary

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/utils/domain.js`
- Modify: `server/src/utils/domain.test.js` or the existing domain test location
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the workspace dependency**

Add:

```json
"@wp-json-discovery/contracts": "workspace:*"
```

to server dependencies. The server consumes compiled ESM JavaScript from `dist`.

- [ ] **Step 2: Preserve domain sanitization behavior**

Use the shared domain schema as a boundary check around the existing `sanitizeDomain` result. Preserve all current behavior: non-string rejection, trimming/lowercasing, maximum length, blocked local suffixes, IP rejection, label validation, and numeric TLD rejection.

The server remains responsible for security policy and response mapping. Zod must not replace the existing SSRF-related domain restrictions.

- [ ] **Step 3: Add regression coverage**

Retain tests for valid domains, whitespace/case normalization, localhost/internal suffixes, IP addresses, invalid labels, and numeric TLDs. Add tests for schema rejection of malformed boundary values and confirm the public server utility still returns `null` or normalized strings exactly as before.

- [ ] **Step 4: Run server proof**

Run:

```bash
pnpm --filter @wp-json-discovery/contracts run build
pnpm --filter wp-json-discovery-server run test
pnpm --filter wp-json-discovery-server run typecheck
pnpm --filter wp-json-discovery-server run lint
```

Expected: contract package builds first, server checks pass, and existing unrelated test failures are reported without altering unrelated behavior.

### Task 6: Integrate Workspace Verification and Close R0

**Files:**
- Modify: root `package.json`
- Modify: `docs/product-roadmap.md`
- Modify: `docs/README.md` if the new documents need indexing

- [ ] **Step 1: Add root contract checks**

Update the root typecheck/build verification so it covers the contracts package before consumers:

```json
"typecheck": "pnpm --filter @wp-json-discovery/contracts run build && pnpm --filter @wp-json-discovery/contracts run typecheck && pnpm --filter frontend run typecheck && pnpm --filter wp-json-discovery-server run typecheck"
```

Add a root `contracts:build` script only if consumer verification needs an explicit compiled-package step:

```json
"contracts:build": "pnpm --filter @wp-json-discovery/contracts run build"
```

- [ ] **Step 2: Update roadmap references**

Add links to the R0 capability inventory, research brief, and approved design spec. State that R0 contracts are implemented before R1 UI work starts.

- [ ] **Step 3: Run complete verification**

Run:

```bash
pnpm install --frozen-lockfile --lockfile-only
pnpm run typecheck
pnpm --filter @wp-json-discovery/contracts run test
pnpm --filter frontend run lint
pnpm --filter frontend run build
pnpm --filter wp-json-discovery-server run lint
git diff --check
```

Expected: frozen lockfile, typechecks, contract tests, lint, build, and diff checks pass. Existing known browser-environment and activity-retention failures remain documented if still present.

- [ ] **Step 4: Confirm R0 implementation closure and R1 gates**

Before handing off to R1, verify:

- All current capabilities have one classification.
- Canonical concepts and redesigned API contracts are documented and implemented.
- Zod schemas compile to ESM and declarations.
- Both frontend and server consume a shared contract at a real boundary.
- Runtime validation at the frontend session and server domain seams has tests; API request/response, persistence, auth, and capability-outcome wiring are deferred until redesigned server surfaces exist in R1.
- Research brief records available log/event observations, static walkthrough hypotheses, and explicit research limitations; human interviews/walkthroughs and analytics validation remain an explicit open gate before R1 commitment.
- No legacy response shape was accidentally promoted to future API status.
