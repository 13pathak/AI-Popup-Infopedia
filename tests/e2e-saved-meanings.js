// Browser integration for issue #39. Uses the runner's CDP browser on 9333,
// an isolated tab, the complete content script and its real shadow-DOM popup.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let ws, page, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function run() {
  page = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), promise = pending.get(message.id);
    if (promise) { pending.delete(message.id); message.error ? promise.reject(message.error) : promise.resolve(message.result); }
  };
  await evaluate(`
    window.savedData = { history: [{ id: 'one', word: 'Cell', definition: 'Original definition <img src=x onerror=alert(1)>', notes: 'Remember this', context: { sentence: 'A cell divides.' }, listId: 'bio', timestamp: new Date(Date.now() - 12 * 86400000).toISOString() }], wordLists: [{ id: 'bio', name: 'Biology' }] };
    window.changeListeners = [];
    window.chrome = {
      runtime: { getURL: p => 'http://127.0.0.1:8793/' + p, onMessage: { addListener() {} }, sendMessage: (msg, cb) => { if (cb) cb(msg.type === 'getLists' ? { lists: savedData.wordLists, lastUsedListId: 'bio' } : {}); } },
      storage: {
        local: { get: (defaults, cb) => setTimeout(() => cb({ ...defaults, ...savedData }), 0) },
        sync: { get: (defaults, cb) => setTimeout(() => cb(defaults), 0) },
        onChanged: { addListener: fn => changeListeners.push(fn) }
      }
    };
  `);
  await evaluate(fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8'));
  await evaluate(`
    window.testPopup = showPopup(60, 60, '');
    testPopup.compareWord = ' CELL ';
    testPopup.compareSlots = [{ modelId: 'test', modelName: 'Test model', status: 'done', started: true, messages: [{ role: 'user', content: 'Cell' }, { role: 'assistant', content: 'A cell is the basic unit of life.' }] }];
    renderCompareView(testPopup);
    new Promise(resolve => setTimeout(resolve, 100));
  `);
  assert.equal(await evaluate(`testPopup.popup.querySelector('.ai-saved-history summary').textContent`), 'Saved in Biology · 12 days ago');
  assert.equal(await evaluate(`testPopup.popup.querySelector('.ai-saved-history details').open`), false);
  await evaluate(`testPopup.popup.querySelector('.ai-saved-history summary').click(); new Promise(resolve => setTimeout(resolve, 20));`);
  assert.equal(await evaluate(`testPopup.popup.querySelector('.ai-saved-history details').open`), true);
  await evaluate(`testPopup.popup.querySelector('.ai-saved-actions button').click()`);
  assert.equal(await evaluate(`testPopup.popup.querySelector('.ai-saved-preview').hidden`), false);
  assert.equal(await evaluate(`testPopup.popup.querySelector('.ai-saved-preview img') === null`), true);
  await evaluate(`renderCompareView(testPopup); new Promise(resolve => setTimeout(resolve, 20));`);
  assert.equal(await evaluate(`testPopup.popup.querySelector('.ai-saved-history details').open && !testPopup.popup.querySelector('.ai-saved-preview').hidden`), true, 'disclosure survives answer-card rerenders');
  for (const theme of ['light', 'dark']) {
    await evaluate(`testPopup.container.setAttribute('data-theme', '${theme}')`);
    assert.equal(await evaluate(`(() => { const p = testPopup.popup, a = p.querySelector('.ai-saved-actions'); return a.scrollWidth <= a.clientWidth && a.getBoundingClientRect().width > 0; })()`), true, theme + ' actions fit the card');
  }
  await evaluate(`savedData.wordLists[0].name = 'Science'; changeListeners.forEach(fn => fn({ wordLists: {} }, 'local')); new Promise(resolve => setTimeout(resolve, 20));`);
  assert.ok((await evaluate(`testPopup.popup.querySelector('.ai-saved-history summary').textContent`)).includes('Science'), 'list rename updates an open popup');
  await evaluate(`savedData.history = []; changeListeners.forEach(fn => fn({ history: {} }, 'local')); new Promise(resolve => setTimeout(resolve, 20));`);
  assert.equal(await evaluate(`testPopup.popup.querySelector('.ai-saved-history summary') === null`), true, 'deleting history clears the badge');
  console.log('Saved-meaning browser integration passed (real popup, both themes, live storage updates).');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ws) ws.close();
  if (page) await fetch('http://127.0.0.1:9333/json/close/' + page.id).catch(() => {});
});
