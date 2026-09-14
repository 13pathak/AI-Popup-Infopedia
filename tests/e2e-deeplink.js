// CDP-driven E2E test for #page=N deep links (issue #17). Loads the real
// viewer in headless Edge/Chrome with deep-link fragments on the viewer
// URL — the form the background interception re-attaches from the original
// PDF URL — and asserts the page the viewer settles on. Run with the
// viewer served on http://127.0.0.1:8793 and headless browser on port 9333:
//   node tests/e2e-deeplink.js
const CDP_PORT = 9333;
const BASE = 'http://127.0.0.1:8793/pdf/web/custom-viewer.html?file=/tests/test_highlight.pdf';

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

// Resolves on the next Page.loadEventFired. Registration must precede the
// navigate it belongs to; awaiting it serializes the driver against the
// document lifecycle, so no eval ever runs in a stale previous document
// (whose already-rendered selectors would otherwise match instantly and
// lag every read one navigation behind).
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

// Consecutive cases share the same ?file= URL, so the fragment is the only
// difference — a straight Page.navigate between them would be treated as a
// same-document hash change and never reload the viewer. Bounce through
// about:blank so every case is a fresh document load.
async function openWithHash(fragment) {
    console.log('  case:', fragment || '(none)');
    await navigateTo('about:blank');
    await navigateTo(BASE + fragment);
    // The load event fired in the new document; wait for the deep-link
    // scroll (300ms timer after render) to settle on a stable page number.
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
    await sleep(900);
    const result = await evalPage(`(() => {
        const num = document.getElementById('page_num').value;
        const div = document.querySelector('.page[data-page-number="' + num + '"]');
        const vc = document.getElementById('viewerContainer');
        const vr = vc.getBoundingClientRect();
        const dr = div ? div.getBoundingClientRect() : null;
        return {
            page: parseInt(num, 10),
            hash: location.hash,
            targetVisible: !!(dr && dr.bottom > vr.top && dr.top < vr.bottom)
        };
    })()`);
    // Diagnostic geometry, attached for assert() to print on failure:
    // distinguishes "scrolled to the wrong page" from "viewport collapsed
    // again" at a glance.
    result.diag = await evalPage(`(() => {
        const vc = document.getElementById('viewerContainer');
        return {
            scrollTop: vc.scrollTop,
            clientH: vc.clientHeight,
            pages: [...document.querySelectorAll('.page')].map(p => p.offsetTop + '/' + p.offsetHeight).join(' ')
        };
    })()`);
    return result;
}

async function main() {
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    // Pick the viewer tab, not just any page target: minutes into an Edge
    // session a first-run edge://sync-confirmation-dialog window appears
    // (360x202) and is listed first — driving it explains every "collapsed
    // viewport" symptom. Prefer real http(s) pages; fall back for a
    // freshly launched browser whose only tab is still about:blank.
    const page = targets.filter(t => t.type === 'page').find(t => /^https?:/.test(t.url)) ||
        targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let finished = false;
    // A silently closed debugger socket otherwise leaves every pending
    // send unsettled; the event loop drains and node exits 0 mid-run
    // looking like success. Surface it loudly instead.
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
    // Viewport sanity gate: headless=new occasionally starts with a
    // collapsed (0-4px tall) window even with --window-size, which
    // degenerates every height-based check in the viewer (current-page
    // detection, visibility) even though scrolls land exactly where they
    // should. Fail loudly on that environment state instead of letting it
    // masquerade as viewer bugs.
    await navigateTo('about:blank');
    const vh = await evalPage('window.innerHeight');
    if (!vh || vh < 200) {
        console.log('FAIL: headless viewport collapsed (innerHeight=' + vh + ') — browser/window sizing is broken, results would be meaningless');
        process.exitCode = 1;
        ws.close();
        process.exit(1);
    }

    // ---- Page-number deep links ----
    let s = await openWithHash('#page=2');
    assert(s.hash === '#page=2' && s.page === 2 && s.targetVisible, '#page=2 lands on page 2, visible', s);

    s = await openWithHash('#page=3');
    assert(s.hash === '#page=3' && s.page === 3 && s.targetVisible, '#page=3 lands on page 3, visible', s);

    s = await openWithHash('#page=2&zoom=100');
    assert(s.hash === '#page=2&zoom=100' && s.page === 2, 'parameter list #page=2&zoom=100 uses the page param', s);

    s = await openWithHash('#page=99');
    assert(s.hash === '#page=99' && s.page === 3, '#page=99 clamps to the last page', s);

    // Unusable page values link no valid page: no deep-link jump (and no
    // stored last page in this plain-HTTP context), so page 1.
    s = await openWithHash('#page=0');
    assert(s.hash === '#page=0' && s.page === 1, '#page=0 ignored, stays on page 1', s);

    s = await openWithHash('#page=abc');
    assert(s.hash === '#page=abc' && s.page === 1, '#page=abc ignored, stays on page 1', s);

    // ---- Named destinations ----
    s = await openWithHash('#nameddest=ChapterTwo');
    assert(s.hash === '#nameddest=ChapterTwo' && s.page === 2 && s.targetVisible, '#nameddest=ChapterTwo resolves to page 2', s);

    s = await openWithHash('#ChapterTwo');
    assert(s.hash === '#ChapterTwo' && s.page === 2, 'bare #ChapterTwo treated as named destination', s);

    s = await openWithHash('#Final%20Page');
    assert(s.hash === '#Final%20Page' && s.page === 3, 'percent-encoded #Final%20Page decodes before lookup', s);

    s = await openWithHash('#NoSuchChapter');
    assert(s.hash === '#NoSuchChapter' && s.page === 1, 'unknown named destination ignored, stays on page 1', s);

    // ---- No fragment: unchanged load behavior ----
    s = await openWithHash('');
    assert(s.hash === '' && s.page === 1 && s.targetVisible, 'no fragment loads at page 1', s);

    console.log(process.exitCode ? 'DEEPLINK E2E FAILED' : 'DEEPLINK E2E PASSED');
    finished = true;
    ws.close();
    process.exit(process.exitCode || 0);
}

main().catch(e => { console.error('DEEPLINK E2E ERROR:', e.message); process.exit(1); });
