// Issue #47. Real PDF viewer in an isolated CDP tab with extension storage.
// Requires tests/serve.js on 8793 and headless Edge/Chrome on 9333.
const assert = require('node:assert/strict');
const fixtures = [
    { id: 1, pageNumber: 1, color: '#FFFF98', text: 'Key argument', note: 'Alpha note' },
    { id: 2, pageNumber: 2, color: '#ffff98', text: 'Second argument', note: '<p>Research <b>question</b> &amp; answer</p>', noteFmt: 'html' },
    { id: 3, pageNumber: 1, color: '#53FFBC', text: 'CITATION evidence', note: 'Reference source', markupType: 'Underline' },
    { id: 4, pageNumber: 2, color: '#FFCBE6', text: 'Open question', markupType: 'StrikeOut' },
    { id: 5, pageNumber: 3, color: '#800080', text: 'Conclusion', note: '疑問 中文' },
    { id: 6, pageNumber: 3, color: '#fff', text: 'Method' }
].map(item => ({ ...item, rects: [{ pdfX: 72, pdfY: 680 - item.id * 20, pdfWidth: 100, pdfHeight: 16 }] }));
const key = 'pdf_highlights_/tests/test_highlight.pdf';
let ws, tab, nextId = 0;
const pending = new Map();
function send(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
}
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
async function click(selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await pause();
}
async function search(text) {
    await evaluate(`(() => { const input = document.getElementById('sidebar-annotation-search'); input.focus(); input.value = ${JSON.stringify(text)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await pause();
}
const ids = () => evaluate(`[...document.querySelectorAll('#sidebar-content-comments .sidebar-item')].map(el => Number(el.dataset.hlId)).sort((a,b) => a-b)`);
const title = () => evaluate(`document.getElementById('sidebar-title').textContent`);
const swatch = color => `.sidebar-color-chip[data-color="${color}"]`;

async function run() {
    tab = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = event => {
        const message = JSON.parse(event.data), p = pending.get(message.id);
        if (p) { pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); }
    };
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
        window.testStore = { ${JSON.stringify(key)}: ${JSON.stringify(fixtures)} };
        const listeners = [];
        const clone = value => JSON.parse(JSON.stringify(value));
        const area = {
            get(keys, cb) {
                const out = typeof keys === 'object' && !Array.isArray(keys) ? { ...keys } : {};
                for (const k of typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(out)) {
                    if (k in testStore) out[k] = clone(testStore[k]);
                }
                setTimeout(() => cb(out), 0);
            },
            set(values, cb) {
                const changes = {};
                for (const [k, v] of Object.entries(values)) { changes[k] = { oldValue: testStore[k], newValue: clone(v) }; testStore[k] = clone(v); }
                setTimeout(() => { if (cb) cb(); listeners.forEach(fn => fn(changes, 'local')); }, 0);
            }
        };
        window.chrome = {
            runtime: { getURL: p => 'http://127.0.0.1:8793/' + p, onMessage: { addListener() {} }, sendMessage(msg, cb) { if (cb) cb({}); } },
            storage: { local: area, sync: { get: (keys, cb) => setTimeout(() => cb(Array.isArray(keys) ? {} : keys), 0) }, onChanged: { addListener: fn => listeners.push(fn) } }
        };
    ` });
    await send('Page.navigate', { url: 'http://127.0.0.1:8793/pdf/web/custom-viewer.html?file=/tests/test_highlight.pdf' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (await evaluate(`!!document.querySelector('.page[data-page-number="1"] .textLayer span')`)) { ready = true; break; }
        await pause();
    }
    assert.ok(ready, 'viewer rendered');
    await click('#icon-tab-comments');
    assert.deepEqual(await ids(), [1, 2, 3, 4, 5, 6]);
    assert.equal(await title(), 'Comments (6)');
    assert.equal(await evaluate(`document.querySelectorAll('.sidebar-color-chip').length`), 5, 'case variants share one chip; custom/short hex colors appear');
    await click(swatch('#ffff98'));
    assert.deepEqual(await ids(), [1, 2]);
    assert.equal(await title(), 'Comments (2 of 6)');
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(swatch('#ffff98'))}).getAttribute('aria-pressed')`), 'true');
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.sidebar-page-divider')].map(el => el.textContent)`), ['Page 1 · 1', 'Page 2 · 1']);
    await click(swatch('#53ffbc'));
    assert.deepEqual(await ids(), [1, 2, 3], 'color selections combine with OR');
    await search('  RESEARCH   question & answer  ');
    assert.deepEqual(await ids(), [2], 'rich note search uses visible text and decoded entities');
    await click('.sidebar-filter-chip');
    assert.deepEqual(await ids(), [], 'page, color and query combine with AND');
    assert.equal(await title(), 'Comments (0 of 6)');
    assert.ok(await evaluate(`document.getElementById('sidebar-content-comments').textContent.includes('No matching comments')`));
    await click('.sidebar-filter-chip');
    await search('citation');
    assert.deepEqual(await ids(), [3], 'highlight text is case insensitive');
    await search('<b>');
    assert.deepEqual(await ids(), [], 'HTML tags are not searchable note text');
    await click('#sidebar-annotation-clear');
    assert.equal(await title(), 'Comments (6)');
    assert.equal(await evaluate(`document.getElementById('sidebar-annotation-search').value`), '');
    await search('疑問');
    assert.deepEqual(await ids(), [5], 'Unicode notes are searchable');
    await click('#sidebar-annotation-clear');

    // Real typing must preserve the same focused search node across renders.
    await evaluate(`window.savedSearch = document.getElementById('sidebar-annotation-search'); savedSearch.focus()`);
    await send('Input.insertText', { text: 'quest' });
    await send('Input.insertText', { text: 'ion' });
    assert.equal(await evaluate(`document.activeElement === savedSearch && savedSearch.value === 'question'`), true);
    assert.deepEqual(await ids(), [2, 4]);
    await click('#icon-tab-bookmarks');
    assert.equal(await evaluate(`document.getElementById('sidebar-annotation-filters').hidden`), true);
    await click('#icon-tab-comments');
    assert.deepEqual(await ids(), [2, 4], 'filters survive tab switching');

    // Editing a matching note may remove it from the search on blur, never mid-typing.
    await evaluate(`(() => { const note = document.querySelector('.sidebar-item[data-hl-id="2"] .sidebar-item-note-input'); note.focus(); note.textContent = 'Changed note'; note.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    assert.deepEqual(await ids(), [2, 4]);
    await evaluate(`document.getElementById('sidebar-annotation-search').focus()`);
    await pause();
    assert.deepEqual(await ids(), [4], 'note edit refreshes membership after blur');
    await click('#sidebar-annotation-clear');
    await click(swatch('#ffcbe6'));
    // Recolor via external storage simulates a second viewer and refreshes chips.
    await evaluate(`(() => { const rows = structuredClone(testStore[${JSON.stringify(key)}]); rows.find(hl => hl.id === 4).color = '#800080'; chrome.storage.local.set({ [${JSON.stringify(key)}]: rows }); })()`);
    await pause();
    assert.deepEqual(await ids(), [], 'recolor removes a selected-color match');
    assert.ok(await evaluate(`!!document.querySelector(${JSON.stringify(swatch('#ffcbe6'))})`), 'empty selected color remains available to deselect');
    await click('#sidebar-annotation-clear');
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(swatch('#ffcbe6'))}) === null`), true);
    await click(swatch('#800080'));
    assert.deepEqual(await ids(), [4, 5]);
    await click('.sidebar-item[data-hl-id="5"] .sidebar-item-delete');
    assert.deepEqual(await ids(), [4]);
    assert.equal(await title(), 'Comments (1 of 5)');
    await click('#undo_annotation');
    assert.deepEqual(await ids(), [4, 5], 'undo restores a match without resetting filters');
    assert.equal(await title(), 'Comments (2 of 6)');
    for (const theme of ['light', 'dark']) {
        await evaluate(`document.body.classList.toggle('dark-mode', ${theme === 'dark'})`);
        assert.equal(await evaluate(`(() => { const el = document.getElementById('sidebar-annotation-filters'); return el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().height > 0; })()`), true, theme + ' filters fit sidebar');
    }
    if (process.env.ANNOTATION_FILTER_SCREENSHOT) {
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        require('node:fs').writeFileSync(process.env.ANNOTATION_FILTER_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
    }
    await evaluate(`chrome.storage.local.set({ [${JSON.stringify(key)}]: [] })`);
    await pause();
    assert.equal(await title(), 'Comments (0)');
    await click('#sidebar-annotation-clear');
    assert.equal(await evaluate(`document.getElementById('sidebar-annotation-clear').disabled`), true);
    console.log('Annotation color/search/page filters, counts, focus, edits and storage updates passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (ws) ws.close();
    if (tab) await fetch('http://127.0.0.1:9333/json/close/' + tab.id).catch(() => {});
});
