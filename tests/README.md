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

* **`test-selection-buttons.js`**: Full content-script browser coverage for optional custom prompt buttons: actual text selection and mouse click, strict opt-in/invalid records, safe labels, live settings updates and initial-load races, selected prompt/context, compare and retry, removed prompt recovery, unchanged Ask AI/Clip actions, and narrow viewport layout in both themes. Included in `run-all.js`; can also run against the test server/browser on ports 8793/9333. Set `SELECTION_BUTTON_SCREENSHOT_DIR` to save optional toolbar screenshots outside the repository.
* **`test-selection-button-settings.js`**: Runs the real prompt settings functions with controlled storage. Covers create/edit/delete, legacy visibility defaults, form reset, metadata retention, storage failures, and rapid toggles/reordering without lost changes. Run with `node tests/test-selection-button-settings.js`; included in `run-all.js`.
* **`test-deferred-navigation.js`**: Runs the real scrolling functions with controlled layout and animation frames. Covers newer page, search-result, and annotation jumps cancelling an older deferred jump, already-visible search results, deferred target replacement, and the bounded layout fallback. Run with `node tests/test-deferred-navigation.js`; included in `run-all.js`.
* **`test-initial-navigation.js`**: Exercises the real initial load and hashchange handlers with deferred destination lookups and controlled timers. Covers newer hashes cancelling stale named destinations and both resume formats, hash changes during layout/loading, and normal initial navigation. Run with `node tests/test-initial-navigation.js`; included in `run-all.js`.
* **`test-search-geometry.js`**: Generates PDFs with rotated text and runs the viewer's search and overlay functions against bundled PDF.js text transforms and viewports. Covers substring offsets, full matches, multiple text chunks, Unicode lowercasing expansions, page rotations, zoom, and unchanged cached transforms. Run with `node tests/test-search-geometry.js`; included in `run-all.js`.
* **`test-page-unloading.js`**: Exercises the real observer, rendering, and unloading functions with deferred PDF.js tasks. Covers pages leaving/re-entering the visibility buffer during rendering, zoom transitions and retries, delayed link annotations, and canvas release after fast scrolling through many pages. Run with `node tests/test-page-unloading.js`; included in `run-all.js`.
* **`test-note-sync.js`**: Runs the real viewer storage listener, floating editor, autosave, and undo/redo functions with deterministic DOM/storage/timer stubs. Covers remote edits and deletions, cancelled stale autosaves, continued typing after toolbar Undo/Redo, immediate Redo invalidation, plain-text comments, unchanged editor DOM for unrelated updates, and own-write echoes. Run with `node tests/test-note-sync.js`; included in `run-all.js`.
* **`e2e-annotation-filters.js`**: Issue #47 browser tests for multi-select color swatches, case-insensitive highlight/rich-note search, composition with the current-page filter, matching/page-group counts, no-result states, retained input focus, note edits, live storage changes, custom colors, tab switching, and light/dark layout. Uses an isolated viewer tab with seeded extension storage; runs in `run-all.js` or against the test server/browser on ports 8793/9333.
* **`test-followup-draft.js`**: Issue #40 regression tests for exact draft preservation through session storage and popup restoration, unanswered initial drafts, caret placement, queued save/clear ordering, legacy payloads, and missing inputs/models. Run independently with `node tests/test-followup-draft.js`.
* **`e2e-followup-draft.js`**: Browser coverage using the complete content script and real session-storage helpers: empty-selection hotkey recovery, outside-click/Escape dismissal, initial and follow-up drafts, immediate clearing on submit/erase, deleted models, and delayed recovery responses that must not overwrite new input.
* **`test-saved-meanings.js`**: Issue #39 regression tests for normalized cross-session recognition, relative dates, safe inline previews, updating a specific meaning while retaining notes/list/review state, explicit additional meanings, concurrent saves, stale/deleted and legacy records, and storage failures. Runs the real worker message handlers and popup disclosure/save functions with storage and DOM stubs. Run independently with `node tests/test-saved-meanings.js`.
* **`e2e-saved-meanings.js`**: Exercises the complete content script's shadow-DOM popup in an isolated browser tab: opening the saved badge, safe previous-definition preview, disclosure persistence across renders, action layout in both themes, and live list renames/deletions.
* **`test-pdf-annotation-recovery.js`**: Generates annotated PDFs in memory and exercises the actual recovery and Save functions with bundled PDF.js/pdf-lib. Covers empty/missing storage, intentional deletion markers, local-state precedence, concurrent edits, rotated/multiline geometry, Unicode notes, authors, clickable overlays, editing and undo/redo, repeated save/reopen, and preservation of unsupported or malformed annotations. Run independently with `node tests/test-pdf-annotation-recovery.js` (no browser required).
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
