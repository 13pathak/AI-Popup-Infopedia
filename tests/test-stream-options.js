// Unit test for the stream_options fallback gate in the real background.js
// (Issue #28 follow-up). OpenAI-compatible lookups send
// stream_options: { include_usage: true } so the terminal SSE chunk carries
// token usage; strict servers that reject the field get one clean retry
// without it. The retry gate is two predicates:
//   isStreamOptionsRejectionStatus(status) — 400 (OpenAI/Groq convention)
//     and 422 (FastAPI/Pydantic proxies that forbid extra body fields)
//   bodyRejectsStreamOptions(response)    — the error body names the field
// Loads the actual service worker source into a VM with a stubbed chrome
// API (same pattern as test-viewer-url.js; no browser or server needed):
//   node tests/test-stream-options.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT_ID = 'b'.repeat(32);

function eventSurface() {
    const handlers = [];
    return {
        addListener: (fn) => handlers.push(fn),
        _fire: (...args) => handlers.map(fn => fn(...args))
    };
}

// Reads mirror defaults back; writes record. The worker's warm-up IIFEs
// settle against this without touching anything the test observes.
function storageArea() {
    return {
        get: (keys, cb) => {
            const val = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
            if (typeof cb === 'function') cb(val);
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
    downloadsOnChanged: eventSurface()
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
        update: (tabId, props, cb) => { if (typeof cb === 'function') cb(); },
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

// Response stand-in: only clone().text() is needed by the peek helper.
function fakeResponse(bodyText) {
    return { clone: () => ({ text: async () => bodyText }) };
}

async function main() {
    // ---- status gate ----
    assert(context.isStreamOptionsRejectionStatus(400) === true, '400 counts as a stream_options rejection');
    assert(context.isStreamOptionsRejectionStatus(422) === true, '422 (FastAPI extra_forbidden) counts as a stream_options rejection');
    assert(context.isStreamOptionsRejectionStatus(401) === false, '401 is not a stream_options rejection');
    assert(context.isStreamOptionsRejectionStatus(500) === false, '500 is not a stream_options rejection');
    assert(context.isStreamOptionsRejectionStatus(200) === false, '200 is not a stream_options rejection');

    // ---- body sniff ----
    const fastapiBody = JSON.stringify({
        detail: [{ type: 'extra_forbidden', loc: ['body', 'stream_options'], msg: 'Extra inputs are not permitted' }]
    });
    assert((await context.bodyRejectsStreamOptions(fakeResponse(fastapiBody))) === true,
        'FastAPI 422 body naming stream_options is detected');

    const openaiBody = JSON.stringify({ error: { message: "Unrecognized request argument supplied: stream_options", type: 'invalid_request_error' } });
    assert((await context.bodyRejectsStreamOptions(fakeResponse(openaiBody))) === true,
        'OpenAI-style body naming stream_options is detected');

    assert((await context.bodyRejectsStreamOptions(fakeResponse(JSON.stringify({ error: { message: 'The model `nope` does not exist' } })))) === false,
        'unrelated 400 body does not trigger the retry');

    assert((await context.bodyRejectsStreamOptions(fakeResponse(JSON.stringify({ error: { message: 'include_usage must be true' } })))) === true,
        'body naming include_usage is detected (field-level variant)');

    assert((await context.bodyRejectsStreamOptions({ clone: () => { throw new Error('body already consumed'); } })) === false,
        'unreadable body fails closed (no retry)');

    console.log(process.exitCode ? 'STREAM-OPTIONS TEST FAILED' : 'STREAM-OPTIONS TEST PASSED');
}

main();
