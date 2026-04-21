# TODO List

This is the active execution backlog.

Related docs:

- Strategic direction: `docs/product-roadmap.md`
- Current capabilities: `docs/scan-capabilities.md`

## Notes and Tasks

- [ ] **History Page:** view runs/hide runs doesn't seem to work.

## High Priority

- [ ] **Homepage security headers panel (scan results):** Add CSP/HSTS/XFO/XCTO/Referrer-Policy/Permissions-Policy analysis to homepage scan output with clear missing-header summary.
- [ ] **Security headers backend model:** Include normalized security-header summary in `/api/homepage-scan` response without bloating activity logs.
- [ ] **Error taxonomy refinement:** Reduce `unknown` error-category share in heartbeat by tightening scan failure categorization (`auth_required`, `blocked_waf`, `timeout`, `network_failure`, `non_wordpress`, etc.).
- [ ] **Retention by event class:** Add configurable retention strategy for noisy classes (`proxy.response`) vs high-value classes (`scan.error`, `metrics.heartbeat`).

## Medium Priority

- [ ] **Asset signal workflow completion:** Expand asset-only plugin/theme promotion flow with better conflict handling and optional preview before save.
- [ ] **Admin consistency pass:** Add explicit “last refreshed” indicators and keep loading/empty/error states consistent across all admin sections.
- [ ] **Activity log export utilities:** Export unknown asset paths and related evidence in CSV/JSON for bulk registry updates.
- [ ] **Operational guardrails:** Add optional rate-limiting / API-key protection for public-facing deployments.

## Low Priority

- [ ] **Codebase docs sweep:** Add targeted JSDoc for high-complexity modules (`server/src/index.js`, logger helpers, admin data hooks).
- [ ] **UI polish backlog:** Add compact badges for asset-only plugin entries and heartbeat health-state chip for at-a-glance triage.

## ETC

- [ ] Verify wordpress.org URLs when auto-filling on the create plugin forms and update plugin forms. Same for themes
- [ ] Add Keyboard shortcuts to enhance navigation
