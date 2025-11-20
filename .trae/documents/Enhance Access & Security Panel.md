## Goals
- Expand the Access & Security card to provide more user accessibility controls and basic security toggles, with persistent settings and audit logging.

## Add Controls
- Accessibility
  - High Contrast: existing toggle persists and logs
  - Font Size: small/medium/large (applies CSS root font-size token)
  - Reduced Motion: honors prefers-reduced-motion; add toggle to force reduce motion classes
  - Focus Visibility: thicker focus ring toggle for keyboard users
  - RTL/LTR Switch: allow explicit UI direction override (persists and re-applies)
- Security (placeholders)
  - 2FA: toggle placeholder flag for future integration
  - Session Timeout: select (never/15m/30m/1h) with local countdown demo

## Implementation
- State persistence: localStorage keys
  - `access_high_contrast`, `access_font_size`, `access_reduce_motion`, `access_focus_ring`, `access_dir`, `security_2fa_enabled`, `security_session_timeout`
- Apply classes/variables
  - Body classes: `high-contrast`, `reduced-motion`, `focus-bold`, `dir-rtl`/`dir-ltr`
  - Root font-size via CSS variable (e.g., `--app-font-size: 14px|16px|18px`)
- Audit logging
  - Log each Apply action with changed settings

## UI & UX
- Expand the Access card with grouped controls (Accessibility / Security)
- Add Apply and Reset buttons; show success toast
- Reflect current settings on load

## Verification
- Toggle each control and confirm body classes/variables change; confirm persistence on reload
- Check keyboard focus rings, contrast tokens, and motion reduction in basic interactions
- Confirm App Overview reflects current state (via added summary chips)

## Next
- After approval, I’ll implement the new toggles, persistence, body class/variable application, and logging in the Access panel; then update App Overview to show current Accessibility/Security settings.