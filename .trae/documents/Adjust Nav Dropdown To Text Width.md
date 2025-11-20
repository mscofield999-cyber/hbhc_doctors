## Goal

Make the mobile nav drop list open downward with a width that matches its text content (not full width), while keeping desktop behavior unchanged.

## Changes Overview

* CSS: Change the dropdown panel to size to content using `width: max-content` with a reasonable `min-width` and padding.

* CSS: Keep links single-line (`white-space: nowrap`) and stack vertically.

* CSS: Position the dropdown just below the toggle button, with a subtle card style.

* JS: Keep the existing toggle behavior; optionally set `aria-expanded` for accessibility.

## Detailed CSS Updates

* In `styles.css` under the mobile breakpoint for nav:

```css
@media (max-width: 800px) {
  .topnav .nav-toggle { display: inline-flex; align-items: center; gap: 6px; }
  .topnav { position: relative; }
  .topnav .dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0; /* anchor to the left edge of the nav (or toggle) */
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    padding: 8px 10px;
    flex-direction: column;
    gap: 6px;
    width: max-content;     /* size to longest link */
    min-width: 180px;       /* sensible minimum */
    max-width: 90vw;        /* avoid overflowing viewport */
  }
  .topnav.open .dropdown { display: flex; }
  .topnav .dropdown .nav-link {
    display: block;
    width: 100%;
    white-space: nowrap;    /* prevent wrapping; width controlled by panel */
  }
}
/* RTL alignment */
[dir='rtl'] .topnav .dropdown { left: auto; right: 0; }
```

* Optional desktop polish (no behavior change): leave existing `.topnav` styles for desktop; dropdown remains inline there.

## JS Tweaks (Optional, Accessibility)

* In `index.html` inline script, when toggling:

```js
btn.addEventListener('click', function() {
  const isOpen = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});
```

## Verification

* Mobile: Click Menu — dropdown opens below with width matching the longest link text; no extra empty space.

* Desktop: No change; links remain inline.

* RTL: Dropdown anchors to the right under Menu.

## Next

On approval, I’ll update `styles.css` to size the dropdown to content and add the small JS accessibility tweak in `index.html`. I’ll keep desktop unchanged and verify in both LTR and RTL modes.
