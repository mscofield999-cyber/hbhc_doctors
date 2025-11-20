## Suggestions
- Admin Control
  - Add audit logs (user changes, permissions updates, data imports/exports), with filters and CSV export
  - Extend permissions to Operations (Duties/On‑Call) and Dashboard widgets; add per‑section toggles
  - Add user status (active/disabled), last login, force logout, reset password; bulk actions (invite/remove/export)
  - Add role presets and per‑department overrides (e.g., heads can edit only their departments)
- Analytics
  - Trend charts: duties per department/hospital (daily/weekly/monthly), vacation utilization by type, on‑call workload distribution
  - Anomaly flags: over‑assignment, overtime, leave conflicts; drill‑down to impacted doctors/dates
  - Export: CSV and image/PDF for charts
- Operations & Vacations
  - Conflict detection/alerts when assigning (leave overlaps, double bookings)
  - Quick templates for common duty formats; copy week/month; saved assignment sets
  - Vacation quotas per type; approvals with comments, attachments, and audit trail
- UX & Navigation
  - Breadcrumbs in Data Entry; searchable Admin Control cards; saved filters/views
  - Unified mode switch component with consistent behavior; keep Menu toggle visible by policy
  - App Overview: add quick actions (open section, manage permissions, view policies)
- Accessibility & RTL
  - Focus‑trap in modals; ARIA labels on all controls; `prefers‑reduced‑motion` handling
  - Audit contrast tokens; verify RTL mirroring for dropdowns and chips
- Printing
  - Headers/footers with page numbers, report title/date; auto pagination; consistent signature spacing
- Security & Auth
  - Replace demo localStorage tokens with proper auth provider later; add password reset flow
  - Enforce domain policy and min password length via Policies; add 2FA toggle (stub)
- Performance & Testing
  - Virtualize large lists (doctors/departments); debounce search suggests
  - Add unit tests for permission matrix and operations guards; basic e2e flows (login, admin control, data entry)

## Implementation Plan
### 1) Permissions Framework
- Create a central `getPermissions(role)` utility; extend matrix to Operations (assign add/remove/save) and Dashboard widgets
- Wire Data Entry, DutiesDesigner, OnCall, Dashboard to use the utility; remove ad‑hoc checks

### 2) Admin Control Panels
- Add Audit Logs panel (persist to localStorage `audit_logs[]` with action, actor, timestamp, payload)
- Extend Users & Roles with active/disabled, last login, force logout, reset password (placeholder)
- Enhance Permissions panel with sections for Operations and Dashboard; per‑department override UI (scope selector)

### 3) Analytics
- Add charts (bar/line) for duties and vacations over time; per department/hospital; add CSV export and PNG snapshot
- Add anomaly summary (over‑assignment, leave conflicts) with links to affected dates/doctors

### 4) Operations & Vacations
- Integrate conflict engine into assignment flows (DutiesDesigner, OnCall) with inline warnings and prevent save if critical
- Add templates (8H/12H/24H presets + custom); copy week/month; saved assignment sets
- Extend Vacations with quotas, comments, attachments, and approval audit trail

### 5) UX & Navigation
- Add breadcrumbs in Data Entry; searchable Admin cards; saved filter presets (localStorage)
- Make App Overview actionable (quick open, manage permissions, policies); add “Open Dashboard Widgets manager”

### 6) Accessibility & RTL
- Implement focus‑trap and Esc handling in modals; ARIA labels and roles; check `prefers‑reduced‑motion`
- Verify RTL alignment for dropdowns, chips, kebab menus; fix any inconsistencies

### 7) Printing
- Add report headers/footers, page numbers; ensure A4 pagination; verify signature spacing

### 8) Security & Auth
- Policy hooks already used in Signup/Invite; extend to user updates; add placeholders for 2FA and password reset

### 9) Performance & Testing
- Virtualize long lists; debounce head‑search; cache heavy computations
- Add unit tests for permissions and operations guards; smoke e2e: login → admin → change permissions → verify UI

## Output & Rollout
- Implement incrementally: start with Permissions utility + Admin Control additions, then Analytics, then Operations conflict detection
- Keep changes behind permissions; add feature flags if needed
- Do not push automatically; push when you say “PUSH”

Would you like me to begin with step 1 (central permissions utility and Admin Control extensions)?