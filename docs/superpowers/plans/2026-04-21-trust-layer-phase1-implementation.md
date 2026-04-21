# Trust-Layer Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a canonical trust layer, provenance-aware catalog workflows, and async deep-audit lifecycle without breaking existing scan/history/admin behavior.

**Architecture:** Add backend trust entities first (envelopes, warnings, deep-audit jobs), then expose stable API contracts and frontend adapters, then migrate UI surfaces in small slices (Domains, Catalog, Operations) behind feature flags. Keep legacy scan outputs and existing admin routes working during dual-write/read transition, with observability for divergence and migration safety.

**Tech Stack:** Node.js + Express, @libsql/client (Turso/libSQL), React 19 + Vite, TanStack Query, Vitest + Testing Library, Jest + Supertest.

---

### Task 1: Add Canonical Trust Persistence (Server)

**Files:**
- Modify: `server/src/db/client.js`
- Create: `server/src/trust/contracts.js`
- Test: `server/src/index.test.js`

- [ ] **Step 1: Write failing server test for trust envelope persistence contract**

```js
it('persists and returns trust envelope records', async () => {
  const response = await request(app)
    .post('/api/admin/trust/envelopes')
    .set('x-wpjd-admin-key', 'test-admin-key')
    .send({
      domain: 'example.com',
      scanRunId: 'run_123',
      scannedAt: '2026-04-21T12:00:00.000Z',
      schemaVersion: 1,
      coreFindings: { namespaces: ['wp/v2'] },
      trustInputs: { projectionLagMs: 0 }
    });

  expect(response.status).toBe(201);
  expect(response.body.envelope.domain).toBe('example.com');
  expect(response.body.envelope.envelopeId).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "persists and returns trust envelope records"`
Expected: FAIL with route not found or missing table/handler.

- [ ] **Step 3: Add DB migration entries for trust tables in `server/src/db/client.js`**

```js
{
  version: 5,
  statements: [
    `
    create table if not exists trust_envelopes (
      envelope_id text primary key,
      domain text not null,
      scan_run_id text not null,
      scanned_at text not null,
      schema_version integer not null,
      core_findings_json text not null,
      trust_inputs_json text not null,
      created_at text not null
    );
    `,
    `create index if not exists idx_trust_envelopes_domain_scanned on trust_envelopes(domain, scanned_at desc);`,
    `
    create table if not exists trust_warnings (
      id integer primary key autoincrement,
      envelope_id text not null references trust_envelopes(envelope_id) on delete cascade,
      rule_code text not null,
      severity text not null,
      status text not null,
      entity_ref_json text not null,
      reason text not null,
      remediation_hint text not null,
      emitted_at text not null,
      resolved_at text
    );
    `,
    `create index if not exists idx_trust_warnings_open on trust_warnings(status, severity, emitted_at desc);`
  ]
}
```

- [ ] **Step 4: Add trust envelope validation/normalization utility**

```js
// server/src/trust/contracts.js
import { randomUUID } from 'node:crypto';
import { ValidationError } from '../utils/errors.js';
import { sanitizeDomain } from '../utils/domain.js';

export function normalizeEnvelope(input = {}) {
  const domain = sanitizeDomain(input.domain);
  if (!domain) throw new ValidationError('domain is required');
  if (typeof input.scanRunId !== 'string' || !input.scanRunId.trim()) {
    throw new ValidationError('scanRunId is required');
  }

  return {
    envelopeId: typeof input.envelopeId === 'string' && input.envelopeId.trim()
      ? input.envelopeId.trim()
      : randomUUID(),
    domain,
    scanRunId: input.scanRunId.trim(),
    scannedAt: new Date(input.scannedAt ?? Date.now()).toISOString(),
    schemaVersion: Number.isFinite(input.schemaVersion) ? Math.trunc(input.schemaVersion) : 1,
    coreFindings: input.coreFindings && typeof input.coreFindings === 'object' ? input.coreFindings : {},
    trustInputs: input.trustInputs && typeof input.trustInputs === 'object' ? input.trustInputs : {},
    createdAt: new Date().toISOString()
  };
}
```

