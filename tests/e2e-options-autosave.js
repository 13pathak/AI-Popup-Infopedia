// Options page: labeled model buttons, autosave everywhere with a "Saved ✓"
// badge (no per-section Save buttons), and the Hallucination Guard's
// verification model greyed out while the guard is off. Loads the real
// options.html from the test server in an isolated tab of the runner's CDP
// browser, with an in-memory chrome.storage stub injected before any page
// script runs. Run with tests/run-all.js, or directly with the server and
// browser on 8793/9333.
'use strict';
const assert = require('node:assert/strict');

let ws, page, nextId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timer });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, label) {
  assert.equal(await evaluate(`(async () => {
    for (let i = 0; i < 150; i++) {
      if (${expression}) return true;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return false;
  })()`), true, label);
}

const { STUB } = require('./options-page-stub');

// Text of the "Saved ✓" badge in the title of the section holding #id.
const badgeFor = id => `(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  const section = el.closest('.settings-section'), tab = el.closest('.tab-content');
  const heading = (section && section.querySelector('.section-title')) || tab.querySelector('h2');
  const badge = heading.querySelector('.saved-badge');
  return badge && badge.classList.contains('show') ? badge.textContent : '';
})()`;
const typeInto = (id, text) => evaluate(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  el.focus(); el.value = ${JSON.stringify(text)};
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const changeTo = (id, apply) => evaluate(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  ${apply};
  el.dispatchEvent(new Event('change', { bubbles: true }));
})()`);

async function run() {
  page = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      clearTimeout(task.timer);
      message.error ? task.reject(message.error) : task.resolve(message.result);
    }
  };
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:8793/options.html' });
  await waitFor(`document.readyState === 'complete' && document.querySelectorAll('#model-select option').length === 2`, 'options page loads its models');

  // 1. Model buttons carry text labels and tooltips; Delete is last and unfilled.
  assert.deepEqual(await evaluate(`(() => {
    const row = document.getElementById('model-selection-container');
    const buttons = [...row.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none');
    const del = document.getElementById('delete-model-btn');
    return {
      labels: buttons.map(b => b.textContent.trim()),
      titled: buttons.every(b => b.title.length > 0),
      deleteLast: buttons.at(-1) === del,
      deleteFill: getComputedStyle(del).backgroundColor,
      deleteQuiet: del.classList.contains('btn-quiet-danger')
    };
  })()`), { labels: ['Add', 'Edit', 'Reorder', 'Delete'], titled: true, deleteLast: true, deleteFill: 'rgba(0, 0, 0, 0)', deleteQuiet: true },
  'model buttons are labeled and Delete is the quiet last one');

  // 2. No per-section Save buttons remain.
  assert.deepEqual(await evaluate(`['save-tavily-btn', 'save-followup-settings-btn', 'save-pdf-author-btn', 'anki-save-settings-btn', 'save-reminder-settings-btn', 'tts-save-btn', 'stt-save-btn'].filter(id => document.getElementById(id))`), [], 'per-section Save buttons are gone');

  // Text fields save after a pause in typing, with the badge in their section.
  await typeInto('tavily-api-key', 'tvly-abc');
  assert.equal(await evaluate(`__stores.sync.tavilyApiKey`), undefined, 'not saved mid-typing');
  await waitFor(`__stores.sync.tavilyApiKey === 'tvly-abc'`, 'the search key saves after a pause');
  await waitFor(`${badgeFor('tavily-api-key')} === 'Saved ✓'`, 'Search API section shows Saved');

  // Leaving a field with an edit pending saves right away.
  await typeInto('static-followup-chips', 'One\nTwo');
  await evaluate(`document.getElementById('static-followup-chips').dispatchEvent(new Event('change', { bubbles: true }))`);
  await waitFor(`JSON.stringify(__stores.sync.followupChips) === '["One","Two"]'`, 'leaving the chips field saves at once');
  await waitFor(`${badgeFor('static-followup-chips')} === 'Saved ✓'`, 'Follow-up section shows Saved');

  await typeInto('pdf-author-name', 'Ada');
  await waitFor(`__stores.local.pdf_author_name === 'Ada'`, 'PDF author name autosaves');
  await waitFor(`${badgeFor('pdf-author-name')} === 'Saved ✓'`, 'PDF tab shows Saved');

  // Pickers, sliders and checkboxes save on change.
  await changeTo('tts-rate-range', `el.value = '1.5'`);
  await waitFor(`__stores.sync.ttsSettings && __stores.sync.ttsSettings.rate === 1.5`, 'TTS rate autosaves');
  await waitFor(`${badgeFor('tts-rate-range')} === 'Saved ✓'`, 'TTS tab shows Saved');

  await changeTo('stt-engine-select', `el.value = 'api'`);
  await waitFor(`__stores.sync.sttEngine === 'api'`, 'STT engine autosaves');
  await typeInto('stt-custom-headers', '{ not json');
  await evaluate(`document.getElementById('stt-custom-headers').dispatchEvent(new Event('change', { bubbles: true }))`);
  await waitFor(`document.getElementById('stt-status').textContent.includes('Invalid JSON')`, 'invalid JSON is reported, not saved');
  assert.notEqual(await evaluate(`__stores.sync.sttCustomHeaders`), '{ not json', 'invalid JSON is not saved');

  await changeTo('reminder-frequency', `el.value = '7'`);
  await waitFor(`__stores.sync.backupReminderFrequency === 7`, 'backup frequency autosaves');
  await changeTo('backup-include-pdf', `el.checked = false`);
  await waitFor(`__stores.sync.backupInclude && __stores.sync.backupInclude.pdf === false`, 'backup content choices autosave');
  await waitFor(`${badgeFor('backup-include-pdf')} === 'Saved ✓'`, 'backup section shows Saved');
  const writesBefore = await evaluate(`__writes.filter(w => w.keys.includes('backupInclude')).length`);
  await evaluate(`document.getElementById('backup-deselect-all-btn').click()`);
  await waitFor(`document.getElementById('reminder-status').textContent.includes('at least one')`, 'an empty backup selection is refused with a message');
  assert.equal(await evaluate(`__writes.filter(w => w.keys.includes('backupInclude')).length`), writesBefore, 'an empty backup selection is not saved');

  // Settings that already autosaved now confirm the same way.
  await changeTo('enable-implicit-context', `el.checked = !el.checked`);
  await waitFor(`${badgeFor('enable-implicit-context')} === 'Saved ✓'`, 'existing autosave toggles show Saved too');

  // 3. The verification model is greyed out and disabled while the guard is off.
  await waitFor(`document.querySelectorAll('#verification-model-select option').length === 2`, 'verification models load');
  const guardState = () => evaluate(`(() => {
    const select = document.getElementById('verification-model-select');
    const field = document.getElementById('verification-model-field');
    return { disabled: select.disabled, greyed: field.classList.contains('setting-disabled'), faded: Number(getComputedStyle(field).opacity) < 1 };
  })()`);
  assert.deepEqual(await guardState(), { disabled: true, greyed: true, faded: true }, 'guard off: verification model is greyed out');
  await changeTo('enable-hallucination-guard', `el.checked = true`);
  await waitFor(`__stores.sync.enableHallucinationGuard === true`, 'guard toggle saves');
  assert.deepEqual(await guardState(), { disabled: false, greyed: false, faded: false }, 'guard on: verification model is usable');
  await waitFor(`${badgeFor('enable-hallucination-guard')} === 'Saved ✓'`, 'guard section shows Saved');
  await changeTo('enable-hallucination-guard', `el.checked = false`);
  assert.deepEqual(await guardState(), { disabled: true, greyed: true, faded: true }, 'guard off again: greyed out again');

  assert.deepEqual(await evaluate('__errors'), [], 'no uncaught page errors');
  console.log('Options autosave passed: labeled model buttons, autosave with Saved badges across sections, invalid input refused, guard greying.');
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const task of pending.values()) clearTimeout(task.timer);
  if (ws) ws.close();
  if (page) await fetch('http://127.0.0.1:9333/json/close/' + page.id).catch(() => {});
});
