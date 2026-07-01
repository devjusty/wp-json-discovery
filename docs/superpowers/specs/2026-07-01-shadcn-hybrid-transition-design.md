# shadcn Hybrid Transition Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt shadcn/ui across the frontend without a flag day, keeping existing atomic imports stable while migrating high-value screens and primitives toward shadcn-backed components.

**Architecture:** Treat `frontend/src/components/ui/` as the new source of truth for reusable UI primitives. Keep the current atomic components as compatibility wrappers during the transition, but make those wrappers as thin as possible so they only preserve the existing API and styling contract. New work should use shadcn components directly when it fits the screen, while existing screens migrate one surface at a time. The first migration targets the dense, interaction-heavy admin experience because that is where shadcn provides the most value: better dialogs, tables, badges, tooltips, separators, and form controls with less custom markup.

**Tech Stack:** React, Vite, existing frontend CSS tokens, shadcn/ui, hugeicons, React Testing Library, Vitest.

---

## Scope

This is a frontend-wide transition, but it is intentionally medium in depth:
- Preserve the atomic folder structure for now.
- Replace atomic internals with shadcn-backed adapters where that is low risk.
- Migrate the most useful screens first, not every file.
- Avoid behavior changes unless the shadcn primitive clearly improves accessibility or interaction.

## Component Strategy

### Keep as compatibility wrappers

These stay import-stable for the rest of the app while their internals move to shadcn:
- `frontend/src/components/atoms/Button.jsx`
- `frontend/src/components/atoms/Card.jsx`
- `frontend/src/components/atoms/TextInput.jsx`

Recommended mapping:
- `Button` -> shadcn `Button`, with existing `primary` / `secondary` / `ghost` variants mapped to shadcn variants or wrapper aliases.
- `Card` -> shadcn `Card`, `CardHeader`, `CardContent`, `CardFooter` style composition.
- `TextInput` -> shadcn `Input`.

### Add shadcn directly for new work

Use `components/ui/*` directly in new code and in migrated screen slices, instead of adding more atomic wrappers.

## Recommended shadcn Set

Install and standardize these first:
- `card`
- `table`
- `dialog`
- `alert-dialog`
- `badge`
- `separator`
- `tooltip`
- `skeleton`
- `tabs`
- `input`
- `textarea`
- `select`
- `checkbox`
- `switch`
- `dropdown-menu`
- `sheet`
- `popover`
- `command`

Reasoning:
- Tables, dialogs, and form controls cover most admin interactions.
- Badge, separator, tooltip, and skeleton reduce custom utility markup across the app.
- Dropdown, sheet, popover, and command cover the next tier of dense interaction patterns without forcing custom composites.

## Migration Order

### Phase 1: Foundation

1. Add shadcn primitives and wire them into `components/ui`.
2. Convert the current atomic wrappers to thin shadcn adapters.
3. Keep public imports unchanged so existing screens do not break.

### Phase 2: High-value admin surfaces

Migrate the admin screens that currently do the most layout and interaction work:
- plugin manager
- unsupported namespace table
- supported plugin/theme registries
- logs / activity surfaces
- recent asset and scan history panels

Expected wins:
- cleaner table composition
- better modal accessibility
- consistent badges and empty states
- more durable loading states

### Phase 3: Shared shell and general app surfaces

Move the broader frontend shells when the foundation is stable:
- page headers and cards
- navigation shell
- settings-like panels
- any recurring filter or action row patterns

## Non-Goals

- No full rewrite of the atomic design tree in one pass.
- No wholesale visual redesign.
- No behavior changes unrelated to the component migration.
- No migration of every custom utility class if the current UI is already stable.

## Testing Strategy

Each migration slice should cover:
- RTL tests for dialog open/close, table actions, and form submission.
- Accessibility checks for dialog titles, button labels, and focus behavior.
- `pnpm --filter frontend run build` after each meaningful slice.
- `pnpm --filter frontend run lint` after wrapper and screen updates.

## Success Criteria

- Existing atomic imports keep working during the transition.
- New frontend work can use shadcn directly.
- The admin experience uses shadcn primitives for the most interaction-heavy UI.
- The codebase is clearly moving from atomic composition toward shadcn-backed components without breaking current screens.
