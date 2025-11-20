## Objectives
- Test and diagnose the Admin Control section functionality and UX.
- Align visualization, layout, and grids so it matches other sections (Data Entry, Dashboard).
- Perform small maintenance cleanups to ensure consistent navigation and behavior.

## Current State Review
- Standalone route `#/admin-control` renders AdminControlPage with grouped cards: User Management, Access & Security, Permissions, Monitoring (app.jsx ~2133–2193).
- Home tile and menu link go to `#/admin-control` (app.jsx ~4163–4174; index.html ~137–151).
- Uses existing `Section`, `card`, and `card-grid` patterns consistent with the app.

## Diagnostics & Testing
- Navigation & Gating
  - Verify admin-only gate: non-admin sees "Admins only"; admin sees full cards.
  - Test links from Home and Menu to `#/admin-control` and direct hash navigation.
- Functional
  - Users & Roles: save, remove, export; state persists; audit logs update.
  - Site Settings: default view applies via `window.setViewMode` and persists.
  - Access & Security: high contrast, reduced motion, focus ring, font size, direction, session timeout; audit logged.
  - Permissions: save/reset respect matrix and reflect in Data Entry controls.
  - Analytics: counts match storage; Audit Logs export.
- UX/Accessibility
  - Focus-visible rings present; high-contrast and reduced-motion apply; RTL/LTR.
  - Keyboard navigation through all controls; Escape closes menu.
- Performance
  - Initial render time within acceptable range; no excessive reflows.

## Layout & Visualization Polish
- Grid Consistency
  - Adopt uniform `card-grid` spacing and minmax sizes across Admin Control.
  - Ensure top-level groups (User Management, Access & Security, Permissions, Monitoring) render as cards with inner `card-grid` matching existing breakpoints.
- Spacing & Typography
  - Normalize headings (`.name`) weight/size to match other sections.
  - Ensure consistent padding/margins (`.card`, `.card-grid`) as in styles.css.
- Visual Alignment
  - Confirm icons and labels align with app conventions (bi icons, Section titles).

## Maintenance & Cleanup
- Confirm all references to old `#/admin` admin-tab opening are removed; rely on `#/admin-control`.
- Ensure App Overview links reflect `#/data-entry` and `#/admin-control`.
- Verify no duplicate storage keys; prefer `access_*` and `security_*` keys already used.

## Implementation Steps
1. Adjust AdminControlPage layout to use consistent `card-grid` and heading styles where needed (app.jsx).
2. Minor style tweaks if required (styles.css): ensure `card-grid` breakpoints are consistent in Admin Control.
3. Update any lingering navigation logic to `#/admin-control` (index.html, app.jsx).
4. Add lightweight checks in DiagnosticsPage to validate Admin Control accessibility toggles (optional).

## Verification
- Manual walkthrough of all Admin Control panels and persistence.
- Visual review across desktop/mobile modes.
- Accessibility inspection: tab order, focus rings, high-contrast, reduced-motion.
- Check Audit Logs entries for each apply/save action.

## Deliverables
- Updated Admin Control layout and minor styles for visual/UX consistency.
- Verified navigation, functionality, accessibility, and audit logging.
- Short test checklist documented with expected outcomes.