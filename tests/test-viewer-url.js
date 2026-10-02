// Unit test for the viewer-URL construction in the real background.js
// (issue #17 regression: no fragment may be %-encoded into ?file=; the
// deep link rides the viewer's own hash only). Loads the actual service
// worker source into a VM with a stubbed chrome API, fires the real
// webNavigation/webRequest listeners, and inspects the tabs.update calls
// they produce. No browser or server needed:
//   node tests/test-viewer-url.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT_ID = 'a'.repeat(32);
const tabsUpdates = []; // { tabId, url } for every chrome.tabs.update call

// Event surfaces whose handlers the test fires: addListener captures them.
function eventSurface() {
    const handlers = [];
    return {
        addListener: (fn) => handlers.push(fn),
        _fire: (...args) => handlers.map(fn => fn(...args))
    };
}

// Storage areas must satisfy both call styles the worker uses: callback
// (last argument) and awaited promise. Reads resolve {} so the warm-up
// IIFEs (redirectedTabsLoaded, pdfViewerEnabledLoaded) settle and
// redirectToPdfViewer's Promise.all completes.
function storageArea() {
    return {
        get: (keys, cb) => {
            const done = (val) => { if (typeof cb === 'function') cb(val); };
            // sync.get({ pdfViewerEnabled: true }) expects the defaults
            // mirrored back when nothing is stored.
            const val = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
            done(val);
            return Promise.resolve(val);
        },
        set: (obj, cb) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
        }
    };
}

const events = {
    webNavigationOnBeforeNavigate: eventSurface(),
    webRequestOnBeforeRequest: eventSurface(),
    webRequestOnHeadersReceived: eventSurface(),
    tabsOnRemoved: eventSurface(),
    storageOnChanged: eventSurface(),
    runtimeOnInstalled: eventSurface(),
    runtimeOnStartup: eventSurface(),
    runtimeOnMessage: eventSurface(),
    commandsOnCommand: eventSurface(),
    alarmsOnAlarm: eventSurface(),
    downloadsOnChanged: eventSurface(),
    actionOnClicked: eventSurface()
};

const chromeStub = {
    runtime: {
        id: EXT_ID,
        lastError: null,
        getURL: (p) => 'chrome-extension://' + EXT_ID + '/' + p,
        sendMessage: (msg, cb) => { if (typeof cb === 'function') cb({}); },
        openOptionsPage: (cb) => { if (typeof cb === 'function') cb(); },
        onInstalled: events.runtimeOnInstalled,
        onStartup: events.runtimeOnStartup,
        onMessage: events.runtimeOnMessage
    },
    storage: {
        local: storageArea(),
        sync: storageArea(),
        session: storageArea(),
        onChanged: events.storageOnChanged
    },
    tabs: {
        update: (tabId, props, cb) => {
            tabsUpdates.push({ tabId, url: props.url });
            if (typeof cb === 'function') cb();
        },
        create: (props, cb) => { if (typeof cb === 'function') cb(); },
        query: (q, cb) => { if (typeof cb === 'function') cb([]); },
        sendMessage: (tabId, msg, cb) => { if (typeof cb === 'function') cb({}); },
        getCurrent: (cb) => { if (typeof cb === 'function') cb(undefined); },
        onRemoved: events.tabsOnRemoved
    },
    webNavigation: { onBeforeNavigate: events.webNavigationOnBeforeNavigate },
    webRequest: { onBeforeRequest: events.webRequestOnBeforeRequest, onHeadersReceived: events.webRequestOnHeadersReceived },
    alarms: {
        create: () => {},
        get: (name, cb) => { if (typeof cb === 'function') cb(); },
        onAlarm: events.alarmsOnAlarm
    },
    downloads: {
        download: (opts, cb) => { if (typeof cb === 'function') cb(1); },
        onChanged: events.downloadsOnChanged
    },
    action: {
        onClicked: events.actionOnClicked,
        setBadgeText: () => {},
        setBadgeBackgroundColor: () => {},
        setBadgeTextColor: () => {}
    },
    commands: { onCommand: events.commandsOnCommand }
};

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const context = vm.createContext({ chrome: chromeStub, console, setTimeout, clearTimeout, setInterval, clearInterval, URL, fetch: () => Promise.reject(new Error('no network in unit test')) });
vm.runInContext(source, context, { filename: 'background.js' });

