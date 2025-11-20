## Target Components
- Tabs: `.tab-chip` default/hover/selected, focus-visible
- KPI tiles: `.kpi.card`, `.kpi .value`, `.kpi .label`
- Bars: `.bar-track`, `.bar-fill` using brand→success tokens

## CSS Changes
- Tabs
  - Add `.theme-dark .tab-chip { background: linear-gradient(180deg, #1f2937 0%, #0f172a 100%); color: var(--text); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.40); }`
  - Add `.theme-dark .tab-chip.selected { background: linear-gradient(180deg, rgba(96,165,250,0.15) 0%, rgba(96,165,250,0.25) 100%); box-shadow: inset 0 0 0 1px var(--ring), 0 4px 12px rgba(0,0,0,0.45); }`
  - Ensure `.tab-chip:focus-visible { box-shadow: 0 0 0 2px var(--ring); }`
- KPI tiles
  - Set `.kpi.card { background: var(--surface-1); }`
  - Keep `.kpi .value { color: var(--text); }` and `.kpi .label { color: var(--muted); }`
- Bars
  - Confirm dark track: `.theme-dark .bar-track { background: rgba(255,255,255,0.12); }`
  - Ensure fill uses tokens: `.bar-fill { background: linear-gradient(90deg, var(--brand-primary), var(--success)); }`

## Verification
- Open Dashboard and Admin Control tabs; inspect tabs, KPI, and bars under Dark/Light/System.
- Check focus-visible ring on tabs via keyboard.
- Confirm contrast of KPI labels and values meets WCAG thresholds.

## Scope
- Pure CSS token mapping; no route or data changes. After approval, I will implement these edits and test across sections.