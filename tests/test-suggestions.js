// Unit tests for the piggybacked follow-up suggestions (Issue #35) in the
// real background.js. Three layers are covered:
//   extractSuggestions()              — cuts the [[SUGGESTIONS]] trailer
//                                       from finished text and sanitizes
//                                       its lines into chip labels
//   createSuggestionsStreamFilter()   — keeps the marker from flashing in
//                                       the live delta channel across
//                                       chunk boundaries and retries
//   getAiDefinition msg               — instruction rides the outbound
//                                       user message when enabled, the
//                                       answer/stash/cache everyone sees
//                                       is clean, and parsed chips travel
//                                       as a separate `suggestions` field
// Loads the actual service worker source into a VM with a stubbed chrome
// API (same pattern as test-pronunciation.js; no browser or server):
//   node tests/test-suggestions.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MARKER = '[[SUGGESTIONS]]';
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
// so the lookup cache survives across handler invocations.
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

// Stream deltas the worker emits to the popup tab (type aiDefinitionDelta),
// including reset/standby control messages, in emission order.
const tabMessages = [];

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
        sendMessage: (tabId, msg, cb) => { tabMessages.push(msg); if (typeof cb === 'function') cb({}); },
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
    TextDecoder,
    TextEncoder,
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

function assertDeepEqual(actual, expected, label) {
    const same = JSON.stringify(actual) === JSON.stringify(expected);
    assert(same, label, same ? undefined : { actual, expected });
}

const flush = () => new Promise(r => setTimeout(r, 20));

// Fires the message handler and resolves with the sendResponse payload.
function askDefinition(request) {
    return new Promise((resolve) => {
        events.runtimeOnMessage._fire(request, { tab: { id: 1 } }, resolve);
    });
}

// SSE chat stream that emits `deltas` as content fragments, then [DONE].
function sseResponse(deltas) {
    const enc = new TextEncoder();
    const chunks = deltas.map(d => enc.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: d } }] }) + '\n\n'));
    chunks.push(enc.encode('data: [DONE]\n\n'));
    let i = 0;
    return {
        ok: true,
        status: 200,
        headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'text/event-stream' : null },
        body: {
            getReader: () => ({
                read: async () => (i < chunks.length) ? { done: false, value: chunks[i++] } : { done: true, value: undefined }
            })
        }
    };
}

// A stream that delivers `deltas` and then dies mid-flight (reader rejects),
// simulating a model that fails AFTER streaming partial text.
function sseResponseDyingMidStream(deltas) {
    const enc = new TextEncoder();
    const chunks = deltas.map(d => enc.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: d } }] }) + '\n\n'));
    let i = 0;
    return {
        ok: true,
        status: 200,
        headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'text/event-stream' : null },
        body: {
            getReader: () => ({
                read: async () => {
                    if (i < chunks.length) return { done: false, value: chunks[i++] };
                    throw new Error('connection reset mid-stream');
                }
            })
        }
    };
}

// Provider that ignores stream:true and answers plain JSON.
function jsonResponse(fullText) {
    return {
        ok: true,
        status: 200,
        headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'application/json' : null },
        text: async () => JSON.stringify({ choices: [{ message: { role: 'assistant', content: fullText } }] })
    };
}

function lastFetchBody() {
    return JSON.parse(fetchCalls[fetchCalls.length - 1][1].body);
}

// What the popup would render for this stream: a delta carrying reset
// discards earlier text (the fallback chain's restart signal), exactly as
// trackAiStream does in content.js.
function visibleDeltasFor(requestId) {
    let text = '';
    for (const m of tabMessages) {
        if (!m || m.type !== 'aiDefinitionDelta' || m.requestId !== requestId || typeof m.delta !== 'string') continue;
        if (m.reset) text = '';
        text += m.delta;
    }
    return text;
}

