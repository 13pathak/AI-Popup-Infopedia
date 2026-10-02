// node tests/test-note-sync.js
// Exercise the real storage listener, floating editor and undo functions.
// DOM/storage/timers are stubbed so delayed saves can be checked deterministically.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8').replace(/\r\n/g, '\n');
const key = 'pdf_highlights_test.pdf';
const initial = [1, 2].map(id => ({ id, pageNumber: 1, note: id === 1 ? '<b>Old note</b>' : 'Other note',
    noteFmt: 'html', color: '#FFFF00', rects: [{ pdfX: 10, pdfY: 20, pdfWidth: 30, pdfHeight: 10 }] }));

function harness() {
    const elements = new Map(), timers = new Map(), writes = [];
    let nextTimer = 0, storageListener;
    const element = id => {
        if (!elements.has(id)) {
            const classes = new Set();
            const listeners = new Map();
            let html = '';
            elements.set(id, {
                dataset: {}, style: {}, htmlWrites: 0,
                addEventListener(type, listener) { listeners.set(type, listener); },
                click() { listeners.get('click')?.(); },
                get innerHTML() { return html; },
                set innerHTML(value) { html = value; this.htmlWrites++; },
                get textContent() { return html.replace(/<[^>]*>/g, ''); },
                set textContent(value) { html = value; },
                classList: {
                    add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
                    toggle(c, enabled) { enabled ? classes.add(c) : classes.delete(c); }
                }
            });
        }
        return elements.get(id);
    };
    const popup = element('note-editor-popup'), editor = element('note-textarea');
    popup.dataset.hlId = '1';
    const emit = (records, storageKey = key) => storageListener({ [storageKey]: { newValue: structuredClone(records) } }, 'local');
    const context = vm.createContext({
        console, structuredClone,
        document: { getElementById: element, querySelector: () => null, querySelectorAll: () => [], activeElement: editor },
        chrome: { runtime: {}, storage: {
            onChanged: { addListener(listener) { storageListener = listener; } },
            local: {
                get() {},
                set(data, callback) { writes.push(structuredClone(data)); callback?.(); emit(data[key]); }
            }
        } },
        setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
        sanitizeRichNote: html => html,
        renderSidebar() {}, recordDocumentIdentity() {}, updateHighlightIndicatorsOnPage() {}
    });
    const run = code => vm.runInContext(code, context);
    run(`
        let highlights = ${JSON.stringify(initial)}, highlightCounter = 2, annotationRevision = 0, annotationSource = null;
        let activeHighlightId = 1, currentSelection = null, noteUndoSession = null;
        let noteAutoSaveTimeout = null, noteStatusFadeTimeout = null, isNoteDirty = false;
        const SYNC_KEYS = { highlights: ${JSON.stringify(key)} };
        const PENDING_WRITE_CONFIRM_MS = 2000, PENDING_WRITE_HISTORY = 8, pendingOwnWrites = new Map();
        const ANNOTATION_UNDO_LIMIT = 100, annotationUndoStack = [], annotationRedoStack = [];
    `);
    for (const name of ['hasChromeStorage', 'isValidStoredRect', 'hasValidCornerQuad', 'maxStoredId',
        'sanitizeStoredHighlights', 'rememberOwnWrite', 'settlePendingWrite', 'livePendingWrites', 'saveHighlights',
        'resetAnnotationHistory', 'registerUndoEntry', 'updateUndoRedoButtons', 'beginNoteUndoSession',
        'endNoteUndoSession', 'commitNoteUndoEntry', 'runAnnotationUndo', 'runAnnotationRedo', 'applyNoteForUndo',
        'syncFloatingNoteEditorForUndo', 'escapeHtml', 'setRichNoteContent', 'getRichNoteContent',
        'getNotePopupTargetHighlight', 'handleFloatingNoteInput', 'flushFloatingNoteSave', 'hidePopups',
        'adoptRemoteHighlights', 'redrawRenderedHighlights', 'syncFloatingNoteEditorAfterRemoteUpdate']) {
        const start = source.indexOf(`function ${name}(`);
        assert.ok(start >= 0, name);
        run(source.slice(start, source.indexOf('\n}', start) + 2));
    }
    const listenerStart = source.indexOf('if (hasChromeStorage()) {\n    chrome.storage.onChanged.addListener');
    assert.ok(listenerStart >= 0);
    run(source.slice(listenerStart, source.indexOf('\n// Another surface', listenerStart)));
    const toolbarStart = source.indexOf("const undoAnnotationBtn = document.getElementById('undo_annotation');");
    run(source.slice(toolbarStart, source.indexOf('// --- Highlight restore primitives', toolbarStart)));
    run("setRichNoteContent(document.getElementById('note-textarea'), highlights[0]); beginNoteUndoSession(highlights[0]);");
    return { run, emit, editor, popup, writes, timers, element,
        type(html) { editor.innerHTML = html; run('handleFloatingNoteInput()'); },
        drainTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); }
    };
}

