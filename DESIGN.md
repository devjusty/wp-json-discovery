---
name: WP JSON Discovery
description: Shadcn-based investigative tooling for WordPress surface discovery.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.148 0.004 228.8)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.148 0.004 228.8)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.148 0.004 228.8)"
  primary: "oklch(0.488 0.243 264.376)"
  primary-foreground: "oklch(0.97 0.014 254.604)"
  secondary: "oklch(0.967 0.001 286.375)"
  secondary-foreground: "oklch(0.21 0.006 285.885)"
  muted: "oklch(0.963 0.002 197.1)"
  muted-foreground: "oklch(0.56 0.021 213.5)"
  accent: "oklch(0.963 0.002 197.1)"
  accent-foreground: "oklch(0.218 0.008 223.9)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.925 0.005 214.3)"
  input: "oklch(0.925 0.005 214.3)"
  ring: "oklch(0.723 0.014 214.4)"
  chart-1: "oklch(0.809 0.105 251.813)"
  chart-2: "oklch(0.623 0.214 259.815)"
  chart-3: "oklch(0.546 0.245 262.881)"
  chart-4: "oklch(0.488 0.243 264.376)"
  chart-5: "oklch(0.424 0.199 265.638)"
  radius: "0"
  sidebar: "oklch(0.987 0.002 197.1)"
  sidebar-foreground: "oklch(0.148 0.004 228.8)"
  sidebar-primary: "oklch(0.546 0.245 262.881)"
  sidebar-primary-foreground: "oklch(0.97 0.014 254.604)"
  sidebar-accent: "oklch(0.963 0.002 197.1)"
  sidebar-accent-foreground: "oklch(0.218 0.008 223.9)"
  sidebar-border: "oklch(0.925 0.005 214.3)"
  sidebar-ring: "oklch(0.723 0.014 214.4)"
typography:
  display:
    fontFamily: "IBM Plex Sans Variable, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans Variable, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans Variable, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "IBM Plex Sans Variable, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  caption:
    fontFamily: "IBM Plex Sans Variable, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.02em"
  monospace:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "0.92rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  control: "0px"
  md: "0px"
  lg: "0px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  text-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  select-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "24px 28px"
  card-info:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "24px 28px"
  card-error:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "24px 28px"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
    rounded: "{rounded.md}"
    padding: "16px"
  status-badge-neutral:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-success:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-warning:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-danger:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-info:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

## Overview
This is an investigative WordPress surface discovery tool built on shadcn-style UI primitives and a tokenized theme layer.

The frontend should feel familiar to users of modern product tools: compact, predictable, and easy to scan under sustained analysis work.

The current system is dense but orderly: a single app shell, sticky navigation, card-based results, and compact data surfaces that support rapid comparison.

## Colors
The source of truth is `frontend/src/theme.css`, which defines the shadcn theme tokens in OKLCH for both light and dark modes.

The default system is restrained: neutral backgrounds, a single primary accent for key actions, and semantic tokens for secondary, muted, destructive, and sidebar surfaces.

Color should communicate hierarchy and state, not decorate inert surfaces. If a token is not helping scanning or action recognition, it should not be emphasized.

## Typography
IBM Plex Sans Variable is the single family across the interface, with system fallbacks only as backup. Hierarchy comes from scale and weight, not font switching.

The display size is used sparingly for the app title and major page headers, while body copy stays compact and readable for long investigative sessions. Labels and captions are tighter and more emphatic for metadata, badges, and section titles.

Keep body copy to a readable measure, especially in prose-like panels and explanatory states.

## Monospace
IBM Plex Mono is the monospace companion for code, paths, inline references, diffs, and structured output. Use it where fixed-width alignment helps scanning or comparison.

Keep monospace usage deliberate and local. It should support analysis, not become the default voice of the interface.

## Elevation
Depth is subtle and functional. Cards and panels should feel like standard shadcn surfaces, with focus states carrying more weight than heavy shadow styling.

Use shadow changes to indicate hierarchy, not motion or drama. Focus states are handled with rings and border color shifts, not glow effects.

## Components
The core vocabulary is shadcn-aligned and intentionally familiar: buttons, inputs, cards, sheets, tooltips, tables, and badges.

Buttons are compact controls with size and variant differences, not custom shapes. Inputs, selects, and other controls should share the same token language and focus behavior.

Cards are the main content container, with inline status, header actions, and dense metadata patterns where needed. Status badges are pill-shaped and tone-specific, used for scan outcomes and summary states.

Navigation is built from sticky shell navigation and page-level switches. Active states are obvious, disabled states stay subdued, and the hierarchy should remain scannable at a glance.

The theme file also establishes the token contract for future shadcn components. If a component needs a new visual treatment, prefer extending the token layer over hard-coding fresh colors or radii.

## Do's and Don'ts
Do keep the interface compact, inspection-friendly, and consistent with the shadcn token system.

Do preserve the existing component vocabulary, spacing rhythm, and status semantics when adding new screens.

Do use clear focus rings, readable contrast, and restrained motion.

Don't introduce decorative flourishes that slow scanning or compete with data.

Don't add new surface styles unless they solve a real hierarchy problem.

Don't turn the app into a brochure, and don't let any single accent color dominate outside active state.
