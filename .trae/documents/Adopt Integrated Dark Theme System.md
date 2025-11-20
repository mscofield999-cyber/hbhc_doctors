## Objectives
- Replace ad‑hoc dark tweaks with a fully integrated, accessible dark theme across all surfaces and components.
- Use a modern, token‑driven design system with predictable contrast and elevation.

## Research‑Backed Principles
- WCAG contrast: maintain ≥4.5:1 for body text, ≥3:1 for large text and UI glyphs.
- Material/Fluent patterns: darker backgrounds with readable surface steps; elevation uses subtle luminance and shadow rather than pure black; primary accents remain saturated but adjusted for dark.
- CSS variables with semantic tokens: map components to tokens, not raw colors.

## Design Tokens (Light + Dark)
- Core semantic tokens (examples):
  - Background: `--bg`
  - Surface/card: `--surface-1`, `--surface-2` (deeper charcoal for elevated panels)
  - Text: `--text`, `--muted`, `--inverse-text`
  - Border: `--border`
  - Focus ring: `--ring`
  - Brand: `--brand-primary`, `--brand-primary-weak`
  - Success/Info/Danger: `--success`, `--info`, `--danger`
- Dark palette target values (baseline):
  - `--bg: #0b1220`, `--surface-1: #0f172a`, `--surface-2: #111827`
  - `--text: #e5e7eb`, `--muted: #94a3b8`, `--inverse-text: #0b1220`
  - `--border: #1f2937`, `--ring: #60a5fa`
  - `--brand-primary: #3b82f6`, `--brand-primary-weak: #60a5fa`
- Elevation steps:
  - 0: bg, 1: card, 2: modal/menus, 3: sticky bars → progressively lighter shadows and slightly lighter surface tint.

## Theming Architecture
- Body class: `theme-dark` toggled by `Theme Mode` (light/dark/system) and `prefers-color-scheme`.
- All components consume tokens:
  - Buttons: neutral, primary, success, danger variants pull from tokens with dark‑specific gradients.
  - Inputs/selects, `.row.smooth`, chips, tables, menus/kebabs, nav toggle, view select.
  - Charts/bars: use brand tokens and adjust track fills for dark.
- High contrast mode remains compatible, layering on top of dark.

## Component Mapping (Key Updates)
- Buttons:
  - Neutral: charcoal gradient + subtle border; text `--text`; hover uses slightly lighter surface.
  - Primary: brighter blue gradient (weak→primary); ensure focus ring visible on dark.
- Tables:
  - Header banding `rgba(255,255,255,0.06)`; odd rows `rgba(255,255,255,0.03)`; hover `rgba(255,255,255,0.05)`.
- Inputs/selects:
  - Dark surface gradient + inner light shadow; placeholder uses `--muted`.
- Chips/pills:
  - Base `--surface-2`; selected state brand ring `--ring` with light text.
- Menus/kebab:
  - Surface `--surface-2`; hover `rgba(255,255,255,0.06)`.
- Bars/KPI:
  - Track `rgba(255,255,255,0.12)`; fill gradient brand → success.

## Implementation Plan
1. Introduce token set in `:root` and `body.theme-dark` (add `--surface-*` and semantic variants).
2. Refactor styles to consume tokens instead of hardcoded colors:
   - Buttons, inputs, selects, chips, tables, nav/menu, `.row.smooth`, KPI, bars.
3. Normalize typography for dark: headings stay light; muted labels use `--muted`.
4. Ensure focus-visible rings and keyboard navigation meet contrast.
5. Keep print styles light; avoid applying dark to `@media print`.
6. Wire Theme Mode selector (already present) to use tokens consistently.

## Rollout & Verification
- Manual checks across sections: Home, Data Entry, Operations, Dashboard, Admin Control.
- Accessibility: contrast audit (≥4.5:1), focus rings on interactive controls.
- Performance: verify no layout thrash from theme switches.

## Deliverables
- Updated design tokens and CSS mappings for dark theme.
- Verified, consistent dark view across all components and pages.
- No change to data or routes; purely visual improvements.

## Optional Enhancements
- Admin palette preview panel (OKLCH/HSLA sliders) to fine‑tune brand accent safely.
- Auto tint of charts based on brand tokens with accessible thresholds.