# Viewer Test Suite

This directory contains automated tests and fixtures for the PDF custom viewer (including annotation undo/redo, text selection, highlights, bookmarks, and notes).

## Running Tests

To run the entire test suite with a single command:

```bash
node tests/run-all.js
```

The runner automatically:
1. Validates the test PDF fixture xref tables.
2. Starts the local HTTP static server on port 8793.
3. Spawns a headless browser (Edge or Chrome) on port 9333 using Chrome DevTools Protocol (CDP).
4. Executes the full end-to-end test scenarios.
5. Cleanly terminates the browser and server processes.

## Files

* **`run-all.js`**: Single-command test runner (auto-spawns browser, server, and runs tests).
* **`e2e-undo.js`**: CDP-driven end-to-end test verifying highlight creation, deletions, recoloring, markup conversions, note coalescing, bookmarks, and undo/redo stacks.
* **`serve.js`**: Local HTTP server for serving the viewer files.
* **`check-pdf.js`**: Validator for PDF xref tables and offsets.
* **`make-test-pdf.js`**: Generator for the minimal 3-page test PDF fixture.
* **`test_highlight.pdf`**: Valid 3-page PDF fixture used by the viewer tests.
