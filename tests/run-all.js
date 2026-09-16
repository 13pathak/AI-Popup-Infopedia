// Single-command test runner for AI agents and developers:
// Automatically starts the test HTTP server, launches headless Edge/Chrome with CDP,
// runs the E2E undo/redo tests, and cleanly shuts down afterwards.
//
// Usage:
//   node tests/run-all.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { createServer, PORT } = require('./serve');

const CDP_PORT = 9333;

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

async function run() {
  console.log('=== Starting Test Suite ===');

  // 1. Check test PDF fixture
  console.log('[1/9] Checking PDF fixture integrity...');
  require('./check-pdf');

  // 2. Unit-test the background viewer-URL construction (no server or
  // browser needed; runs the real background.js under a chrome stub)
  console.log('[2/9] Testing background viewer-URL construction...');
  const urlProc = spawn(process.execPath, [path.join(__dirname, 'test-viewer-url.js')], {
    stdio: 'inherit'
  });
  const urlCode = await new Promise(res => urlProc.on('exit', code => res(code ?? 0)));
  if (urlCode !== 0) {
    throw new Error('Viewer-URL unit tests failed.');
  }

  // 3. Unit-test the stream_options fallback gate (same chrome-stub
  // approach; guards the usage-tracking retry against regressions)
  console.log('[3/9] Testing stream_options fallback gate...');
  const streamOptsProc = spawn(process.execPath, [path.join(__dirname, 'test-stream-options.js')], {
    stdio: 'inherit'
  });
  const streamOptsCode = await new Promise(res => streamOptsProc.on('exit', code => res(code ?? 0)));
  if (streamOptsCode !== 0) {
    throw new Error('Stream-options unit tests failed.');
  }

  // 4. Unit-test the toolbar launcher popup (snapshot wiring + rendering;
  // also chrome-stubbed, so it runs before any server or browser starts)
  console.log('[4/9] Testing toolbar launcher popup...');
  const launcherProc = spawn(process.execPath, [path.join(__dirname, 'test-launcher-popup.js')], {
    stdio: 'inherit'
  });
  const launcherCode = await new Promise(res => launcherProc.on('exit', code => res(code ?? 0)));
  if (launcherCode !== 0) {
    throw new Error('Launcher popup unit tests failed.');
  }

  // 5. Start HTTP server
  console.log(`[5/9] Starting local HTTP server on port ${PORT}...`);
  const server = createServer();
  await new Promise((res, rej) => {
    server.listen(PORT, '127.0.0.1', (err) => err ? rej(err) : res());
  });
  console.log(`  Server ready at http://127.0.0.1:${PORT}`);

  // 6. Launch headless browser
  const browserBin = findBrowserBinary();
  if (!browserBin) {
    server.close();
    throw new Error('No compatible browser (Edge or Chrome) found on this system.');
  }
  console.log(`[6/9] Launching headless browser: ${path.basename(browserBin)}...`);
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-test-profile-'));

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

    // 7. Run E2E tests
    console.log('[7/9] Executing E2E undo/redo test harness...');
    const testProc = spawn(process.execPath, [path.join(__dirname, 'e2e-undo.js')], {
      stdio: 'inherit'
    });

    exitCode = await new Promise(res => testProc.on('exit', code => res(code ?? 0)));

    console.log('[8/9] Executing E2E deep-link test harness...');
    const deeplinkProc = spawn(process.execPath, [path.join(__dirname, 'e2e-deeplink.js')], {
      stdio: 'inherit'
    });

    const deeplinkCode = await new Promise(res => deeplinkProc.on('exit', code => res(code ?? 0)));
    if (deeplinkCode !== 0) exitCode = deeplinkCode;

    console.log('[9/9] Executing E2E view-state persistence test harness...');
    const viewstateProc = spawn(process.execPath, [path.join(__dirname, 'e2e-viewstate.js')], {
      stdio: 'inherit'
    });

    const viewstateCode = await new Promise(res => viewstateProc.on('exit', code => res(code ?? 0)));
    if (viewstateCode !== 0) exitCode = viewstateCode;
  } catch (err) {
    console.error('Test runner failed:', err.message);
    exitCode = 1;
  } finally {
    // Cleanup browser
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', browserProc.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        browserProc.kill('SIGKILL');
      }
    } catch (e) {}

    // Cleanup server
    try { server.close(); } catch (e) {}

    // Cleanup temp profile directory
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(`=== Tests Finished (exit code: ${exitCode}) ===`);
  process.exit(exitCode);
}

run();
