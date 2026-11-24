// Runs the complete content script in the test runner's CDP browser and
// drives the full-screen word cursor with real key and mouse events.
// Run with tests/run-all.js, or directly with the server/browser on 8793/9333.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
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
    for (let i = 0; i < 100; i++) {
      if (${expression}) return true;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return false;
  })()`), true, label);
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const KEY_CODES = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Enter: 13, Escape: 27, End: 35, Home: 36, ' ': 32 };
const MOD = { alt: 1, ctrl: 2, shift: 8 };
async function press(key, modifiers = 0) {
  const vk = KEY_CODES[key];
  const base = { key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers };
  const text = key === 'Enter' ? '\r' : key === ' ' ? ' ' : undefined;
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text, unmodifiedText: text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}
async function mouse(type, point, clickCount = 1, modifiers = 0) {
  await send('Input.dispatchMouseEvent', { type, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount, modifiers, ...point });
}
async function clickAt(point, clickCount = 1, modifiers = 0) {
  await mouse('mousePressed', point, clickCount, modifiers);
  await mouse('mouseReleased', point, clickCount, modifiers);
}
const wordPoint = (selector, word, nth = 0, frac = 0.5) => evaluate(`wordPoint(${JSON.stringify(selector)}, ${JSON.stringify(word)}, ${nth}, ${frac})`);
const selected = () => evaluate('getSelection().toString()');
const cursorText = () => evaluate('wordCursor.sel ? wordCursorRangeOf(wordCursor.sel).toString() : ""');
const pageKeys = () => evaluate('pageKeys.splice(0)');

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.bringToFront');

  await evaluate(`
    document.title = 'Word cursor test';
    document.body.style.margin = '0';
    document.body.innerHTML = \`
      <header id="masthead" style="position: sticky; top: 0; background: #eee; font: 16px sans-serif; padding: 8px">Site Name Home About Contact</header>
      <main style="font: 20px/30px monospace; width: 600px; margin: 20px 40px">
        <p id="p1">Alpha beta, <b>gamma</b> delta. <span id="gone" style="display: none">hidden words here</span><span id="sr" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">screen reader only</span>Epsilon <a id="link" href="#zeta">zeta</a> eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega. Second sentence starts here! Third one? Yes.</p>
        <p id="p2">Bank one: the river bank was muddy. Bank two: the bank lent money.</p>
        <input id="field" value="type here">
        <div style="height: 1600px"></div>
        <p id="far">Faraway words wait at the bottom of the page.</p>
        <p id="long">\${Array.from({ length: 90 }, (_, i) => 'w' + (i + 1)).join(' ')}</p>
      </main>\`;

    // Full screen is the (display-mode: fullscreen) media query, which
    // headless Chrome cannot emulate: this stand-in fires the same event.
    const realMatchMedia = window.matchMedia.bind(window);
    let fullscreen = false;
    window.fakeFullscreen = new EventTarget();
    Object.defineProperty(window.fakeFullscreen, 'matches', { get: () => fullscreen });
    window.setFullscreen = on => { fullscreen = on; window.fakeFullscreen.dispatchEvent(new Event('change')); };
    window.matchMedia = query => query.includes('display-mode: fullscreen') ? window.fakeFullscreen : realMatchMedia(query);

    window.syncData = { uiTheme: 'dark', wordCursorInFullscreen: true, defaultModelId: 'm1', models: [{ id: 'm1', name: 'Model one' }] };
    window.localData = {};
    window.changeListeners = [];
    window.messageListeners = [];
    window.requests = [];
    window.errors = [];
    window.pageKeys = [];
    window.addEventListener('error', event => errors.push(event.message));
    document.addEventListener('keydown', e => pageKeys.push('down:' + e.key));
    document.addEventListener('keypress', e => pageKeys.push('press:' + e.key));
    document.addEventListener('keyup', e => pageKeys.push('up:' + e.key));
    window.chrome = {
      runtime: {
        getURL: p => 'http://127.0.0.1:8793/' + p,
        lastError: null,
        onMessage: { addListener: listener => messageListeners.push(listener) },
        sendMessage(message, callback) {
          requests.push(structuredClone(message));
          let response = {};
          if (message.type === 'getAiDefinition') response = { definition: 'Meaning of ' + message.word, usedModelName: message.modelId };
          else if (message.type === 'getLists' || message.type === 'getWordLists') response = { lists: [{ id: 'one', name: 'Words' }], lastUsedListId: 'one' };
          if (callback) setTimeout(() => callback(response), 0);
        }
      },
      storage: {
        local: {
          get: (defaults, callback) => setTimeout(() => callback(Array.isArray(defaults) || typeof defaults === 'string' ? {} : { ...defaults, ...localData }), 0),
          set: (values, callback) => { Object.assign(localData, structuredClone(values)); if (callback) setTimeout(callback, 0); },
          remove: (keys, callback) => { [].concat(keys).forEach(key => delete localData[key]); if (callback) setTimeout(callback, 0); }
        },
        sync: {
          get(defaults, callback) {
            const result = Array.isArray(defaults)
              ? Object.fromEntries(defaults.map(key => [key, syncData[key]]))
              : { ...defaults, ...syncData };
            setTimeout(() => callback(structuredClone(result)), 0);
          },
          set: (values, callback) => { Object.assign(syncData, structuredClone(values)); if (callback) setTimeout(callback, 0); }
        },
        onChanged: { addListener: listener => changeListeners.push(listener) }
      }
    };
    window.updateSync = values => {
      const changes = {};
      for (const [key, value] of Object.entries(values)) {
        changes[key] = { oldValue: syncData[key], newValue: value };
        syncData[key] = value;
      }
      changeListeners.forEach(listener => listener(changes, 'sync'));
    };
    window.sendExtensionMessage = message => messageListeners.forEach(listener => listener(message, {}, () => {}));
    window.aiRequests = () => requests.filter(request => request.type === 'getAiDefinition');

    // Viewport point inside the nth occurrence of a word (frac across it).
    window.wordPoint = (selector, word, nth, frac) => {
      const walker = document.createTreeWalker(document.querySelector(selector), NodeFilter.SHOW_TEXT);
      let seen = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let at = node.data.indexOf(word); at !== -1; at = node.data.indexOf(word, at + 1)) {
          if (seen++ < nth) continue;
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + word.length);
          const rect = range.getBoundingClientRect();
          return { x: rect.left + rect.width * frac, y: rect.top + rect.height / 2 };
        }
      }
      throw new Error('word not found: ' + word);
    };

    // Brute-force reference for ↑ / ↓: among the words of #p1, the nearest
    // one to goalX on the line just below (or above) the given rect.
    window.p1Words = () => {
      const words = [];
      const walker = document.createTreeWalker(document.getElementById('p1'), NodeFilter.SHOW_TEXT, {
        acceptNode: n => n.parentElement.closest('#gone, #sr') ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT
      });
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const part of segmenter.segment(node.data)) {
          if (!part.isWordLike) continue;
          const range = document.createRange();
          range.setStart(node, part.index);
          range.setEnd(node, part.index + part.segment.length);
          words.push({ text: part.segment, rect: range.getBoundingClientRect() });
        }
      }
      return words;
    };
    window.expectedLineWord = (fromText, goalX, direction) => {
      const words = p1Words();
      const from = words.find(w => w.text === fromText).rect;
      const beyond = words.filter(w => direction > 0 ? w.rect.top >= from.bottom - 1 : w.rect.bottom <= from.top + 1);
      const lineTop = direction > 0 ? Math.min(...beyond.map(w => w.rect.top)) : Math.max(...beyond.map(w => w.rect.top));
      const line = beyond.filter(w => Math.abs(w.rect.top - lineTop) < 2);
      const distance = r => r.right < goalX ? goalX - r.right : r.left > goalX ? r.left - goalX : 0;
      line.sort((a, b) => distance(a.rect) - distance(b.rect));
      return line[0].text;
    };
    window.cursorRect = () => wordCursorRangeOf(wordCursor.sel).getBoundingClientRect();
    window.hintText = () => {
      const host = document.querySelector('[data-ai-word-cursor-hint]');
      return host ? host.shadowRoot.querySelector('.hint').textContent : '';
    };
    1;
  `);
  await evaluate(fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8'));
  await sleep(50);

  // Off outside full screen.
  assert.equal(await evaluate('wordCursor.active'), false, 'no word cursor outside full screen');
  assert.equal(await selected(), '', 'nothing selected outside full screen');

  // Entering full screen selects the first word of the main content, not
  // the sticky site header, and shows the key hint.
  await evaluate('setFullscreen(true)');
  await waitFor('wordCursor.active', 'full screen turns the word cursor on');
  assert.equal(await selected(), 'Alpha', 'the first word of the main content is selected');
  assert.match(await evaluate('hintText()'), /Word cursor.*Shift\+arrows select more.*Enter.*explain.*Esc.*exit/, 'the key hint is shown');
  assert.equal(await evaluate(`document.querySelector('[data-ai-word-cursor-hint]').shadowRoot.querySelector('[role="status"]') !== null`), true, 'the hint is a status message');
  await pageKeys();

  // ← → step through whole words, across inline tags, past punctuation and
  // around hidden and screen-reader-only text. The page never sees the keys
  // and does not scroll.
  const sequence = ['beta', 'gamma', 'delta', 'Epsilon', 'zeta', 'eta'];
  for (const word of sequence) {
    await press('ArrowRight');
    assert.equal(await selected(), word, `→ selects "${word}"`);
  }
  await press('ArrowLeft');
  assert.equal(await selected(), 'zeta', '← steps back');
  await press('ArrowLeft');
  assert.equal(await selected(), 'Epsilon', '← skips the hidden text');
  assert.deepEqual(await pageKeys(), [], 'consumed keys never reach the page (keydown, keypress, keyup)');
  assert.equal(await evaluate('scrollY'), 0, 'arrow keys do not scroll the page');

  // Shift+arrows grow and shrink the selection by whole words from a fixed
  // starting word; a plain arrow goes back to one word.
  const selText = () => evaluate('wordCursorSelText(wordCursor.sel)');
  await press('ArrowRight', MOD.shift);
  assert.equal(await selected(), 'Epsilon zeta', 'Shift+→ adds the next word');
  await press('ArrowRight', MOD.shift);
  assert.equal(await selected(), 'Epsilon zeta eta', 'and the next');
  await press('ArrowLeft', MOD.shift);
  assert.equal(await selected(), 'Epsilon zeta', 'Shift+← takes one back');
  await press('ArrowLeft', MOD.shift);
  assert.equal(await selected(), 'Epsilon', 'back to the starting word');
  await press('ArrowLeft', MOD.shift);
  assert.equal(await selText(), 'delta. Epsilon', 'past the starting word it grows the other way, leaving hidden text out');
  await press('End', MOD.shift);
  await press('ArrowDown', MOD.shift | MOD.ctrl);
  assert.equal(await selText(), 'delta. Epsilon', 'Shift+End and Ctrl+Shift+↓ never select part of a word');
  await press('ArrowRight');
  assert.equal(await selected(), 'zeta', '→ goes back to one word: the one after the selection');
  await press('ArrowRight', MOD.ctrl | MOD.shift);
  assert.match(await selText(), /^zeta eta theta .* psi omega$/, 'Ctrl+Shift+→ selects to the end of the sentence');
  await press('ArrowRight', MOD.ctrl | MOD.shift);
  assert.match(await selText(), /^zeta .* omega\. Second sentence starts here$/, 'again: to the end of the next sentence');
  await press('ArrowLeft', MOD.ctrl | MOD.shift);
  assert.match(await selText(), /^zeta .* omega\. Second$/, 'Ctrl+Shift+← takes it back to the start of that sentence');
  await press('ArrowLeft');
  assert.equal(await selected(), 'Epsilon', '← goes back to one word: the one before the selection');
  assert.deepEqual(await pageKeys(), [], 'Shift keys stay away from the page');
  // Alt+← (Back) and Ctrl+↓ belong to the browser and the page.
  await press('ArrowDown', MOD.ctrl);
  assert.deepEqual((await pageKeys()).filter(k => k.startsWith('down:')), ['down:ArrowDown'], 'Ctrl+↓ is left to the page');

  // Ctrl+→ / Ctrl+← move by sentence, crossing paragraphs.
  await press('ArrowRight', MOD.ctrl);
  assert.equal(await selected(), 'Second', 'Ctrl+→ goes to the next sentence');
  await press('ArrowRight', MOD.ctrl);
  assert.equal(await selected(), 'Third', 'Ctrl+→ again');
  await press('ArrowRight', MOD.ctrl);
  assert.equal(await selected(), 'Yes', 'Ctrl+→ to the last sentence');
  await press('ArrowRight', MOD.ctrl);
  assert.equal(await selected(), 'Bank', 'Ctrl+→ continues into the next paragraph');
  await press('ArrowLeft', MOD.ctrl);
  assert.equal(await selected(), 'Yes', 'Ctrl+← at a sentence start goes to the previous sentence');
  await press('ArrowLeft', MOD.ctrl);
  assert.equal(await selected(), 'Third', 'Ctrl+← again');
  await press('ArrowRight');
  assert.equal(await selected(), 'one', '→ into the sentence');
  await press('ArrowLeft', MOD.ctrl);
  assert.equal(await selected(), 'Third', 'Ctrl+← inside a sentence goes to its first word');

  // ↓ / ↑ move by line, keeping the starting column.
  await clickAt(await wordPoint('#p1', 'Alpha'));
  assert.equal(await selected(), 'Alpha', 'click selects a word');
  const goalX = await evaluate('(cursorRect().left + cursorRect().right) / 2');
  const lineBelow = await evaluate(`expectedLineWord('Alpha', ${goalX}, 1)`);
  await press('ArrowDown');
  assert.equal(await selected(), lineBelow, '↓ selects the closest word on the next line');
  const lineBelowThat = await evaluate(`expectedLineWord(${JSON.stringify(lineBelow)}, ${goalX}, 1)`);
  await press('ArrowDown');
  assert.equal(await selected(), lineBelowThat, 'a second ↓ keeps the original column');
  await press('ArrowUp');
  await press('ArrowUp');
  assert.equal(await selected(), 'Alpha', '↑ ↑ returns to the starting word');
  await press('ArrowDown', MOD.shift);
  assert.equal(await evaluate('wordCursorRangeOf(wordCursorSelFromWord(wordCursor.sel.first)).toString()'), 'Alpha', 'Shift+↓ keeps the starting word');
  assert.equal(await evaluate('wordCursorRangeOf(wordCursorSelFromWord(wordCursor.sel.last)).toString()'), lineBelow, 'and selects down to the closest word on the next line');
  await press('ArrowUp', MOD.shift);
  assert.equal(await selected(), 'Alpha', 'Shift+↑ takes the line back');
  assert.deepEqual(await pageKeys(), [], 'line moves stay away from the page');

  // Moving off screen scrolls the word into view; scrolling away and then
  // pressing an arrow restarts at the top of the screen.
  await clickAt(await wordPoint('#p2', 'Bank', 1));
  assert.equal(await selected(), 'Bank', 'click on the second sentence of #p2');
  await press('ArrowRight', MOD.ctrl);
  assert.equal(await selected(), 'Faraway', 'Ctrl+→ jumps past the empty space to the far paragraph');
  assert.ok(await evaluate('scrollY') > 0, 'the page scrolled to the selected word');
  assert.equal(await evaluate('cursorRect().top >= 0 && cursorRect().bottom <= innerHeight'), true, 'the selected word is on screen');
  await evaluate('scrollTo(0, 0)');
  await press('ArrowRight');
  assert.equal(await selected(), 'Alpha', 'after scrolling away, → restarts at the first word on screen');

  // Text under the sticky header is on screen but hidden: the cursor keeps
  // clear of it when restarting and when moving up.
  await evaluate('scrollTo(0, 60)');
  await press('ArrowRight');
  const headerBottom = await evaluate(`document.getElementById('masthead').getBoundingClientRect().bottom`);
  assert.notEqual(await selected(), 'Alpha', 'the word now under the header is not kept');
  assert.ok(await evaluate('cursorRect().top') >= headerBottom, 'the restart word is below the sticky header');
  const belowHeader = await selected();
  await press('ArrowUp');
  assert.notEqual(await selected(), belowHeader, '↑ moves to the line above');
  assert.ok(await evaluate('cursorRect().top') >= headerBottom, '↑ scrolls the word out from under the sticky header');
  await evaluate('scrollTo(0, 0)');

  // Enter explains the word with its exact sentence as context.
  await clickAt(await wordPoint('#p2', 'bank', 1));
  assert.equal(await selected(), 'bank', 'click the second lowercase "bank"');
  await press('Enter');
  await waitFor('aiRequests().length === 1', 'Enter sends a lookup');
  let request = (await evaluate('aiRequests()'))[0];
  assert.equal(request.word, 'bank', 'the lookup is for the selected word');
  assert.equal(request.context.sentence, 'Bank two: the bank lent money.', 'the context is the sentence holding this occurrence');
  assert.equal(request.context.pageTitle, 'Word cursor test', 'the page title rides along');
  assert.equal(await evaluate('activePopups.length'), 1, 'one popup opens');
  assert.equal(await evaluate('document.activeElement === document.body'), true, 'focus stays on the page');
  assert.deepEqual((await pageKeys()).filter(k => k.includes('Enter')), [], 'the page never sees that Enter');

  // Stepping on and pressing Enter replaces the answer instead of stacking.
  const firstPopup = await evaluate('window.firstPopup = activePopups[0], 1');
  void firstPopup;
  await press('ArrowRight');
  assert.equal(await selected(), 'lent', '→ still moves the cursor while a popup is open');
  await press('Enter');
  await waitFor('aiRequests().length === 2', 'Enter on the next word sends a lookup');
  assert.equal((await evaluate('aiRequests()'))[1].word, 'lent', 'for the new word');
  assert.equal(await evaluate('activePopups.length'), 1, 'the new answer replaces the old popup');
  assert.equal(await evaluate('activePopups[0] !== firstPopup'), true, 'it is a new popup');
  await press('Enter');
  await sleep(100);
  assert.equal(await evaluate('aiRequests().length'), 2, 'Enter on the same word sends nothing');
  assert.equal(await evaluate('activePopups.length'), 1, 'and closes nothing');

  // The popup's question box keeps its keys: typing, ← in the box, Enter to
  // send, Esc to leave the box.
  await waitFor(`!activePopups[0].isLoading && activePopups[0].popup.querySelector('#ai-popup-followup-input')`, 'the answer renders with a question box');
  await evaluate(`activePopups[0].popup.querySelector('#ai-popup-followup-input').focus(), 1`);
  await send('Input.insertText', { text: 'why' });
  await press('ArrowLeft');
  assert.equal(await evaluate(`activePopups[0].popup.querySelector('#ai-popup-followup-input').selectionStart`), 2, '← moves the caret in the question box');
  assert.equal(await cursorText(), 'lent', 'and leaves the word cursor alone');
  await press('Enter');
  await waitFor('aiRequests().length === 3', 'Enter in the question box sends the follow-up');
  assert.ok(Array.isArray((await evaluate('aiRequests()'))[2].messages), 'as a follow-up');
  await press('Escape');
  assert.equal(await evaluate('activePopups.length'), 1, 'Esc in the question box leaves the popup open');
  assert.equal(await evaluate(`activePopups[0].container.shadowRoot.activeElement === null`), true, 'and only leaves the box');
  await pageKeys();

  // Esc does one thing per press: close the top popup, then the next, then
  // turn the cursor off.
  await press('Escape');
  assert.equal(await evaluate('activePopups.length'), 0, 'Esc closes the popup');
  assert.equal(await evaluate('wordCursor.active'), true, 'the cursor stays on');
  await press('Enter');
  await waitFor('activePopups.length === 1 && !activePopups[0].isLoading', 'Enter opens a popup again');
  await evaluate(`sendExtensionMessage({ type: 'triggerPopup' }), 1`);
  await waitFor('activePopups.length === 2', 'the shortcut stacks a second popup');
  await press('Escape');
  assert.equal(await evaluate('activePopups.length'), 1, 'one Esc closes one popup');
  await press('Escape');
  assert.equal(await evaluate('activePopups.length'), 0, 'the next Esc closes the other');
  assert.equal(await evaluate('wordCursor.active'), true, 'the cursor is still on');
  assert.equal(await selected(), 'lent', 'with its word selected');
  await press('Escape');
  assert.equal(await evaluate('wordCursor.active'), false, 'Esc with no popup turns the cursor off');
  assert.equal(await selected(), '', 'and clears its selection');
  assert.match(await evaluate('hintText()'), /Word cursor off/, 'saying so');
  assert.deepEqual((await pageKeys()).filter(k => k.includes('Escape')), [], 'none of those Esc presses reached the page');
  await press('ArrowRight');
  assert.ok((await pageKeys()).includes('down:ArrowRight'), 'once off, arrows go back to the page');

  // Turned off with Esc, it stays off until full screen is entered again.
  await evaluate(`document.dispatchEvent(new Event('scroll')), 1`);
  await sleep(500);
  assert.equal(await evaluate('wordCursor.active'), false, 'stays off after a scroll');
  await evaluate('setFullscreen(false)');
  await evaluate('setFullscreen(true)');
  await waitFor('wordCursor.active', 'entering full screen again turns it back on');
  assert.equal(await selected(), 'Alpha', 'at the first word on screen');
  await pageKeys();

  // A field keeps every key.
  await clickAt(await evaluate(`(() => { const r = document.getElementById('field').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`));
  assert.equal(await evaluate(`document.activeElement.id`), 'field', 'the field has focus');
  await press('ArrowLeft');
  await press('Enter');
  await press('Escape');
  const fieldKeys = (await pageKeys()).filter(k => k.startsWith('down:'));
  assert.deepEqual(fieldKeys, ['down:ArrowLeft', 'down:Enter', 'down:Escape'], 'keys typed in a field reach the page');
  assert.equal(await cursorText(), 'Alpha', 'the word cursor did not move');
  assert.equal(await evaluate('aiRequests().length'), 5, 'Enter in a field sends no lookup');
  assert.equal(await evaluate('wordCursor.active'), true, 'Esc in a field leaves the cursor on');

  // Clicks and drags snap to whole words; no Ask AI button appears.
  await clickAt(await wordPoint('#p1', 'kappa'));
  assert.equal(await selected(), 'kappa', 'a click selects the word under the pointer');
  assert.notEqual(await evaluate('document.activeElement.id'), 'field', 'and focus left the field');
  await clickAt(await wordPoint('#p1', 'omicron'), 1, MOD.shift);
  assert.equal(await selected(), 'kappa lambda mu nu xi omicron', 'Shift+click selects from the current word to the clicked one');
  await clickAt(await wordPoint('#p1', 'iota'), 1, MOD.shift);
  assert.equal(await selected(), 'iota kappa', 'Shift+click before the starting word keeps that word');
  // Headless Chrome does not drag-select from CDP mouse moves, so the drag's
  // result (a selection from mid-word to mid-word) is set directly and the
  // mouseup that ends a drag is sent.
  await evaluate(`(() => {
    const node = [...document.getElementById('p1').childNodes].find(n => n.nodeType === 3 && n.data.includes('omicron'));
    const start = node.data.indexOf('omicron') + 3;
    const end = node.data.indexOf('sigma') + 2;
    getSelection().setBaseAndExtent(node, start, node, end);
    const point = wordPoint('#p1', 'sigma', 0, 0.4);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: point.x, clientY: point.y }));
  })()`);
  assert.equal(await selected(), 'omicron pi rho sigma', 'a drag from mid-word to mid-word selects whole words');
  assert.equal(await evaluate('activePopups.length'), 0, 'no Ask AI button appears');
  await clickAt({ x: 900, y: 400 });
  assert.equal(await selected(), 'omicron pi rho sigma', 'a click on empty space keeps the selection');
  await clickAt(await wordPoint('#p1', 'lambda'), 1);
  await clickAt(await wordPoint('#p1', 'lambda'), 2);
  assert.equal(await selected(), 'lambda', 'a double-click selects the word without its trailing space');

  // After clicking a link, → then Enter explains the word instead of
  // following the link again.
  await clickAt(await wordPoint('#p1', 'zeta'));
  assert.equal(await selected(), 'zeta', 'click on the link word');
  assert.equal(await evaluate('document.activeElement.id'), 'link', 'the link took focus');
  await press('ArrowRight');
  assert.equal(await selected(), 'eta', '→ moves on');
  await press('Enter');
  await waitFor('aiRequests().length === 6', 'Enter explains the word');
  assert.equal((await evaluate('aiRequests()'))[5].word, 'eta', 'the word, not the link');
  await press('Escape');
  await pageKeys();

  // A large playing video keeps the arrows and Enter.
  await evaluate(`(() => {
    const video = document.createElement('video');
    video.id = 'vid';
    video.style.cssText = 'position: fixed; left: 0; top: 0; width: 900px; height: 600px';
    Object.defineProperty(video, 'paused', { get: () => false });
    document.body.appendChild(video);
  })()`);
  await press('ArrowRight');
  assert.equal(await selected(), 'eta', 'the cursor does not move while a big video plays');
  assert.ok((await pageKeys()).includes('down:ArrowRight'), 'the video page gets the arrow');
  await evaluate(`document.getElementById('vid').remove()`);
  await press('ArrowRight');
  assert.equal(await selected(), 'theta', 'with the video gone, → moves again');

  // Enter explains a phrase as it reads: text hidden inside it is left out.
  await clickAt(await wordPoint('#p1', 'delta'));
  await press('ArrowRight', MOD.shift);
  const lookupsBefore = await evaluate('aiRequests().length');
  await press('Enter');
  await waitFor(`aiRequests().length === ${lookupsBefore + 1}`, 'Enter sends one lookup for the phrase');
  const phraseRequest = (await evaluate('aiRequests()')).at(-1);
  assert.equal(phraseRequest.word, 'delta. Epsilon', 'the lookup is the phrase without the hidden text');
  assert.equal(phraseRequest.context.sentence, 'Alpha beta, gamma delta.', 'with the sentence where it starts');
  await press('Enter');
  await sleep(100);
  assert.equal(await evaluate('aiRequests().length'), lookupsBefore + 1, 'Enter on the same phrase sends nothing');
  await press('Escape');

  // Holding Shift+→ stops at the phrase limit; shrinking still works.
  await evaluate(`document.getElementById('long').scrollIntoView({ block: 'center' })`);
  await clickAt(await wordPoint('#long', 'w1 ', 0, 0.2));
  assert.equal(await selected(), 'w1', 'start a phrase at w1');
  for (let i = 0; i < 70; i++) await press('ArrowRight', MOD.shift);
  assert.equal(await evaluate('wordCursorCountWords(wordCursor.sel, 1000)'), 60, 'the phrase stops at 60 words');
  assert.match(await selText(), /^w1 w2 .* w60$/, 'w1 to w60');
  assert.match(await evaluate('hintText()'), /Selection limit: 60 words/, 'the hint says why');
  await press('ArrowLeft', MOD.shift);
  assert.equal(await evaluate('wordCursorCountWords(wordCursor.sel, 1000)'), 59, 'Shift+← still shrinks it');
  await press('ArrowDown', MOD.shift);
  await press('ArrowDown', MOD.shift);
  assert.equal(await evaluate('wordCursorCountWords(wordCursor.sel, 1000)'), 60, 'a line jump past the limit stops at it');
  assert.deepEqual((await pageKeys()).filter(k => k.startsWith('down:')), [], 'none of it reached the page');
  await evaluate('scrollTo(0, 0)');

  // A removed word: the next arrow restarts at the first word on screen.
  await clickAt(await wordPoint('#p2', 'muddy'));
  assert.equal(await selected(), 'muddy', 'select a word in #p2');
  await evaluate(`document.getElementById('p2').remove()`);
  await press('ArrowRight');
  assert.equal(await selected(), 'Alpha', 'after its paragraph is removed, → restarts at the top');

  // Leaving full screen turns it off and clears the selection.
  await evaluate('setFullscreen(false)');
  assert.equal(await evaluate('wordCursor.active'), false, 'leaving full screen turns it off');
  assert.equal(await selected(), '', 'and clears the word');

  // The setting is required for full screen; the shortcut works anywhere.
  await evaluate(`updateSync({ wordCursorInFullscreen: false })`);
  await evaluate('setFullscreen(true)');
  await sleep(50);
  assert.equal(await evaluate('wordCursor.active'), false, 'with the setting off, full screen does nothing');
  await evaluate('setFullscreen(false)');
  await evaluate(`sendExtensionMessage({ type: 'toggleWordCursor' }), 1`);
  assert.equal(await evaluate('wordCursor.active'), true, 'the shortcut turns it on outside full screen');
  assert.equal(await selected(), 'Alpha', 'at the first word on screen');
  await press('ArrowRight');
  assert.equal(await selected(), 'beta', 'and the keys work');
  await evaluate(`sendExtensionMessage({ type: 'toggleWordCursor' }), 1`);
  assert.equal(await evaluate('wordCursor.active'), false, 'the shortcut turns it off');
  assert.equal(await selected(), '', 'clearing the word');

  // Text that arrives after full screen begins still gets the cursor,
  // without the user scrolling.
  await evaluate(`updateSync({ wordCursorInFullscreen: true })`);
  await evaluate(`document.querySelector('main').style.display = 'none'`);
  await evaluate('setFullscreen(true)');
  await sleep(300);
  assert.equal(await evaluate('wordCursor.active'), false, 'too little text on screen: not started');
  await evaluate(`document.querySelector('main').style.display = ''`);
  await waitFor('wordCursor.active', 'the cursor starts once the text appears');
  assert.equal(await selected(), 'Alpha', 'at the first word of the new text');
  await evaluate('setFullscreen(false)');

  assert.deepEqual(await evaluate('errors'), [], 'no page errors');
  console.log('Word cursor passed: full-screen start, word/line/sentence moves, phrase selection (Shift+arrows, Ctrl+Shift sentences, Shift+click, 60-word limit, hidden text left out), field keys, Enter with exact sentence, replace-not-stack, one-action Esc, clicks and drags snap to words, video and removed-word handling, sticky-header clearance, late text, setting and shortcut.');
}

run().then(async () => {
  ws.close();
  await fetch(`http://127.0.0.1:9333/json/close/${page.id}`).catch(() => {});
}).catch(async error => {
  console.error('Word cursor test FAILED:', error && error.stack || error);
  try { ws.close(); } catch (e) {}
  if (page) await fetch(`http://127.0.0.1:9333/json/close/${page.id}`).catch(() => {});
  process.exit(1);
});
