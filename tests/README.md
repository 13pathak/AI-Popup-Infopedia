# Viewer Test Suite

This directory contains automated tests and fixtures for the PDF custom viewer (including annotation undo/redo, text selection, highlights, bookmarks, and notes).

## Running Tests

To run the entire test suite with a single command:

```bash
node tests/run-all.js
```

The runner automatically:
1. Validates the test PDF fixture xref tables.
2. Unit-tests the background viewer-URL construction.
3. Starts the local HTTP static server on port 8793.
4. Spawns a headless browser (Edge or Chrome) on port 9333 using Chrome DevTools Protocol (CDP).
5. Executes the full end-to-end test scenarios.
6. Cleanly terminates the browser and server processes.

## Files

* **`run-all.js`**: Single-command test runner (auto-spawns browser, server, and runs tests).
* **`e2e-undo.js`**: CDP-driven end-to-end test verifying highlight creation, deletions, recoloring, markup conversions, note coalescing, bookmarks, and undo/redo stacks.
* **`e2e-deeplink.js`**: CDP-driven end-to-end test for `#page=N` deep links (issue #17): page-number fragments, clamping, invalid values, named destinations (bare, `nameddest=`, percent-encoded), unchanged no-fragment load behavior, and same-document hash edits while the viewer is open (address-bar style changes, clamping, history Back, no-op on unusable fragments).
* **`e2e-viewstate.js`**: CDP-driven end-to-end test for per-document zoom + scroll persistence (issue #16). Injects a localStorage-backed `chrome.storage` stub (`Page.addScriptToEvaluateOnNewDocument`) so the real persistence paths run outside the extension: zoom-button and scroll saves land as one `{ page, zoom, scrollRatio }` object under the resume key, reopen restores the exact zoom and scroll ratio, an untouched session writes nothing back, legacy bare-page-number records still resume at the page top (and upgrade to the object schema at the next save), corrupt fields are ignored, and out-of-range zoom clamps. Also covers the resume race fix: the pre-#16 code reset its page tracker to 1 before the delayed resume could fire, so stored positions regressed to page 1 on every reopen.
* **`test-viewer-url.js`**: Unit test that loads the real `background.js` under a stubbed `chrome` API and fires the actual `webNavigation`/`webRequest` listeners, asserting the viewer-URL shape: `?file=` is always fragment-free and the deep link rides the viewer's own hash (plus fragment recovery and fragment-aware cross-listener dedupe — same document with a different fragment inside the TTL is a new navigation and redirects again).
* **`test-suggestions.js`**: Unit test for the piggybacked follow-up chips (Issue #35), loading the real `background.js` under a chrome stub with a streaming fetch: `extractSuggestions` cuts the `[[SUGGESTIONS]]` trailer from finished text and sanitizes its lines; the live-delta filter keeps the marker from flashing across chunk boundaries, mid-stream failures, and fallback retries; and the `getAiDefinition` handler appends the instruction only when enabled, strips the trailer from the answer/deltas/cache on every path (SSE, plain-JSON providers, cache hits), never mutates the caller's follow-up history, and returns the chips as a separate `suggestions` field.
* **`serve.js`**: Local HTTP server for serving the viewer files.
* **`check-pdf.js`**: Validator for PDF xref tables and offsets.
* **`make-test-pdf.js`**: Generator for the minimal 3-page test PDF fixture (includes named destinations used by the deep-link tests).
* **`test_highlight.pdf`**: Valid 3-page PDF fixture used by the viewer tests.