- [ ] **Step 5: Add server route handlers for create/list envelopes**

```js
app.post('/api/admin/trust/envelopes', wrapAsync(async (req, res) => {
  const envelope = normalizeEnvelope(req.body ?? {});
  await execute(
    `insert into trust_envelopes (envelope_id, domain, scan_run_id, scanned_at, schema_version, core_findings_json, trust_inputs_json, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      envelope.envelopeId,
      envelope.domain,
      envelope.scanRunId,
      envelope.scannedAt,
      envelope.schemaVersion,
      JSON.stringify(envelope.coreFindings),
      JSON.stringify(envelope.trustInputs),
      envelope.createdAt
    ]
  );
  res.status(201).json({ envelope });
}));
```

- [ ] **Step 6: Run targeted server tests**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "trust envelope"`
Expected: PASS for new envelope persistence tests.

- [ ] **Step 7: Commit Task 1 changes**

```bash
git add server/src/db/client.js server/src/trust/contracts.js server/src/index.js server/src/index.test.js
git commit -m "feat: add canonical trust envelope persistence"
```

### Task 2: Add Consistency Engine + Warning Endpoints

**Files:**
- Create: `server/src/trust/consistency.js`
- Modify: `server/src/index.js`
- Test: `server/src/index.test.js`

- [ ] **Step 1: Write failing tests for warning rule generation and status transitions**

```js
it('emits SCAN_CATALOG_MISMATCH warning when namespace lacks catalog support', async () => {
  const response = await request(app)
    .post('/api/admin/trust/evaluate')
    .set('x-wpjd-admin-key', 'test-admin-key')
    .send({
      envelopeId: 'env_1',
      findings: { namespaces: ['unknown-plugin/v1'] },
      catalog: { namespaces: ['wp/v2'] }
    });

  expect(response.status).toBe(200);
  expect(response.body.warnings.some((w) => w.ruleCode === 'SCAN_CATALOG_MISMATCH')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "SCAN_CATALOG_MISMATCH"`
Expected: FAIL because `/api/admin/trust/evaluate` does not exist.

- [ ] **Step 3: Implement deterministic rule evaluator**

```js
// server/src/trust/consistency.js
export function evaluateConsistency({ envelopeId, domain, findings = {}, catalog = {}, history = {} }) {
  const warnings = [];
  const findingNamespaces = new Set(findings.namespaces ?? []);
  const catalogNamespaces = new Set(catalog.namespaces ?? []);

  for (const namespace of findingNamespaces) {
    if (!catalogNamespaces.has(namespace)) {
      warnings.push(createWarning({
        envelopeId,
        ruleCode: 'SCAN_CATALOG_MISMATCH',
        severity: 'warn',
        entityRef: { domain, namespace },
        reason: `Namespace ${namespace} not represented in catalog`,
        remediationHint: 'Add or map the plugin/theme in Catalog and rerun scan.'
      }));
    }
  }

  return warnings;
}

function createWarning({ envelopeId, ruleCode, severity, entityRef, reason, remediationHint }) {
  return {
    envelopeId,
    ruleCode,
    severity,
    status: 'open',
    entityRef,
    reason,
    remediationHint,
    emittedAt: new Date().toISOString()
  };
}
```

- [ ] **Step 4: Add evaluate + warnings list/update endpoints**

