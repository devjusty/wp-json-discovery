# WP JSON Discovery

## What This Is

An internal WordPress investigation tool for researching, auditing, and inspecting sites. It helps with competitor research and client-site audits by surfacing public WordPress evidence, plugin/theme clues, SEO signals, and rendered HTML/source indicators quickly.

## Core Value

Give a fast, trustworthy read on what a WordPress site is exposing publicly so investigators can make decisions quickly.

## Requirements

### Validated

- User can submit a domain and inspect a site through the existing scan flow.
- User can review past scans and revisit prior results.
- Admin can review unsupported namespace and log signals to improve coverage.

### Active

- [ ] Surface wp-json evidence in a single investigative view.
- [ ] Highlight plugin and theme clues from public signals.
- [ ] Present SEO and source/HTML indicators alongside scan output.

### Out of Scope

- Authenticated crawling or private-site access — the tool is focused on public evidence.
- General web monitoring and alerting — the goal is investigation, not ongoing surveillance.
- Non-WordPress CMS profiling — keep the scope centered on WordPress.

## Context

- Existing stack: Express proxy/server plus Vite + React frontend.
- Existing product shape already includes scan, history, and admin workflows.
- The product is used internally, so clarity, speed, and dense evidence presentation matter more than promotional polish.

## Constraints

- **Tech stack**: Preserve the current JavaScript-only server/frontend structure — avoid unnecessary rewrites.
- **Scope**: Focus on public WordPress surface area — no credentialed access assumptions.
- **UX**: Prioritize fast scanning and easy comparison of evidence for researchers and auditors.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Internal WordPress research/audit tool | Matches the user's primary workflow and current product direction | — Pending |
| Vertical MVP delivery | End-to-end value is more useful than isolated technical layers | — Pending |
| Public-surface inspection only | Keeps scope realistic for competitor research and client audits | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after project initialization*
