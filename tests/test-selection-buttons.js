// Runs the complete content script in the test runner's isolated CDP browser.
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
async function click(expression) {
  const point = await evaluate(`(() => { const r = (${expression}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
const grammar = { id: 'grammar', name: 'Grammar', content: 'Check the grammar of "{word}". Explain errors and provide a corrected sentence.', showInSelectionPopup: true };
const translation = { id: 'translation', name: 'Translate', content: 'Translate "{word}" into French.', showInSelectionPopup: true };
const literalLabel = '<img src=x onerror=alert(1)>';
const prompts = [
  grammar,
  { id: 'disabled', name: 'Disabled', content: 'Disabled prompt', showInSelectionPopup: false },
  { id: 'legacy', name: 'Legacy default', content: 'Explain the selection for a beginner.' },
  { id: 'truthy', name: 'Not a boolean', content: 'Not opted in', showInSelectionPopup: 'true' },
  { id: 'literal', name: literalLabel, content: 'Treat the label as text.', showInSelectionPopup: true },
  null,
  { id: 'empty-name', name: ' ', content: 'Nonempty', showInSelectionPopup: true },
  { id: 'empty-content', name: 'Empty instruction', content: ' ', showInSelectionPopup: true },
  { id: 'bad-name', name: 12, content: 'Nonempty', showInSelectionPopup: true },
  { id: 'bad-content', name: 'Bad instruction', content: {}, showInSelectionPopup: true }
];

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
  await evaluate(`
    window.syncData = {
      uiTheme: 'dark', customPrompts: ${JSON.stringify(prompts)}, defaultPromptId: 'legacy', defaultModelId: 'first',
      models: [{ id: 'first', name: 'First model' }, { id: 'second', name: 'Second model' }]
    };
    window.changeListeners = [];
    window.requests = [];
    window.errors = [];
    window.localData = {};
    window.heldCallbacks = [];
    window.failNextRequest = true;
    window.delayInitialPromptRead = true;
    window.selectedText = 'She go to school every day.';
    window.selectionContext = { sentence: 'She go to school every day. She enjoys her classes.', pageTitle: 'Grammar exercise' };
    window.selectionRect = { left: 60, right: 300, top: 120, bottom: 140, width: 240, height: 20 };
    window.addEventListener('error', event => errors.push(event.message));
    window.chrome = {
      runtime: {
        getURL: p => 'http://127.0.0.1:8793/' + p,
        onMessage: { addListener() {} },
        sendMessage(message, callback) {
          requests.push(structuredClone(message));
          if (message.type === 'getAiDefinition' && window.holdAiRequests) {
            heldCallbacks.push(callback);
            return;
          }
          let response = {};
          if (message.type === 'getAiDefinition') {
            response = failNextRequest ? { error: 'Temporary model error' } : { definition: 'Use “She goes to school every day.”', usedModelName: message.modelId };
            failNextRequest = false;
          } else if (message.type === 'getLists' || message.type === 'getWordLists') response = { lists: [{ id: 'one', name: 'Words' }, { id: 'two', name: 'Phrases' }], lastUsedListId: 'one' };
          else if (message.type === 'saveClip') response = { status: 'saved' };
          if (callback) setTimeout(() => callback(response), 0);
        }
      },
      storage: {
        local: {
          get: (defaults, callback) => setTimeout(() => callback(Array.isArray(defaults) ? {} : { ...defaults, ...localData }), 0),
          set: (values, callback) => { Object.assign(localData, structuredClone(values)); if (callback) setTimeout(callback, 0); }
        },
        sync: { get(defaults, callback) {
          const result = Array.isArray(defaults)
            ? Object.fromEntries(defaults.map(key => [key, syncData[key]]))
            : { ...defaults, ...syncData };
          const snapshot = structuredClone(result);
          if (delayInitialPromptRead && Object.hasOwn(defaults, 'customPrompts') && Object.hasOwn(defaults, 'uiTheme')) {
            delayInitialPromptRead = false;
            window.finishInitialPromptRead = () => callback(snapshot);
          } else setTimeout(() => callback(snapshot), 0);
        } },
        onChanged: { addListener: listener => changeListeners.push(listener) }
      }
    };
    window.aiRequests = () => requests.filter(request => request.type === 'getAiDefinition');
    window.updatePrompts = prompts => {
      const oldValue = syncData.customPrompts;
      syncData.customPrompts = structuredClone(prompts);
      changeListeners.forEach(listener => listener({ customPrompts: { oldValue, newValue: syncData.customPrompts } }, 'sync'));
    };
    window.buttonLabels = () => [...toolbar.popup.querySelectorAll('.ai-selection-prompt-button')].map(button => button.textContent);
  `);
  await evaluate(fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8'));

  // A late initial read must not overwrite a settings change that arrived first.
  await evaluate(`
    document.title = 'Grammar exercise';
    const passage = document.createElement('p');
    passage.style.cssText = 'margin: 150px 50px; font: 20px/1.6 sans-serif; max-width: 500px';
    passage.textContent = selectionContext.sentence;
    document.body.appendChild(passage);
    const range = document.createRange();
    range.setStart(passage.firstChild, 0);
    range.setEnd(passage.firstChild, selectedText.length);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    window.toolbar = activePopups.at(-1);
    updatePrompts([${JSON.stringify(translation)}]);
    finishInitialPromptRead();
  `);
  await waitFor(`buttonLabels().join() === 'Translate'`, 'new settings beat a delayed initial storage read');
  await evaluate(`updatePrompts(${JSON.stringify(prompts)})`);
  assert.deepEqual(await evaluate('buttonLabels()'), ['Grammar', literalLabel], 'only valid, explicitly enabled prompts appear');
  assert.equal(await evaluate(`toolbar.popup.querySelector('#ai-open-button-popup').textContent`), 'Ask AI');
  assert.equal(await evaluate(`!!toolbar.popup.querySelector('#ai-clip-button-popup')`), true, 'Clip remains available');
  assert.equal(await evaluate(`toolbar.popup.querySelectorAll('.ai-selection-prompt-button img').length`), 0, 'prompt labels are plain text');
  assert.equal(await evaluate('aiRequests().length'), 0, 'rendering buttons does not call a model');

  // Click the real button and exercise the selector, lazy compare, and Retry UI.
  await click(`toolbar.popup.querySelector('[data-prompt-id="grammar"]')`);
  await waitFor(`aiRequests().length === 1 && activePopups.at(-1).compareSlots?.[0].status === 'error'`, 'custom button sends a request');
  // First multi-model popup: the swipe hint sits beside the pager (no toast
  // over the follow-up box) and is remembered as shown.
  await waitFor(`activePopups.at(-1).popup.querySelector('.ai-compare-nav .ai-compare-hint')`, 'compare hint appears in the pager row');
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('.ai-compare-hint').textContent`), 'Swipe or use arrows to compare');
  assert.equal(await evaluate(`!!activePopups.at(-1).popup.querySelector('.ai-popup-toast')`), false, 'no compare toast');
  assert.equal(await evaluate('localData.compareHintShown'), true, 'the hint is shown only once');
  assert.equal(await evaluate(`(() => {
    const hint = activePopups.at(-1).popup.querySelector('.ai-compare-hint').getBoundingClientRect();
    const input = activePopups.at(-1).popup.querySelector('#ai-popup-followup-container').getBoundingClientRect();
    return hint.bottom <= input.top;
  })()`), true, 'the hint does not cover the follow-up box');
  assert.deepEqual(await evaluate(`(() => { const r = aiRequests()[0]; return { word: r.word, customPrompt: r.customPrompt, context: r.context, modelId: r.modelId }; })()`), {
    word: 'She go to school every day.', customPrompt: grammar.content,
    context: { sentence: 'She go to school every day. She enjoys her classes.', pageTitle: 'Grammar exercise' }, modelId: 'first'
  });
  assert.equal(await evaluate('toolbar.container.isConnected'), false, 'click replaces the toolbar with the answer popup');
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector').value`), grammar.content, 'selector reflects the clicked prompt instead of the default');
  await evaluate(`activePopups.at(-1).popup.querySelector('.ai-compare-card .ai-compare-actions button').click()`);
  await waitFor(`aiRequests().length === 2 && activePopups.at(-1).compareSlots[0].status === 'done'`, 'Retry finishes successfully');
  assert.equal(await evaluate('aiRequests()[1].customPrompt'), grammar.content, 'Retry retains the prompt');
  await evaluate(`activePopups.at(-1).popup.querySelector('.ai-compare-nav-next').click()`);
  await waitFor(`aiRequests().length === 3 && activePopups.at(-1).compareSlots[1].status === 'done'`, 'next compare model answers on demand');
  assert.equal(await evaluate(`!!activePopups.at(-1).popup.querySelector('.ai-compare-hint')`), false, 'moving to another model dismisses the hint');
  assert.equal(await evaluate('aiRequests()[2].modelId'), 'second');
  assert.equal(await evaluate('aiRequests()[2].customPrompt'), grammar.content, 'comparison retains the prompt');
  assert.deepEqual(await evaluate('aiRequests()[2].context'), await evaluate('selectionContext'), 'comparison retains context');

  // Explicit System Default is distinct from inheriting the configured default.
  await evaluate(`(() => { const selector = activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector'); [...selector.querySelectorAll('.custom-option')].find(option => option.textContent.trim() === 'System Default').click(); })()`);
  await waitFor('aiRequests().length === 4', 'changing the prompt starts another lookup');
  assert.equal(await evaluate('aiRequests()[3].customPrompt'), '', 'System Default keeps its explicit empty-string override');

  // Restored conversations can reference a prompt deleted from Settings.
  await evaluate(`createSelectors(activePopups.at(-1), syncData.models, [], 'first', ${JSON.stringify(grammar.content)}, selectedText, 'system')`);
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector').value`), grammar.content, 'an unmatched explicit prompt remains selected');
  await evaluate(`(() => { const selector = activePopups.at(-1).popup.querySelector('#ai-popup-model-selector'); [...selector.querySelectorAll('.custom-option')].find(option => option.textContent.trim() === 'Second model').click(); })()`);
  await waitFor('aiRequests().length === 5', 'changing models with a deleted prompt remains callable');
  assert.equal(await evaluate('aiRequests()[4].customPrompt'), grammar.content, 'model changes retain an unmatched explicit prompt');
  await evaluate(`createSelectors(activePopups.at(-1), syncData.models, [], 'first', null, selectedText, 'system')`);
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector .custom-select').classList.contains('disabled')`), true, 'no explicit or saved prompt leaves the empty selector disabled');

  await evaluate(`removeAllPopups(); window.toolbar = showOpenButtonPopup(selectionRect, selectedText, selectionContext); requests.length = 0;`);
  const renamed = { ...grammar, name: 'Proofread', content: 'Proofread this: {word}' };
  await evaluate(`updatePrompts(${JSON.stringify([renamed, translation])})`);
  assert.deepEqual(await evaluate('buttonLabels()'), ['Proofread', 'Translate'], 'rename and additions update an open toolbar');
  await evaluate(`changeListeners.forEach(listener => listener({ customPrompts: { newValue: [] } }, 'local'))`);
  assert.deepEqual(await evaluate('buttonLabels()'), ['Proofread', 'Translate'], 'unrelated local-storage changes do not affect sync prompts');
  await evaluate(`updatePrompts(${JSON.stringify([{ ...renamed, showInSelectionPopup: false }, translation])})`);
  assert.deepEqual(await evaluate('buttonLabels()'), ['Translate'], 'disabling removes only that button immediately');
  await evaluate('updatePrompts([])');
  assert.deepEqual(await evaluate('buttonLabels()'), [], 'deleting the last custom prompt leaves the built-in actions');
  assert.equal(await evaluate('toolbar.popup.querySelectorAll("button").length'), 2);
  await evaluate('updatePrompts({ invalid: true })');
  assert.deepEqual(await evaluate('buttonLabels()'), [], 'malformed top-level prompt data is safe');
  await evaluate(`updatePrompts(${JSON.stringify([renamed])}); removePopupInstance(toolbar); window.toolbar = showOpenButtonPopup(selectionRect, selectedText, selectionContext);`);
  assert.deepEqual(await evaluate('buttonLabels()'), ['Proofread'], 'future selections use the latest settings');
  if (process.env.SELECTION_BUTTON_SCREENSHOT_DIR) {
    const directory = path.resolve(process.env.SELECTION_BUTTON_SCREENSHOT_DIR);
    fs.mkdirSync(directory, { recursive: true });
    for (const theme of ['light', 'dark']) {
      await evaluate(`applyThemeToPopupContainer(toolbar.container, '${theme}')`);
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(directory, `selection-buttons-${theme}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  await evaluate(`toolbar.popup.querySelector('.ai-selection-prompt-button').click()`);
  await waitFor('aiRequests().length === 1', 'edited prompt is callable');
  assert.equal(await evaluate('aiRequests()[0].customPrompt'), renamed.content, 'edited content replaces the previous instruction');

  // The original actions retain their request behavior. The answer is held
  // back to inspect the loading state: skeleton lines in a body that already
  // has the reserved answer height, released once the answer settles.
  await evaluate(`window.holdAiRequests = true; removeAllPopups(); window.toolbar = showOpenButtonPopup(selectionRect, selectedText, selectionContext); requests.length = 0; toolbar.popup.querySelector('#ai-open-button-popup').click();`);
  await waitFor('aiRequests().length === 1', 'Ask AI remains callable');
  assert.equal(await evaluate(`Object.hasOwn(aiRequests()[0], 'customPrompt')`), false, 'Ask AI inherits the configured default');
  await waitFor(`activePopups.at(-1).popup.querySelector('.ai-compare-card .ai-popup-skeleton')`, 'loading card shows skeleton lines');
  assert.deepEqual(await evaluate(`(() => {
    const body = activePopups.at(-1).popup.querySelector('.ai-compare-card .ai-compare-body');
    const label = body.querySelector('.ai-popup-loading-text');
    return { reserved: body.classList.contains('ai-compare-body-reserved'), tall: body.offsetHeight >= Math.min(innerHeight * 0.38, 260) - 1, label: !!label && label.textContent.length > 0 };
  })()`), { reserved: true, tall: true, label: true }, 'the waiting body holds the answer height and keeps its status text');
  assert.equal(await evaluate(`!!activePopups.at(-1).popup.querySelector('.ai-compare-hint')`), false, 'later popups do not repeat the hint');
  await evaluate(`window.holdAiRequests = false; heldCallbacks.splice(0).forEach(callback => callback({ definition: 'Short answer.', usedModelName: 'first' }));`);
  await waitFor(`activePopups.at(-1).compareSlots[0].status === 'done'`, 'held answer settles');
  assert.deepEqual(await evaluate(`(() => {
    const body = activePopups.at(-1).popup.querySelector('.ai-compare-card .ai-compare-body');
    return { skeleton: !!body.querySelector('.ai-popup-skeleton'), reserved: body.classList.contains('ai-compare-body-reserved') };
  })()`), { skeleton: false, reserved: false }, 'a settled answer releases the reserved height');

  // Toolbar: one split Save button (no per-answer bookmark, no separate list
  // picker), a read-aloud button distinct from the word's speaker, and a pin
  // tooltip that says what pinning does. The answer sits on the popup itself.
  await waitFor(`activePopups.at(-1).popup.querySelector('#ai-popup-save-btn')`, 'split Save button is mounted');
  assert.deepEqual(await evaluate(`(() => {
    const popup = activePopups.at(-1).popup, save = popup.querySelector('#ai-popup-save-btn');
    const card = getComputedStyle(popup.querySelector('.ai-compare-card'));
    return {
      label: save.textContent, disabled: save.disabled,
      turnButtons: popup.querySelectorAll('.ai-turn-save-btn').length,
      listPickers: popup.querySelectorAll('.ai-popup-actions .custom-select-container').length,
      pickerInSplit: !!popup.querySelector('.ai-save-split .custom-select-container'),
      readAloud: popup.querySelector('#ai-popup-speak-btn').title,
      pinMentionsEsc: popup.querySelector('#ai-popup-pin-btn').title.includes('Esc'),
      cardBorder: card.borderTopWidth, cardBackground: card.backgroundColor
    };
  })()`), {
    label: 'Save to Words', disabled: false, turnButtons: 0, listPickers: 1, pickerInSplit: true,
    readAloud: 'Read this answer aloud', pinMentionsEsc: true, cardBorder: '0px', cardBackground: 'rgba(0, 0, 0, 0)'
  });
  await evaluate(`(() => { const popup = activePopups.at(-1).popup; popup.querySelector('.ai-save-split .custom-select').click(); [...popup.querySelectorAll('.ai-save-split .custom-option')].find(option => option.textContent.trim() === 'Phrases').click(); })()`);
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-save-btn').textContent`), 'Save to Phrases', 'the arrow picks the list the button names');
  await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-save-btn').click()`);
  await waitFor(`requests.some(request => request.type === 'saveToHistory')`, 'Save sends the answer on screen');
  assert.deepEqual(await evaluate(`(() => { const r = requests.find(request => request.type === 'saveToHistory'); return { listId: r.listId, definition: r.definition }; })()`), { listId: 'two', definition: 'Short answer.' });
  await waitFor(`activePopups.at(-1).popup.querySelector('#ai-popup-save-btn').textContent === 'Saved'`, 'Save shows the saved state');
  await evaluate(`removeAllPopups(); window.toolbar = showOpenButtonPopup(selectionRect, selectedText, selectionContext); requests.length = 0; toolbar.popup.querySelector('#ai-clip-button-popup').click();`);
  await waitFor(`requests.some(request => request.type === 'saveClip')`, 'Clip remains callable');
  assert.equal(await evaluate('aiRequests().length'), 0, 'Clip does not call AI');
  assert.deepEqual(await evaluate(`(() => { const r = requests.find(request => request.type === 'saveClip'); return { text: r.text, context: r.context }; })()`), {
    text: 'She go to school every day.', context: { sentence: 'She go to school every day. She enjoys her classes.', pageTitle: 'Grammar exercise' }
  });

  // Many/long names must stay usable at a narrow viewport's lower-right edge.
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: false });
  await evaluate(`removeAllPopups(); updatePrompts(Array.from({ length: 25 }, (_, index) => ({ id: 'long-' + index, name: 'Very long popup button label ' + index, content: 'Instruction ' + index, showInSelectionPopup: true }))); window.toolbar = showOpenButtonPopup({ left: 310, right: 319, top: 615, bottom: 635, width: 9, height: 20 }, selectedText, selectionContext);`);
  for (const theme of ['light', 'dark']) {
    await evaluate(`applyThemeToPopupContainer(toolbar.container, '${theme}'); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));`);
    assert.equal(await evaluate(`(() => { const group = toolbar.popup, bounds = group.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1 && group.scrollWidth <= group.clientWidth + 1; })()`), true, `${theme} toolbar fits inside narrow viewport`);
  }
  assert.equal(await evaluate('buttonLabels().length'), 25, 'layout does not discard enabled buttons');

  // Icon and emoji buttons: custom prompts with emoji or SVG, and Ask AI icon styles
  await evaluate(`
    updatePrompts([
      { id: 'grammar-icon', name: 'Grammar', content: 'Check grammar', showInSelectionPopup: true, icon: '✍️' },
      { id: 'translate-icon', name: 'Translate', content: 'Translate text', showInSelectionPopup: true, icon: 'sparkles' }
    ]);
  `);
  assert.equal(await evaluate(`toolbar.popup.querySelector('[data-prompt-id="grammar-icon"]').textContent`), '✍️');
  assert.equal(await evaluate(`toolbar.popup.querySelector('[data-prompt-id="grammar-icon"]').getAttribute('aria-label')`), 'Grammar');
  assert.equal(await evaluate(`toolbar.popup.querySelector('[data-prompt-id="grammar-icon"]').classList.contains('ai-selection-icon-only')`), true);
  assert.equal(await evaluate(`!!toolbar.popup.querySelector('[data-prompt-id="translate-icon"] svg')`), true);
  assert.equal(await evaluate(`toolbar.popup.querySelector('[data-prompt-id="translate-icon"]').getAttribute('aria-label')`), 'Translate');

  // Ask AI icon customization via sync storage changes
  await evaluate(`changeListeners.forEach(listener => listener({ askAiButtonIcon: { newValue: 'sparkles' } }, 'sync'))`);
  assert.equal(await evaluate(`!!toolbar.popup.querySelector('#ai-open-button-popup svg')`), true);
  assert.equal(await evaluate(`toolbar.popup.querySelector('#ai-open-button-popup').classList.contains('ai-selection-icon-only')`), true);

  await evaluate(`changeListeners.forEach(listener => listener({ askAiButtonIcon: { newValue: '🤖' } }, 'sync'))`);
  assert.equal(await evaluate(`toolbar.popup.querySelector('#ai-open-button-popup').textContent`), '🤖');

  await evaluate(`changeListeners.forEach(listener => listener({ askAiButtonIcon: { newValue: 'text' } }, 'sync'))`);
  assert.equal(await evaluate(`toolbar.popup.querySelector('#ai-open-button-popup').textContent`), 'Ask AI');

  assert.deepEqual(await evaluate('errors'), [], 'no uncaught content-script errors');
  console.log('Selection buttons passed: opt-in filtering, live sync/race, safe labels, request/context, compare/retry, built-ins, responsive layout, and SVG/emoji icons.');
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const task of pending.values()) clearTimeout(task.timer);
  if (ws) ws.close();
  if (page) await fetch('http://127.0.0.1:9333/json/close/' + page.id).catch(() => {});
});
