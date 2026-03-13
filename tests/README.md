# Playwright E2E tests

## Run

Install Playwright (if not already):

```bash
npx playwright install --with-deps
```

Run tests:

```bash
npm run test:e2e
# or
npx playwright test
```

## Debug

Use Playwright's debug flag:

```bash
npx playwright test --debug
```

## Architecture

These tests use Playwright's `_electron` API which drives the Electron binary via the
Chrome DevTools Protocol (CDP). The test process launches the Electron executable and
connects to renderer contexts to inspect DOM, evaluate JS, and interact with UI elements.

## Notes

- The test launches the Electron binary found via `require('electron')` from `node_modules`.
- On CI (Linux) you may need to run tests under an X virtual framebuffer (e.g. `xvfb-run`).
- If your app shows a splash screen, the first window may be the splash window. Update the
  test to wait for a window with the expected URL or for a specific element instead of
  relying on `firstWindow()`.
