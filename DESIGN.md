---
name: WP JSON Discovery
description: Dark-first investigative tooling for WordPress surface discovery.
colors:
  ink: "#e6edf7"
  ink-dark: "#c7d3e5"
  ink-strong: "#f2f7ff"
  ink-muted: "#aebcd2"
  ink-soft: "#8b9bb3"
  ink-pale: "#6f809a"
  surface: "#111827"
  surface-muted: "#0f172a"
  surface-strong: "#1b2437"
  surface-tint: "#1a2233"
  surface-elevated: "#202b41"
  border: "#2f3b53"
  border-strong: "#445779"
  border-soft: "#37455f"
  primary: "#60a5fa"
  primary-strong: "#3b82f6"
  accent: "#22d3ee"
  primary-light: "#7dd3fc"
  success-bg: "#0f2a21"
  success-border: "#1f6a56"
  success-text: "#4ade80"
  info-bg: "#102338"
  info-border: "#244f7a"
  warning-bg: "#35240f"
  warning-border: "#7b4a1f"
  warning-text: "#fb923c"
  danger-bg: "#31151d"
  danger-soft: "#2a1219"
  danger-border: "#7a2a3b"
  danger-border-strong: "#8f3247"
  danger-strong: "#fb7185"
  danger-deep: "#fecdd3"
  indigo-bg: "#1d2342"
  indigo-border: "#3f4a8a"
  indigo-text: "#c7d2fe"
  indigo-strong: "#818cf8"
  sidebar-bg: "#0b1220"
  sidebar-text: "#d9e4f5"
  sidebar-muted: "#95a7c2"
  input-bg: "#121c2d"
  input-bg-soft: "#111a2a"
  input-border: "#3b4c67"
  input-border-hover: "#5d7498"
  input-border-focus: "#60a5fa"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "2.4rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  caption:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  control: "10px"
  md: "12px"
  lg: "16px"
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
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  text-input:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  select-input:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px 28px"
  card-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px 28px"
  card-error:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px 28px"
  sidebar:
    backgroundColor: "{colors.sidebar-bg}"
    textColor: "{colors.sidebar-text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  status-badge-neutral:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success-text}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning-text}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-strong}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-badge-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

## Overview
This is a dark-first investigative interface for WordPress surface discovery. It is used in a dim, focused working context, so the UI should read like an analysis console, not a marketing site.

The current system is dense but orderly: a single app shell, a sticky sidebar, card-based scan results, and compact data surfaces that support rapid comparison.

## Colors
The palette is built around deep navy surfaces, pale ink text, and a blue-led accent range with cyan support. Primary interaction color is `#60a5fa`, with `#22d3ee` reserved for reinforcing active states and selected navigation.

Surfaces layer from `surface-muted` through `surface-elevated`, while borders stay cool and restrained to preserve legibility in crowded panels.

Semantic colors are present for success, info, warning, and danger states. They are used for state and status, not decoration.

## Typography
Inter is the single family across the interface. Hierarchy comes from scale and weight, not font switching.

The display size is used sparingly for the app title, while body copy stays compact and readable for long investigative sessions. Labels and captions are tighter and more emphatic for metadata, badges, and section titles.

Keep body copy to a readable measure, especially in prose-like panels and explanatory states.

## Elevation
Depth is subtle and functional. Cards and the page shell use soft shadows, not dramatic lifts, and the sidebar sits one layer apart from content to clarify navigation without becoming a separate world.

Use shadow changes to indicate hierarchy, not motion or drama. Focus states are handled with rings and border color shifts, not glow effects.

## Components
The core vocabulary is consistent across the app: `button` with `primary`, `secondary`, and `ghost` variants, `text-input`, `select-input`, `card`, `sidebar`, and `status-badge`.

Buttons are compact, rounded controls with small/medium/large sizes, and they should stay visually familiar across views. Inputs use the same rounded control shape and a clear focus ring for keyboard users.

Cards are the main content container, with info and error variants for inline status. Status badges are pill-shaped and tone-specific, used for scan outcomes and summary states.

Navigation is built from a sticky sidebar and a top-level page switcher. Active states are obvious, disabled states stay subdued, and the hierarchy should remain scannable at a glance.

## Do's and Don'ts
Do keep the interface dark, compact, and inspection-friendly.

Do preserve the existing component vocabulary, spacing rhythm, and status colors when adding new screens.

Do use clear focus rings, readable contrast, and restrained motion.

Don't introduce decorative flourishes that slow scanning or compete with data.

Don't add new surface styles unless they solve a real hierarchy problem.

Don't turn the app into a brochure, and don't let any single accent color dominate outside active state.
