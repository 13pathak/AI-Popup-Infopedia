// Issue #39: real worker message handlers and popup save/disclosure functions.
// No network or browser needed: node tests/test-saved-meanings.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness() {
  const store = { history: [], wordLists: [{ id: 'bio', name: 'Biology' }, { id: 'other', name: 'Other' }] };
  const listeners = [];
  const event = () => ({ addListener() {} });
  let failRead = false, failWrite = false;
  const area = backing => ({
    get(keys, callback) {
      const data = {};
      for (const key of Array.isArray(keys) ? keys : Object.keys(keys)) data[key] = backing[key] ?? keys[key];
      const result = clone(data);
      if (!callback) return Promise.resolve(result);
      queueMicrotask(() => {
        chrome.runtime.lastError = failRead ? { message: 'Read failed' } : null;
        callback(result);
        chrome.runtime.lastError = null;
      });
    },
    set(data, callback) {
      queueMicrotask(() => {
        if (!failWrite) Object.assign(backing, clone(data));
        chrome.runtime.lastError = failWrite ? { message: 'Write failed' } : null;
        if (callback) callback();
        chrome.runtime.lastError = null;
      });
    }
  });
  const chrome = {
    runtime: { lastError: null, id: 'test', getURL: p => p, onMessage: { addListener: fn => listeners.push(fn) }, onStartup: event(), onInstalled: event() },
    storage: { local: area(store), sync: area({}), session: area({}), onChanged: event() },
    commands: { onCommand: event() }, alarms: { create() {}, onAlarm: event() },
    tabs: { onRemoved: event() }, downloads: { onChanged: event() },
    webNavigation: { onBeforeNavigate: event() }, webRequest: { onHeadersReceived: event() },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} }
  };
  const worker = vm.createContext({ chrome, console, setTimeout, clearTimeout, URL, TextDecoder, TextEncoder, AbortController });
  vm.runInContext(source('background.js'), worker);
  const send = request => new Promise(resolve => listeners[0](clone(request), {}, resolve));
  chrome.runtime.sendMessage = (request, callback) => { send(request).then(callback); };
  return { store, chrome, send, errors: (read, write) => { failRead = read; failWrite = write; } };
}

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.events = {}; this.attributes = {}; this.className = ''; this.classList = { contains: name => this.className.split(' ').includes(name), add: name => { this.className += ' ' + name; } }; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  replaceChildren() { this.children = []; }
  addEventListener(type, fn) { this.events[type] = fn; }
  setAttribute(key, value) { this.attributes[key] = value; }
  click() { if (!this.disabled && this.events.click) this.events.click({ stopPropagation() {} }); }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
}

