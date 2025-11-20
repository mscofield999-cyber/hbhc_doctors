## Objectives
- Complete the integrated, token‑driven dark theme across all components.
- Ensure WCAG contrast, consistent elevation, and modern visuals.

## Token Foundation
- Expand tokens in `:root` and `body.theme-dark`:
  - Add `--surface-1`, `--surface-2`, `--inverse-text`.
  - Normalize `--brand-primary`/`--brand-primary-weak`, `--success`, `--info`, `--danger`.
- Document elevation steps: 0 (bg), 1 (card), 2 (menus/modals), 3 (sticky bars).

## CSS Refactor Targets
- Map surfaces:
  - `.topbar`, dropdown menus, kebabs → `--surface-2`.
  - `.card`, grids, panels → `--surface-1`.
- Buttons:
  - Neutral: charcoal gradient + subtle border; hover slightly lighter.
  - Primary: `--brand-primary-weak` → `--brand-primary` gradient; focus ring visible.
  - Approve/Deny: brighter gradients for dark.
- Forms & filters:
  - `.row.smooth`, inputs, selects → dark gradients, inner light shadow; placeholders use `--muted`.
- Chips & pills:
  - Base `--surface-2`; selected shows `--ring` and light text.
- Tables:
  - Header `rgba(255,255,255,0.06)`; odd rows `rgba(255,255,255,0.03)`; hover `rgba(255,255,255,0.05)`.
- KPI & bars:
  - Track `rgba(255,255,255,0.12)`; fill brand→success.
- Print:
  - Keep `@media print` light; no dark overrides applied to print.

## JS Theme Application
- Keep Theme Mode (light/dark/system) in Access & Security.
- Respect `prefers-color-scheme`; apply `theme-dark` on load and storage changes.
- Ensure high‑contrast remains compatible layered over dark.

## Verification
- Manual checks on Home, Data Entry, Operations, Dashboard, Admin Control.
- Accessibility:
  - Body text ≥4.5:1; large text/UI glyphs ≥3:1.
  - Focus-visible ring contrast on all interactive controls.
- Performance: Confirm no layout thrash when switching theme.

## Deliverables
- Updated tokens and CSS mappings for a modern dark theme.
- Consistent visuals and accessibility across all pages; no data/route changes.

## Optional Enhancement (post‑rollout)
- Admin palette preview (OKLCH/HSLA sliders) for safe brand tuning.
- Auto tint charts using brand tokens with accessible thresholds.