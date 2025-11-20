## Overview
Adopt a modern, token‑driven dark theme across all surfaces and components, ensuring WCAG contrast and consistent elevation.

## Design Tokens
- Add semantic tokens in `:root` and `body.theme-dark`:
  - Background: `--bg`
  - Surfaces: `--surface-1`, `--surface-2`
  - Typography: `--text`, `--muted`, `--inverse-text`
  - UI: `--border`, `--ring`, `--brand-primary`, `--brand-primary-weak`, `--success`, `--info`, `--danger`
- Dark baseline:
  - `--bg: #0b1220`, `--surface-1: #0f172a`, `--surface-2: #111827`
  - `--text: #e5e7eb`, `--muted: #94a3b8`, `--inverse-text: #0b1220`
  - `--border: #1f2937`, `--ring: #60a5fa`, `--brand-primary: #3b82f6`, `--brand-primary-weak: #60a5fa`

## Theming Architecture
- Use `theme-dark` body class from Theme Mode (light/dark/system) and respect `prefers-color-scheme`.
- Keep high-contrast compatible (layered on top of dark tokens).

## Component Mappings
- Buttons:
  - Neutral: charcoal gradient + subtle border; text `--text`; hover slightly lighter.
  - Primary: gradient `--brand-primary-weak` → `--brand-primary`; visible focus ring.
- Tables:
  - Header `rgba(255,255,255,0.06)`, odd rows `rgba(255,255,255,0.03)`, hover `rgba(255,255,255,0.05)`.
- Inputs/Selects/.row.smooth:
  - Dark surface gradient, inner light shadow; placeholders use `--muted`.
- Chips/Pills:
  - Base `--surface-2`, selected shows `--ring` with light text.
- Menus/Kebab/Nav:
  - Surfaces use `--surface-2`; hover `rgba(255,255,255,0.06)`.
- Bars/KPI:
  - Track `rgba(255,255,255,0.12)`; fill brand→success.

## Implementation Steps
1. Define token set (light/dark) including `--surface-*`, typography, and brand.
2. Refactor CSS to consume tokens across:
   - Topbar, dropdowns/menus, cards, buttons (neutral/primary/success/danger), inputs/selects, `.row.smooth`, chips, tables, KPI, bars.
3. Normalize headings and labels (light text, muted labels) in dark.
4. Ensure focus-visible rings across interactive controls meet contrast.
5. Keep print styles light and unmodified.
6. Confirm Theme Mode selector persists and applies tokens consistently.

## Verification
- Manual checks in Home, Data Entry, Operations, Dashboard, Admin Control.
- Contrast audit: body text ≥4.5:1; large text/UI glyphs ≥3:1.
- Performance: no layout thrash on theme switch.

## Optional Enhancements
- Add Admin palette preview (OKLCH/HSLA sliders) for safe brand tuning.
- Auto tint charts using brand tokens with accessible thresholds.

## Next Action
On approval, I will implement token additions and refactors, then validate visually and for accessibility across the app.