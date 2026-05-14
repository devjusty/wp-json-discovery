# Phase 1: Scan Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 1-Scan Core
**Areas discussed:** Scan landing state

---

## Scan landing state

| Option | Description | Selected |
|--------|-------------|----------|
| Stay inline | Keep the current single-page flow: form at the top, then inline results below with a compact WordPress verdict and evidence summary. | |
| Result first | Shift focus to the result panel after submit and reduce secondary chrome like recent domains while the scan is active. | ✓ |
| Staged reveal | Show an immediate verdict banner first, then expand deeper evidence sections underneath once the scan completes. | |

**User's choice:** Result first
**Notes:** The user then narrowed this to a dedicated results view, not the current inline shell, and said the view should be minimal proof-first.

---

## the agent's Discretion

- View composition, component reuse, routing mechanics, and how secondary scan controls are de-emphasized in the dedicated view.

## Deferred Ideas

- WordPress proof threshold and which exact signals constitute a confident "appears to be WordPress" verdict.
- How much raw route/core collection data should remain visible versus summarized.
- Auth-restricted, unreachable, and non-WordPress failure-state wording and treatment.
- Whether homepage HTML/source clues should be promoted into Phase 1 or remain a Phase 2 concern.
