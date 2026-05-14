# Requirements: WP JSON Discovery

**Defined:** 2026-05-14
**Core Value:** Give a fast, trustworthy read on what a WordPress site is exposing publicly so investigators can make decisions quickly.

## v1 Requirements

### Discovery

- [ ] **DISC-01**: User can enter a domain and start an investigation scan.
- [ ] **DISC-02**: User can see clear wp-json evidence and whether the target appears to be WordPress.

### Signals

- [ ] **SIGN-01**: User can review plugin and theme clues gathered from public signals.
- [ ] **SIGN-02**: User can review SEO and metadata indicators from the inspected site.
- [ ] **SIGN-03**: User can review rendered HTML and source clues alongside the scan.

### Review

- [ ] **REVW-01**: User can revisit previous scans from history.

### Operations

- [ ] **OPS-01**: Admin can review unsupported namespace and logging signals to improve coverage.

## v2 Requirements

### Workflow Expansion

- **DISC-03**: Batch multiple site investigations in one session.
- **DISC-04**: Compare scan results across runs.
- **SIGN-04**: Expand evidence extraction beyond the initial public-surface signals.

### Admin Expansion

- **OPS-02**: Richer dashboards for unsupported namespaces and scan quality trends.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authenticated site crawling | The tool is intended for public evidence, not credentialed access |
| Continuous monitoring and alerts | This project is for investigation, not surveillance |
| Non-WordPress CMS support | The product is centered on WordPress analysis |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 1 | Pending |
| DISC-02 | Phase 1 | Pending |
| SIGN-01 | Phase 2 | Pending |
| SIGN-02 | Phase 2 | Pending |
| SIGN-03 | Phase 2 | Pending |
| REVW-01 | Phase 3 | Pending |
| OPS-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after project initialization*
