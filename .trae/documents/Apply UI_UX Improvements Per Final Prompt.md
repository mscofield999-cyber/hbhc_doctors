## Scope
Apply the final prompt’s UI/UX changes to the app, covering navigation, dashboard KPIs/charts, vacations modals, confirmations, RTL/accessibility, and print reports — with responsive behavior for desktop/mobile.

## Implementation Plan
### 1) Navigation
- Add/confirm left-aligned “Menu” toggle
- Dropdown opens below the toggle; width fits longest link; single-column links
- Update `aria-expanded` on toggle; keyboard focus order and Esc to close
- RTL: mirror alignment; dropdown anchors to appropriate edge

### 2) Dashboard
- KPI tiles: value 34px; label 13px; grid auto-fit (`minmax(240px, 1fr)`); spacing and card layout
- Doctors per Hospital: bars show counts; animate width; label clarity
- Departments per Hospital: convert to count list with chips (no percentages)
- Vacations Analysis: add “Now on Vacation”, “Avg Days / Approved”; show type averages as bars; animate width
- Reorder cards: KPIs → Doctors/Hospital → Departments/Hospital → Vacations Analysis → Top‑5 → Duty Distribution

### 3) Operations (Duties/On‑Call)
- Assignment panel layout refinements; add/remove controls clearer; chips; disabled states
- Add confirmations for removing duty assignments/on‑call chips
- Tooltips for on‑call names remain legible

### 4) Vacations
- Requests table shows Days and Type
- Replace browser prompts with modal for editing; validate date ranges
- Delete via modal confirmation; status actions: requested → Approve/Deny; approved → Edit/Delete

### 5) Print Reports
- Duties/On‑Call/Vacation Plans: signature font ~17px bold
- Increase spacing: margin‑top ~32px; signatures sit two lines below tables
- Section titles readable; table spacing adequate; no clipped content

### 6) Accessibility & RTL
- Focus‑visible rings on interactive elements
- Keyboard navigation for dropdowns and modals; `aria‑expanded` states
- AA contrast for text and muted labels
- RTL mirror checks for nav, chips, labels

### 7) Responsive Target (Desktop/Mobile/Both)
- Desktop: multi‑column cards; hover affordances; gutters
- Mobile: stacked cards; touch targets ≥ 44px; `white‑space: nowrap` where needed; avoid horizontal scroll
- Both: implement media queries (e.g., `max‑width: 800px`); verify breakpoints

### 8) Validation
- Manual checks: desktop, mobile, RTL, print preview
- Accessibility: keyboard nav, focus‑visible, dropdown ARIA
- Visual: KPI sizes, bar animations, list counts, signature spacing

### 9) Delivery & Git Policy
- Prepare changes locally; do not push automatically
- Push only when you say “PUSH”

## Output
- Updated React/CSS implementing the final prompt
- Verified behavior across views and print

## Next Step
On your approval, I will implement these changes in code and verify across desktop/mobile/RTL/print, then await your “PUSH” command.