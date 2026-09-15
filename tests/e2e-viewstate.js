// CDP-driven E2E test for per-document zoom + scroll persistence
// (issue #16). The viewer's persistence only exists when chrome.storage is
// present, so a localStorage-backed chrome.storage stub is injected via
// Page.addScriptToEvaluateOnNewDocument before any page script runs —
// same-origin localStorage survives the bounce-navigations, standing in
// for "reopen the document later". Runs the real viewer code paths for
// save (zoom buttons + scroll → debounced write), restore (zoom + exact
// scroll ratio), legacy bare-number records, and corrupt-value handling.
// Run with the viewer served on http://127.0.0.1:8793 and headless browser
// on port 9333:
//   node tests/e2e-viewstate.js
const CDP_PORT = 9333;
const VIEWER_PATH = 'http://127.0.0.1:8793/pdf/web/custom-viewer.html';
const DEFAULT_FILE = '/tests/test_highlight.pdf';
const LASTPAGE_KEY = 'pdf_lastpage_' + DEFAULT_FILE;

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evalPage(expression, awaitPromise = false) {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const loadWaiters = [];
function waitForLoad(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('loadEventFired timeout'));
        }, timeoutMs);
        loadWaiters.push(() => {
            clearTimeout(timer);
            resolve();
        });
    });
}

