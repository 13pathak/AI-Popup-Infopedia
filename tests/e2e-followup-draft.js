// Browser integration for issue #40. Uses the runner's CDP browser on 9333,
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
    window.sessionData = {};
    window.questionCount = 0;
    window.delayRecovery = false;
    window.models = [{ id: 'test', name: 'Test model' }];
    window.chrome = {
      runtime: {
        getURL: p => 'http://127.0.0.1:8793/' + p,
        onMessage: { addListener(fn) { window.popupMessage = fn; } },
        sendMessage(msg, cb) {
          if (msg.type === 'stashConversation') return setConvoStash(msg.payload).then(ok => cb({ ok }));
          if (msg.type === 'clearConversationDraft') return clearConvoDraft().then(ok => cb({ ok }));
          if (msg.type === 'getLastConversation') return getConvoStash().then(payload => {
            if (delayRecovery) window.pendingRecovery = () => cb({ payload });
            else cb({ payload });
          });
          if (msg.type === 'getAiDefinition') { questionCount++; return cb({ definition: 'Test answer', usedModelName: 'Test model' }); }
          if (cb) cb(msg.type === 'getLists' ? { lists: [{ id: 'one', name: 'Words' }], lastUsedListId: 'one' } : {});
        }
      },
      storage: {
        local: { get: (defaults, cb) => setTimeout(() => cb(Array.isArray(defaults) ? {} : defaults), 0) },
        sync: { get: (defaults, cb) => setTimeout(() => cb({ ...defaults, models, defaultModelId: 'test' }), 0) },
        session: {
          get: (key, cb) => setTimeout(() => cb(JSON.parse(JSON.stringify(sessionData))), 0),
          set: (values, cb) => setTimeout(() => { Object.assign(sessionData, JSON.parse(JSON.stringify(values))); cb(); }, 0)
        },
        onChanged: { addListener() {} }
      }
    };
    window.pause = () => new Promise(resolve => setTimeout(resolve, 150));
  `);
  const background = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  await evaluate(background.slice(background.indexOf('const CONVO_STASH_KEY'), background.indexOf('// --- Direct pronunciation & IPA')));
  await evaluate(fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8'));
  const open = () => evaluate(`popupMessage({ type: 'triggerPopup' }); pause();`);
  const inputValue = () => evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-followup-input').value`);
  const type = value => evaluate(`(() => { const input = activePopups.at(-1).popup.querySelector('#ai-popup-followup-input'); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input')); })(); pause();`);
  const close = () => evaluate(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); pause();`);
  await open();
  await type('  My unfinished question 🧬  ');
  await close();
  assert.equal(await evaluate(`getConvoStash().then(stash => stash.slots.length)`), 0, 'draft saved with no answer');
  await open();
  assert.equal(await inputValue(), '  My unfinished question 🧬  ');
  assert.equal(await evaluate(`(() => { const p = activePopups.at(-1), i = p.popup.querySelector('#ai-popup-followup-input'); return p.shadow.activeElement === i && i.selectionStart === i.value.length && i.selectionEnd === i.value.length; })()`), true, 'hotkey focuses at end');
  assert.equal(await evaluate('questionCount'), 0, 'recovery never submits');
  await type('');
  assert.equal(await evaluate(`getConvoStash().then(stash => stash.followupDraft)`), '', 'erasing clears session immediately');
  await close(); await open();
  assert.equal(await inputValue(), '', 'erased text stays gone');

  await type('Submit this question'); await close(); await open();
  await evaluate(`activePopups.at(-1).popup.querySelector('.ai-popup-followup-send').click(); pause();`);
  assert.equal(await evaluate('questionCount'), 1);
  assert.equal(await evaluate(`getConvoStash().then(stash => stash.followupDraft)`), '', 'submission clears session immediately');
  await type('Follow-up draft'); await close(); await open();
  assert.equal(await inputValue(), 'Follow-up draft');
  assert.equal(await evaluate(`activePopups.at(-1).compareSlots[0].messages.some(m => m.content === 'Test answer')`), true, 'follow-up recovery retains context');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); pause();`);
  await open();
  assert.equal(await inputValue(), 'Follow-up draft', 'Escape dismissal retains draft');

  await close();
  await evaluate('delayRecovery = true');
  await open();
  await type('New text beats delayed recovery');
  await evaluate('pendingRecovery(); delayRecovery = false; pause();');
  assert.equal(await inputValue(), 'New text beats delayed recovery');
  await close();
  await evaluate('models = []');
  await open();
  assert.equal(await inputValue(), 'New text beats delayed recovery', 'deleted models do not lose drafts');
  console.log('Draft hotkey recovery, dismissal, caret, clear/submit and delayed-response browser tests passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ws) ws.close();
  if (page) await fetch('http://127.0.0.1:9333/json/close/' + page.id).catch(() => {});
});
