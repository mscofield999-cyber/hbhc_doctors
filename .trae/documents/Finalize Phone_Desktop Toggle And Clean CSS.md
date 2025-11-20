## Changes To Apply
- Remove stray `:root {}` at end of `styles.css` to avoid override confusion.
- Consolidate responsive rules under `.phone-view` and ensure they don’t conflict with base tokens.
- Add compact table styling for phone view: smaller padding and font for `.table`, `.duties-table`, `.oncall-monthly-table`.
- Ensure `display_mode` persists and is applied on load by toggling `body` classes `phone-view`/`desktop-view`.

## Verification
- Toggle modes on Home page; confirm body class flips and layout reflows.
- Reload; confirm persisted mode is restored.
- Check Data/Operations/Dashboard tables render compact in phone view; normal in desktop view.

## Afterward
- Push updated CSS and minor app wires to GitHub after confirming no regressions.
- If desired, add per-section phone tweaks (hide secondary meta text) in a follow-up.