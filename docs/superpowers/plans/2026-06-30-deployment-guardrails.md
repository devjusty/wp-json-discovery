# Deployment Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional API-only deployment guardrails for live Render deployments without changing the frontend hosting model or the existing Auth0/Turso flow.

**Architecture:** Add one opt-in Express middleware that is mounted before `/api/*` routes and reads the deployment toggle and shared secret from `process.env` on each request. When enabled, it fails closed with `401` unless the request presents the deployment key in either a dedicated header or a bearer token; when disabled, requests continue unchanged. Keep `/health` public for Render checks and keep the existing auth/admin middlewares in place after the guardrail.

**Tech Stack:** Express 5, existing auth/rate-limit middleware, Render environment variables, Node.js tests, Supertest.

---

### Task 1: Build the deployment guardrail middleware

**Files:**
- Create: `server/src/middleware/deploymentGuardrails.js`
- Create: `server/src/__tests__/deploymentGuardrails.test.js`

- [ ] **Step 1: Write the failing test**

```js
import express from 'express';
import request from 'supertest';
import { deploymentGuardrails, extractDeploymentKey } from '../middleware/deploymentGuardrails.js';

function buildApp() {
  const app = express();
  app.use('/api', deploymentGuardrails);
  app.get('/api/proxy', (_req, res) => res.json({ ok: true }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}

describe('deployment guardrails middleware', () => {
  const originalEnabled = process.env.DEPLOYMENT_GUARDRAILS_ENABLED;
  const originalKey = process.env.DEPLOYMENT_GUARDRAILS_KEY;

  function restoreDeploymentGuardrailsEnv() {
    if (originalEnabled === undefined) {
      delete process.env.DEPLOYMENT_GUARDRAILS_ENABLED;
    } else {
      process.env.DEPLOYMENT_GUARDRAILS_ENABLED = originalEnabled;
    }

    if (originalKey === undefined) {
      delete process.env.DEPLOYMENT_GUARDRAILS_KEY;
    } else {
      process.env.DEPLOYMENT_GUARDRAILS_KEY = originalKey;
    }
  }

  afterEach(restoreDeploymentGuardrailsEnv);

  it('prefers the dedicated deployment header over bearer auth', () => {
    const req = {
      headers: {
        'x-wpjd-deployment-key': 'alpha',
        authorization: 'Bearer beta',
      },
    };

    expect(extractDeploymentKey(req)).toBe('alpha');
  });

  it('blocks api requests when enabled and no key is present', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/api/proxy')
      .expect(401);
  });

  it('allows api requests with the deployment header', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/api/proxy')
      .set('x-wpjd-deployment-key', 'deploy-secret')
      .expect(200);
  });

  it('allows api requests with a bearer deployment token', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/api/proxy')
      .set('authorization', 'Bearer deploy-secret')
      .expect(200);
  });

  it('keeps /health public when guardrails are enabled', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/health')
      .expect(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter wp-json-discovery-server run test -- src/__tests__/deploymentGuardrails.test.js`

Expected: FAIL because `server/src/middleware/deploymentGuardrails.js` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```js
import { timingSafeEqual } from 'node:crypto';

function asSingleHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return typeof value === 'string' ? value : '';
}

function isEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function safeCompare(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function extractDeploymentKey(req) {
  const direct = asSingleHeaderValue(req.headers['x-wpjd-deployment-key']);
  if (direct) {
    return direct;
  }

  const authorization = asSingleHeaderValue(req.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

export function deploymentGuardrails(req, res, next) {
  if (!isEnabled(process.env.DEPLOYMENT_GUARDRAILS_ENABLED)) {
    return next();
  }

  const configuredKey = asSingleHeaderValue(process.env.DEPLOYMENT_GUARDRAILS_KEY);
  const providedKey = extractDeploymentKey(req);

  if (!configuredKey || !providedKey || !safeCompare(configuredKey, providedKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

export default deploymentGuardrails;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter wp-json-discovery-server run test -- src/__tests__/deploymentGuardrails.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/deploymentGuardrails.js server/src/__tests__/deploymentGuardrails.test.js
git commit -m "feat: add deployment guardrails middleware"
```

### Task 2: Wire guardrails into the API bootstrap