// A remote comment becomes the starting point for subsequent typing and undo.
const updated = harness();
const remote = structuredClone(initial);
remote[0].note = '<b>Remote comment</b>';
updated.emit(remote);
assert.equal(updated.editor.innerHTML, remote[0].note);
assert.equal(updated.run('noteUndoSession.note'), remote[0].note);
assert.equal(updated.writes.length, 0, 'adoption itself must not write back');
updated.type(updated.editor.innerHTML + ' + local edit');
updated.drainTimers();
assert.equal(updated.writes.at(-1)[key][0].note, '<b>Remote comment</b> + local edit');
updated.run('runAnnotationUndo()');
assert.equal(updated.editor.innerHTML, remote[0].note, 'undo returns to the adopted comment');
updated.run('runAnnotationRedo()');
assert.equal(updated.editor.innerHTML, '<b>Remote comment</b> + local edit');

// A local draft's delayed save must not resurrect stale text after adoption.
const pending = harness();
pending.type('<b>Old note</b> + uncommitted draft');
const staleSave = pending.timers.get(pending.run('noteAutoSaveTimeout'));
pending.run("noteStatusFadeTimeout = setTimeout(() => {}, 1500)");
const plain = structuredClone(initial);
plain[0].note = '<b>literal tags</b> 中文';
delete plain[0].noteFmt;
pending.emit(plain);
assert.equal(pending.editor.innerHTML, '&lt;b&gt;literal tags&lt;/b&gt; 中文', 'remote plain notes remain literal');
assert.equal(pending.run('isNoteDirty'), false);
assert.equal(pending.timers.size, 0, 'autosave and stale status timers are cancelled');
assert.equal(pending.element('note-save-status').textContent, '');
staleSave(); // Even a callback already dispatched before cancellation is harmless.
pending.run('hidePopups()');
assert.equal(pending.writes.length, 0, 'closing the popup cannot overwrite the remote plain note');

// Remote deletion closes the popup based on its bound id, even if the active
// highlight has already been cleared. Its old debounce must not recreate it.
const deleted = harness();
deleted.type('Pending deleted note');
const deletedSave = deleted.timers.get(deleted.run('noteAutoSaveTimeout'));
deleted.run('activeHighlightId = null');
deleted.emit([initial[1]]);
assert.ok(deleted.popup.classList.contains('hidden'));
assert.equal(deleted.popup.dataset.hlId, undefined);
deletedSave();
assert.equal(deleted.writes.length, 0);
assert.equal(deleted.run('highlights.length'), 1);
assert.equal(deleted.run('noteUndoSession'), null);

// An empty remote comment also clears the DOM before the next input.
const cleared = harness();
const empty = structuredClone(initial);
delete empty[0].note;
delete empty[0].noteFmt;
cleared.emit(empty);
assert.equal(cleared.editor.innerHTML, '');
cleared.type(cleared.editor.innerHTML + 'New comment');
cleared.drainTimers();
assert.equal(cleared.writes.at(-1)[key][0].note, 'New comment');

