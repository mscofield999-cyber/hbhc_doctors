## Goal
Create a new “Vacations Analysis” card on the Key Metrics dashboard that summarizes vacation data using existing filters and UI components.

## Data Sources
- Use `filteredVacations` in `DashboardPage` (already respects hospital/department filters).
- Reuse existing helpers (today coverage, `approvedVacationDays`).

## Metrics To Show
1. Summary KPIs (top of the card):
- Approved Requests: count of `filteredVacations` with `status === 'approved'`
- Requested Pending: count of `status === 'requested'`
- Denied Requests: count of `status === 'denied'`
- Approved Vacation Days: reuse `approvedVacationDays`

2. Type Breakdown (bars):
- Annual, Sick Leave, Emergency Leave, Maternity Leave — bars showing total approved days per type
- Bar `value`: approved days for the type
- Bar `max`: sum of approved days across all types (for percentage visualization)

3. Status Breakdown (bars):
- Requested vs Approved vs Denied — simple counts
- Bar `value`: count per status
- Bar `max`: total requests

4. Upcoming Window (optional small list):
- Next 30 days: list total approved vacation days and count of doctors with approved leave in the window

## UI Implementation
- Place new card under the existing Metrics card section (`dashboardActive === 'metrics'`), after the KPI grid.
- Use existing `KPI` and `Bar` components:
- `KPI`: `<KPI label="Approved Requests" value={approvedCount} />` etc.
- `Bar`: `React.createElement(Bar, { label: 'Annual', value: annualDays, max: allApprovedDays })`
- Layout: one card, grid with two columns for the bar sections; KPIs row at the top inside the card.

## Computation Details
- `approvedCount`: `filteredVacations.filter(v => v.status === 'approved').length`
- `requestedCount`: `filteredVacations.filter(v => v.status === 'requested').length`
- `deniedCount`: `filteredVacations.filter(v => v.status === 'denied').length`
- `daysFor(v)`: inclusive days `(new Date(v.end_date) - new Date(v.start_date)) / (msPerDay) + 1`
- Approved days by type: sum `daysFor(v)` for `status === 'approved'` grouped by `v.type` (‘annual’, ‘sick_leave’, ‘emergency’, ‘maternity_leave’)
- `allApprovedDays`: sum across all approved vacations
- Upcoming window (optional): filter approved where date range overlaps `[today, today + 30]`, compute total days overlapping and distinct doctor count

## Styling & Accessibility
- Reuse `.card`, `.kpi-grid`, and `Bar` semantics; matches existing style and responsive behavior.
- Labels: consistent capitalization with existing types.

## Verification
- Validate counts and days by comparing against the Vacations page list for the same filters.
- Sanity-check `max` values on bars to ensure percentages behave correctly.

## Next Step
On approval, I will implement in `DashboardPage`:
- Compute aggregates from `filteredVacations`
- Render the new Vacations Analysis card with KPIs and bars
- Keep code style consistent and avoid new dependencies