**Files:**
- Modify: `server/src/index.js`
- Modify: `server/.env.example`
- Modify: `server/src/index.test.js`

- [ ] **Step 1: Write the failing integration tests**

Add this environment reset near the top of `server/src/index.test.js`, alongside the existing `adminHeaders` fixture:

```js
const originalDeploymentGuardrailsEnabled = process.env.DEPLOYMENT_GUARDRAILS_ENABLED;
const originalDeploymentGuardrailsKey = process.env.DEPLOYMENT_GUARDRAILS_KEY;

afterEach(() => {
  if (originalDeploymentGuardrailsEnabled === undefined) {
    delete process.env.DEPLOYMENT_GUARDRAILS_ENABLED;
  } else {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = originalDeploymentGuardrailsEnabled;
  }

  if (originalDeploymentGuardrailsKey === undefined) {
    delete process.env.DEPLOYMENT_GUARDRAILS_KEY;
  } else {
    process.env.DEPLOYMENT_GUARDRAILS_KEY = originalDeploymentGuardrailsKey;
  }
});
```

Add these cases inside the existing `describe('API routes', () => { ... })` block:

```js
it('rejects api requests when deployment guardrails are enabled and no key is present', async () => {
  process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
  process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

  const res = await request(app).get('/api/proxy?domain=redirect-example.com');
  expect(res.statusCode).toEqual(401);
});

it('allows api requests when the deployment key is present', async () => {
  process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
  process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

  const res = await request(app)
    .get('/api/proxy?domain=redirect-example.com')
    .set('x-wpjd-deployment-key', 'deploy-secret');

  expect(res.statusCode).not.toEqual(401);
});

it('keeps /health public when deployment guardrails are enabled', async () => {
  process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
  process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

  const res = await request(app).get('/health');
  expect(res.statusCode).toEqual(200);
  expect(res.body).toEqual({ status: 'ok' });
});

it('still requires admin auth after the deployment guardrail', async () => {
  process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
  process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

  const res = await request(app)
    .get('/api/admin/db-snapshot')
    .set('x-wpjd-deployment-key', 'deploy-secret');

  expect(res.statusCode).toEqual(401);
});

it('allows admin routes once both the deployment and admin keys are present', async () => {
  process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
  process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

  const res = await request(app)
    .get('/api/admin/db-snapshot')
    .set('x-wpjd-deployment-key', 'deploy-secret')
    .set(adminHeaders);

  expect(res.statusCode).not.toEqual(401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter wp-json-discovery-server run test -- src/index.test.js`

Expected: FAIL because `/api/proxy` is still unguarded and the new env vars are not yet wired.

- [ ] **Step 3: Write the minimal implementation**

Update the bootstrap import and middleware order in `server/src/index.js`:

```js
import { deploymentGuardrails } from './middleware/deploymentGuardrails.js';
```

Mount it before the existing API middleware chain:

```js
app.use('/api', deploymentGuardrails);
app.use('/api', apiRateLimiter);
app.use('/api', requireAuthMiddleware);
```

Document the opt-in keys in `server/.env.example`:

```env
# Optional: gate every /api route behind an additional deployment key
DEPLOYMENT_GUARDRAILS_ENABLED=false
DEPLOYMENT_GUARDRAILS_KEY=change-me
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter wp-json-discovery-server run test -- src/index.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.js server/.env.example server/src/index.test.js
git commit -m "feat: wire deployment guardrails into api"
```

### Task 3: Run full verification

**Files:**
- Test: `server/src/__tests__/deploymentGuardrails.test.js`
- Test: `server/src/index.test.js`
- Test: full `server` suite

- [ ] **Step 1: Run the focused guardrail tests**

Run: `pnpm --filter wp-json-discovery-server run test -- src/__tests__/deploymentGuardrails.test.js src/index.test.js`

Expected: PASS.

- [ ] **Step 2: Run the full server suite**

Run: `pnpm --filter wp-json-discovery-server run test`

Expected: PASS with no new failures in existing auth, rate-limit, homepage, or logging coverage.

- [ ] **Step 3: Confirm the worktree only contains intended changes**

Run: `git status --short`

Expected: only the deployment guardrail files from this task are modified or staged; leave unrelated `.dex/tasks.jsonl` and `.vscode/settings.json` untouched.