function assert(cond, label, extra) {
    if (!cond) {
        console.log('FAIL: ' + label + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
        process.exitCode = 1;
    } else {
        console.log('pass: ' + label);
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function settle() {
    // redirectToPdfViewer awaits storage warm-up promises; a short sleep
    // lets those microtasks and the tabs.update callback run out.
    await sleep(25);
}
const updatesFor = (tabId) => tabsUpdates.filter(u => u.tabId === tabId);

function navigateGet(details) {
    events.webNavigationOnBeforeNavigate._fire(details);
    events.webRequestOnBeforeRequest._fire({
        ...details, type: 'main_frame', method: 'GET', url: details.url.split('#')[0]
    });
}

async function main() {
    const fileOf = (url) => 'chrome-extension://' + EXT_ID + '/pdf/web/custom-viewer.html?file=' + encodeURIComponent(url);

    // ---- GET request path: navigation supplies the fragment ----
    events.webNavigationOnBeforeNavigate._fire({ frameId: 0, tabId: 1, url: 'https://example.com/paper.pdf#page=2' });
    await settle();
    assert(updatesFor(1).length === 0, 'URL shape alone cannot redirect before the HTTP method is known');
    navigateGet({ frameId: 0, tabId: 1, url: 'https://example.com/paper.pdf#page=2' });
    await settle();
    let ups = updatesFor(1);
    assert(ups.length === 1, 'GET PDF request redirects exactly once', ups);
    assert(ups[0] && ups[0].url === fileOf('https://example.com/paper.pdf') + '#page=2',
        '?file= is fragment-free and the hash rides the viewer URL (webNavigation)', ups[0] && ups[0].url);
    assert(ups[0] && !ups[0].url.includes('%23'), 'no %-encoded fragment inside the ?file= value', ups[0] && ups[0].url);

    // The PDF response still arrives for the in-flight navigation: the
    // header listener must be deduped despite the hash/fragment asymmetry.
    events.webRequestOnHeadersReceived._fire({
        type: 'main_frame', method: 'GET', tabId: 1, url: 'https://example.com/paper.pdf',
        responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }]
    });
    await settle();
    assert(updatesFor(1).length === 1, 'webRequest re-fire for the same navigation is deduped', updatesFor(1));

    // ---- webRequest path: fragment recovered from onBeforeNavigate memory ----
    // No .pdf extension, so the navigation listener only records the
    // fragment; the PDF nature surfaces via Content-Type alone.
    navigateGet({ frameId: 0, tabId: 2, url: 'https://example.com/view?id=3#page=5' });
    await settle();
    assert(updatesFor(2).length === 0, 'non-Pdf navigation is not redirected by URL shape', updatesFor(2));
    events.webRequestOnHeadersReceived._fire({
        type: 'main_frame', method: 'GET', tabId: 2, url: 'https://example.com/view?id=3',
        responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }]
    });
    await settle();
    ups = updatesFor(2);
    assert(ups.length === 1, 'Content-Type detection redirects exactly once', ups);
    assert(ups[0] && ups[0].url === fileOf('https://example.com/view?id=3') + '#page=5',
        'fragment remembered from onBeforeNavigate is re-attached on the viewer hash', ups[0] && ups[0].url);
    assert(ups[0] && !ups[0].url.includes('%23'), 'no %-encoded fragment inside ?file= (webRequest path)', ups[0] && ups[0].url);

    // ---- No fragment anywhere: viewer URL unchanged in shape ----
    navigateGet({ frameId: 0, tabId: 3, url: 'https://example.com/plain.pdf' });
    await settle();
    ups = updatesFor(3);
    assert(ups.length === 1 && ups[0].url === fileOf('https://example.com/plain.pdf'),
        'fragment-less PDF builds the historical viewer URL', ups);

    // ---- New navigation, different fragment, inside the dedupe TTL ----
    // The reported regression: doc.pdf#page=2, Back, then doc.pdf#page=40
    // within 10s. The marks share the fragment-stripped URL, so naive
    // modulo-fragment matching suppressed the second redirect; the mark's
    // navHash (the navigation's fragment) must tell them apart.
    navigateGet({ frameId: 0, tabId: 4, url: 'https://example.com/doc.pdf#page=2' });
    await settle();
    navigateGet({ frameId: 0, tabId: 4, url: 'https://example.com/doc.pdf#page=40' });
    await settle();
    ups = updatesFor(4);
    assert(ups.length === 2, 'same document with a different fragment redirects again inside the TTL', ups);
    assert(ups[1] && ups[1].url === fileOf('https://example.com/doc.pdf') + '#page=40',
        'second fragment navigation carries its own deep link', ups[1] && ups[1].url);

    // An identical full URL within the TTL stays suppressed (the
    // historical tradeoff of the dedupe window) — asserted against the
    // current mark, i.e. before any other navigation re-marks the tab.
    navigateGet({ frameId: 0, tabId: 4, url: 'https://example.com/doc.pdf#page=40' });
    await settle();
    assert(updatesFor(4).length === 2, 'identical URL within the TTL stays deduped', updatesFor(4).length);

    // Bare re-navigation of a previously-fragmented URL is also new.
    navigateGet({ frameId: 0, tabId: 4, url: 'https://example.com/doc.pdf' });
    await settle();
    ups = updatesFor(4);
    assert(ups.length === 3 && ups[2].url === fileOf('https://example.com/doc.pdf'),
        'bare re-navigation of the same document redirects again', ups);

    navigateGet({ frameId: 0, tabId: 4, url: 'https://example.com/doc.pdf' });
    await settle();
    assert(updatesFor(4).length === 3, 'identical bare URL within the TTL stays deduped', updatesFor(4).length);

    // ---- Content-Type path: fragments the webRequest URL cannot show ----
    // Marks made from the header listener store the remembered fragment,
    // so a later navigation whose remembered fragment differs redirects
    // even though both webRequest URLs are byte-identical.
    navigateGet({ frameId: 0, tabId: 5, url: 'https://example.com/view?id=3#page=5' });
    await settle();
    events.webRequestOnHeadersReceived._fire({
        type: 'main_frame', method: 'GET', tabId: 5, url: 'https://example.com/view?id=3',
        responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }]
    });
    await settle();
    navigateGet({ frameId: 0, tabId: 5, url: 'https://example.com/view?id=3#page=9' });
    await settle();
    events.webRequestOnHeadersReceived._fire({
        type: 'main_frame', method: 'GET', tabId: 5, url: 'https://example.com/view?id=3',
        responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }]
    });
    await settle();
    ups = updatesFor(5);
    assert(ups.length === 2, 'same Content-Type document with a different remembered fragment redirects again', ups);
    assert(ups[1] && ups[1].url === fileOf('https://example.com/view?id=3') + '#page=9',
        'Content-Type re-navigation carries the new fragment', ups[1] && ups[1].url);

    // ---- POST reports must keep their original response/body ----
    // Include the early .pdf/arXiv paths as well as both MIME-based paths.
    let nextTab = 20;
    for (const [url, contentType, method] of [
        ['https://example.com/report.pdf', 'application/pdf', 'POST'],
        ['https://example.com/generate', 'application/pdf', 'POST'],
        ['https://example.com/download', 'application/octet-stream', 'POST'],
        ['https://example.com/report.pdf', 'application/octet-stream', 'POST'],
        ['https://arxiv.org/pdf/1234.5678', 'application/pdf', 'POST'],
        ['https://example.com/report.pdf', 'application/pdf', 'PUT'],
        ['https://example.com/report.pdf', 'application/pdf', undefined]
    ]) {
        const tabId = nextTab++;
        events.webNavigationOnBeforeNavigate._fire({ frameId: 0, tabId, url: url + '#page=2' });
        await settle();
        events.webRequestOnBeforeRequest._fire({ type: 'main_frame', tabId, url, method });
        await settle();
        events.webRequestOnHeadersReceived._fire({
            type: 'main_frame', tabId, url, method,
            responseHeaders: [
                { name: 'Content-Type', value: contentType },
                { name: 'Content-Disposition', value: 'inline; filename="report.pdf"' }
            ]
        });
        await settle();
        assert(updatesFor(tabId).length === 0, `${method || 'unknown method'} ${url} remains native (${contentType})`, updatesFor(tabId));
        // A skipped POST must not leave a bypass mark that swallows a later GET.
        navigateGet({ frameId: 0, tabId, url });
        events.webRequestOnHeadersReceived._fire({
            type: 'main_frame', tabId, url, method: 'GET',
            responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }]
        });
        await settle();
        assert(updatesFor(tabId).length === 1, 'a subsequent GET in the same tab still opens the custom viewer', updatesFor(tabId));
    }

    // Redirect hops must use the current method: 307/308 keep POST; a
    // 303 landing page fetched with GET can use the custom viewer.
    const redirectTab = nextTab++;
    events.webRequestOnBeforeRequest._fire({ type: 'main_frame', tabId: redirectTab, url: 'https://example.com/generate', method: 'POST' });
    events.webRequestOnBeforeRequest._fire({ type: 'main_frame', tabId: redirectTab, url: 'https://example.com/redirected.pdf', method: 'POST' });
    events.webRequestOnHeadersReceived._fire({ type: 'main_frame', tabId: redirectTab, url: 'https://example.com/redirected.pdf', method: 'POST',
        responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }] });
    await settle();
    assert(updatesFor(redirectTab).length === 0, 'redirects that preserve POST are not intercepted');
    events.webRequestOnBeforeRequest._fire({ type: 'main_frame', tabId: redirectTab, url: 'https://example.com/result.pdf', method: 'GET' });
    await settle();
    assert(updatesFor(redirectTab).length === 1, 'redirects that switch to GET can open the viewer');

    const binaryTab = nextTab++;
    navigateGet({ frameId: 0, tabId: binaryTab, url: 'https://example.com/download#page=3' });
    events.webRequestOnHeadersReceived._fire({ type: 'main_frame', tabId: binaryTab, url: 'https://example.com/download', method: 'GET',
        responseHeaders: [{ name: 'Content-Type', value: 'application/octet-stream' }, { name: 'Content-Disposition', value: 'attachment; filename="report.pdf"' }] });
    await settle();
    assert(updatesFor(binaryTab)[0]?.url === fileOf('https://example.com/download') + '#page=3', 'GET binary PDF detection retains its deep link');

    const localTab = nextTab++;
    events.webNavigationOnBeforeNavigate._fire({ frameId: 0, tabId: localTab, url: 'file:///C:/reports/local.pdf#page=4' });
    await settle();
    assert(updatesFor(localTab)[0]?.url === fileOf('file:///C:/reports/local.pdf') + '#page=4', 'local PDF files still use navigation interception');
    for (const type of ['sub_frame', 'xmlhttprequest']) {
        const tabId = nextTab++;
        events.webRequestOnBeforeRequest._fire({ type, tabId, url: 'https://example.com/report.pdf', method: 'GET' });
        events.webRequestOnHeadersReceived._fire({ type, tabId, url: 'https://example.com/report.pdf', method: 'GET',
            responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }] });
        await settle();
        assert(updatesFor(tabId).length === 0, `${type} PDF requests do not redirect the tab`);
    }

    console.log(process.exitCode ? 'VIEWER-URL TEST FAILED' : 'VIEWER-URL TEST PASSED');
    process.exit(process.exitCode || 0);
}

main().catch(e => { console.error('VIEWER-URL TEST ERROR:', e && e.stack || e); process.exit(1); });
