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
    webRequest: { onHeadersReceived: events.webRequestOnHeadersReceived },
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

async function main() {
    const fileOf = (url) => 'chrome-extension://' + EXT_ID + '/pdf/web/custom-viewer.html?file=' + encodeURIComponent(url);

    // ---- webNavigation path: URL carries the fragment ----
    events.webNavigationOnBeforeNavigate._fire({ frameId: 0, tabId: 1, url: 'https://example.com/paper.pdf#page=2' });
    await settle();
    let ups = updatesFor(1);
    assert(ups.length === 1, 'onBeforeNavigate fragment URL redirects exactly once', ups);
    assert(ups[0] && ups[0].url === fileOf('https://example.com/paper.pdf') + '#page=2',
        '?file= is fragment-free and the hash rides the viewer URL (webNavigation)', ups[0] && ups[0].url);
    assert(ups[0] && !ups[0].url.includes('%23'), 'no %-encoded fragment inside the ?file= value', ups[0] && ups[0].url);

    // The PDF response still arrives for the in-flight navigation: the
    // header listener must be deduped despite the hash/fragment asymmetry.
    events.webRequestOnHeadersReceived._fire({
        type: 'main_frame', tabId: 1, url: 'https://example.com/paper.pdf',
        responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }]
    });
    await settle();
    assert(updatesFor(1).length === 1, 'webRequest re-fire for the same navigation is deduped', updatesFor(1));

    // ---- webRequest path: fragment recovered from onBeforeNavigate memory ----
    // No .pdf extension, so the navigation listener only records the
    // fragment; the PDF nature surfaces via Content-Type alone.
    events.webNavigationOnBeforeNavigate._fire({ frameId: 0, tabId: 2, url: 'https://example.com/view?id=3#page=5' });
    await settle();
    assert(updatesFor(2).length === 0, 'non-Pdf navigation is not redirected by URL shape', updatesFor(2));
    events.webRequestOnHeadersReceived._fire({
        type: 'main_frame', tabId: 2, url: 'https://example.com/view?id=3',
        responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }]
    });
    await settle();
    ups = updatesFor(2);
    assert(ups.length === 1, 'Content-Type detection redirects exactly once', ups);
    assert(ups[0] && ups[0].url === fileOf('https://example.com/view?id=3') + '#page=5',
        'fragment remembered from onBeforeNavigate is re-attached on the viewer hash', ups[0] && ups[0].url);
    assert(ups[0] && !ups[0].url.includes('%23'), 'no %-encoded fragment inside ?file= (webRequest path)', ups[0] && ups[0].url);

    // ---- No fragment anywhere: viewer URL unchanged in shape ----
    events.webNavigationOnBeforeNavigate._fire({ frameId: 0, tabId: 3, url: 'https://example.com/plain.pdf' });
    await settle();
    ups = updatesFor(3);
    assert(ups.length === 1 && ups[0].url === fileOf('https://example.com/plain.pdf'),
        'fragment-less PDF builds the historical viewer URL', ups);

    console.log(process.exitCode ? 'VIEWER-URL TEST FAILED' : 'VIEWER-URL TEST PASSED');
    process.exit(process.exitCode || 0);
}

main().catch(e => { console.error('VIEWER-URL TEST ERROR:', e && e.stack || e); process.exit(1); });
