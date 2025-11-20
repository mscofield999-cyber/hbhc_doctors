## Goals
- Make the front-page Phone/Desktop toggle work smoothly across the app.
- Clean up CSS (remove stray `:root {}` and consolidate responsive overrides).
- Verify persistence and initial mode application on load.

## Changes Proposed
### App Logic
- Ensure `display_mode` is read on start and applied to `body` class (`phone-view`/`desktop-view`).
- Keep the Home page toggle as the single source of truth; persist changes to `localStorage`.

### CSS Refinement
- Remove the stray `:root {}` at the end of `styles.css`.
- Group responsive overrides under `.phone-view`:
  - Typography tokens (`--font-sm`, `--font-md`, `--font-lg`, `--font-xl`).
  - Layout: `.home-grid`, `.card-grid`, `.topnav` wrap.
  - Tables: reduce padding, increase compactness for `.table` in phone view.
- Add `.desktop-view` block only if needed (currently no overrides).

### UI Polish
- Add a subtle label beside the toggle to indicate current mode (“View Mode”).
- Keep RTL compatibility (do not break Arabic rendering).

## Verification
- Switch modes on the Home page; confirm body classes change and UI reflows.
- Reload the page; ensure chosen mode persists.
- Navigate to Data/Operations/Dashboard; confirm grids and tables adapt in phone view.

## Next Actions
- I will implement the above refinements, run a local verification, and push changes to GitHub after confirming there are no regressions.