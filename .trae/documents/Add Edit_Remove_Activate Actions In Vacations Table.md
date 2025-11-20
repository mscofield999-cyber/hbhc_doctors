## Scope
- Add action buttons to the Vacations table `td` (Actions column): Edit, Remove, Activate.
- Keep existing rule: when status is `approved`, do NOT show Activate (Approve) or Deny.

## Implementation
- In `Vacations` component (`app.jsx:1245–1251`):
  - Replace the Actions `td` with three buttons:
    - Edit: opens simple prompts for start/end/type and saves after validation.
    - Remove: confirms and deletes the vacation.
    - Activate: sets status to `approved`.
  - Conditional rendering:
    - Hide Activate and Deny when `String(v.status || '').trim().toLowerCase() === 'approved'`.
- Add validations reused from earlier logic:
  - End date on/after start date.
  - No overlap with existing approved vacations for the same doctor (exclude self when editing).
- Reuse existing helper handlers:
  - `updateStatus(id, nextStatus)` for Activate.
  - Inline `saveEdit` via prompts.
  - Remove via filtering and `store.write`.

## UX Notes
- Prompts are lightweight and consistent with current UI.
- Buttons use existing classes: `btn`, `btn-approve`, `btn-deny`.

## Verification
- Add a vacation; check Actions show Edit/Remove/Activate.
- Activate: status changes to `approved` and Approve/Deny disappear.
- Edit: change dates/type; invalid ranges or overlaps are blocked.
- Remove: confirm deletion; row disappears.

## Next
- After your confirmation, I will implement the changes and verify on `#/operations` → Vacations.