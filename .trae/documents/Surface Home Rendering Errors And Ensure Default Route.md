## Changes
- Wrap App mount with SimpleErrorBoundary to surface any runtime errors and show the fallback UI instead of a blank page.
- Set initial route to `#/` in App to ensure Home is the first render before Router updates.

## Verification
- Load `http://localhost:5173/#/`; confirm Home tiles render or the error boundary shows an error message.
- Switch to other routes and confirm rendering remains stable.

## Next
- If an error appears in the boundary, I’ll fix the specific code location accordingly and re-verify.