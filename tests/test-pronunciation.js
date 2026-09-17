// Unit tests for the direct pronunciation & IPA badge (Issue #37) in the
// real background.js. Two layers are covered:
//   sanitizeIpaText()        — reduces model answers to a plausible IPA
//                              transcription (delimiters, prose, respellings)
//   getWordPronunciation msg — resolves the model, makes ONE non-streaming
//                              ask, coalesces concurrent requests, caches
//                              successes per word in session storage, and
//                              answers { ipa: null } on every failure path
//                              so the popup badge simply stays hidden.
// Loads the actual service worker source into a VM with a stubbed chrome
// API (same pattern as test-stream-options.js; no browser or server):
//   node tests/test-pronunciation.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT_ID = 'p'.repeat(32);

function eventSurface() {
    const handlers = [];
    return {
        addListener: (fn) => handlers.push(fn),
        _fire: (...args) => handlers.map(fn => fn(...args))
    };
}

// Object-backed storage area: get() honors string/array/object keys and
// falls back to the caller's defaults, set() persists into the backing map
// so the pronunciation cache survives across handler invocations.
function storageArea(backing) {
    return {
        get: (keys, cb) => {
            const out = {};
            if (typeof keys === 'string') {
                if (backing[keys] !== undefined) out[keys] = backing[keys];
            } else if (Array.isArray(keys)) {
                keys.forEach(k => { if (backing[k] !== undefined) out[k] = backing[k]; });
            } else if (keys && typeof keys === 'object') {
                Object.keys(keys).forEach(k => {
                    out[k] = backing[k] !== undefined ? backing[k] : keys[k];
                });
            }
            if (typeof cb === 'function') cb(out);
            return Promise.resolve(out);
        },
        set: (obj, cb) => {
            Object.keys(obj).forEach(k => { backing[k] = JSON.parse(JSON.stringify(obj[k])); });
            if (typeof cb === 'function') cb();
            return Promise.resolve();
        }
    };
}

const syncBacking = {};
const localBacking = {};
const sessionBacking = {};

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
        local: storageArea(localBacking),
        sync: storageArea(syncBacking),
        session: storageArea(sessionBacking),
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

// Controllable fetch: each test installs the next behavior and we count
// how many network asks the handler actually spent.
let fetchCalls = [];
let fetchImpl = () => Promise.reject(new Error('no fetch installed'));

const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const context = vm.createContext({
    chrome: chromeStub,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    AbortController,
    fetch: (...args) => {
        fetchCalls.push(args);
        return fetchImpl(...args);
    }
});
vm.runInContext(source, context, { filename: 'background.js' });

function assert(cond, label, extra) {
    if (!cond) {
        console.log('FAIL: ' + label + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
        process.exitCode = 1;
    } else {
        console.log('pass: ' + label);
    }
}

const flush = () => new Promise(r => setTimeout(r, 20));

// Fires the message handler and resolves with the sendResponse payload.
function askPronunciation(request) {
    return new Promise((resolve) => {
        events.runtimeOnMessage._fire(request, { tab: { id: 1 } }, resolve);
    });
}

function okChatResponse(content) {
    return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ choices: [{ message: { role: 'assistant', content: content } }] })
    };
}