function assert(cond, label, extra) {
    if (!cond) {
        console.log('FAIL: ' + label + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
        process.exitCode = 1;
    } else {
        console.log('pass: ' + label);
    }
}

async function navigateTo(url) {
    const loaded = waitForLoad();
    const r = await send('Page.navigate', { url });
    if (r && r.errorText) throw new Error('navigation failed: ' + r.errorText);
    await loaded;
}

// Fresh document load of the viewer (bounce through about:blank so a
// changed ?file= or repeated URL still reloads), then wait for the first
// page's text layer plus the 300ms restore timers to settle.
async function openViewer() {
    await navigateTo('about:blank');
    await navigateTo(VIEWER_PATH + '?file=' + encodeURIComponent(DEFAULT_FILE));
    await evalPage(`new Promise(res => {
        const t0 = Date.now();
        const check = () => {
            const p = document.querySelector('.page[data-page-number="1"] .textLayer');
            if (p && p.querySelectorAll('span').length) res(true);
            else if (Date.now() - t0 > 8000) res(false);
            else setTimeout(check, 200);
        };
        check();
    })`, true);
    await sleep(1200);
}

function readStoredLastPage() {
    return evalPage(`window.__stubStorage.read()[${JSON.stringify(LASTPAGE_KEY)}]`);
}

function writeStoredLastPage(value) {
    return evalPage(`(() => {
        const all = window.__stubStorage.read();
        all[${JSON.stringify(LASTPAGE_KEY)}] = ${JSON.stringify(value)};
        window.__stubStorage.write(all);
        return true;
    })()`);
}

function readViewerState() {
    return evalPage(`(() => {
        const vc = document.getElementById('viewerContainer');
        const num = parseInt(document.getElementById('page_num').value, 10);
        const div = document.querySelector('.page[data-page-number="' + num + '"]');
        return {
            page: num,
            zoomLabel: document.getElementById('zoom_level').textContent,
            scrollRatio: vc.scrollHeight > 0 ? vc.scrollTop / vc.scrollHeight : 0,
            targetOffset: div ? (div.getBoundingClientRect().top - vc.getBoundingClientRect().top) : null
        };
    })()`);
}

// The chrome.storage stand-in. get/set/remove mirror the callback shapes the
// viewer uses; onChanged fires after each set/remove so the echo-suppression
// and adoption paths run exactly as in the extension. localStorage keeps the
// data alive across viewer reopens; only pages on the test origin ever read
// it. chrome.runtime.lastError must exist (callbacks read it); tabs/messaging
// are only touched on error screens these tests never reach.
const STORAGE_STUB = `(() => {
    if (window.__stubStorage) return;
    const AREA = 'viewstate-e2e-store';
    const readAll = () => { try { return JSON.parse(localStorage.getItem(AREA) || '{}'); } catch (e) { return {}; } };
    const writeAll = (obj) => localStorage.setItem(AREA, JSON.stringify(obj));
    const listeners = [];
    const fire = (changes) => { for (const l of listeners) { try { l(changes, 'local'); } catch (e) {} } };
    const area = {
        get(keys, cb) {
            const all = readAll();
            let out = {};
            if (keys == null) out = { ...all };
            else if (typeof keys === 'string') { if (keys in all) out[keys] = all[keys]; }
            else if (Array.isArray(keys)) { for (const k of keys) if (k in all) out[k] = all[k]; }
            else if (typeof keys === 'object') { for (const k of Object.keys(keys)) out[k] = k in all ? all[k] : keys[k]; }
            setTimeout(() => cb(out), 0);
        },
        set(obj, cb) {
            const all = readAll();
            const changes = {};
            for (const [k, v] of Object.entries(obj)) {
                changes[k] = { oldValue: all[k], newValue: v };
                all[k] = v;
            }
            writeAll(all);
            setTimeout(() => { if (cb) cb(); fire(changes); }, 0);
        },
        remove(keys, cb) {
            const all = readAll();
            const changes = {};
            for (const k of Array.isArray(keys) ? keys : [keys]) {
                if (k in all) { changes[k] = { oldValue: all[k], newValue: undefined }; delete all[k]; }
            }
            writeAll(all);
            setTimeout(() => { if (cb) cb(); fire(changes); }, 0);
        }
    };
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || { lastError: undefined };
    window.chrome.storage = {
        local: area,
        sync: { get(keys, cb) { const d = (keys && typeof keys === 'object' && !Array.isArray(keys)) ? keys : {}; setTimeout(() => cb({ ...d }), 0); } },
        onChanged: { addListener(l) { listeners.push(l); }, removeListener() {} }
    };
    window.__stubStorage = { read: readAll, write: writeAll };
})();`;

async function main() {
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    const page = targets.filter(t => t.type === 'page').find(t => /^https?:/.test(t.url)) ||
        targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let finished = false;
    ws.onclose = () => {
        if (!finished) { console.log('FAIL: debugger websocket closed unexpectedly'); process.exitCode = 1; }
    };
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id);
            pending.delete(m.id);
            m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        } else if (m.method === 'Page.loadEventFired') {
            while (loadWaiters.length) loadWaiters.shift()();
        }
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: STORAGE_STUB });
    await navigateTo('about:blank');
    const vh = await evalPage('window.innerHeight');
    if (!vh || vh < 200) {
        console.log('FAIL: headless viewport collapsed (innerHeight=' + vh + ') — results would be meaningless');
        process.exitCode = 1;
        ws.close();
        process.exit(1);
    }

    // ---- Save path: zoom button + scroll produce one persisted object ----
    await openViewer();
    await evalPage(`document.getElementById('zoom_in').click()`); // 1.25 -> 1.5
    await sleep(300);
    await evalPage(`(() => {
        const vc = document.getElementById('viewerContainer');
        const p3 = document.querySelector('.page[data-page-number="3"]');
        vc.scrollTop = p3.offsetTop + p3.offsetHeight * 0.4; // mid page 3
    })()`);
    await sleep(1800); // debounce (1s) must fire
    const saved = await readStoredLastPage();
    const liveState = await readViewerState();
    assert(saved && typeof saved === 'object', 'scroll + zoom persist as an object under the resume key', saved);
    assert(saved && saved.page === 3, 'saved page is 3', saved);
    assert(saved && Math.abs(saved.zoom - 1.5) < 0.001, 'saved zoom is 1.5 (one zoom-in from default)', saved);
    assert(saved && Number.isFinite(saved.scrollRatio) && saved.scrollRatio > 0 && saved.scrollRatio < 1,
        'saved scrollRatio is a fraction of document height', saved);
    assert(saved && Math.abs(saved.scrollRatio - liveState.scrollRatio) < 0.005,
        'saved scrollRatio matches the live position', { saved: saved && saved.scrollRatio, live: liveState.scrollRatio });

    // ---- Restore path: reopen lands on the same zoom and exact position ----
    const savedBeforeReopen = JSON.stringify(await readStoredLastPage());
    await openViewer();
    let s = await readViewerState();
    assert(s.zoomLabel === '150%', 'reopened at the saved zoom (150%)', s);
    assert(s.page === 3, 'reopened on the saved page 3', s);
    assert(Math.abs(s.scrollRatio - saved.scrollRatio) < 0.01,
        'reopened at the saved scroll ratio (exact position)', { restored: s.scrollRatio, saved: saved.scrollRatio });
    const storedAfterReopen = await readStoredLastPage();
    assert(JSON.stringify(storedAfterReopen) === savedBeforeReopen,
        'untouched session writes nothing back (no redundant save after restore)', storedAfterReopen);

    // ---- Legacy bare-number record: page-top resume, then schema upgrade ----
    await writeStoredLastPage(2);
    await openViewer();
    s = await readViewerState();
    assert(s.page === 2, 'legacy bare page number still resumes on that page', s);
    assert(s.zoomLabel === '125%', 'legacy record carries no zoom, default applies', s);
    assert(s.targetOffset !== null && s.targetOffset >= 0 && s.targetOffset < 40,
        'legacy resume lands at the page top (scrollToPage\u2019s -20px lead, not a stored ratio)', s);
    await sleep(1800); // the first natural save upgrades the record
    const upgraded = await readStoredLastPage();
    assert(upgraded && typeof upgraded === 'object' && upgraded.page === 2 && Math.abs(upgraded.zoom - 1.25) < 0.001,
        'legacy record upgrades to the object schema at the next save', upgraded);

    // ---- Corrupt record: every field rejected, loads at page 1, no crash ----
    await writeStoredLastPage({ page: 'x', zoom: -2, scrollRatio: 7 });
    await openViewer();
    s = await readViewerState();
    assert(s.page === 1 && s.zoomLabel === '125%', 'corrupt fields are ignored, fresh view at page 1', s);

    // ---- Coercion guards (parseStoredViewState): only number primitives
    // count as zoom/scrollRatio. Number(null)===0, Number('')===0 and
    // Number([])===0 used to turn an absent scrollRatio into "restore at
    // the very top" (bypassing the page-top fallback below), and
    // Number(true)===1 accepted booleans as zoom 1.0 / document bottom.
    for (const badRatio of [null, false, '', [], true]) {
        await writeStoredLastPage({ page: 2, zoom: 1.5, scrollRatio: badRatio });
        await openViewer();
        s = await readViewerState();
        assert(s.page === 2 && s.zoomLabel === '150%' && s.targetOffset !== null && s.targetOffset >= 0 && s.targetOffset < 40,
            'non-number scrollRatio (' + JSON.stringify(badRatio) + ') means absent: page-top resume, saved zoom', s);
    }
    await writeStoredLastPage({ page: 2, zoom: true, scrollRatio: true });
    await openViewer();
    s = await readViewerState();
    assert(s.page === 2 && s.zoomLabel === '125%' && s.targetOffset !== null && s.targetOffset >= 0 && s.targetOffset < 40,
        'boolean zoom/scrollRatio rejected: default zoom, page-top resume', s);

    // ---- Dirty-check coercion guard (viewStateDirty): a partial record
    // with a numeric zoom and null ratio must still compare dirty at the
    // document top. null coerces to 0 in the drift arithmetic, so a tiny
    // scroll (< ratio epsilon) used to compare clean and the record never
    // upgraded to the full schema. ----
    await writeStoredLastPage({ page: 1, zoom: 1.25, scrollRatio: null });
    await openViewer();
    await evalPage(`document.getElementById('viewerContainer').scrollTop += 5`); // below the ratio epsilon
    await sleep(1800); // debounce (1s) must fire and upgrade the record
    const upgradedPartial = await readStoredLastPage();
    assert(upgradedPartial && typeof upgradedPartial === 'object' &&
        upgradedPartial.page === 1 && Math.abs(upgradedPartial.zoom - 1.25) < 0.001 &&
        typeof upgradedPartial.scrollRatio === 'number',
        'null scrollRatio with matching zoom still upgrades at the first natural save', upgradedPartial);

    // ---- Out-of-range zoom clamps into the allowed range ----
    await writeStoredLastPage({ page: 1, zoom: 50, scrollRatio: 0 });
    await openViewer();
    s = await readViewerState();
    assert(s.zoomLabel === '500%', 'out-of-range saved zoom clamps to MAX_SCALE', s);
    assert(s.page === 1 && Math.abs(s.scrollRatio) < 0.01, 'ratio 0 restores to the very top', s);

    console.log(process.exitCode ? 'VIEWSTATE E2E FAILED' : 'VIEWSTATE E2E PASSED');
    finished = true;
    ws.close();
    process.exit(process.exitCode || 0);
}

main().catch(e => { console.error('VIEWSTATE E2E ERROR:', e.message); process.exit(1); });
