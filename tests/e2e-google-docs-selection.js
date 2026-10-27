// Browser coverage for selections in Google's canvas editors (Docs and
// Slides). Serves a stand-in editor at https://docs.google.com through CDP
// request interception: text drawn on a canvas, keyboard focus and copy
// handled by an offscreen ".docs-texteventtarget-iframe", like the real
// editors. The complete content script runs in the top frame and, as in the
// extension (all_frames + match_about_blank), inside that iframe too.
// Run with tests/run-all.js, or directly with the test browser on 9333.
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
const mouse = (type, x, y, clickCount = 1) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount });
async function doubleClick(x, y) {
  await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y, 1);
  await mouse('mousePressed', x, y, 2); await mouse('mouseReleased', x, y, 2);
}
async function drag(from, to) {
  await mouse('mousePressed', from.x, from.y);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: to.x, y: to.y });
  await mouse('mouseReleased', to.x, to.y);
}
const pause = () => evaluate('new Promise(resolve => setTimeout(resolve, 150))');

const editorPage = `<!doctype html><html><head><title>Lecture notes - Google Docs</title></head>
<body style="margin:0">
  <div id="docs-chrome" style="height:60px;background:#eee"><button id="bold" style="margin:16px">B</button></div>
  <div class="kix-appview-editor"><canvas id="page" width="900" height="600" style="display:block"></canvas></div>
  <iframe class="docs-texteventtarget-iframe" style="position:absolute;top:-10000px;width:600px;height:1px;border:0"></iframe>
  <script>
    window.docsSelection = '';
    window.copyEvents = [];
    const frame = document.querySelector('.docs-texteventtarget-iframe');
    const idoc = frame.contentDocument;
    idoc.body.innerHTML = '<div contenteditable="true" role="textbox" aria-label="Document content"> </div>';
    // The editor answers copy from its own selection model.
    idoc.addEventListener('copy', event => {
      copyEvents.push(event.isTrusted);
      if (!docsSelection) return;
      event.clipboardData.setData('text/plain', docsSelection);
      event.preventDefault();
    });
    // Pointer selection keeps keyboard focus in the offscreen iframe.
    document.getElementById('page').addEventListener('mousedown', event => {
      event.preventDefault();
      idoc.querySelector('[contenteditable]').focus();
    });
  </script>
</body></html>`;

const stub = `(target, log) => {
  target.chrome = {
    runtime: {
      getURL: p => 'https://docs.google.com/__extension/' + p,
      lastError: undefined,
      onMessage: { addListener(fn) { target.popupMessage = fn; } },
      sendMessage(message, callback) {
        log.push(JSON.parse(JSON.stringify(message)));
        let response = {};
        if (message.type === 'getAiDefinition') response = { definition: 'Test answer', usedModelName: 'Test model' };
        else if (message.type === 'getLists' || message.type === 'getWordLists') response = { lists: [{ id: 'one', name: 'Words' }], lastUsedListId: 'one' };
        if (callback) setTimeout(() => callback(response), 0);
      }
    },
    storage: {
      local: { get: (defaults, cb) => setTimeout(() => cb(Array.isArray(defaults) ? {} : defaults), 0), set: (v, cb) => cb && setTimeout(cb, 0) },
      sync: { get: (defaults, cb) => setTimeout(() => cb({ ...(Array.isArray(defaults) ? {} : defaults), models: [{ id: 'test', name: 'Test model' }], defaultModelId: 'test' }), 0) },
      session: { get: (key, cb) => setTimeout(() => cb({}), 0), set: (v, cb) => cb && setTimeout(cb, 0) },
      onChanged: { addListener() {} }
    }
  };
}`;

