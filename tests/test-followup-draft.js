// Issue #40: exercise the production stash/restore and session-storage helpers.
// Run: node tests/test-followup-draft.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const content = read('content.js');
const background = read('background.js');
const session = {};
let submissions = 0;
const compareRequests = [];
const input = value => ({ value, disabled: false, focus() { this.focused = true; }, setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } });
const context = vm.createContext({
  chrome: { runtime: {}, storage: { session: {
    set(values, callback) { Object.assign(session, JSON.parse(JSON.stringify(values))); callback(); },
    get(key, callback) { callback(JSON.parse(JSON.stringify(session))); }
  } } },
  COMPARE_MODEL_CAP: 4,
  createFollowupInput(instance) { instance.input = input(''); },
  renderCompareView() {},
  updateCompareFollowupState(instance) { instance.input.disabled = false; },
  dispatchFollowupText() { submissions++; },
  issueCompareRequest(instance, generation, slot, word, customPrompt, isFollowup) {
    compareRequests.push({ modelId: slot.modelId, word, customPrompt, isFollowup });
  }
});
vm.runInContext(content.slice(content.indexOf('const CONVO_STASH_MAX_MESSAGES_PER_SLOT'), content.indexOf('// Opens the stashed conversation:')), context);
vm.runInContext(content.slice(content.indexOf('function ensureCompareSlotLoaded('), content.indexOf('// Zero-models fallback')), context);
vm.runInContext(background.slice(background.indexOf('const CONVO_STASH_KEY'), background.indexOf('// --- Direct pronunciation & IPA')), context);

function popup(value, withInput = true) {
  const instance = {
    input: withInput ? input(value) : null,
    compareWord: 'Cell',
    compareIndex: 0,
    compareSlots: [{ modelId: 'model', modelName: 'Model', started: true, messages: [
      { role: 'user', content: 'Cell' },
      { role: 'assistant', content: 'A unit of life.' },
      { role: 'assistant', content: 'Partial output', isStreaming: true }
    ] }]
  };
  instance.popup = { querySelector(selector) {
    if (selector === '#ai-popup-followup-input') return instance.input;
    if (selector === '#ai-popup-followup-container') return instance.input ? {} : null;
    return null;
  } };
  return instance;
}
const models = [{ id: 'model', name: 'Model' }];

async function run() {
  const draft = '  How does “细胞” differ from a stem cell? 🧬  ';
  const original = popup(draft);
  const stash = context.buildConversationStash(original);
  assert.equal(stash.followupDraft, draft, 'preserve exact unsent text');
  assert.equal(stash.slots[0].messages.length, 2, 'streaming content remains excluded');
  await context.setConvoStash(stash);
  const recovered = await context.getConvoStash();
  const reopened = popup('', false);
  assert.equal(context.restoreConversationFromStash(reopened, recovered, models), true);
  assert.equal(reopened.input.value, draft, 'draft survives the session-storage round trip');
  assert.equal(reopened.input.disabled, false);
  assert.equal(reopened.input.focused, true);
  assert.equal(reopened.input.selectionStart, draft.length);
  assert.equal(reopened.input.selectionEnd, draft.length);
  assert.equal(submissions, 0, 'restoring must not submit the draft');
  assert.equal(reopened.compareSlots[0].messages.length, 2, 'draft is not a conversation turn');

  reopened.input.value = 'Edited draft';
  const nextStash = context.buildConversationStash(reopened);
  assert.equal(nextStash.followupDraft, 'Edited draft', 'subsequent dismissal captures edits');
  reopened.input.value = '';
  assert.equal(context.buildConversationStash(reopened).followupDraft, '', 'cleared or submitted text is not resurrected');
  assert.equal(context.buildConversationStash(popup('   ')).followupDraft, '   ', 'no trimming');
  assert.equal(context.buildConversationStash(popup('', false)).followupDraft, '', 'missing input is safe');

  // Selection buttons choose a task independently of the configured default.
  // A model first visited after reopening must receive that same task.
  const compareModels = [...models, { id: 'late-model', name: 'Late Model' }];
  for (const selectedPrompt of ['Check the grammar of {word}.', '']) {
    const selected = popup('Follow-up draft');
    selected.comparePrompt = selectedPrompt;
    const selectedStash = context.buildConversationStash(selected);
    assert.equal(selectedStash.comparePrompt, selectedPrompt, 'stash retains the custom task and explicit system choice');
    await context.setConvoStash(selectedStash);
    const restoredSelection = popup('', false);
    assert.equal(context.restoreConversationFromStash(restoredSelection, await context.getConvoStash(), compareModels), true);
    assert.equal(restoredSelection.comparePrompt, selectedPrompt, 'selected task survives the session-storage round trip');
    context.ensureCompareSlotLoaded(restoredSelection, 1);
    assert.deepEqual(compareRequests.at(-1), {
      modelId: 'late-model', word: 'Cell', customPrompt: selectedPrompt, isFollowup: false
    }, 'a late compare model runs the task selected before closing');
  }
  for (const invalidPrompt of [undefined, null, 42, { content: 'not a string' }]) {
    const malformed = popup('Draft');
    malformed.comparePrompt = invalidPrompt;
    assert.equal(context.buildConversationStash(malformed).comparePrompt, null, 'only actual prompt strings are stashed');
    const legacyStash = { ...stash, comparePrompt: invalidPrompt };
    if (invalidPrompt === undefined) delete legacyStash.comparePrompt;
    const restoredLegacy = popup('', false);
    assert.equal(context.restoreConversationFromStash(restoredLegacy, legacyStash, compareModels), true);
    assert.equal(restoredLegacy.comparePrompt, null, 'older and malformed stashes use default prompt resolution');
    context.ensureCompareSlotLoaded(restoredLegacy, 1);
    assert.equal(compareRequests.at(-1).customPrompt, null);
  }

  for (const invalid of [undefined, null, 42, { text: 'wrong shape' }]) {
    const target = popup('Existing text');
    assert.equal(context.restoreConversationFromStash(target, { ...stash, followupDraft: invalid }, models), true);
    assert.equal(target.input.value, '', 'legacy/malformed drafts default to empty');
  }
  const empty = popup('No answered conversation');
  empty.compareSlots = [];
  const initialDraft = context.buildConversationStash(empty);
  assert.equal(initialDraft.followupDraft, 'No answered conversation', 'initial drafts survive without an assistant answer');
  assert.equal(initialDraft.slots.length, 0);
  const initialTarget = popup('', false);
  initialTarget.compareSlots = [];
  assert.equal(context.restoreConversationFromStash(initialTarget, initialDraft, []), true, 'drafts restore even with no configured models');
  assert.equal(initialTarget.input.value, initialDraft.followupDraft);
  empty.input.value = '';
  assert.equal(context.buildConversationStash(empty), null, 'truly empty popups do not replace recovery');
  empty.input.value = '   ';
  assert.equal(context.buildConversationStash(empty), null, 'whitespace alone is not an unfinished question');
  // The clear must run after a pending save; reopening waits for both.
  const saving = context.setConvoStash(stash);
  const clearing = context.clearConvoDraft();
  const afterClear = await context.getConvoStash();
  await Promise.all([saving, clearing]);
  assert.equal(afterClear.followupDraft, '');
  assert.equal(afterClear.slots[0].messages.length, 2, 'clearing retains conversation recovery');
  console.log('Follow-up draft and selected prompt preservation and restoration tests passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