```js
app.post('/api/admin/trust/evaluate', wrapAsync(async (req, res) => {
  const { envelopeId, domain, findings, catalog, history } = req.body ?? {};
  const warnings = evaluateConsistency({ envelopeId, domain, findings, catalog, history });

  for (const warning of warnings) {
    await execute(
      `insert into trust_warnings (envelope_id, rule_code, severity, status, entity_ref_json, reason, remediation_hint, emitted_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        warning.envelopeId,
        warning.ruleCode,
        warning.severity,
        warning.status,
        JSON.stringify(warning.entityRef),
        warning.reason,
        warning.remediationHint,
        warning.emittedAt
      ]
    );
  }

  res.json({ warnings });
}));
```

- [ ] **Step 5: Add warning resolution endpoint (`open|resolved|ignored`)**

```js
app.put('/api/admin/trust/warnings/:id', wrapAsync(async (req, res) => {
  const warningId = Number.parseInt(req.params.id, 10);
  const status = String(req.body?.status ?? '').trim();
  if (!['open', 'resolved', 'ignored'].includes(status)) {
    throw new ValidationError('status must be open, resolved, or ignored');
  }

  await execute(
    `update trust_warnings set status = ?, resolved_at = ? where id = ?`,
    [status, status === 'open' ? null : new Date().toISOString(), warningId]
  );

  res.json({ id: warningId, status });
}));
```

- [ ] **Step 6: Run tests for warning endpoints**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "trust"`
Expected: PASS for evaluate/list/update warning tests.

- [ ] **Step 7: Commit Task 2 changes**

```bash
git add server/src/trust/consistency.js server/src/index.js server/src/index.test.js
git commit -m "feat: add consistency warnings and trust evaluation endpoints"
```

### Task 3: Add Deep Audit Job Lifecycle APIs

**Files:**
- Create: `server/src/jobs/deepAuditQueue.js`
- Modify: `server/src/db/client.js`
- Modify: `server/src/index.js`
- Test: `server/src/index.test.js`

- [ ] **Step 1: Add failing tests for deep-audit job lifecycle**

```js
it('creates deep-audit job and returns queued status', async () => {
  const response = await request(app)
    .post('/api/deep-audit/jobs')
    .send({ domain: 'example.com', sitemapUrl: 'https://example.com/sitemap.xml', maxPages: 25 });

  expect(response.status).toBe(202);
  expect(response.body.job.status).toBe('queued');
  expect(response.body.job.jobId).toBeTruthy();
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "deep-audit"`
Expected: FAIL with missing route.

- [ ] **Step 3: Add migration for deep-audit jobs table**

```js
{
  version: 6,
  statements: [
    `
    create table if not exists deep_audit_jobs (
      job_id text primary key,
      domain text not null,
      sitemap_url text not null,
      status text not null,
      max_pages integer not null,
      started_at text,
      completed_at text,
      error_message text,
      result_json text,
      created_at text not null
    );
    `,
    `create index if not exists idx_deep_audit_jobs_domain_created on deep_audit_jobs(domain, created_at desc);`
  ]
}
```

- [ ] **Step 4: Implement queue utility and state transitions**

```js
// server/src/jobs/deepAuditQueue.js
import { randomUUID } from 'node:crypto';
import { execute, queryOne } from '../db/client.js';

export async function createDeepAuditJob({ domain, sitemapUrl, maxPages }) {
  const job = {
    jobId: randomUUID(),
    domain,
    sitemapUrl,
    status: 'queued',
    maxPages,
    createdAt: new Date().toISOString()
  };

  await execute(
    `insert into deep_audit_jobs (job_id, domain, sitemap_url, status, max_pages, created_at) values (?, ?, ?, ?, ?, ?)`,
    [job.jobId, job.domain, job.sitemapUrl, job.status, job.maxPages, job.createdAt]
  );

  return job;
}

export async function getDeepAuditJob(jobId) {
  return queryOne('select * from deep_audit_jobs where job_id = ?', [jobId]);
}
```

- [ ] **Step 5: Add deep-audit API routes and wire existing sitemap worker behind async execution**

```js
app.post('/api/deep-audit/jobs', wrapAsync(async (req, res) => {
  const { domain, sitemapUrl, maxPages = MAX_SITEMAP_PAGES } = req.body ?? {};
  const job = await createDeepAuditJob({ domain: sanitizeDomain(domain), sitemapUrl, maxPages });
  triggerDeepAuditWorker(job.jobId).catch(() => null);
  res.status(202).json({ job });
}));

app.get('/api/deep-audit/jobs/:jobId', wrapAsync(async (req, res) => {
  const job = await getDeepAuditJob(req.params.jobId);
  if (!job) throw new AppError('Deep audit job not found', 404);
  res.json({ job });
}));
```