async function main() {
    // ---------- extractSuggestions ----------
    const es = context.extractSuggestions;

    let r = es('A plain answer with no trailer.');
    assert(r.text === 'A plain answer with no trailer.' && r.suggestions === null, 'no marker: text unchanged, no suggestions', r);

    r = es('Answer body.\n\n' + MARKER + '\nWhat is it?\nWhy now?\nHow so?');
    assert(r.text === 'Answer body.', 'trailer (and the whitespace introducing it) is cut from the text', JSON.stringify(r.text));
    assertDeepEqual(r.suggestions, ['What is it?', 'Why now?', 'How so?'], 'clean trailer lines become suggestions');

    r = es('Answer.\n' + MARKER + '\nQ1\nQ2\nQ3\nQ4\nQ5');
    assertDeepEqual(r.suggestions, ['Q1', 'Q2', 'Q3', 'Q4'], 'suggestion list is capped at four');

    r = es('Answer.\n' + MARKER + '\n\n  \n' + 'x'.repeat(81) + '\nShort one');
    assertDeepEqual(r.suggestions, ['Short one'], 'empty and over-long lines are dropped');

    r = es('Answer.\n' + MARKER + '\n- Dashed question\n2) numbered question\n* starred');
    assertDeepEqual(r.suggestions, ['Dashed question', 'numbered question', 'starred'], 'list-marker prefixes are stripped');

    r = es('Answer.\n' + MARKER + '\nSame question\nsame question\nOTHER');
    assertDeepEqual(r.suggestions, ['Same question', 'OTHER'], 'case-insensitive duplicates collapse');

    r = es('Answer.\n' + MARKER + '\n   ');
    assert(r.suggestions === null && r.text === 'Answer.', 'marker with no valid lines still truncates and yields no suggestions', r);

    r = es('pre ' + MARKER + ' stray\nmiddle\n' + MARKER + '\nReal question');
    assert(r.text === 'pre ' + MARKER + ' stray\nmiddle', 'the LAST marker delimits the trailer (earlier stray text survives)', JSON.stringify(r.text));
    assertDeepEqual(r.suggestions, ['Real question'], 'only the final trailer parses');

    r = es(42);
    assert(r.text === 42 && r.suggestions === null, 'non-string input passes through untouched', r);

    // ---------- createSuggestionsStreamFilter ----------
    const mk = context.createSuggestionsStreamFilter;

    let f = mk();
    assert(f.push('just text') === 'just text', 'plain text passes straight through');
    assert(f.push('') === '', 'empty delta emits nothing');

    f = mk();
    assert(f.push('Answer ends with [[SUG') === 'Answer ends with ', 'partial marker prefix is held back');
    assert(f.flush() === '[[SUG', 'flush releases an unterminated partial marker');
    assert(f.flush() === '', 'flush is idempotent');

    f = mk();
    let out = f.push('Answer.\n\n[[SUG');
    out += f.push('GESTIONS]]\nQ1\nQ2');
    out += f.push('\nQ3');
    assert(out === 'Answer.\n\n', 'marker split across deltas never surfaces', JSON.stringify(out));
    assert(f.flush() === '', 'captured trailer flushes nothing');

    f = mk();
    f.push('partial [[SUG');
    f.reset();
    assert(f.push('new attempt text') === 'new attempt text', 'reset drops held-back state from the dead attempt');
    f = mk();
    f.push('x' + MARKER + 'captured');
    f.reset();
    assert(f.push('fresh') === 'fresh', 'reset exits capture mode so a retried model streams visibly');

    // ---------- getAiDefinition handler ----------
    syncBacking.models = [
        { id: 'm1', name: 'Primary', endpointUrl: 'https://api.primary/v1/chat/completions', modelName: 'p-1', apiKey: 'sk-p' },
        { id: 'm2', name: 'Backup', endpointUrl: 'https://api.backup/v1/chat/completions', modelName: 'b-1', apiKey: '' }
    ];
    syncBacking.defaultModelId = 'm1';
    delete syncBacking.enableFollowupSuggestions;

    // 1. Enabled by default: instruction rides the outbound user message;
    //    trailer stripped from text, deltas, and travels as `suggestions`.
    fetchCalls = []; tabMessages.length = 0;
    fetchImpl = () => Promise.resolve(sseResponse(['Answer text.\n\n[[SUG', 'GESTIONS]]\nWhat is it?\nWhy now?\nHow so?']));
    let resp = await askDefinition({ type: 'getAiDefinition', word: 'ephemeral', requestId: 'sr_t1' });
    await flush();
    assert(fetchCalls.length === 1, 'one network ask for a fresh lookup', fetchCalls.length);
    let body = lastFetchBody();
    assert(body.messages.length >= 1 && body.messages[body.messages.length - 1].role === 'user', 'outbound ends with the user message', body.messages);
    const outbound = body.messages[body.messages.length - 1].content;
    assert(outbound.includes(MARKER), 'instruction containing the marker is appended when enabled', outbound.slice(-400));
    assert(outbound.indexOf('ephemeral') !== -1, 'the lookup word is in the outbound prompt', outbound);
    assert(resp && resp.definition === 'Answer text.', 'response definition is the stripped text', resp && resp.definition);
    assertDeepEqual(resp && resp.suggestions, ['What is it?', 'Why now?', 'How so?'], 'parsed suggestions ride the response');
    const live = visibleDeltasFor('sr_t1');
    assert(live.indexOf(MARKER) === -1, 'no delta ever carries the marker', live);
    assert(live.trim() === 'Answer text.', 'the visible stream matches the final text', JSON.stringify(live));
    const firstDeltaMsg = tabMessages.find(m => m && m.type === 'aiDefinitionDelta' && m.requestId === 'sr_t1' && typeof m.delta === 'string');
    assert(firstDeltaMsg && firstDeltaMsg.reset === true, 'first delta of the attempt carries the reset flag', firstDeltaMsg);

    // 2. Repeat lookup: served from the lookup cache with suggestions intact.
    fetchCalls = []; tabMessages.length = 0;
    fetchImpl = () => Promise.reject(new Error('should not fetch'));
    resp = await askDefinition({ type: 'getAiDefinition', word: 'ephemeral', requestId: 'sr_t2' });
    await flush();
    assert(fetchCalls.length === 0, 'cache absorbs the repeat lookup', fetchCalls.length);
    assert(resp && resp.fromCache === true && resp.definition === 'Answer text.', 'cached definition replays', resp);
    assertDeepEqual(resp && resp.suggestions, ['What is it?', 'Why now?', 'How so?'], 'cached suggestions replay with the answer');

    // 3. Setting off: no instruction outbound, but stripping still applies.
    syncBacking.enableFollowupSuggestions = false;
    fetchCalls = [];
    fetchImpl = () => Promise.resolve(sseResponse(['Clean answer.\n\n' + MARKER + '\nS1\nS2']));
    resp = await askDefinition({ type: 'getAiDefinition', word: 'stubborn', requestId: 'sr_t3' });
    await flush();
    body = lastFetchBody();
    const outboundOff = body.messages[body.messages.length - 1].content;
    assert(outboundOff.indexOf(MARKER) === -1, 'instruction is gated by the setting', outboundOff.slice(-200));
    assert(resp && resp.definition === 'Clean answer.', 'a marker emitted anyway is still stripped (defense in depth)', resp && resp.definition);
    delete syncBacking.enableFollowupSuggestions;

    // 4. Setting off degrades a CACHED hit: chips replay only when enabled.
    syncBacking.enableFollowupSuggestions = false;
    fetchCalls = [];
    fetchImpl = () => Promise.reject(new Error('should not fetch'));
    resp = await askDefinition({ type: 'getAiDefinition', word: 'ephemeral', requestId: 'sr_t4' });
    await flush();
    assert(fetchCalls.length === 0, 'still a cache hit with the setting off', fetchCalls.length);
    assert(resp && resp.definition === 'Answer text.', 'cached definition replays regardless of the setting', resp && resp.definition);
    assert(resp && resp.suggestions === null, 'cached suggestions are dropped when the setting is off', resp && resp.suggestions);
    delete syncBacking.enableFollowupSuggestions;

    // 5. Follow-up turn: instruction lands on a COPY of the last user
    //    message; the caller's history array is never mutated.
    fetchCalls = [];
    fetchImpl = () => Promise.resolve(sseResponse(['Follow-up answer.\n' + MARKER + '\nNext question?']));
    const history = [
        { role: 'user', content: 'original question' },
        { role: 'assistant', content: 'original answer' },
        { role: 'user', content: 'the follow-up being asked' }
    ];
    const historySnapshot = JSON.stringify(history);
    resp = await askDefinition({ type: 'getAiDefinition', word: 'ephemeral', messages: history, requestId: 'sr_t5' });
    await flush();
    body = lastFetchBody();
    const lastUser = body.messages[body.messages.length - 1];
    assert(lastUser.role === 'user' && lastUser.content.endsWith(MARKER + ' after the list.') === false, 'follow-up outbound last user message shape', lastUser);
    assert(lastUser.content.indexOf(MARKER) !== -1 && lastUser.content.indexOf('the follow-up being asked') !== -1, 'instruction is appended to the last user message of the copy', lastUser.content.slice(-300));
    assert(JSON.stringify(history) === historySnapshot, 'request.messages is never mutated', history);
    assert(body.messages[0].content === 'original question' && body.messages[0].content.indexOf(MARKER) === -1, 'earlier turns carry no instruction', body.messages[0]);
    assert(resp && resp.definition === 'Follow-up answer.', 'follow-up answer is stripped clean', resp && resp.definition);
    assertDeepEqual(resp && resp.suggestions, ['Next question?'], 'follow-up suggestions ride the response');

    // 6. Fallback chain: a model dying mid-stream (after a partial marker
    //    holdback) cannot leak into the retry — the next model's stream
    //    starts with reset and shows only its own text.
    fetchCalls = []; tabMessages.length = 0;
    const fetches = [
        () => Promise.resolve(sseResponseDyingMidStream(['dead model partial [[SUG'])),
        () => Promise.resolve(sseResponse(['retry model answer\n', '[[SUGGESTIONS]]\nRetry question?']))
    ];
    fetchImpl = () => fetches.shift()();
    resp = await askDefinition({ type: 'getAiDefinition', word: 'fallback-word', requestId: 'sr_t6' });
    await flush();
    assert(fetchCalls.length === 2, 'the chain spent both attempts', fetchCalls.length);
    assert(resp && resp.definition === 'retry model answer', 'the retry model\'s stripped answer wins', resp && resp.definition);
    assertDeepEqual(resp && resp.suggestions, ['Retry question?'], 'retry suggestions parse');
    const live6 = visibleDeltasFor('sr_t6');
    assert(live6.indexOf('dead model') === -1, 'dead attempt text never reaches the live view', live6);
    assert(live6.indexOf(MARKER) === -1, 'no marker in the live view across the fallback', live6);
    const resets = tabMessages.filter(m => m && m.type === 'aiDefinitionDelta' && m.requestId === 'sr_t6' && m.reset);
    assert(resets.length === 2, 'each attempt\'s first visible delta carries reset', resets.length);

    // 7. Provider that ignores stream:true (plain JSON): the single big
    //    delta is filtered too, and the final text is clean.
    fetchCalls = []; tabMessages.length = 0;
    fetchImpl = () => Promise.resolve(jsonResponse('JSON answer.\n\n' + MARKER + '\nFrom JSON?'));
    resp = await askDefinition({ type: 'getAiDefinition', word: 'json-provider', requestId: 'sr_t7' });
    await flush();
    assert(resp && resp.definition === 'JSON answer.', 'non-SSE provider answer is stripped', resp && resp.definition);
    assertDeepEqual(resp && resp.suggestions, ['From JSON?'], 'non-SSE provider suggestions parse');
    assert(visibleDeltasFor('sr_t7').indexOf(MARKER) === -1, 'buffered one-shot delta is filtered as well', visibleDeltasFor('sr_t7'));

    console.log(process.exitCode ? 'SUGGESTIONS TEST FAILED' : 'SUGGESTIONS TEST PASSED');
}

main();