async function run() {
  const h = harness();
  const old = { id: 'old', word: 'Cell', definition: 'Old definition <img src=x onerror=bad()>', listId: 'bio', timestamp: '2026-09-08T12:00:00Z', context: { sentence: 'The cell divides.' }, notes: 'My notes', favorite: true, fsrs: { stability: 12 } };
  h.store.history = [clone(old)];
  const request = { type: 'saveToHistory', word: '  CELL  ', definition: 'New definition', listId: 'other', modelName: 'Model', promptName: 'Prompt', context: { sentence: 'A new cell.' }, recognizeExisting: true };
  assert.equal((await h.send(request)).status, 'duplicate');
  assert.equal(h.store.history.length, 1);
  assert.equal((await h.send({ ...request, allowDuplicate: true })).status, 'saved');
  assert.equal(h.store.history.length, 2);
  assert.equal(h.store.history[0].listId, 'other');
  assert.deepEqual(h.store.history[0].context, request.context);
  assert.deepEqual(h.store.history[1], old);

  const update = { ...request, type: 'updateSavedMeaning', previousItem: old, sourceUrl: 'https://new.example', citations: [{ url: 'https://source.example' }] };
  assert.equal((await h.send(update)).status, 'saved');
  const updated = h.store.history.find(item => item.id === 'old');
  for (const key of ['id', 'word', 'listId', 'timestamp', 'notes', 'favorite', 'fsrs']) assert.deepEqual(updated[key], old[key]);
  for (const key of ['definition', 'context', 'sourceUrl', 'citations']) assert.deepEqual(updated[key], update[key]);
  assert.ok(updated.updatedAt);
  assert.equal((await h.send(update)).status, 'error', 'stale update must not overwrite newer data');
  h.store.history = [];
  assert.equal((await h.send(update)).status, 'error', 'deleted entry must not be recreated');
  const results = await Promise.all([h.send(request), h.send(request)]);
  assert.deepEqual(results.map(r => r.status), ['saved', 'duplicate']);
  assert.equal(h.store.history.length, 1);

  const legacy = { ...old }; delete legacy.id;
  h.store.history = [clone(legacy)];
  assert.equal((await h.send({ ...update, previousItem: legacy })).status, 'saved');
  assert.ok(h.store.history[0].id, 'legacy record gains an identity');
  h.store.history = [clone(legacy), clone(legacy)];
  assert.equal((await h.send({ ...update, previousItem: legacy })).status, 'error', 'ambiguous legacy records stay unchanged');
  h.store.history = [clone(old)];
  h.errors(false, true);
  assert.equal((await h.send(update)).status, 'error');
  assert.deepEqual(h.store.history, [old]);
  h.errors(true, false);
  assert.equal((await h.send(update)).status, 'error');
  h.errors(false, false);
  assert.equal((await h.send(update)).status, 'saved', 'queue recovers after storage failure');

  // Load the production popup helpers without unrelated page/selection setup.
  const toasts = [];
  const instance = { compareWord: '  cELL ', implicitContext: { sentence: 'Current sentence' }, listSelector: { value: 'other', querySelector: () => ({ textContent: 'Other' }) } };
  const msg = { role: 'assistant', content: 'Current explanation' };
  const slot = { messages: [{ role: 'user', content: 'Cell' }, msg], modelName: 'Model' };
  const ctx = vm.createContext({ chrome: h.chrome, document: { createElement: tag => new Element(tag) }, activePopups: [instance], showPopupToast: (_, text) => toasts.push(text), collectSourceMetadata: () => ({ sourceUrl: 'https://current.example', sourceTitle: 'Current page' }), renderCompareView() {}, iconSvg: () => '' });
  const content = source('content.js');
  vm.runInContext(content.slice(content.indexOf('function savedWordForTurn('), content.indexOf('// Renders one model\'s conversation')), ctx);
  assert.equal(ctx.normalizeSavedWord('  ＣＥＬＬ\n  wall '), 'cell wall');
  assert.notEqual(ctx.normalizeSavedWord('cellular'), ctx.normalizeSavedWord('cell'));
  const now = Date.parse('2026-09-20T12:00:00Z');
  assert.equal(ctx.savedRelativeTime(old.timestamp, now), '12 days ago');
  assert.equal(ctx.savedRelativeTime(new Date(now - 30000).toISOString(), now), 'just now');
  assert.equal(ctx.savedRelativeTime(new Date(now - 30 * 86400000).toISOString(), now), '1 month ago');
  assert.equal(ctx.savedRelativeTime('bad', now), 'date unknown');
  assert.equal(ctx.savedRelativeTime(new Date(now + 5000).toISOString(), now), 'just now');
  const followup = { role: 'assistant', content: 'Follow-up answer' };
  slot.messages.push({ role: 'user', content: 'Examples?' }, followup);
  assert.equal(ctx.savedWordForTurn(instance, slot, followup), '  cELL : Examples?');

  h.store.history = [clone(old)];
  ctx.refreshSavedHistory(instance); await tick();
  const turn = new Element('div');
  ctx.appendSavedHistory(instance, turn, slot, msg);
  const find = text => turn.all().find(el => el.textContent === text);
  assert.ok(turn.all().find(el => el.tagName === 'summary').textContent.startsWith('Saved in Biology'));
  find('View previous').click();
  const preview = turn.all().find(el => el.className === 'ai-saved-preview');
  assert.equal(preview.hidden, false);
  assert.ok(preview.textContent.includes(old.definition));
  assert.ok(preview.textContent.includes(old.notes));
  assert.ok(preview.textContent.includes(old.context.sentence));
  assert.equal(preview.innerHTML, undefined, 'stored markup is text only');

  ctx.saveTurnToHistory(instance, slot, msg, null);
  assert.equal(msg.savedHistoryOpen, true);
  assert.equal(h.store.history.length, 1, 'normal save opens actions instead of duplicating');
  find('Update').click(); await tick();
  assert.equal(h.store.history.length, 1);
  assert.equal(h.store.history[0].definition, msg.content);
  assert.equal(h.store.history[0].listId, 'bio');
  assert.equal(h.store.history[0].notes, old.notes);
  assert.equal(h.store.history[0].context.sentence, 'Current sentence');
  assert.equal(msg.isSaved, true);

  msg.isSaved = false;
  ctx.refreshSavedHistory(instance); await tick();
  find('Save another meaning').click();
  find('Save another meaning').click(); await tick();
  assert.equal(h.store.history.length, 2, 'rapid double click saves only once');
  assert.equal(h.store.history[0].listId, 'other');
  assert.equal(h.store.history[1].listId, 'bio');
  msg.isSaved = false;
  h.store.history = [];
  ctx.refreshSavedHistory(instance); await tick();
  assert.equal(turn.all().filter(el => el.tagName === 'summary').length, 0, 'deleted matches disappear');
  h.store.history = [clone(old)]; // Another page saved after our last read.
  ctx.saveTurnToHistory(instance, slot, msg, null); await tick();
  assert.equal(h.store.history.length, 1);
  assert.equal(msg.isSaved, false);
  assert.ok(find('Update'), 'worker duplicate result refreshes disclosure');
  h.errors(false, true);
  find('Update').click(); await tick();
  assert.equal(msg.isSaved, false);
  assert.equal(msg.historyWritePending, false);
  assert.ok(toasts.includes('Could not update saved history.'));
  h.errors(false, false);
  h.store.wordLists = [];
  ctx.refreshSavedHistory(instance); await tick();
  assert.ok(turn.all().find(el => el.tagName === 'summary').textContent.startsWith('Saved in Unlisted'));
  console.log('Saved-meaning recognition, disclosure, save/update and failure-path tests passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