// Other annotations/documents and our own storage echoes must not reset the
// editor DOM (which would disturb the caret) or split the local undo session.
const unrelated = harness();
const htmlWrites = unrelated.editor.htmlWrites;
const other = structuredClone(initial);
other[1].note = 'Other annotation changed';
unrelated.emit(other);
unrelated.emit(remote, 'pdf_highlights_other.pdf');
assert.equal(unrelated.editor.htmlWrites, htmlWrites);
unrelated.type('<b>Old note</b> local');
const beforeEchoWrites = unrelated.editor.htmlWrites;
unrelated.drainTimers();
assert.equal(unrelated.editor.htmlWrites, beforeEchoWrites, 'own echo does not repaint the editor');
assert.equal(unrelated.run('noteUndoSession.note'), initial[0].note);
unrelated.popup.classList.add('hidden');
unrelated.emit(remote);
assert.equal(unrelated.editor.htmlWrites, beforeEchoWrites, 'a hidden editor is not reopened or repainted');

// Toolbar Undo leaves the floating popup open. Typing must start a fresh
// session before mutating the restored note and invalidate Redo immediately,
// even while the 300 ms storage debounce has not fired yet.
const toolbar = harness();
toolbar.type('<b>First edit</b>');
toolbar.drainTimers();
toolbar.element('undo_annotation').click();
assert.equal(toolbar.editor.innerHTML, initial[0].note);
assert.ok(!toolbar.popup.classList.contains('hidden'));
assert.equal(toolbar.run('noteUndoSession'), null);
assert.equal(toolbar.run('annotationRedoStack.length'), 1);
toolbar.type('<b>Second edit</b>');
assert.equal(toolbar.run('annotationUndoStack.length'), 1, 'typing after toolbar Undo creates an undo entry');
assert.equal(toolbar.run('annotationRedoStack.length'), 0, 'typing invalidates stale Redo before autosave');
assert.equal(toolbar.element('redo_annotation').disabled, true);
toolbar.element('redo_annotation').click();
assert.equal(toolbar.editor.innerHTML, '<b>Second edit</b>', 'stale Redo cannot overwrite new typing');
toolbar.drainTimers();
toolbar.type('<b>Second edit</b> continued');
toolbar.drainTimers();
assert.equal(toolbar.run('annotationUndoStack.length'), 1, 'continued typing coalesces within the fresh session');
toolbar.element('undo_annotation').click();
assert.equal(toolbar.editor.innerHTML, initial[0].note, 'one undo restores the new session baseline');
toolbar.element('redo_annotation').click();
assert.equal(toolbar.editor.innerHTML, '<b>Second edit</b> continued');

// Redo also ends the old session. A further edit must be tracked separately
// and can be undone before its pending storage write fires.
toolbar.type('Edit after Redo');
assert.equal(toolbar.run('annotationUndoStack.length'), 2);
toolbar.element('undo_annotation').click();
assert.equal(toolbar.editor.innerHTML, '<b>Second edit</b> continued');
toolbar.drainTimers();
assert.equal(toolbar.writes.at(-1)[key][0].note, '<b>Second edit</b> continued', 'old debounce cannot reapply the undone edit');
toolbar.element('redo_annotation').click();
assert.equal(toolbar.editor.innerHTML, 'Edit after Redo');

// Coalescing back to the starting text must not leave an older after-state
// that a later Redo could resurrect, including when it was already autosaved.
for (const autosaveIntermediate of [false, true]) {
    const reverted = harness();
    reverted.type('Temporary change');
    if (autosaveIntermediate) {
        reverted.drainTimers();
        assert.equal(reverted.writes.at(-1)[key][0].note, 'Temporary change');
    }
    reverted.type(initial[0].note);
    reverted.drainTimers();
    assert.equal(reverted.run('annotationUndoStack.length'), 1, 'reversion stays in the same editing session');
    assert.equal(reverted.run('annotationUndoStack[0].after.note'), initial[0].note,
        'coalesced entry replaces discarded intermediate text with the final note');
    assert.equal(reverted.writes.at(-1)[key][0].note, initial[0].note);
    reverted.run('hidePopups()'); // End the session as a user closing the editor would.
    reverted.element('undo_annotation').click();
    reverted.element('redo_annotation').click();
    assert.equal(reverted.run('highlights[0].note'), initial[0].note, 'Redo keeps the final text');
    assert.equal(reverted.run('highlights[0].noteFmt'), initial[0].noteFmt, 'Redo keeps the final format');
    assert.equal(reverted.writes.at(-1)[key][0].note, initial[0].note,
        'Redo never persists the discarded intermediate text');
}

console.log('Floating note sync and history: cross-tab adoption, timers, toolbar undo/redo and continued editing passed.');
