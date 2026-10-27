// Single-command test runner for AI agents and developers:
// Automatically starts the test HTTP server, launches headless Edge/Chrome with CDP,
// runs the E2E undo/redo tests, and cleanly shuts down afterwards.
//
// Usage:
//   node tests/run-all.js
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { createServer, PORT } = require('./serve');

const CDP_PORT = 9333;
const PROFILE_PREFIX = 'browser-test-profile-';
const STALE_PROFILE_AGE_MS = 60 * 60 * 1000;

function findBrowserBinary() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (isMac) {
    const candidates = [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    // Linux
    const candidates = ['google-chrome', 'microsoft-edge', 'chromium-browser', 'chromium'];
    for (const c of candidates) {
      try {
        const out = require('child_process').execSync(`which ${c} 2>/dev/null`).toString().trim();
        if (out) return out;
      } catch (e) {}
    }
  }
  return null;
}

function pollEndpoint(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error(`Timeout connecting to ${url}`));
      else setTimeout(check, 300);
    };
    check();
  });
}

// Quit the browser over CDP so it shuts down normally: a force-killed Edge
// never unregisters its tabs, so Windows keeps listing them in Alt+Tab, and
// it still holds the profile open when we try to delete it. Force-kill only
// if it has not exited within the grace period.
async function closeBrowser(browserProc) {
  const exited = new Promise(res => {
    if (browserProc.exitCode !== null || browserProc.signalCode !== null) res();
    else browserProc.once('exit', res);
  });
  const waitForExit = (ms) => Promise.race([
    exited.then(() => true),
    new Promise(res => setTimeout(() => res(false), ms))
  ]);

  try {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
    const ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  } catch (e) {}
  if (await waitForExit(10000)) return;

  console.warn('  Browser did not exit after Browser.close; force-killing it.');
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(browserProc.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      browserProc.kill('SIGKILL');
    }
  } catch (e) {}
  await waitForExit(5000);
}

// A run that is interrupted (Ctrl+C, a killed terminal, a tool timeout)
// never reaches its own cleanup, so its profile stays in the temp folder.
// Remove those on the next start, skipping any changed within the last hour
// so a run still in progress keeps its profile. One that a leftover browser
// still holds open fails to delete and is retried next time.
async function sweepStaleProfiles() {
  const tmp = os.tmpdir();
  const cutoff = Date.now() - STALE_PROFILE_AGE_MS;
  let entries;
  try { entries = fs.readdirSync(tmp, { withFileTypes: true }); } catch (e) { return; }
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(PROFILE_PREFIX)) continue;
    const dir = path.join(tmp, entry.name);
    try {
      if (fs.statSync(dir).mtimeMs > cutoff) continue;
      await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      removed++;
    } catch (e) {}
  }
  if (removed) console.log(`Removed ${removed} stale browser profile(s) left by earlier runs.`);
}