async function run() {
  page = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const isEditor = new URL(request.url).pathname.startsWith('/document/');
      send('Fetch.fulfillRequest', isEditor
        ? { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: Buffer.from(editorPage).toString('base64') }
        : { requestId, responseCode: 404, responseHeaders: [], body: '' });
      return;
    }
    const promise = pending.get(message.id);
    if (promise) { pending.delete(message.id); message.error ? promise.reject(message.error) : promise.resolve(message.result); }
  };
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://docs.google.com/*' }] });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.navigate', { url: 'https://docs.google.com/document/d/test/edit' });
  assert.equal(await evaluate(`(async () => {
    for (let i = 0; i < 100; i++) {
      if (location.hostname === 'docs.google.com' && document.readyState === 'complete') return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  })()`), true, 'stand-in editor loads at docs.google.com');

  const content = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  await evaluate(`
    window.topRequests = [];
    window.frameRequests = [];
    (${stub})(window, topRequests);
    window.frameWindow = document.querySelector('.docs-texteventtarget-iframe').contentWindow;
    (${stub})(frameWindow, frameRequests);
  `);
  await evaluate(content);
  await evaluate(`(() => {
    const script = frameWindow.document.createElement('script');
    script.textContent = ${JSON.stringify(content)};
    frameWindow.document.documentElement.appendChild(script);
  })()`);
  const topPopup = () => evaluate(`activePopups.length ? { count: activePopups.length, text: activePopups.at(-1).sourceText, word: activePopups.at(-1).sourceWord || null, toolbar: !!activePopups.at(-1).popup.querySelector('#ai-open-button-popup') } : null`);
  const aiWords = list => evaluate(`${list}.filter(m => m.type === 'getAiDefinition').map(m => m.word)`);
  const framePopups = () => evaluate(`[...frameWindow.document.documentElement.children].filter(el => el.shadowRoot).length`);

  // Plain clicks (placing the caret, toolbar buttons) never ask the editor.
  await evaluate(`docsSelection = 'photosynthesis'`);
  await mouse('mousePressed', 200, 300); await mouse('mouseReleased', 200, 300);
  await pause();
  assert.equal(await evaluate('copyEvents.length'), 0, 'single click sends no copy event');
  assert.equal(await topPopup(), null, 'single click opens nothing');

  // Double-clicking a word shows the toolbar above the pointer.
  await doubleClick(200, 300);
  await pause();
  assert.deepEqual(await topPopup(), { count: 1, text: 'photosynthesis', word: null, toolbar: true }, 'double-click selection shows Ask AI');
  assert.deepEqual(await evaluate('copyEvents'), [false], 'one untrusted copy event reads the selection');
  const placement = await evaluate(`(() => { const r = activePopups.at(-1).popup.getBoundingClientRect(); return { left: r.left, bottom: r.bottom }; })()`);
  assert.equal(placement.left, 200, 'toolbar starts at the pointer');
  assert.ok(placement.bottom <= 300, `toolbar sits above the pointer (bottom ${placement.bottom})`);

  // Ask AI looks the word up with the page title as context.
  const askAt = await evaluate(`(() => { const r = activePopups.at(-1).popup.querySelector('#ai-open-button-popup').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await mouse('mousePressed', askAt.x, askAt.y); await mouse('mouseReleased', askAt.x, askAt.y);
  await pause();
  assert.deepEqual(await aiWords('topRequests'), ['photosynthesis'], 'Ask AI sends the editor selection');
  assert.deepEqual(await evaluate(`topRequests.find(m => m.type === 'getAiDefinition').context`), { sentence: '', pageTitle: 'Lecture notes - Google Docs' });
  await mouse('mousePressed', 600, 500); await mouse('mouseReleased', 600, 500);
  await pause();
  assert.equal(await topPopup(), null, 'outside click closes the popup');

  // Dragging across text works the same way.
  await evaluate(`docsSelection = 'light dependent reactions'`);
  await drag({ x: 120, y: 260 }, { x: 420, y: 300 });
  await pause();
  assert.equal((await topPopup()).text, 'light dependent reactions', 'drag selection shows Ask AI');

  // Escape typed into the editor's iframe still closes the toolbar.
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await pause();
  assert.equal(await evaluate('document.activeElement.className'), 'docs-texteventtarget-iframe', 'focus stays in the editor iframe');
  assert.equal(await topPopup(), null, 'Escape closes the toolbar');

  // Double-clicks in the menu/toolbar area are not text selections.
  const copiesBefore = await evaluate('copyEvents.length');
  await doubleClick(24, 30);
  await pause();
  assert.equal(await evaluate('copyEvents.length'), copiesBefore, 'toolbar double-click sends no copy event');
  assert.equal(await topPopup(), null, 'toolbar double-click opens nothing');

  // The hotkey is handled by the top frame, not the offscreen iframe.
  await evaluate(`docsSelection = 'chlorophyll'`);
  await mouse('mousePressed', 200, 300); await mouse('mouseReleased', 200, 300);
  await evaluate(`popupMessage({ type: 'triggerPopup' }); frameWindow.popupMessage({ type: 'triggerPopup' });`);
  await pause();
  assert.deepEqual(await topPopup(), { count: 1, text: 'chlorophyll', word: null, toolbar: false }, 'hotkey opens the answer popup in the top frame');
  assert.deepEqual(await aiWords('topRequests'), ['photosynthesis', 'chlorophyll'], 'hotkey sends the editor selection');
  assert.equal(await framePopups(), 0, 'nothing renders inside the offscreen iframe');
  assert.deepEqual(await aiWords('frameRequests'), [], 'the iframe sends no lookups');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await pause();
  assert.equal(await topPopup(), null);

  // With nothing selected the hotkey opens the question box in the top frame.
  await evaluate(`docsSelection = ''`);
  await evaluate(`popupMessage({ type: 'triggerPopup' }); frameWindow.popupMessage({ type: 'triggerPopup' });`);
  await pause();
  assert.deepEqual(await topPopup(), { count: 1, text: '', word: 'Custom Question', toolbar: false }, 'empty hotkey opens the question popup');
  assert.equal(await framePopups(), 0, 'question popup is not hidden in the iframe');
  assert.deepEqual(await evaluate('copyEvents.filter(trusted => trusted)'), [], 'every copy event was synthetic');
  console.log('Google editor selection, toolbar placement, hotkey frame routing and Escape browser tests passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ws) ws.close();
  if (page) await fetch('http://127.0.0.1:9333/json/close/' + page.id).catch(() => {});
});
