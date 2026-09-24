# Brand foundations

Visual specimen: [`wp-json-discovery-foundations.png`](./wp-json-discovery-foundations.png)  
Implementable CSS: [`tokens.css`](./tokens.css)

Dark-first investigative utility. Do not introduce purple glow, marketing gradients, or light-first defaults for the investigator shell.

## Color

| Token | Hex | Role |
|-------|-----|------|
| `charcoal` | `#0B0C0E` | Canvas / app background |
| `panel` | `#14161A` | Raised surface |
| `cream` | `#E8E4DC` | Primary text / logo |
| `steel` | `#8B9099` | Muted text / borders / queued |
| `signal` | `#5EB8C4` | Accent, focus, running |
| `ember` | `#C97B6B` | Warm accent / success chip |

**Semantic map:** text → cream · muted → steel · accent → signal · warm → ember · border → steel @ ~28% · focus ring → signal

## Type

- **Sans:** IBM Plex Sans Variable (already in `frontend/src/fonts.css`)
- **Mono:** IBM Plex Mono — status chips, URLs, commands
- **Ramp:** 12 / 14 / 16 / 20 / 28 / 40 → `xs` … `2xl`

## Radius

`none` 0 · `sm` 4 · `md` 8 · `lg` 12

Prefer `sm`/`md` for controls; avoid pill-heavy chrome.

## Spacing

4 · 8 · 12 · 16 · 24 · 32 · 48 → `space-1` … `space-7`

## Surfaces

1. **canvas** — charcoal  
2. **panel** — panel + 1px soft steel border  
3. **well** — slightly darker inset (`#0E1013`)

Elevation is border + value shift, not multi-layer drop shadows.

## Motion

- Fast UI: 120–200ms ease-out  
- **Pulse only** on `RUNNING` capability chips  

## Related boards

- Identity: `wp-json-discovery-brandkit.png`
- Compact concept: `wp-json-discovery-concept-2x2.png`
- UI direction: `wp-json-discovery-ui-direction.png`
