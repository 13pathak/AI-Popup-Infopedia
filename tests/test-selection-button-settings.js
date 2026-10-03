// Run the production prompt settings functions with controlled DOM and storage.
// Usage: node tests/test-selection-button-settings.js
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'options.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const elements = new Map();
function element() {
  return {
    value: '', checked: false, disabled: false, style: {}, dataset: {}, children: [], listeners: {},
    classList: { add() {}, remove() {} },
    set innerHTML(value) { this.children = []; this.markup = value; },
    get innerHTML() { return this.markup || ''; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    setAttribute(key, value) { this[key] = value; },
    scrollIntoView() {},
  };
}
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  },
  createElement: element,
  createTextNode: textContent => ({ textContent }),
  querySelectorAll: () => [],
};
let store = { customPrompts: [] };
let failGet = false;
let failSet = false;
let writes = 0;
const alerts = [];
const chrome = {
  runtime: { lastError: null },
  storage: { sync: {
    get(defaults, callback) {
      chrome.runtime.lastError = failGet ? { message: 'Storage unavailable' } : null;
      failGet = false;
      callback(clone({ ...defaults, ...store }));
      chrome.runtime.lastError = null;
    },
    set(updates, callback) {
      chrome.runtime.lastError = failSet ? { message: 'Quota exceeded' } : null;
      failSet = false;
      if (!chrome.runtime.lastError) { Object.assign(store, clone(updates)); writes++; }
      callback();
      chrome.runtime.lastError = null;
    },
  } },
};
const context = vm.createContext({
  document, chrome,
  alert: message => alerts.push(message),
  confirm: () => true,
  escapeHTML: text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  loadDefaultPromptSelect() {},
});
vm.runInContext(source.slice(source.indexOf('const promptMutationQueue'), source.indexOf('function loadTTSSettings()')), context);
vm.runInContext(source.slice(source.indexOf('function savePrompt()'), source.indexOf('function debounce(')), context);
const el = id => document.getElementById(id);
const checkbox = () => el('prompt-show-in-selection-popup');
const status = () => el('prompt-status').textContent;
function fill(name, content, enabled) {
  el('prompt-name').value = name;
  el('prompt-content').value = content;
  checkbox().checked = enabled;
}
function savedToggle(id) {
  const row = el('prompts-list').children.find(child => child.dataset?.promptId === id);
  return row.children[1].children[0].children[0];
}

context.cancelPromptEdit();
fill('  Check Grammar  ', '  Correct {word} and explain any mistakes.  ', true);
context.savePrompt();
assert.equal(store.customPrompts.length, 1);
const first = store.customPrompts[0];
assert.equal(first.name, 'Check Grammar');
assert.equal(first.content, 'Correct {word} and explain any mistakes.');
assert.equal(first.showInSelectionPopup, true);
assert.equal(el('prompt-name').value, '');
assert.equal(checkbox().checked, false, 'saving resets the visibility field');
assert.equal(savedToggle(first.id).checked, true, 'saved rows reflect visibility');

store.customPrompts[0].futureMetadata = { retained: true };
context.editPrompt(first.id);
assert.equal(checkbox().checked, true);
fill('Grammar', 'Check {word}.', false);
context.savePrompt();
assert.equal(store.customPrompts.length, 1, 'editing updates the existing prompt');
assert.equal(store.customPrompts[0].showInSelectionPopup, false);
assert.deepEqual(store.customPrompts[0].futureMetadata, { retained: true });

store.customPrompts.push({ id: 'legacy', name: 'Legacy', content: 'Explain {word}.' });
store.customPrompts.push({ id: 'invalid-flag', name: 'Imported', content: 'Explain {word}.', showInSelectionPopup: 'true' });
context.loadPrompts();
assert.equal(savedToggle('legacy').checked, false, 'old prompts are hidden until enabled');
assert.equal(savedToggle('invalid-flag').checked, false, 'only boolean true enables a button');
context.editPrompt('legacy');
assert.equal(checkbox().checked, false, 'editing legacy prompts resets any previous checked value');

