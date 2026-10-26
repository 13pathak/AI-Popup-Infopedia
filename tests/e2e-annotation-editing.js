// Real editor typing, autosave and reload persistence. Uses an isolated CDP tab
// and localStorage-backed extension storage on test ports 8793/9333.
const assert = require('node:assert/strict');
const key = 'pdf_highlights_/tests/test_highlight.pdf';
const fixture = { id: 1, pageNumber: 1, color: '#FFFF98', text: 'Page one sample text', note: 'Original note',
    rects: [{ pdfX: 72, pdfY: 722, pdfWidth: 220, pdfHeight: 26 }] };
let ws, tab, nextId = 0, loaded;
const pending = new Map();
function send(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
        if (await evaluate(expression)) return;
        await pause(100);
    }
    throw new Error('Timed out: ' + expression);
}
async function navigate(method, params) {
    const complete = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Load timed out')), 15000);
        loaded = () => { clearTimeout(timeout); loaded = null; resolve(); };
    });
    await send(method, params);
    await complete;
    await waitFor(`!!document.querySelector('.page .textLayer span') && !!document.querySelector('.sidebar-item-note-input')`);
}
async function type(text) {
    await evaluate(`(() => {
        if (document.getElementById('sidebar').classList.contains('hidden')) document.getElementById('icon-tab-comments').click();
        window.noteEditor = document.querySelector('.sidebar-item-note-input');
        noteEditor.focus();
        const range = document.createRange(); range.selectNodeContents(noteEditor);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    })()`);
    await send('Input.insertText', { text });
}
const stored = () => evaluate(`testStore[${JSON.stringify(key)}][0].note`);

async function run() {
    tab = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = event => {
        const m = JSON.parse(event.data), p = pending.get(m.id);
        if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
        if (m.method === 'Page.loadEventFired') loaded?.();
    };
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
        if (location.origin !== 'http://127.0.0.1:8793') return;
        const areaKey = 'annotation-editing-e2e';
        window.testStore = JSON.parse(localStorage.getItem(areaKey) || 'null') || { ${JSON.stringify(key)}: [${JSON.stringify(fixture)}] };
        const listeners = [];
        const area = {
            get(keys, cb) {
                const out = keys && typeof keys === 'object' && !Array.isArray(keys) ? { ...keys } : {};
                for (const k of typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || testStore)) {
                    if (k in testStore) out[k] = structuredClone(testStore[k]);
                }
                setTimeout(() => cb(out), 0);
            },
            set(values, cb) {
                const changes = {};
                for (const [k, v] of Object.entries(values)) {
                    changes[k] = { oldValue: testStore[k], newValue: structuredClone(v) };
                    testStore[k] = structuredClone(v);
                }
                localStorage.setItem(areaKey, JSON.stringify(testStore));
                setTimeout(() => { cb?.(); listeners.forEach(fn => fn(changes, 'local')); }, 0);
            }
        };
        window.chrome = {
            runtime: { getURL: p => 'http://127.0.0.1:8793/' + p, onMessage: { addListener() {} }, sendMessage(msg, cb) { cb?.({}); } },
            storage: { local: area, sync: { get: (keys, cb) => setTimeout(() => cb(Array.isArray(keys) ? {} : keys), 0) }, onChanged: { addListener: fn => listeners.push(fn) } }
        };
    })()` });
    await navigate('Page.navigate', { url: 'http://127.0.0.1:8793/pdf/web/custom-viewer.html?file=/tests/test_highlight.pdf' });
    await type('Autosaved comment 中文 🙂');
    await waitFor(`testStore[${JSON.stringify(key)}][0].note === 'Autosaved comment 中文 🙂'`);
    assert.ok(await evaluate('document.activeElement === noteEditor'), 'autosave keeps the original focused editor');
    await navigate('Page.reload');
    assert.equal(await evaluate(`document.querySelector('.sidebar-item-note-input').textContent`), 'Autosaved comment 中文 🙂');
    await type('Last keystroke before reload');
    await navigate('Page.reload'); // No debounce wait or blur.
    assert.equal(await stored(), 'Last keystroke before reload');
    assert.equal(await evaluate(`document.querySelector('.sidebar-item-note-input').textContent`), 'Last keystroke before reload');
    await type('Hidden-tab draft');
    await evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState;`);
    assert.equal(await stored(), 'Hidden-tab draft', 'hidden-tab event flushes pending text');
    console.log('pass: sidebar autosave, focus, reload before debounce and visibility flush');


}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (tab) {
        try { await evaluate("localStorage.removeItem('annotation-editing-e2e')"); } catch {}
    }
    ws?.close();
    if (tab) await fetch(`http://127.0.0.1:9333/json/close/${tab.id}`).catch(() => {});
});
