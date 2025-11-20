## Current Findings
- Vacations section renders with hospital → department → doctor cascading inputs; department select is disabled until a hospital is chosen.
- Doctors list is very long and not searchable, which affects usability.
- Selected date range shows, but there’s no validation or feedback for invalid ranges or overlaps with existing approved vacations.
- Vacation types include annual, emergency, sick_leave; maternity leave isn’t listed.
- Actions allow request add and status update (approve/deny) but lack edit/delete.
- Code locations to modify:
  - Vacations component: `app.jsx:1187–1251`
  - Doctor filtering helpers used here: `app.jsx:1209–1227`

## Planned Improvements
### UX
- Enable department select when a hospital is chosen; auto-populate only departments for the selected hospital.
- Add a search input above Doctor select to filter visible doctors by name (subsequence match with Arabic/Latin-safe normalization).
- Show selected date range with inclusive day count and color-coded hints (valid/invalid).
- Add “Maternity Leave” option to Type of Vacation.

### Validation & Consistency
- Prevent submit when end date < start date; show toast message.
- Prevent zero-length or negative durations.
- Prevent overlapping approved vacations for the same doctor (warn and block add).
- Ensure hospital/department filter coherence: only doctors from the selected hospital/department can be chosen.

### Data & Actions
- Keep using `store.write('vacations', next)` so changes persist and mirror to Firebase.
- Add “Remove” and “Edit” actions for vacation requests; allow changing dates/type/status before approval.
- Keep approve/deny buttons; show toast confirmations.

### Performance & Accessibility
- Limit doctor options to first N results until user searches; improves performance for large lists.
- Ensure RTL attributes are preserved for Arabic names; use `dir="auto"` on inputs.
- Keyboard navigation and focus handling for selects and search input.

## Implementation Outline
- In `Vacations` (`app.jsx:1187–1251`):
  1) Add `doctorQuery` state; filter `visibleDoctors` by subsequence match on name.
  2) Add `isValidRange(start, end)` and `overlapsExisting(doctorId, start, end)` helpers; block add with toasts.
  3) Add `maternity_leave` to the Type select.
  4) Update department options to enable once a hospital is selected; keep current filtering by `hospital_id`.
  5) Add Edit/Remove per vacation row; on edit, update local state and `store.write`.
  6) Keep Firebase mirroring via existing store and subscriptions (already present at `app.jsx:3530`).

## Verification Steps
- Select a hospital → department enables and lists only that hospital’s departments.
- Type characters in doctor search to quickly narrow the list; selection restricted to hospital/department.
- Add a vacation with valid range; toast confirms; an overlapping vacation is blocked.
- Approve/deny updates are reflected immediately; edit/remove behave correctly.
- Refresh page → changes persist (localStorage + Firebase).

## Next Actions
- With your confirmation, I will implement these changes in `app.jsx` (Vacations component), verify them locally, and push to GitHub. 