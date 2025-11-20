## Goals
- Finish integrated, token‑driven dark theme across all components
- Ensure WCAG contrast and consistent elevations for a modern look

## Token Foundation
- Expand tokens: `--surface-1`, `--surface-2`, `--inverse-text`, `--brand-primary-weak`
- Verify dark palette across backgrounds, surfaces, borders, rings

## CSS Refactor Targets
- Map surfaces
  - Topbar, dropdowns, kebabs → `--surface-2`
  - Cards, panels, grids → `--surface-1`
- Buttons
  - Neutral: charcoal gradient + subtle border; light text
  - Primary: brighter gradient (`weak → primary`); strong focus ring
  - Approve/Deny: vivid gradients for dark
- Forms/Filters
  - `.row.smooth`, inputs, selects: dark gradients, inner light shadows; placeholders `--muted`
- Chips/Pills
  - Base `--surface-2`; selected ring `--ring` and light text
- Tables
  - Header `rgba(255,255,255,0.06)`, odd rows `rgba(255,255,255,0.03)`, hover `rgba(255,255,255,0.05)`
- KPI/Bars
  - Track `rgba(255,255,255,0.12)`; fill brand → success
- Print
  - Keep print styles light; no dark overrides in `@media print`

## JS Theme Application
- Keep Theme Mode (light/dark/system) and `prefers-color-scheme` support
- Ensure high‑contrast layering works over dark

## Verification
- Manual checks across Home, Data Entry, Operations, Dashboard, Admin Control
- Contrast audit: text ≥4.5:1; large text/UI glyphs ≥3:1
- Focus-visible rings across all controls
- Confirm no layout thrash when switching theme

## Deliverables
- Updated tokens and CSS mappings for modern dark theme
- Consistent visuals and accessibility across all pages