let toggle = savedToggle('legacy');
toggle.checked = true;
toggle.listeners.change();
assert.equal(store.customPrompts[1].showInSelectionPopup, true);
assert.equal(checkbox().checked, true, 'quick toggles keep the open edit form in sync');
toggle.checked = false;
toggle.listeners.change();
assert.equal(store.customPrompts[1].showInSelectionPopup, false);
assert.equal(checkbox().checked, false);
assert.equal(store.customPrompts[0].futureMetadata.retained, true);

for (const failure of ['get', 'set']) {
  if (failure === 'get') failGet = true;
  else failSet = true;
  toggle.checked = true;
  toggle.listeners.change();
  assert.equal(toggle.checked, false, `${failure} failure rolls the toggle back`);
  assert.equal(toggle.disabled, false);
  assert.equal(store.customPrompts[1].showInSelectionPopup, false);
  assert.match(status(), /Could not update selection button/);
}

fill('Unsaved grammar edit', 'Preserve this {word}.', true);
const beforeFailure = clone(store);
for (const failure of ['get', 'set']) {
  if (failure === 'get') failGet = true;
  else failSet = true;
  context.savePrompt();
  assert.deepEqual(store, beforeFailure, `${failure} failure does not update storage`);
  assert.equal(el('prompt-id').value, 'legacy');
  assert.equal(el('prompt-name').value, 'Unsaved grammar edit');
  assert.equal(el('prompt-content').value, 'Preserve this {word}.');
  assert.equal(checkbox().checked, true);
  assert.equal(el('save-custom-prompt-btn').disabled, false);
  assert.match(status(), /Could not save prompt/);
}

context.cancelPromptEdit();
assert.equal(el('prompt-id').value, '');
assert.equal(checkbox().checked, false, 'cancel clears selection visibility');
fill('  ', 'Check {word}.', true);
const beforeInvalid = writes;
context.savePrompt();
assert.equal(writes, beforeInvalid, 'blank names are not saved');
assert.equal(alerts.length, 1);

context.editPrompt('legacy');
store.customPrompts = store.customPrompts.filter(prompt => prompt.id !== 'legacy');
context.savePrompt();
assert.match(status(), /prompt was deleted/);
assert.equal(el('prompt-id').value, 'legacy', 'missing prompts leave the edit recoverable');

// Delay commits so two user actions overlap, as Chrome's asynchronous storage
// callbacks do. Each mutation must read only after the preceding write lands.
context.cancelPromptEdit();
context.loadPrompts();
const pendingWrites = [];
const immediateSet = chrome.storage.sync.set;
chrome.storage.sync.set = (updates, callback) => pendingWrites.push(() => immediateSet(updates, callback));
const firstToggle = savedToggle(first.id);
const secondToggle = savedToggle('invalid-flag');
firstToggle.checked = true;
firstToggle.listeners.change();
secondToggle.checked = true;
secondToggle.listeners.change();
assert.equal(pendingWrites.length, 1, 'concurrent mutations wait for the first write');
pendingWrites.shift()();
assert.equal(pendingWrites.length, 1);
pendingWrites.shift()();
assert.equal(store.customPrompts.every(prompt => prompt.showInSelectionPopup === true), true,
  'rapid toggles retain both changes');
assert.equal(savedToggle(first.id).checked, true);
assert.equal(savedToggle('invalid-flag').checked, true);

toggle = savedToggle(first.id);
toggle.checked = false;
toggle.listeners.change();
const target = el('prompts-list').children.find(row => row.dataset?.promptId === 'invalid-flag');
target.listeners.drop({
  stopPropagation() {}, preventDefault() {},
  dataTransfer: { getData: () => first.id },
});
pendingWrites.shift()();
pendingWrites.shift()();
assert.equal(store.customPrompts[1].id, first.id, 'reordering runs after the pending toggle');
assert.equal(store.customPrompts[1].showInSelectionPopup, false, 'reordering preserves the latest visibility');
assert.deepEqual(store.customPrompts[1].futureMetadata, { retained: true });
chrome.storage.sync.set = immediateSet;

store.defaultPromptId = first.id;
context.deletePrompt(first.id);
assert.equal(store.customPrompts.some(prompt => prompt.id === first.id), false);
assert.equal(store.defaultPromptId, 'system', 'deleting the default button resets the default prompt');
assert.equal(savedToggle('invalid-flag').checked, true);

console.log('Selection button settings tests passed (CRUD, legacy flags, metadata, storage errors, and concurrent changes).');