async function main() {
    // ---------- sanitizeIpaText ----------
    const s = context.sanitizeIpaText;
    assert(s('/əˈfem.ər.əl/') === 'əˈfem.ər.əl', 'slash-delimited IPA is extracted');
    assert(s('[ɪˈfem.ər.əl]') === 'ɪˈfem.ər.əl', 'bracket-delimited IPA is extracted');
    assert(s('The IPA is /ˈwɜːrd/.') === 'ˈwɜːrd', 'prose around a delimited transcription is stripped');
    assert(s('Sure! It is [ˈsɜːdʒəri], ok?') === 'ˈsɜːdʒəri', 'sentence with embedded bracketed IPA yields the IPA');
    assert(s('/wɜ:d/') === 'wɜːd', 'ASCII colon is normalized to the IPA length mark');
    assert(s('ih-FEM-er-ul') === null, 'respelling (all ASCII, no phonetic glyphs) is rejected');
    assert(s('ephemeral') === null, 'the word itself is rejected as an answer');
    assert(s('pronounced wɜːrd-ish') === null, 'prose with a stray glyph is rejected token-by-token');
    assert(s('ˈaɪs ˌkriːm') === 'ˈaɪs ˌkriːm', 'syllable-spaced IPA is accepted');
    assert(s('naïve') === null, 'non-ASCII letters without phonetic glyphs are rejected');
    assert(s('[ˈw3ːd]') === null, 'digits inside the transcription are rejected');
    assert(s('x'.repeat(60)) === null, 'over-long junk is rejected');
    assert(s('') === null && s(undefined) === null && s(42) === null, 'non-string inputs return null');
    assert(s('```ipa\n[əˈfɛməɹəl]\n```') === 'əˈfɛməɹəl', 'code-fenced answers are unwrapped');

    // ---------- getWordPronunciation handler ----------
    syncBacking.models = [
        { id: 'm1', name: 'Default Model', endpointUrl: 'https://api.default/v1/chat/completions', modelName: 'default-1', apiKey: 'sk-default' },
        { id: 'm2', name: 'Second Model', endpointUrl: 'https://api.second/v1/chat/completions', modelName: 'second-1', apiKey: '' }
    ];
    syncBacking.defaultModelId = 'm1';

    // 1. Happy path against the REQUESTED model (m2, no fallback expected).
    fetchCalls = [];
    fetchImpl = () => Promise.resolve(okChatResponse('[ɪˈfem.ər.əl]'));
    let resp = await askPronunciation({ type: 'getWordPronunciation', word: 'ephemeral', modelId: 'm2' });
    await flush();
    assert(resp && resp.ipa === 'ɪˈfem.ər.əl', 'valid answer surfaces the IPA', resp);
    assert(fetchCalls.length === 1, 'exactly one network ask per uncached word', fetchCalls.length);
    const url = fetchCalls[0][0];
    const init = fetchCalls[0][1];
    const body = JSON.parse(init.body);
    assert(url === 'https://api.second/v1/chat/completions', 'ask goes to the requested model endpoint', url);
    assert(body.stream === false, 'ask is non-streaming', body);
    assert(!body.tools, 'no search tools on the pronunciation ask', body);
    assert(body.messages.length === 1 && body.messages[0].role === 'user', 'single user message', body.messages);
    assert(init.headers['Authorization'] === undefined || init.headers['Authorization'] === '', 'no auth header without an api key', init.headers);

    // 2. Same word again (different popup): served from the session cache.
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'ephemeral' });
    await flush();
    assert(resp && resp.ipa === 'ɪˈfem.ər.əl', 'cached word answers identically', resp);
    assert(fetchCalls.length === 1, 'cache absorbs the repeat ask (no second fetch)', fetchCalls.length);

    // 3. Concurrent asks for one new word coalesce into a single fetch.
    fetchCalls = [];
    fetchImpl = () => new Promise(resolve => setTimeout(() => resolve(okChatResponse('/ˈsɜːdʒəri/')), 30));
    const [r1, r2] = await Promise.all([
        askPronunciation({ type: 'getWordPronunciation', word: 'surgery', modelId: 'm2' }),
        askPronunciation({ type: 'getWordPronunciation', word: 'Surgery' })
    ]);
    await flush();
    assert(r1 && r1.ipa === 'ˈsɜːdʒəri' && r2 && r2.ipa === 'ˈsɜːdʒəri', 'both concurrent callers get the answer', { r1, r2 });
    assert(fetchCalls.length === 1, 'in-flight map coalesces concurrent asks (case-insensitive key)', fetchCalls.length);

    // 4. A failed ask answers { ipa: null } and is NOT cached.
    fetchCalls = [];
    fetchImpl = () => Promise.reject(new Error('network down'));
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'unlucky' });
    await flush();
    assert(resp && resp.ipa === null, 'network failure answers ipa null (no error object)', resp);
    fetchImpl = () => Promise.resolve(okChatResponse('[ˌʌnˈlʌki]'));
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'unlucky' });
    await flush();
    assert(resp && resp.ipa === 'ˌʌnˈlʌki', 'failed word is retried on the next popup (failures not cached)', resp);
    assert(fetchCalls.length === 2, 'the retry spent exactly the expected asks', fetchCalls.length);

    // 5. Garbage model answers sanitize to null.
    fetchCalls = [];
    fetchImpl = () => Promise.resolve(okChatResponse('Sorry, I do not know this word.'));
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'garbled' });
    await flush();
    assert(resp && resp.ipa === null, 'prose answer yields ipa null, badge stays hidden', resp);

    // 6. Non-JSON success body yields null without throwing.
    fetchImpl = () => Promise.resolve({ ok: true, status: 200, headers: { get: () => 'text/plain' }, json: async () => { throw new Error('not json'); } });
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'plainjson' });
    await flush();
    assert(resp && resp.ipa === null, 'non-JSON body answers ipa null', resp);

    // 7. Guard rails: phrases and empty words never reach the network.
    fetchCalls = [];
    fetchImpl = () => Promise.resolve(okChatResponse('[ɪˈfem.ər.əl]'));
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'artificial intelligence' });
    assert(resp && resp.ipa === null, 'multi-word phrase answers ipa null', resp);
    resp = await askPronunciation({ type: 'getWordPronunciation', word: '   ' });
    assert(resp && resp.ipa === null, 'blank word answers ipa null', resp);
    resp = await askPronunciation({ type: 'getWordPronunciation' });
    assert(resp && resp.ipa === null, 'missing word answers ipa null', resp);
    assert(fetchCalls.length === 0, 'guard rails spent no network asks', fetchCalls.length);

    // 8. Unconfigured extension answers null without fetching.
    const savedModels = syncBacking.models;
    const savedDefault = syncBacking.defaultModelId;
    delete syncBacking.models;
    delete syncBacking.defaultModelId;
    delete localBacking.models;
    delete localBacking.defaultModelId;
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'modelless' });
    await flush();
    assert(resp && resp.ipa === null, 'no configured model answers ipa null', resp);
    assert(fetchCalls.length === 0, 'no fetch without models', fetchCalls.length);
    syncBacking.models = savedModels;
    syncBacking.defaultModelId = savedDefault;

    // 9. Unknown modelId falls back to the default model.
    fetchCalls = [];
    fetchImpl = () => Promise.resolve(okChatResponse('[ɡrəˈviːti]'));
    resp = await askPronunciation({ type: 'getWordPronunciation', word: 'gravity', modelId: 'no-such-model' });
    await flush();
    assert(resp && resp.ipa === 'ɡrəˈviːti', 'unknown model id still answers via the default model', resp);
    assert(fetchCalls.length === 1 && fetchCalls[0][0] === 'https://api.default/v1/chat/completions', 'fallback ask hit the default model endpoint', fetchCalls[0] && fetchCalls[0][0]);
    const authHeader = fetchCalls[0][1].headers['Authorization'];
    assert(authHeader === 'Bearer sk-default', 'api key model sends its bearer token', authHeader);

    console.log(process.exitCode ? 'PRONUNCIATION TEST FAILED' : 'PRONUNCIATION TEST PASSED');
}

main();
