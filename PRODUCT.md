# Product

## Register

product

## Users
WP JSON Discovery serves mixed WordPress practitioners: developers, marketers, security analysts, SEO researchers, and designers. They use it as an internal investigative utility to quickly profile a domain and extract actionable clues from public surfaces.

Primary job-to-be-done: enter a domain and rapidly understand what the site is running and exposing, including plugin/theme signals, SEO structure, rendered HTML/source indicators, and public `wp-json` evidence.

## Product Purpose
The product helps users inspect a WordPress site quickly and confidently, surfacing the signals that matter for analysis, research, and triage.

Success means the interface makes deep inspection feel fast, legible, and trustworthy, without adding noise or unnecessary ceremony.

## Interface Direction
The frontend now builds on shadcn-style primitives and tokenized theme CSS as the shared UI foundation.

That means the product should feel familiar to users of modern investigative tools: compact controls, predictable form elements, clear state handling, and dense information surfaces that stay easy to scan.

The UI system should be treated as a product asset, not just a styling layer. Consistency across buttons, inputs, cards, tables, sheets, and status indicators matters more than decorative distinction.

## Brand Personality
The product should feel intelligent, whimsical, and elegant.

Emotional target: investigative focus. The interface should support deep inspection without feeling noisy or heavy.

Because this is an internal tool, design should prioritize function, intuitiveness, and performance over promotional presentation.

## Anti-references
Avoid marketing-style visual treatments and decorative flourishes that hurt usability or scanning speed.

Avoid surfaces that feel noisy, over-decorated, or heavy when the user needs to scan and compare results.

## Design Principles
1. Investigative clarity first, prioritize fast signal extraction, strong hierarchy, and obvious data grouping.
2. Functional elegance, keep components refined and polished, but optimized for utility and speed.
3. Familiarity over novelty, use shadcn conventions and standard affordances so the UI disappears into the task.
4. Intelligent whimsy, used sparingly, introduce personality only where it does not compete with analysis tasks.
5. Theme discipline, keep colors, radius, and elevation aligned to the tokenized theme layer rather than ad hoc one-off styling.
6. Keyboard-first navigation, every primary action and section path should be reachable and understandable without a mouse.

## Accessibility & Inclusion
Maintain clear focus states, readable contrast, and keyboard-first interaction patterns.

Keep motion restrained and respect reduced-motion preferences when animated affordances are added.

Treat shadcn component defaults as the baseline for accessibility, then refine only where the investigative workflow needs denser information or clearer hierarchy.