async function run() {
  console.log('=== Starting Test Suite ===');
  await sweepStaleProfiles();

  // 1. Check test PDF fixture
  console.log('[1/10] Checking PDF fixture integrity...');
  require('./check-pdf');

  // 2. Unit-test the background viewer-URL construction (no server or
  // browser needed; runs the real background.js under a chrome stub)
  console.log('[2/10] Testing background viewer-URL construction...');
  const urlProc = spawn(process.execPath, [path.join(__dirname, 'test-viewer-url.js')], {
    stdio: 'inherit'
  });
  const urlCode = await new Promise(res => urlProc.on('exit', code => res(code ?? 0)));
  if (urlCode !== 0) {
    throw new Error('Viewer-URL unit tests failed.');
  }

  // 3. Unit-test the stream_options fallback gate (same chrome-stub
  // approach; guards the usage-tracking retry against regressions)
  console.log('[3/10] Testing stream_options fallback gate...');
  const streamOptsProc = spawn(process.execPath, [path.join(__dirname, 'test-stream-options.js')], {
    stdio: 'inherit'
  });
  const streamOptsCode = await new Promise(res => streamOptsProc.on('exit', code => res(code ?? 0)));
  if (streamOptsCode !== 0) {
    throw new Error('Stream-options unit tests failed.');
  }

  // 4. Unit-test the toolbar launcher popup (snapshot wiring + rendering;
  // also chrome-stubbed, so it runs before any server or browser starts)
  console.log('[4/10] Testing toolbar launcher popup...');
  const launcherProc = spawn(process.execPath, [path.join(__dirname, 'test-launcher-popup.js')], {
    stdio: 'inherit'
  });
  const launcherCode = await new Promise(res => launcherProc.on('exit', code => res(code ?? 0)));
  if (launcherCode !== 0) {
    throw new Error('Launcher popup unit tests failed.');
  }

  // 5. Unit-test the pronunciation & IPA badge (sanitizer + message
  // handler; same chrome-stub approach, no server or browser needed)
  console.log('[5/11] Testing pronunciation & IPA badge...');
  const pronProc = spawn(process.execPath, [path.join(__dirname, 'test-pronunciation.js')], {
    stdio: 'inherit'
  });
  const pronCode = await new Promise(res => pronProc.on('exit', code => res(code ?? 0)));
  if (pronCode !== 0) {
    throw new Error('Pronunciation unit tests failed.');
  }

  // 6. Unit-test the piggybacked follow-up suggestions (Issue #35):
  // trailer extraction, the live-delta marker filter, and the
  // getAiDefinition handler end-to-end under a streaming fetch stub
  console.log('[6/11] Testing follow-up suggestion chips...');
  const sugProc = spawn(process.execPath, [path.join(__dirname, 'test-suggestions.js')], {
    stdio: 'inherit'
  });
  const sugCode = await new Promise(res => sugProc.on('exit', code => res(code ?? 0)));
  if (sugCode !== 0) {
    throw new Error('Follow-up suggestions unit tests failed.');
  }

  console.log('Testing follow-up draft recovery...');
  const draftProc = spawn(process.execPath, [path.join(__dirname, 'test-followup-draft.js')], { stdio: 'inherit' });
  const draftCode = await new Promise(res => draftProc.on('exit', code => res(code ?? 0)));
  if (draftCode !== 0) throw new Error('Follow-up draft recovery tests failed.');

  console.log('Testing custom selection button settings...');
  const selectionSettingsProc = spawn(process.execPath, [path.join(__dirname, 'test-selection-button-settings.js')], { stdio: 'inherit' });
  const selectionSettingsCode = await new Promise(res => selectionSettingsProc.on('exit', code => res(code ?? 0)));
  if (selectionSettingsCode !== 0) throw new Error('Selection button settings tests failed.');

  console.log('Testing saved-meaning recognition and actions...');
  const meaningsProc = spawn(process.execPath, [path.join(__dirname, 'test-saved-meanings.js')], { stdio: 'inherit' });
  const meaningsCode = await new Promise(res => meaningsProc.on('exit', code => res(code ?? 0)));
  if (meaningsCode !== 0) throw new Error('Saved-meaning recognition tests failed.');

  console.log('Testing embedded PDF annotation recovery and safe round-trips...');
  const recoveryProc = spawn(process.execPath, [path.join(__dirname, 'test-pdf-annotation-recovery.js')], {
    stdio: 'inherit'
  });
  const recoveryCode = await new Promise(res => recoveryProc.on('exit', code => res(code ?? 0)));
  if (recoveryCode !== 0) throw new Error('PDF annotation recovery tests failed.');

  console.log('Testing cross-tab floating note synchronization...');
  const noteSyncProc = spawn(process.execPath, [path.join(__dirname, 'test-note-sync.js')], { stdio: 'inherit' });
  const noteSyncCode = await new Promise(res => noteSyncProc.on('exit', code => res(code ?? 0)));
  if (noteSyncCode !== 0) throw new Error('Cross-tab note synchronization tests failed.');

  console.log('Testing deferred page unloading during fast scrolling...');
  const unloadingProc = spawn(process.execPath, [path.join(__dirname, 'test-page-unloading.js')], { stdio: 'inherit' });
  const unloadingCode = await new Promise(res => unloadingProc.on('exit', code => res(code ?? 0)));
  if (unloadingCode !== 0) throw new Error('Page unloading tests failed.');

  console.log('Testing PDF print memory limits...');
  const printBudgetProc = spawn(process.execPath, [path.join(__dirname, 'test-print-budget.js')], { stdio: 'inherit' });
  const printBudgetCode = await new Promise(res => printBudgetProc.on('exit', code => res(code ?? 0)));
  if (printBudgetCode !== 0) throw new Error('Print budget tests failed.');

  console.log('Testing rotated-text search geometry...');
  const searchGeometryProc = spawn(process.execPath, [path.join(__dirname, 'test-search-geometry.js')], { stdio: 'inherit' });
  const searchGeometryCode = await new Promise(res => searchGeometryProc.on('exit', code => res(code ?? 0)));
  if (searchGeometryCode !== 0) throw new Error('Search geometry tests failed.');

  console.log('Testing initial navigation races...');
  const initialNavigationProc = spawn(process.execPath, [path.join(__dirname, 'test-initial-navigation.js')], { stdio: 'inherit' });
  const initialNavigationCode = await new Promise(res => initialNavigationProc.on('exit', code => res(code ?? 0)));
  if (initialNavigationCode !== 0) throw new Error('Initial navigation tests failed.');

  console.log('Testing deferred navigation races...');
  const deferredNavigationProc = spawn(process.execPath, [path.join(__dirname, 'test-deferred-navigation.js')], { stdio: 'inherit' });
  const deferredNavigationCode = await new Promise(res => deferredNavigationProc.on('exit', code => res(code ?? 0)));
  if (deferredNavigationCode !== 0) throw new Error('Deferred navigation tests failed.');

  console.log('Testing viewer tab titles...');
  const viewerTitleProc = spawn(process.execPath, [path.join(__dirname, 'test-viewer-title.js')], { stdio: 'inherit' });
  const viewerTitleCode = await new Promise(res => viewerTitleProc.on('exit', code => res(code ?? 0)));
  if (viewerTitleCode !== 0) throw new Error('Viewer title tests failed.');

  console.log('Testing the FSRS scheduler and optimizer...');
  const fsrsProc = spawn(process.execPath, [path.join(__dirname, 'test-fsrs.js')], { stdio: 'inherit' });
  const fsrsCode = await new Promise(res => fsrsProc.on('exit', code => res(code ?? 0)));
  if (fsrsCode !== 0) throw new Error('FSRS tests failed.');

  // 7. Start HTTP server
  console.log(`[7/11] Starting local HTTP server on port ${PORT}...`);
  const server = createServer();
  await new Promise((res, rej) => {
    server.listen(PORT, '127.0.0.1', (err) => err ? rej(err) : res());
  });
  console.log(`  Server ready at http://127.0.0.1:${PORT}`);

  // 8. Launch headless browser
  const browserBin = findBrowserBinary();
  if (!browserBin) {
    server.close();
    throw new Error('No compatible browser (Edge or Chrome) found on this system.');
  }
  console.log(`[8/11] Launching headless browser: ${path.basename(browserBin)}...`);
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX));

  const browserProc = spawn(browserBin, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--remote-allow-origins=*',
    '--window-size=1280,900',
    '--disable-sync',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { stdio: 'ignore' });

  let exitCode = 0;
  try {
    await pollEndpoint(`http://127.0.0.1:${CDP_PORT}/json`, 15000);
    console.log(`  CDP ready on port ${CDP_PORT}`);

    console.log('Testing responsive PDF workspace and page navigation...');
    const viewerLayoutProc = spawn(process.execPath, [path.join(__dirname, 'e2e-viewer-layout.js')], { stdio: 'inherit' });
    const viewerLayoutCode = await new Promise(res => viewerLayoutProc.on('exit', code => res(code ?? 0)));
    if (viewerLayoutCode !== 0) throw new Error('PDF workspace layout tests failed.');

    console.log('Testing PDF Focus mode and search results...');
    const focusSearchProc = spawn(process.execPath, [path.join(__dirname, 'e2e-focus-search.js')], { stdio: 'inherit' });
    const focusSearchCode = await new Promise(res => focusSearchProc.on('exit', code => res(code ?? 0)));
    if (focusSearchCode !== 0) throw new Error('PDF Focus mode and search results tests failed.');

    console.log('Testing annotation color and text filters...');
    const filtersProc = spawn(process.execPath, [path.join(__dirname, 'e2e-annotation-filters.js')], { stdio: 'inherit' });
    const filtersCode = await new Promise(res => filtersProc.on('exit', code => res(code ?? 0)));
    if (filtersCode !== 0) throw new Error('Annotation filter tests failed.');

    console.log('Testing comment autosave and annotation popup anchoring...');
    const editingProc = spawn(process.execPath, [path.join(__dirname, 'e2e-annotation-editing.js')], { stdio: 'inherit' });
    const editingCode = await new Promise(res => editingProc.on('exit', code => res(code ?? 0)));
    if (editingCode !== 0) throw new Error('Annotation editing tests failed.');

    // 9. Run E2E tests
    console.log('[9/11] Executing E2E undo/redo test harness...');
    const testProc = spawn(process.execPath, [path.join(__dirname, 'e2e-undo.js')], {
      stdio: 'inherit'
    });

    exitCode = await new Promise(res => testProc.on('exit', code => res(code ?? 0)));

    console.log('[10/11] Executing E2E deep-link test harness...');
    const deeplinkProc = spawn(process.execPath, [path.join(__dirname, 'e2e-deeplink.js')], {
      stdio: 'inherit'
    });

    const deeplinkCode = await new Promise(res => deeplinkProc.on('exit', code => res(code ?? 0)));
    if (deeplinkCode !== 0) exitCode = deeplinkCode;

    console.log('[11/11] Executing E2E view-state persistence test harness...');
    const viewstateProc = spawn(process.execPath, [path.join(__dirname, 'e2e-viewstate.js')], {
      stdio: 'inherit'
    });

    const viewstateCode = await new Promise(res => viewstateProc.on('exit', code => res(code ?? 0)));
    if (viewstateCode !== 0) exitCode = viewstateCode;

    console.log('Testing saved-meaning controls in the popup...');
    const meaningsBrowserProc = spawn(process.execPath, [path.join(__dirname, 'e2e-saved-meanings.js')], { stdio: 'inherit' });
    const meaningsBrowserCode = await new Promise(res => meaningsBrowserProc.on('exit', code => res(code ?? 0)));
    if (meaningsBrowserCode !== 0) exitCode = meaningsBrowserCode;

    console.log('Testing automatic draft recovery in the popup...');
    const draftBrowserProc = spawn(process.execPath, [path.join(__dirname, 'e2e-followup-draft.js')], { stdio: 'inherit' });
    const draftBrowserCode = await new Promise(res => draftBrowserProc.on('exit', code => res(code ?? 0)));
    if (draftBrowserCode !== 0) exitCode = draftBrowserCode;

    console.log('Testing options page autosave and model controls...');
    const optionsAutosaveProc = spawn(process.execPath, [path.join(__dirname, 'e2e-options-autosave.js')], { stdio: 'inherit' });
    const optionsAutosaveCode = await new Promise(res => optionsAutosaveProc.on('exit', code => res(code ?? 0)));
    if (optionsAutosaveCode !== 0) exitCode = optionsAutosaveCode;

    console.log('Testing options page layout...');
    const optionsLayoutProc = spawn(process.execPath, [path.join(__dirname, 'e2e-options-layout.js')], { stdio: 'inherit' });
    const optionsLayoutCode = await new Promise(res => optionsLayoutProc.on('exit', code => res(code ?? 0)));
    if (optionsLayoutCode !== 0) exitCode = optionsLayoutCode;

    console.log('Testing custom selection popup buttons...');
    const selectionButtonsProc = spawn(process.execPath, [path.join(__dirname, 'test-selection-buttons.js')], { stdio: 'inherit' });
    const selectionButtonsCode = await new Promise(res => selectionButtonsProc.on('exit', code => res(code ?? 0)));
    if (selectionButtonsCode !== 0) exitCode = selectionButtonsCode;

    console.log('Testing selections in Google Docs and Slides...');
    const googleDocsProc = spawn(process.execPath, [path.join(__dirname, 'e2e-google-docs-selection.js')], { stdio: 'inherit' });
    const googleDocsCode = await new Promise(res => googleDocsProc.on('exit', code => res(code ?? 0)));
    if (googleDocsCode !== 0) exitCode = googleDocsCode;
  } catch (err) {
    console.error('Test runner failed:', err.message);
    exitCode = 1;
  } finally {
    // Cleanup browser
    await closeBrowser(browserProc);

    // Cleanup server
    try { server.close(); } catch (e) {}

    // Cleanup temp profile directory. Helper processes (crashpad, GPU) can
    // hold files for a moment after the browser exits, so retry on EBUSY.
    try {
      await fs.promises.rm(tempProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (e) {
      console.warn(`  Could not remove temp profile ${tempProfile}: ${e.message}`);
    }
  }

  console.log(`=== Tests Finished (exit code: ${exitCode}) ===`);
  process.exit(exitCode);
}

run();
