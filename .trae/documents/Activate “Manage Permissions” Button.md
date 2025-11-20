## Goal
Make the “Manage Permissions” button open Admin Control and auto-switch to the Permissions panel.

## Approach
- Use a small state handoff via storage to select the initial Admin Control panel.
- Avoid changing global routing structure; keep the hash route `#/admin-control`.

## Changes
1. In AppOverviewPanel
- Update the button handler to set `localStorage.admin_panel = 'perm'` and navigate to `#/admin-control`.

2. In AdminControlPage
- On mount, read `localStorage.admin_panel` and if present, set `active` to that value (`'user'|'access'|'perm'|'monitor'`), then remove the key.
- Keep default `active = 'user'` when no hint is provided.

## Verification
- Click “Manage Permissions” on App Overview; confirm Admin Control opens on the Permissions panel.
- Navigate to Admin Control from Home/Menu; confirm default opens on User Management.
- Confirm no regressions in gating and panel switching.

## Notes
- Minimal, self-contained change; no new routes required.
- Future-friendly: can extend to support `#/admin-control/perm` if needed, but not required now.