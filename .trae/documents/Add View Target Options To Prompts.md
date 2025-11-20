## Goal
Add an explicit option in all prompts to choose the target view: desktop, mobile, or both, with conditional requirements and acceptance criteria.

## Changes
- Introduce a "View Target" control: `desktop | mobile | both`.
- Adjust deliverables and success criteria per chosen view.
- Keep RTL, accessibility, and print guidance intact.

## Updated Prompt Inserts
### Design Prompt Insert
- View Target: desktop | mobile | both
- If desktop: prioritize wide KPI grid, multi-column cards, hover affordances.
- If mobile: prioritize stacked layout, dropdown nav under Menu, single-column cards, touch targets ≥ 44px, reduced text wrapping.
- If both: provide separate Figma frames for desktop and mobile with responsive rules and breakpoints (e.g., 1200px, 800px).

### Engineering Prompt Insert
- View Target: desktop | mobile | both
- Desktop-specific: auto-fit KPI grid (`minmax(240px, 1fr)`), side-by-side charts, larger gutters.
- Mobile-specific: dropdown menu under toggle, stacked KPIs/cards, single-column lists, ensure `white-space: nowrap` where needed.
- Both: implement responsive CSS with media queries (e.g., `max-width: 800px`); verify LTR/RTL for each view.

### QA/Review Prompt Insert
- View Target: desktop | mobile | both
- Desktop checks: multi-column layouts, hover states visible, keyboard navigation.
- Mobile checks: dropdown opens under toggle, single-column, touch target sizes, no horizontal scroll.
- Both: breakpoint behavior validated; content legibility preserved; RTL alignment verified in each view.

### Executive Brief (One-Liner)
“Design and implement HBHC Doctors UI targeted for [desktop|mobile|both] with responsive layouts, accessible nav dropdown, clear KPIs/charts, RTL support, and print-friendly reports.”

## Next
On approval, I will deliver the revised full prompts with the View Target option integrated across Design, Engineering, QA, and Executive Brief.