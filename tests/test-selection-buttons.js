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
          set: (values, callback) => { Object.assign(localData, structuredClone(values)); if (callback) setTimeout(callback, 0); },
          remove: (keys, callback) => { [].concat(keys).forEach(key => delete localData[key]); if (callback) setTimeout(callback, 0); }
        },
        sync: { get(defaults, callback) {
          const result = Array.isArray(defaults)
            ? Object.fromEntries(defaults.map(key => [key, syncData[key]]))
            : { ...defaults, ...syncData };
          const snapshot = structuredClone(result);
          if (delayInitialPromptRead && Object.hasOwn(defaults, 'customPrompts') && Object.hasOwn(defaults, 'uiTheme')) {
            delayInitialPromptRead = false;
            window.finishInitialPromptRead = () => callback(snapshot);
          } else setTimeout(() => callback(snapshot), window.syncDelay || 0);
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
  assert.deepEqual(await evaluate(`(() => ({
    role: toolbar.popup.getAttribute('role'),
    unnamed: [...toolbar.popup.querySelectorAll('button')].filter(b => !b.getAttribute('aria-label') && !b.textContent.trim()).length
  }))()`), { role: 'toolbar', unnamed: 0 }, 'the selection toolbar is a named toolbar of named buttons');
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
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-selectors-container').classList.contains('prompt-compact')`), false, 'a custom prompt in effect shows the full Prompt field');
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
  assert.deepEqual(await evaluate(`(() => {
    const trigger = activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector .custom-select');
    return { compact: activePopups.at(-1).popup.querySelector('#ai-popup-selectors-container').classList.contains('prompt-compact'), chip: trigger.querySelector('.ai-prompt-chip-text').textContent, valueShown: getComputedStyle(trigger.querySelector('.custom-select-value')).display !== 'none' };
  })()`), { compact: true, chip: 'Prompt', valueShown: false }, 'System Default shrinks the picker to a Prompt chip');

  // Restored conversations can reference a prompt deleted from Settings.
  await evaluate(`createSelectors(activePopups.at(-1), syncData.models, [], 'first', ${JSON.stringify(grammar.content)}, selectedText, 'system')`);
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector').value`), grammar.content, 'an unmatched explicit prompt remains selected');
  await evaluate(`(() => { const selector = activePopups.at(-1).popup.querySelector('#ai-popup-model-selector'); [...selector.querySelectorAll('.custom-option')].find(option => option.textContent.trim() === 'Second model').click(); })()`);
  await waitFor('aiRequests().length === 5', 'changing models with a deleted prompt remains callable');
  assert.equal(await evaluate('aiRequests()[4].customPrompt'), grammar.content, 'model changes retain an unmatched explicit prompt');
  await evaluate(`createSelectors(activePopups.at(-1), syncData.models, [], 'first', null, selectedText, 'system')`);
  assert.equal(await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector .custom-select').classList.contains('disabled')`), true, 'no explicit or saved prompt leaves the empty selector disabled');
  assert.deepEqual(await evaluate(`(() => {
    const trigger = activePopups.at(-1).popup.querySelector('#ai-popup-prompt-selector .custom-select');
    return { compact: activePopups.at(-1).popup.querySelector('#ai-popup-selectors-container').classList.contains('prompt-compact'), ariaDisabled: trigger.getAttribute('aria-disabled'), pointsToSettings: trigger.title.includes('Settings') };
  })()`), { compact: true, ariaDisabled: 'true', pointsToSettings: true }, 'with no custom prompts the chip is disabled and says where to add them');

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
  // Real-extension timing: settings arrive a few frames late and the popup
  // opens at a remembered (resized) size. The first answer's skeleton must
  // stay in view — the viewport was measured before the footer mounted and
  // left shorter than the card, clipping it — and the input must be locked
  // with Stop showing while the model answers.
  await evaluate(`window.syncDelay = 120; savedPopupSize = { width: 330, height: 490 }; window.holdAiRequests = true; removeAllPopups(); window.toolbar = showOpenButtonPopup(selectionRect, selectedText, selectionContext); requests.length = 0; toolbar.popup.querySelector('#ai-open-button-popup').click();`);
  await waitFor(`aiRequests().length === 1 && activePopups.at(-1).popup.querySelector('.ai-compare-card .ai-popup-skeleton') && activePopups.at(-1).popup.querySelector('#ai-popup-followup-input')`, 'slow-settings lookup shows the loading card');
  await new Promise(resolve => setTimeout(resolve, 400)); // footer, toolbar and layout settle
  assert.deepEqual(await evaluate(`(() => {
    const p = activePopups.at(-1).popup, viewport = p.querySelector('.ai-compare-viewport'), card = p.querySelector('.ai-compare-card');
    const skeleton = p.querySelector('.ai-popup-skeleton').getBoundingClientRect(), view = viewport.getBoundingClientRect();
    return {
      resized: p.classList.contains('is-resized'),
      cardFits: viewport.offsetHeight >= card.offsetHeight - 1,
      skeletonInView: skeleton.height > 40 && skeleton.top < view.bottom - 40,
      locked: p.querySelector('#ai-popup-followup-input').disabled,
      stop: p.querySelector('.ai-popup-followup-stop').style.display !== 'none',
      mic: p.querySelector('.ai-popup-followup-mic').style.display !== 'none'
    };
  })()`), { resized: true, cardFits: true, skeletonInView: true, locked: true, stop: true, mic: false }, 'first answer: skeleton in view, input locked, Stop shown');
  await evaluate(`window.syncDelay = 0; savedPopupSize = null; heldCallbacks.splice(0); window.holdAiRequests = false; removeAllPopups();`);

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

  // Saving: every answer keeps its own bookmark, so a specific turn (the
  // first answer or a follow-up) can be saved, and the toolbar's split
  // button saves the latest answer on screen, its arrow picking the list both
  // use. Also: a read-aloud button distinct from the word's speaker, a pin
  // tooltip that says what pinning does, and no panel around the answer.
  await waitFor(`activePopups.at(-1).popup.querySelector('#ai-popup-save-btn')`, 'split Save button is mounted');
  const firstCard = `activePopups.at(-1).popup.querySelectorAll('.ai-compare-card')[0]`;
  const saveLabel = `activePopups.at(-1).popup.querySelector('#ai-popup-save-btn').textContent`;
  const bookmark = index => `${firstCard}.querySelectorAll('.ai-turn-save-btn')[${index}]`;
  const savedRequest = index => evaluate(`(() => { const r = requests.filter(request => request.type === 'saveToHistory')[${index}]; return { listId: r.listId, word: r.word, definition: r.definition }; })()`);
  assert.deepEqual(await evaluate(`(() => {
    const popup = activePopups.at(-1).popup;
    const card = getComputedStyle(popup.querySelector('.ai-compare-card'));
    return {
      label: ${saveLabel}, bookmarks: ${firstCard}.querySelectorAll('.ai-turn-save-btn').length,
      listPickers: popup.querySelectorAll('.ai-popup-actions .custom-select-container').length,
      pickerInSplit: !!popup.querySelector('.ai-save-split .custom-select-container'),
      readAloud: popup.querySelector('#ai-popup-speak-btn').title,
      pinMentionsEsc: popup.querySelector('#ai-popup-pin-btn').title.includes('Esc'),
      cardBorder: card.borderTopWidth, cardBackground: card.backgroundColor
    };
  })()`), {
    label: 'Save to Words', bookmarks: 1, listPickers: 1, pickerInSplit: true,
    readAloud: 'Read this answer aloud', pinMentionsEsc: true, cardBorder: '0px', cardBackground: 'rgba(0, 0, 0, 0)'
  });
  await evaluate(`dispatchFollowupText(activePopups.at(-1), 'More examples')`);
  await waitFor(`activePopups.at(-1).compareSlots[0].status === 'done' && ${firstCard}.querySelectorAll('.ai-turn-save-btn').length === 2`, 'the follow-up answer gets its own bookmark');
  await evaluate(`(() => { const popup = activePopups.at(-1).popup; popup.querySelector('.ai-save-split .custom-select').click(); [...popup.querySelectorAll('.ai-save-split .custom-option')].find(option => option.textContent.trim() === 'Phrases').click(); })()`);
  assert.equal(await evaluate(saveLabel), 'Save to Phrases', 'the arrow picks the list the button names');
  // The split button saves the LATEST answer (the follow-up)...
  await evaluate(`activePopups.at(-1).popup.querySelector('#ai-popup-save-btn').click()`);
  await waitFor(`requests.some(request => request.type === 'saveToHistory')`, 'the split button saves');
  assert.deepEqual(await savedRequest(0), { listId: 'two', word: 'She go to school every day.: More examples', definition: 'Use “She goes to school every day.”' }, 'the split button saves the latest answer');
  await waitFor(`${saveLabel} === 'Saved' && ${bookmark(1)}.classList.contains('is-saved')`, 'the button and the latest answer bookmark both show saved');
  assert.equal(await evaluate(`${bookmark(0)}.classList.contains('is-saved')`), false, 'the first answer is still unsaved');
  // ...and the first answer's own bookmark saves that earlier answer.
  await evaluate(`${bookmark(0)}.click()`);
  await waitFor(`requests.filter(request => request.type === 'saveToHistory').length === 2`, 'the first answer bookmark saves');
  assert.deepEqual(await savedRequest(1), { listId: 'two', word: 'She go to school every day.', definition: 'Short answer.' }, 'an earlier answer saves on its own');
  await waitFor(`${bookmark(0)}.classList.contains('is-saved')`, 'the first answer shows its saved state');

  // Accessibility: every button (and div-based picker trigger) in the popup
  // has an accessible name, the popup is a labelled dialog, the pager says
  // which model each dot is and which is current, and pickers expose
  // their open state.
  assert.deepEqual(await evaluate(`(async () => {
    const popup = activePopups.at(-1).popup;
    const unnamed = [...popup.querySelectorAll('button, [role="button"]')].filter(b => !b.getAttribute('aria-label') && !b.textContent.trim()).map(b => b.className || b.id);
    const trigger = popup.querySelector('#ai-popup-model-selector .custom-select');
    trigger.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const opened = trigger.getAttribute('aria-expanded');
    trigger.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const dots = [...popup.querySelectorAll('.ai-compare-dotnav')];
    return {
      unnamed, role: popup.getAttribute('role'), name: popup.getAttribute('aria-label'),
      prev: popup.querySelector('.ai-compare-nav-prev').getAttribute('aria-label'), next: popup.querySelector('.ai-compare-nav-next').getAttribute('aria-label'),
      firstDot: dots[0].getAttribute('aria-label'), current: dots.map(d => d.getAttribute('aria-current')),
      modelName: trigger.getAttribute('aria-label'), opened, closed: trigger.getAttribute('aria-expanded'),
      listbox: popup.querySelector('#ai-popup-model-selector .custom-options').getAttribute('role')
    };
  })()`), {
    unnamed: [], role: 'dialog', name: 'AI explanation: She go to school every day.',
    prev: 'Previous model', next: 'Next model', firstDot: 'First model — answered', current: ['true', null],
    modelName: 'AI model: First model', opened: 'true', closed: 'false', listbox: 'listbox'
  }, 'popup controls are named and expose their state');

  // Follow-up chips sit pinned just above the input (not inside the
  // scrolling answer), for the card on screen.
  assert.deepEqual(await evaluate(`(() => {
    const popup = activePopups.at(-1).popup, row = popup.querySelector('.ai-compare-chips');
    const input = popup.querySelector('#ai-popup-followup-container');
    return {
      labels: [...row.querySelectorAll('.ai-popup-followup-chip')].map(chip => chip.textContent),
      inCard: !!row.closest('.ai-compare-card'), aboveInput: row.nextElementSibling === input,
      visible: row.getBoundingClientRect().bottom <= input.getBoundingClientRect().top && row.getBoundingClientRect().height > 0
    };
  })()`), { labels: ['💡 Simpler', '📝 2 Examples', '🏛️ Etymology'], inCard: false, aboveInput: true, visible: true }, 'chips are pinned above the input');

  // Chip dots: none while every chip fits; once the chips overflow, one dot
  // per chip with the in-view chips' dots filled, and clicking a dot scrolls
  // only the strip to that chip, keeping the popup open and the input focused.
  const chipDots = `[...activePopups.at(-1).popup.querySelectorAll('.ai-compare-chip-dot')].map(d => d.classList.contains('in-view'))`;
  const chipStrip = `activePopups.at(-1).popup.querySelector('.ai-compare-chips-strip')`;
  const savedChips = await evaluate(`(async () => {
    const instance = activePopups.at(-1), popup = instance.popup, saved = instance.followupChips;
    const dots = () => popup.querySelector('.ai-compare-chip-dots');
    const settle = (test) => new Promise(resolve => { let n = 0; const tick = () => (test() || ++n > 100) ? resolve() : setTimeout(tick, 20); tick(); });
    instance.followupChips = ['Only one'];
    renderPinnedFollowupChips(instance);
    await settle(() => dots().hidden);
    window.chipDotsWhenFitting = { hidden: dots().hidden, count: dots().children.length };
    instance.followupChips = ['💡 Simpler', '📝 2 Examples', '🏛️ Etymology', '🔁 Synonyms', '🚫 Antonyms', '🗣️ Use it in a sentence', '🎯 Common mistakes', '📚 Related words'];
    renderPinnedFollowupChips(instance);
    await settle(() => !dots().hidden && ${chipDots}[0]);
    popup.querySelector('#ai-popup-followup-input').focus();
    window.chipDotsPageScroll = [scrollX, scrollY];
    return saved;
  })()`);
  const chipDotsBefore = await evaluate(chipDots);
  await click(`activePopups.at(-1).popup.querySelectorAll('.ai-compare-chip-dot')[7]`);
  await waitFor(`${chipStrip}.scrollLeft >= ${chipStrip}.scrollWidth - ${chipStrip}.clientWidth - 1 && ${chipDots}[7]`, 'the last dot scrolls the strip to the last chip');
  assert.deepEqual(await evaluate(`(() => {
    const instance = activePopups.at(-1), popup = instance.popup;
    const after = ${chipDots};
    const result = {
      fitting: chipDotsWhenFitting, count: after.length, before: [${JSON.stringify(chipDotsBefore)}[0], ${JSON.stringify(chipDotsBefore)}[7]], after: [after[0], after[7]],
      open: popup.isConnected, inputFocused: popup.getRootNode().activeElement === popup.querySelector('#ai-popup-followup-input'),
      pageScrolled: scrollX !== chipDotsPageScroll[0] || scrollY !== chipDotsPageScroll[1]
    };
    instance.followupChips = ${JSON.stringify(savedChips)};
    renderPinnedFollowupChips(instance);
    return result;
  })()`), {
    fitting: { hidden: true, count: 1 }, count: 8, before: [true, false], after: [false, true],
    open: true, inputFocused: true, pageScrolled: false
  }, 'chip dots appear on overflow and jump to their chip');

  // Toast: readable in both themes (the toast is dark in each, so its text
  // must stay light), and it sits above the action row instead of over the
  // question box where the user may be typing.
  assert.deepEqual(await evaluate(`(async () => {
    const instance = activePopups.at(-1), popup = instance.popup;
    const rgb = value => value.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number);
    const luminance = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const contrast = (a, b) => { const [x, y] = [luminance(rgb(a)), luminance(rgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const result = {};
    for (const theme of ['light', 'dark']) {
      applyThemeToPopupContainer(instance.container, theme);
      showPopupToast(instance, 'Saved to Words');
      const toast = popup.querySelector('.ai-popup-toast');
      const style = getComputedStyle(toast);
      result[theme] = contrast(style.color, style.backgroundColor) >= 4.5;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    const toast = popup.querySelector('.ai-popup-toast').getBoundingClientRect();
    const actions = popup.querySelector('.ai-popup-actions').getBoundingClientRect();
    const input = popup.querySelector('#ai-popup-followup-container').getBoundingClientRect();
    result.aboveActions = toast.bottom <= actions.top + 1;
    result.clearOfInput = toast.bottom < input.top;
    result.insidePopup = toast.top >= popup.getBoundingClientRect().top;
    applyThemeToPopupContainer(instance.container, 'dark');
    return result;
  })()`), { light: true, dark: true, aboveActions: true, clearOfInput: true, insidePopup: true }, 'the toast is readable and stays off the question box');

  // Verification: checking, a clean result and an unavailable check are a
  // small badge; a clean result's reasoning opens from the badge and stays
  // open across re-renders; possible errors get the full box. Verifier text
  // is shown as text, never as markup.
  assert.deepEqual(await evaluate(`(async () => {
    const instance = activePopups.at(-1), popup = instance.popup;
    const slot = instance.compareSlots[instance.compareIndex || 0];
    const msg = slot.messages.filter(m => m.role === 'assistant' && !m.isThinking).at(-1);
    const card = () => popup.querySelectorAll('.ai-compare-card')[instance.compareIndex || 0];
    const box = () => card().querySelector('.ai-popup-verification');
    const show = verification => { msg.verification = verification; renderCompareView(instance); return box(); };
    const out = {};
    out.pending = show({ state: 'pending' }).textContent.trim();
    out.failed = show({ state: 'failed' }).textContent.trim();
    let el = show({ state: 'verified', reasoning: 'Grammar point is correct. <img src=x>', corrections: [], checkedBy: 'Checker' });
    const summary = el.querySelector('summary.ai-verify-badge');
    out.verified = { badge: summary.textContent.trim(), compact: el.getBoundingClientRect().height <= 28, title: summary.title, open: el.querySelector('details').open };
    summary.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    renderCompareView(instance);
    el = box();
    out.reopened = { open: el.querySelector('details').open, detail: el.querySelector('.ai-verify-detail').textContent, injected: !!el.querySelector('img') };
    el = show({ state: 'hallucination', reasoning: 'The subject is singular.', corrections: ['She goes to school every day.', '<b>bold</b>'], checkedBy: 'Checker' });
    out.hallucination = {
      title: el.querySelector('.ai-verify-title').textContent.trim(), by: el.querySelector('.ai-verify-by').textContent,
      corrections: [...el.querySelectorAll('li')].map(li => li.textContent), injected: !!el.querySelector('li b'), why: el.querySelector('summary').textContent
    };
    out.unnamed = show({ state: 'verified', reasoning: '', corrections: [] }).querySelector('.ai-verify-badge').title;
    msg.verification = undefined;
    renderCompareView(instance);
    return out;
  })()`), {
    pending: 'Checking…', failed: 'Couldn’t check',
    verified: { badge: 'Verified', compact: true, title: 'Checked by Checker: no problems found. Click for the reasoning.', open: false },
    reopened: { open: true, detail: 'Checked by Checker: no problems found.Grammar point is correct. <img src=x>', injected: false },
    hallucination: { title: 'Possible errors found', by: 'Checked by Checker.', corrections: ['She goes to school every day.', '<b>bold</b>'], injected: false, why: 'Why' },
    unnamed: 'Checked by your verification model: no problems found.'
  }, 'verification shows as a compact badge, with the full box only for possible errors');

  // The line above the answer: comparing models it names the model, a
  // finished answer shows no "done", and there is no trailing bullet. With
  // one model the name only appears when a fallback model answered, and
  // the line appears only while answering or after a failure.
  assert.deepEqual(await evaluate(`(() => {
    const instance = activePopups.at(-1), popup = instance.popup;
    const header = popup.querySelectorAll('.ai-compare-card')[instance.compareIndex || 0].querySelector('.ai-compare-header');
    const compare = {
      name: header.querySelector('.ai-compare-model').textContent,
      status: !!header.querySelector('.ai-compare-status'),
      bullet: getComputedStyle(header.querySelector('.ai-compare-model'), '::after').content,
      padding: getComputedStyle(header).paddingRight
    };
    const slot = instance.compareSlots[instance.compareIndex || 0];
    const single = (overrides) => {
      const all = instance.compareSlots;
      instance.compareSlots = [slot];
      const card = document.createElement('div');
      try { buildCompareCard(instance, card, { ...slot, ...overrides }); } finally { instance.compareSlots = all; }
      const h = card.querySelector('.ai-compare-header');
      return h ? { name: h.querySelector('.ai-compare-model')?.textContent || null, title: h.querySelector('.ai-compare-model')?.title || null, status: h.querySelector('.ai-compare-status')?.textContent || null } : null;
    };
    return {
      compare,
      singleDone: single({}),
      singleFallback: single({ answerModelName: 'Backup model', answerModelId: 'backup' }),
      singleAnswering: single({ status: 'streaming', pendingFollowups: [] }),
      singleFailed: single({ status: 'error', stopped: false })
    };
  })()`), {
    compare: { name: 'first', status: false, bullet: 'none', padding: '2px' },
    singleDone: null,
    singleFallback: { name: 'Backup model', title: 'Answered by Backup model', status: null },
    singleAnswering: { name: null, title: null, status: 'answering…' },
    singleFailed: { name: null, title: null, status: 'failed' }
  }, 'the line above the answer says only what the picker does not');

  // Model dots: a 12 x 24 click area around a dot that still looks 6px wide
  // (16px for the current model).
  assert.deepEqual(await evaluate(`(() => {
    const dots = [...activePopups.at(-1).popup.querySelectorAll('.ai-compare-dotnav')];
    return dots.map(d => {
      const r = d.getBoundingClientRect();
      return { hit: r.width >= 12 && r.height >= 24, drawn: getComputedStyle(d, '::before').width, active: d.classList.contains('active') };
    });
  })()`), [{ hit: true, drawn: '16px', active: true }, { hit: true, drawn: '6px', active: false }], 'model dots are easy to hit and look the same');

  // Cards are spaced apart, so the next card never touches the viewport's
  // clipping edge, and a slide still lands exactly on the next card.
  assert.deepEqual(await evaluate(`(() => {
    const instance = activePopups.at(-1), popup = instance.popup;
    const viewport = () => popup.querySelector('.ai-compare-viewport').getBoundingClientRect();
    const card = i => popup.querySelectorAll('.ai-compare-card')[i].getBoundingClientRect();
    const restingGap = Math.round(card(1).left - viewport().right);
    instance.compareIndex = 1;
    layoutCompareTrack(instance);
    const secondAligned = Math.abs(card(1).left - viewport().left) < 0.5;
    instance.compareIndex = 0;
    layoutCompareTrack(instance);
    return { restingGap, secondAligned, firstAligned: Math.abs(card(0).left - viewport().left) < 0.5 };
  })()`), { restingGap: 16, secondAligned: true, firstAligned: true }, 'cards sit a gap apart and slides land on them');

  // Split Save button: the list arrow is visibly its own part in both
  // themes (its own darker shade, a divider in the button's text colour),
  // and it looks pressed with its chevron flipped while the list is open.
  assert.deepEqual(await evaluate(`(async () => {
    const instance = activePopups.at(-1), popup = instance.popup;
    const arrow = popup.querySelector('.ai-save-split .custom-select');
    const alpha = value => { const m = value.match(/rgba?\\(([^)]+)\\)/); const parts = m ? m[1].split(',').map(Number) : []; return parts.length === 4 ? parts[3] : (m ? 1 : 0); };
    const out = {};
    for (const theme of ['light', 'dark']) {
      applyThemeToPopupContainer(instance.container, theme);
      const style = getComputedStyle(arrow), divider = getComputedStyle(arrow, '::before');
      out[theme] = { shaded: alpha(style.backgroundColor) >= 0.1, divider: divider.width === '1px' && Number(divider.opacity) >= 0.5 && divider.backgroundColor === style.color };
    }
    const chevron = () => getComputedStyle(arrow.querySelector(':scope > span:last-child')).transform;
    const closedShade = alpha(getComputedStyle(arrow).backgroundColor);
    arrow.click();
    await new Promise(resolve => setTimeout(resolve, 200));
    out.open = { expanded: arrow.getAttribute('aria-expanded'), flipped: chevron() !== 'none', darker: alpha(getComputedStyle(arrow).backgroundColor) > closedShade };
    arrow.click();
    await new Promise(resolve => setTimeout(resolve, 200));
    out.closed = { expanded: arrow.getAttribute('aria-expanded'), flipped: chevron() !== 'none' };
    applyThemeToPopupContainer(instance.container, 'dark');
    return out;
  })()`), {
    light: { shaded: true, divider: true }, dark: { shaded: true, divider: true },
    open: { expanded: 'true', flipped: true, darker: true }, closed: { expanded: 'false', flipped: false }
  }, 'the list arrow reads as its own part of the Save button');

  // Resize: dragging the bottom-left grip grows the popup left and down
  // (right edge fixed), saves the size, new popups open at it, and a
  // double-click on the grip returns to the default size.
  // Sizes are layout sizes (offsetWidth/Height): the open animation's
  // transform can still be applied in this background test tab.
  const before = await evaluate(`(() => { const p = activePopups.at(-1).popup, r = p.getBoundingClientRect(); const g = p.querySelector('.ai-popup-resize-grip').getBoundingClientRect(); return { right: p.style.right, top: r.top, width: p.offsetWidth, height: p.offsetHeight, gx: g.left + g.width / 2, gy: g.top + g.height / 2, vh: innerHeight }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: before.gx, y: before.gy });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: before.gx - 50, y: before.gy + 20 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: before.gx - 100, y: before.gy + 40 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: before.gx - 100, y: before.gy + 40 });
  await waitFor('localData.popupSize', 'the dragged size is saved');
  const after = await evaluate(`(() => { const p = activePopups.at(-1).popup; return { right: p.style.right, width: p.offsetWidth, height: p.offsetHeight, saved: localData.popupSize }; })()`);
  const expectedHeight = Math.min(before.height + 40, before.vh - before.top - 12);
  // Within 2px: pointer coordinates are whole pixels, the grip's centre is not.
  const near = (actual, expected) => Math.abs(actual - expected) <= 2;
  assert.deepEqual({ right: after.right === before.right, width: near(after.width, before.width + 100), height: near(after.height, expectedHeight) },
    { right: true, width: true, height: true }, `the grip resizes left and down (right edge anchored): ${JSON.stringify({ before, after })}`);
  assert.deepEqual(after.saved, { width: Math.round(after.width), height: Math.round(after.height) }, 'the size is remembered');
  assert.deepEqual(await evaluate(`(() => {
    const instance = showPopup(0, 0, 'Loading');
    const style = { width: instance.popup.style.width, height: instance.popup.style.height };
    instance.popup.querySelector('.ai-popup-resize-grip').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const reset = { width: instance.popup.style.width, height: instance.popup.style.height, saved: localData.popupSize === undefined };
    removePopupInstance(instance);
    return { style, reset };
  })()`), { style: { width: after.saved.width + 'px', height: after.saved.height + 'px' }, reset: { width: '', height: '', saved: true } }, 'new popups open at the saved size; double-click resets');
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
