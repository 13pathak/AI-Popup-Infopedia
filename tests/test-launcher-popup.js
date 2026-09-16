// Standalone smoke test for the toolbar launcher popup (Issue #28 follow-up).
// Loads background.js and popup.js inside a vm with a stubbed chrome/DOM
// surface, then exercises:
//   1. background: getLauncherSnapshot (due count + today's usage bucket)
//   2. background: getLauncherSnapshot / openOptionsTab message wiring
//   3. background: badge path through the shared computeDueCardsCount helper
//   4. popup: due chip, today usage line, version, theme, and the two
//      buttons routing through openOptionsTab
//
// Usage: node tests/test-launcher-popup.js   (exit code 0 = pass)

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}\n       expected: ${e}\n       actual:   ${a}`);
  }
}

// ---------------------------------------------------------------------------
// Chrome API stub: promise-or-callback storage, listener capture, no-ops for
// everything background.js touches at the top level.
// ---------------------------------------------------------------------------
function makeChromeStub({ local = {}, sync = {}, session = {} } = {}) {
  const calls = { openOptionsPage: 0, sentMessages: [], badgeTexts: [], alarms: [] };

  function area(store) {
    return {
      get(defaultsOrKeys, cb) {
        let result = {};
        if (Array.isArray(defaultsOrKeys)) {
          for (const k of defaultsOrKeys) result[k] = store[k];
        } else if (defaultsOrKeys && typeof defaultsOrKeys === 'object') {
          result = { ...defaultsOrKeys };
          for (const k of Object.keys(defaultsOrKeys)) {
            if (k in store) result[k] = store[k];
          }
        } else if (typeof defaultsOrKeys === 'string') {
          result[defaultsOrKeys] = store[defaultsOrKeys];
        }
        const p = Promise.resolve(result);
        if (typeof cb === 'function') p.then(cb);
        else return p;
      },
      set(items, cb) {
        Object.assign(store, items);
        const p = Promise.resolve();
        if (typeof cb === 'function') p.then(cb);
        else return p;
      },
      remove(keys, cb) {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
        const p = Promise.resolve();
        if (typeof cb === 'function') p.then(cb);
        else return p;
      },
    };
  }

  const listeners = {};
  const on = (name) => ({
    addListener(fn) { (listeners[name] = listeners[name] || []).push(fn); },
    removeListener() {},
    hasListener() { return false; },
  });

  const chrome = {
    _stores: { local, sync, session },
    _calls: calls,
    _listeners: listeners,
    runtime: {
      lastError: null,
      id: 'test-extension-id',
      getURL: (p) => 'chrome-extension://test-extension-id/' + String(p).replace(/^\//, ''),
      getManifest: () => ({ version: '9.9.9' }),
      sendMessage: (msg, cb) => { calls.sentMessages.push(msg); if (cb) cb(undefined); },
      openOptionsPage: (cb) => { calls.openOptionsPage++; if (cb) cb(); },
      onMessage: on('runtime.onMessage'),
      onStartup: on('runtime.onStartup'),
      onInstalled: on('runtime.onInstalled'),
      onConnect: on('runtime.onConnect'),
    },
    storage: {
      local: area(local),
      sync: area(sync),
      session: area(session),
      onChanged: on('storage.onChanged'),
    },
    tabs: {
      create: (opts, cb) => { if (cb) cb({ id: 1 }); },
      update: (id, opts, cb) => { if (cb) cb({}); },
      query: (q, cb) => cb([]),
      sendMessage: (id, msg, cb) => { if (cb) cb({}); },
      getCurrent: (cb) => cb(null),
      onRemoved: on('tabs.onRemoved'),
    },
    alarms: {
      create: (name, info) => calls.alarms.push(name),
      get: (name, cb) => cb(null),
      onAlarm: on('alarms.onAlarm'),
    },
    action: {
      setBadgeText: ({ text }, cb) => { calls.badgeTexts.push(text); if (cb) cb(); },
      setBadgeBackgroundColor: (_o, cb) => { if (cb) cb(); },
      setBadgeTextColor: (_o, cb) => { if (cb) cb(); },
    },
    downloads: {
      download: (opts, cb) => { if (cb) cb(1); },
      onChanged: on('downloads.onChanged'),
    },
    webNavigation: { onBeforeNavigate: on('webNavigation.onBeforeNavigate'), onHistoryStateUpdated: on('webNavigation.onHistoryStateUpdated') },
    webRequest: { onHeadersReceived: on('webRequest.onHeadersReceived') },
    commands: { onCommand: on('commands.onCommand') },
    contextMenus: { onClicked: on('contextMenus.onClicked'), create: () => {} },
  };
  return chrome;
}

function baseSandbox(chrome) {
  return {
    chrome,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    TextEncoder,
    TextDecoder,
    crypto: require('crypto').webcrypto,
    fetch: () => Promise.reject(new Error('network disabled in test')),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  };
}

function loadScript(file, sandbox) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.createContext(sandbox);
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  vm.runInContext(source, sandbox, { filename: file });
  return sandbox;
}

function soleListener(listeners, name) {
  const fns = listeners[name] || [];
  if (fns.length !== 1) throw new Error(`expected exactly one ${name} listener, found ${fns.length}`);
  return fns[0];
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// Minimal DOM stand-in for popup.js: elements by id, DOMContentLoaded
// capture, and a documentElement that records data-theme.
function makePopupDom() {
  const elements = {};
  const makeEl = (id) => {
    const classes = new Set();
    const el = {
      id,
      textContent: '',
      title: '',
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
      },
      _handlers: {},
      addEventListener(type, fn) { el._handlers[type] = fn; },
      click() { if (el._handlers.click) el._handlers.click(); },
    };
    return el;
  };
  for (const id of ['popup-version', 'due-chip', 'usage-line', 'open-review', 'open-settings']) {
    elements[id] = makeEl(id);
  }
  const domReady = [];
  return {
    elements,
    document: {
      addEventListener: (type, fn) => { if (type === 'DOMContentLoaded') domReady.push(fn); },
      getElementById: (id) => elements[id] || null,
      documentElement: {
        _attrs: {},
        setAttribute(k, v) { this._attrs[k] = v; },
        removeAttribute(k) { delete this._attrs[k]; },
      },
    },
    fireDomReady: () => domReady.forEach((fn) => fn()),
  };
}

async function testBackground() {
  console.log('background.js:');
  const now = Date.now();
  const chrome = makeChromeStub({
    local: {
      history: [
        { word: 'a', nextReview: now - 1000 },                    // due
        { word: 'b', nextReview: now + 100000 },                  // scheduled for later
        { word: 'c' },                                            // never reviewed -> due
        { word: 'd', modelName: 'clip' },                         // clip w/o definition -> skipped
        { word: 'e', modelName: 'clip', definition: 'x', nextReview: now - 5 }, // due
      ],
      aiUsageStats: {
        totals: { requests: 9, promptTokens: 900, completionTokens: 450, totalTokens: 1350 },
        byDay: {
          '2000-01-01': { requests: 7, promptTokens: 700, completionTokens: 350, totalTokens: 1050 },
          [dayKey(now)]: { requests: 2, promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        },
      },
    },
    sync: { dueBadgeEnabled: true },
  });
  const sandbox = loadScript('background.js', baseSandbox(chrome));
  const onMessage = () => soleListener(chrome._listeners, 'runtime.onMessage');

  // Direct call
  const snap = await sandbox.getLauncherSnapshot();
  check('snapshot.dueCount', snap.dueCount, 3);
  check('snapshot.today', snap.today, { requests: 2, promptTokens: 100, completionTokens: 50, totalTokens: 150 });

  // Message wiring: getLauncherSnapshot answers asynchronously
  {
    let response = null;
    const asyncReply = onMessage()({ type: 'getLauncherSnapshot' }, {}, (r) => { response = r; });
    check('getLauncherSnapshot handler returns true (async)', asyncReply, true);
    await tick();
    check('message response.dueCount', response && response.dueCount, 3);
    check('message response.today.totalTokens', response && response.today && response.today.totalTokens, 150);
  }

  // Message wiring: openOptionsTab stores the target tab and opens the page
  {
    onMessage()({ type: 'openOptionsTab', tab: 'flashcards-content' }, {}, () => {});
    await tick();
    check('openOptionsTab stores activeOptionsTab', chrome._stores.local.activeOptionsTab, 'flashcards-content');
    check('openOptionsTab opened the options page', chrome._calls.openOptionsPage, 1);
  }

  // Badge path shares computeDueCardsCount
  {
    sandbox.updateDueCardsBadge();
    await tick();
    check('badge shows due count', chrome._calls.badgeTexts.includes('3'), true);
  }

  // Empty-storage edge case
  {
    const chromeEmpty = makeChromeStub();
    const sandboxEmpty = loadScript('background.js', baseSandbox(chromeEmpty));
    const snapEmpty = await sandboxEmpty.getLauncherSnapshot();
    check('empty snapshot.dueCount', snapEmpty.dueCount, 0);
    check('empty snapshot.today', snapEmpty.today, { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  }
}

async function testPopup() {
  console.log('popup.js:');
  const dom = makePopupDom();
  const sent = [];
  let popupClosed = 0;
  const chrome = makeChromeStub({ sync: { uiTheme: 'light' } });
  chrome.storage.sync.get = (defaults, cb) => cb({ uiTheme: 'light' }); // popup reads theme via callback style
  chrome.runtime.sendMessage = (msg, cb) => {
    sent.push(msg);
    if (msg.type === 'getLauncherSnapshot') {
      cb({ dueCount: 3, today: { requests: 2, promptTokens: 1000, completionTokens: 500, totalTokens: 1500 } });
    } else if (cb) {
      cb(undefined);
    }
  };

  const sandbox = baseSandbox(chrome);
  sandbox.document = dom.document;
  sandbox.localStorage = { getItem: () => null, setItem: () => {} }; // cold mirror -> sync fallback
  sandbox.close = () => { popupClosed++; };
  loadScript('popup.js', sandbox);

  check('theme applied from sync fallback', dom.document.documentElement._attrs['data-theme'], 'light');
  dom.fireDomReady();

  check('version rendered', dom.elements['popup-version'].textContent, 'v9.9.9');
  check('snapshot requested once', sent.filter((m) => m.type === 'getLauncherSnapshot').length, 1);
  check('due chip text', dom.elements['due-chip'].textContent, '3 due');
  check('due chip not muted', dom.elements['due-chip'].classList.contains('none'), false);
  check('usage line', dom.elements['usage-line'].textContent, 'Today · 2 calls · 1.5K tokens');
  check('usage tooltip', dom.elements['usage-line'].title, 'Today: 2 calls · 1,000 prompt + 500 completion tokens');

  // Zero state: re-run the DOMContentLoaded wiring with an empty snapshot
  chrome.runtime.sendMessage = (msg, cb) => {
    sent.push(msg);
    if (msg.type === 'getLauncherSnapshot') cb({ dueCount: 0, today: { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
    else if (cb) cb(undefined);
  };
  dom.fireDomReady();
  check('zero due chip text', dom.elements['due-chip'].textContent, 'none due');
  check('zero due chip muted', dom.elements['due-chip'].classList.contains('none'), true);
  check('zero usage line', dom.elements['usage-line'].textContent, 'Today · no API usage yet');

  // Button routing
  dom.elements['open-review'].click();
  check('review button routes to flashcards tab', sent[sent.length - 1], { type: 'openOptionsTab', tab: 'flashcards-content' });
  check('popup closes after click', popupClosed >= 1, true);
  dom.elements['open-settings'].click();
  check('settings button routes to settings tab', sent[sent.length - 1], { type: 'openOptionsTab', tab: 'settings-content' });
}

(async () => {
  try {
    await testBackground();
    await testPopup();
  } catch (err) {
    console.error('\nUnhandled error:', err);
    process.exit(1);
  }
  if (failures) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll launcher popup checks passed.');
})();