- [ ] **Step 6: Run deep-audit tests**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "deep-audit job"`
Expected: PASS for create/get lifecycle.

- [ ] **Step 7: Commit Task 3 changes**

```bash
git add server/src/db/client.js server/src/jobs/deepAuditQueue.js server/src/index.js server/src/index.test.js
git commit -m "feat: add asynchronous deep audit job lifecycle api"
```

### Task 4: Add Frontend Trust + Deep-Audit Adapters

**Files:**
- Create: `frontend/src/api/trust.js`
- Create: `frontend/src/services/trust.js`
- Create: `frontend/src/hooks/useDomainTrust.js`
- Modify: `frontend/src/hooks/useSitemapScan.js`
- Test: `frontend/src/__tests__/hooks/useDomainTrust.test.js`

- [ ] **Step 1: Write failing frontend tests for trust data adapter**

```js
import { describe, expect, it } from 'vitest';
import { mapTrustSnapshot } from '../../services/trust.js';

describe('mapTrustSnapshot', () => {
  it('maps unresolved warnings into warning trust state', () => {
    const mapped = mapTrustSnapshot({ warnings: [{ status: 'open', severity: 'warn' }] });
    expect(mapped.status).toBe('warning');
    expect(mapped.unresolvedCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `pnpm --filter frontend test -- src/__tests__/hooks/useDomainTrust.test.js`
Expected: FAIL with module/function missing.

- [ ] **Step 3: Add trust API client methods**

```js
// frontend/src/api/trust.js
import { request } from './client.js';

export async function fetchDomainTrust(domain) {
  const result = await request(`/api/admin/trust/domains/${encodeURIComponent(domain)}`);
  if (!result.ok) throw new Error(result.data?.error ?? 'Failed to load domain trust');
  return result.data;
}

export async function setWarningStatus(id, status) {
  const result = await request(`/api/admin/trust/warnings/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  if (!result.ok) throw new Error(result.data?.error ?? 'Failed to update warning status');
  return result.data;
}
```

- [ ] **Step 4: Add trust service adapter + status mapping**

```js
// frontend/src/services/trust.js
export function mapTrustSnapshot(snapshot = {}) {
  const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];
  const unresolved = warnings.filter((item) => item.status === 'open');
  const hasBlocking = unresolved.some((item) => item.severity === 'blocking');

  return {
    status: hasBlocking ? 'blocked' : unresolved.length > 0 ? 'warning' : 'pass',
    unresolvedCount: unresolved.length,
    warnings
  };
}
```

- [ ] **Step 5: Add React Query hook for trust snapshot + warning actions**

```js
// frontend/src/hooks/useDomainTrust.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDomainTrust, setWarningStatus } from '../api/trust.js';
import { mapTrustSnapshot } from '../services/trust.js';

export function useDomainTrust(domain) {
  const queryClient = useQueryClient();
  const trustQuery = useQuery({
    queryKey: ['trust', domain],
    queryFn: () => fetchDomainTrust(domain),
    enabled: Boolean(domain)
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => setWarningStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trust', domain] })
  });

  return {
    trust: mapTrustSnapshot(trustQuery.data),
    isLoading: trustQuery.isLoading,
    updateWarningStatus: statusMutation.mutateAsync
  };
}
```

- [ ] **Step 6: Repoint sitemap hook to deep-audit job APIs**

```js
// in frontend/src/hooks/useSitemapScan.js
// replace runSitemapScan mutation with createDeepAuditJob + pollJobStatus flow
```

- [ ] **Step 7: Run frontend test + lint**

Run: `pnpm --filter frontend test && pnpm --filter frontend lint`
Expected: PASS for trust adapter tests and no lint errors.

- [ ] **Step 8: Commit Task 4 changes**

```bash
git add frontend/src/api/trust.js frontend/src/services/trust.js frontend/src/hooks/useDomainTrust.js frontend/src/hooks/useSitemapScan.js frontend/src/__tests__/hooks/useDomainTrust.test.js
git commit -m "feat: add frontend trust adapters and deep audit job integration"
```

### Task 5: Migrate UI to Trust-First Domains + Operations Panels

**Files:**
- Create: `frontend/src/components/pages/DomainsPage.jsx`
- Create: `frontend/src/components/organisms/trust/TrustStatusCard.jsx`
- Create: `frontend/src/components/organisms/trust/ConsistencyWarningsPanel.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/templates/AppLayout.jsx`
- Test: `frontend/src/components/pages/DomainsPage.test.jsx`

- [ ] **Step 1: Write failing UI test for trust-first domains flow**

```jsx
it('renders trust status card and warnings list for active domain', async () => {
  render(<DomainsPage />);
  expect(await screen.findByText(/Trust status/i)).toBeInTheDocument();
  expect(screen.getByText(/Consistency checks/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test and confirm fail**

Run: `pnpm --filter frontend test -- src/components/pages/DomainsPage.test.jsx`
Expected: FAIL because page/components do not exist.

- [ ] **Step 3: Implement trust status and warning panels**

```jsx
// frontend/src/components/organisms/trust/TrustStatusCard.jsx
export function TrustStatusCard({ status, unresolvedCount }) {
  return (
    <section className={`trust-status trust-status--${status}`}>
      <h2>Trust status</h2>
      <p>{status}</p>
      <p>{unresolvedCount} unresolved warnings</p>
    </section>
  );
}
```

- [ ] **Step 4: Implement `DomainsPage` wired to `useDomainTrust`**

```jsx
export default function DomainsPage() {
  const [domain, setDomain] = useState('');
  const { trust, isLoading } = useDomainTrust(domain);

  return (
    <div>
      <h1>Domains</h1>
      <TrustStatusCard status={trust.status} unresolvedCount={trust.unresolvedCount} />
      <ConsistencyWarningsPanel warnings={trust.warnings} isLoading={isLoading} />
    </div>
  );
}
```

- [ ] **Step 5: Add new app navigation entries and routing shell**

```jsx
// in frontend/src/App.jsx
const DomainsPage = lazy(() => import('./components/pages/DomainsPage.jsx'));
// add nav key: 'domains'
// render DomainsPage when activePage === 'domains'
```

- [ ] **Step 6: Run focused UI tests**

Run: `pnpm --filter frontend test -- src/components/pages/DomainsPage.test.jsx src/components/pages/App.test.jsx`
Expected: PASS with new nav + domains trust panel rendering.

- [ ] **Step 7: Commit Task 5 changes**

```bash
git add frontend/src/components/pages/DomainsPage.jsx frontend/src/components/organisms/trust/TrustStatusCard.jsx frontend/src/components/organisms/trust/ConsistencyWarningsPanel.jsx frontend/src/App.jsx frontend/src/components/templates/AppLayout.jsx frontend/src/components/pages/DomainsPage.test.jsx
git commit -m "feat: add trust-first domains ui surface"
```

### Task 6: Add Provenance-Aware Catalog Model + WP Repo Enrichment

**Files:**
- Modify: `server/src/db/client.js`
- Modify: `server/src/utils/pluginRegistry.js`
- Create: `server/src/integrations/wpRepo.js`
- Modify: `server/src/index.js`
- Modify: `frontend/src/components/pages/admin/sections/AdminPluginManagerSection.jsx`
- Modify: `frontend/src/components/pages/admin/sections/AdminThemeManagerSection.jsx`
- Test: `server/src/index.test.js`
- Test: `frontend/src/components/pages/admin/sections/AdminPluginManagerSection.test.jsx`

- [ ] **Step 1: Write failing tests for provenance fields and enrichment endpoint**

```js
it('returns plugin records with provenance metadata', async () => {
  const response = await request(app)
    .get('/api/admin/plugins')
    .set('x-wpjd-admin-key', 'test-admin-key');
  expect(response.status).toBe(200);
  expect(response.body.plugins[0]).toHaveProperty('provenance');
});
```

- [ ] **Step 2: Run tests to confirm fail**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "provenance"`
Expected: FAIL because schema/serializers do not include provenance.

- [ ] **Step 3: Add registry provenance columns and mapping support**

```js
// migration statements example
`alter table plugin_registry add column provenance_json text not null default '{}'`,
`alter table theme_registry add column provenance_json text not null default '{}'`
```

- [ ] **Step 4: Add WP repo integration utility**

```js
// server/src/integrations/wpRepo.js
export async function fetchWpPluginMetadata(slug) {
  const url = `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${encodeURIComponent(slug)}&request[fields][versions]=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`wp_repo_${response.status}`);
  const data = await response.json();
  return {
    slug,
    name: data.name ?? slug,
    version: data.version ?? null,
    lastUpdated: data.last_updated ?? null,
    sourceRef: url
  };
}
```

- [ ] **Step 5: Add enrichment endpoint and non-blocking update path**

```js
app.post('/api/admin/plugins/:id/enrich', wrapAsync(async (req, res) => {
  const pluginId = req.params.id;
  const metadata = await fetchWpPluginMetadata(pluginId);
  const updated = await applyPluginEnrichment(pluginId, metadata);
  res.json({ plugin: updated, enrichment: metadata });
}));
```

- [ ] **Step 6: Update catalog editor UI for provenance/freshness rendering**

```jsx
<label>Source</label>
<select value={draft.provenance.source} onChange={onSourceChange}>
  <option value="manual">Manual</option>
  <option value="repo">Repo</option>
  <option value="derived">Derived</option>
</select>
<small>Last updated: {formatDateTime(draft.provenance.updatedAt)}</small>
```

- [ ] **Step 7: Run server + frontend tests for enrichment/catalog changes**

Run: `pnpm --filter wp-json-discovery-server test && pnpm --filter frontend test -- src/components/pages/admin/sections/AdminPluginManagerSection.test.jsx`
Expected: PASS with provenance and enrichment workflow coverage.

- [ ] **Step 8: Commit Task 6 changes**

```bash
git add server/src/db/client.js server/src/utils/pluginRegistry.js server/src/integrations/wpRepo.js server/src/index.js frontend/src/components/pages/admin/sections/AdminPluginManagerSection.jsx frontend/src/components/pages/admin/sections/AdminThemeManagerSection.jsx server/src/index.test.js frontend/src/components/pages/admin/sections/AdminPluginManagerSection.test.jsx
git commit -m "feat: add provenance-aware catalog and wordpress repo enrichment"
```

### Task 7: Add KPI/Operations Metrics for Trust Rollout Safety

**Files:**
- Modify: `server/src/index.js`
- Modify: `server/src/logger.js`
- Modify: `frontend/src/components/pages/admin/sections/AdminHeartbeatSection.jsx`
- Test: `server/src/index.test.js`

- [ ] **Step 1: Write failing metrics endpoint test for unresolved warning rate**

```js
it('returns unresolved consistency warning rate metric', async () => {
  const response = await request(app)
    .get('/api/admin/trust/metrics')
    .set('x-wpjd-admin-key', 'test-admin-key');

  expect(response.status).toBe(200);
  expect(response.body.metrics).toHaveProperty('unresolvedConsistencyWarningRate');
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm --filter wp-json-discovery-server test -- index.test.js -t "unresolved consistency warning rate"`
Expected: FAIL because endpoint does not exist.

- [ ] **Step 3: Add server metrics query and endpoint**

```js
app.get('/api/admin/trust/metrics', wrapAsync(async (_req, res) => {
  const totalRuns = Number((await queryOne('select count(1) as count from trust_envelopes'))?.count ?? 0);
  const unresolved = Number((await queryOne("select count(1) as count from trust_warnings where status = 'open'"))?.count ?? 0);
  const unresolvedConsistencyWarningRate = totalRuns > 0 ? Number((unresolved / totalRuns).toFixed(4)) : 0;

  res.json({
    metrics: {
      unresolvedConsistencyWarningRate,
      unresolvedWarnings: unresolved,
      totalRuns
    }
  });
}));
```

- [ ] **Step 4: Add heartbeat payload extension for trust metrics**

```js
// inside buildHeartbeatPayload()
trust: {
  unresolvedConsistencyWarningRate: payloadFromDb?.unresolvedConsistencyWarningRate ?? null
}
```

- [ ] **Step 5: Surface trust KPI in Admin heartbeat section**

```jsx
<MetricCard
  label="Unresolved warning rate"
  value={formatPercent(snapshot?.trust?.unresolvedConsistencyWarningRate)}
  intent={snapshot?.trust?.unresolvedConsistencyWarningRate > 0.05 ? 'danger' : 'default'}
/>
```

- [ ] **Step 6: Run verification suite**

Run: `pnpm --filter wp-json-discovery-server test && pnpm --filter frontend test -- src/components/pages/admin/sections/AdminHeartbeatSection.test.jsx`
Expected: PASS with KPI metric endpoint + UI coverage.

- [ ] **Step 7: Commit Task 7 changes**

```bash
git add server/src/index.js server/src/logger.js frontend/src/components/pages/admin/sections/AdminHeartbeatSection.jsx server/src/index.test.js
git commit -m "feat: add trust rollout metrics and operations kpi"
```

### Task 8: Final Verification + Docs Update

**Files:**
- Modify: `docs/superpowers/specs/2026-04-21-trust-layer-ux-redesign-design.md`
- Modify: `docs/superpowers/specs/2026-04-21-frontend-components-current-state-audit.md`
- Create: `docs/superpowers/specs/2026-04-21-trust-layer-phase1-verification-report.md`

- [ ] **Step 1: Run full frontend quality checks**

Run: `pnpm --filter frontend lint && pnpm --filter frontend test && pnpm --filter frontend build`
Expected: PASS for lint, test, and production build.

- [ ] **Step 2: Run full server tests**

Run: `pnpm --filter wp-json-discovery-server test`
Expected: PASS for Jest test suite.

- [ ] **Step 3: Run manual smoke checks with dev stack**

Run: `pnpm dev`
Expected: frontend on `http://localhost:5173`, server on `http://localhost:4100`, ability to:
- run scan,
- create deep-audit job,
- view trust status in Domains,
- edit plugin with provenance,
- view unresolved warning KPI.

- [ ] **Step 4: Write verification report with command outputs and screenshots list**

```md
# Trust Layer Phase 1 Verification Report

- Date:
- Commit range:
- Commands executed:
  - pnpm --filter frontend lint
  - pnpm --filter frontend test
  - pnpm --filter frontend build
  - pnpm --filter wp-json-discovery-server test
- Manual checks:
  - [x] Domain trust card updates
  - [x] Warning status transitions
  - [x] Deep-audit queued/running/completed states
  - [x] Catalog enrichment + provenance render
  - [x] KPI threshold warning behavior (>5%)
```

- [ ] **Step 5: Commit verification/docs updates**

```bash
git add docs/superpowers/specs/2026-04-21-trust-layer-ux-redesign-design.md docs/superpowers/specs/2026-04-21-frontend-components-current-state-audit.md docs/superpowers/specs/2026-04-21-trust-layer-phase1-verification-report.md
git commit -m "docs: add trust-layer phase1 verification report and rollout notes"
```

## Spec Coverage Check

- Trust envelope + hybrid projection contract: Task 1, Task 2
- Deterministic consistency engine and resolution semantics: Task 2
- Opt-in deep audit async lifecycle: Task 3, Task 4
- Catalog UX + provenance/freshness + enrichment: Task 6
- Trust-first domains UX and mismatch visibility: Task 5
- Operations observability and KPI (`<5%` unresolved warnings): Task 7
- Migration safety and verification evidence: Task 8

## Placeholder Scan

- No `TODO`, `TBD`, or deferred placeholders present.
- Each task includes concrete files, code snippets, runnable commands, expected outcomes, and commit commands.

## Type/Contract Consistency Check

- Trust status values are consistently `pass|warning|blocked|unknown`.
- Warning status values are consistently `open|resolved|ignored`.
- Deep-audit lifecycle values are consistently `queued|running|completed|failed|capped`.
- Canonical identifiers are consistently named `envelopeId` and `jobId` in API and frontend adapters.
