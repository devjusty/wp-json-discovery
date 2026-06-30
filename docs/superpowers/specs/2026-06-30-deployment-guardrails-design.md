# Deployment Guardrails Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional API-only deployment guardrails for live Render deployments without changing the frontend hosting model or the existing Auth0/Turso flow.

**Architecture:** Add one opt-in Express middleware that runs before `/api/*` routes and blocks requests unless a deployment key is present. Keep `/health` and all non-API routes open so Render health checks and the static frontend continue to work. Existing auth middleware, admin fallback keys, and rate limiting stay in place after the guardrail check.

**Tech Stack:** Express 5, existing auth/rate-limit middleware, Render environment variables, Node.js tests.

---

## Scope

This feature protects the live API surface only:

- `/api/*` routes can require an extra deployment key when enabled.
- `/health` remains public.
- Static frontend routes remain public.
- Current dev/internal behavior remains unchanged when guardrails are disabled.

This is intentionally separate from Auth0 authorization. Auth0 still handles user/admin identity after the deployment gate.

## Deployment Model

The guardrails are controlled entirely by backend environment variables on Render:

- `DEPLOYMENT_GUARDRAILS_ENABLED` - `true` or `false`
- `DEPLOYMENT_GUARDRAILS_KEY` - shared secret used only when guardrails are enabled

When disabled, requests follow the existing path exactly.
When enabled, API requests must present the key in either:

- `x-wpjd-deployment-key: <secret>`
- `Authorization: Bearer <secret>`

The middleware should prefer the dedicated header first and only fall back to the bearer format for convenience.

## Request Flow

1. Request enters Express.
2. If the path does not start with `/api`, the request continues normally.
3. If the path starts with `/api`, the deployment guardrail middleware checks whether guardrails are enabled.
4. If guardrails are disabled, the request continues normally.
5. If guardrails are enabled and the key matches, the request continues into the existing middleware chain.
6. If guardrails are enabled and the key is missing or wrong, the server returns `401 Unauthorized`.

This happens before `apiRateLimiter`, `requireAuthMiddleware`, and `requireAdminOrToken`, so the extra protection applies to all API routes uniformly.

## Files

### Create

- `server/src/middleware/deploymentGuardrails.js` - middleware and header parsing helpers.
- `server/src/__tests__/deploymentGuardrails.test.js` - unit coverage for enabled/disabled behavior and header parsing.

### Modify

- `server/src/index.js` - mount the guardrail middleware before `/api` routes and keep `/health` public.
- `server/src/index.test.js` - add integration coverage for protected API routes and the public health check.
- `server/.env.example` - document the two new deployment variables.

## Error Handling

- Missing or empty deployment key when enabled returns `401`.
- Disabled guardrails never block requests.
- Invalid or malformed `Authorization` headers are treated as missing credentials, not as a server error.
- `/health` must remain reachable even when guardrails are enabled.

## Testing

The tests should prove three things:

1. The middleware blocks API requests when enabled and no key is present.
2. The middleware allows API requests when the correct key is present.
3. Non-API routes, especially `/health`, are still reachable without the deployment key.

Suggested assertions:

```js
expect(await request(app).get('/api/proxy?domain=example.com')).toHaveStatus(401);
expect(await request(app).get('/api/proxy?domain=example.com').set('x-wpjd-deployment-key', 'secret')).toHaveStatus(200);
expect(await request(app).get('/health')).toHaveStatus(200);
```

Use a focused middleware test file for the key parsing and a small integration slice in `index.test.js` for the mounted route behavior.

## Acceptance Criteria

- API requests can be gated by a separate deployment key when enabled.
- The feature is opt-in and does not change default dev/internal behavior.
- `/health` remains public for Render checks.
- Existing Auth0 auth and admin-key fallback behavior still work once a request has passed the guardrail.
- Tests cover blocked, allowed, and public-route cases.
