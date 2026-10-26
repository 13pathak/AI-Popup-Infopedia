// Real-browser Focus mode and search-result navigation using a generated PDF.
// Run with tests/serve.js on 8793 and a headless browser on CDP port 9333.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PDFLib = require('../pdf-lib.min.js');
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
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
        if (await evaluate(expression)) return;
        await pause(100);
    }
    throw new Error('Timed out: ' + expression);
}
async function click(id) {
    const point = await evaluate(`(() => {
        const el = document.getElementById(${JSON.stringify(id)}), r = el.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        if (!el.contains(document.elementFromPoint(x, y))) throw new Error('Obscured: ' + el.id);
        return { x, y };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await pause(120);
}
async function key(key, code, modifiers = 0) {
    const windowsVirtualKeyCode = key === 'Enter' ? 13 : key === 'Escape' ? 27 : key === 'ArrowDown' ? 40 : key.toUpperCase().charCodeAt(0);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode,
        ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode });
    await pause(100);
}
async function search(text) {
    await evaluate(`document.getElementById('findInput').focus(); document.getElementById('findInput').select()`);
    await send('Input.insertText', { text });
    await key('Enter', 'Enter');
    await waitFor(`document.getElementById('search-result-list').getAttribute('aria-busy') === 'false'`);
}
async function chooseResult(index) {
    await evaluate(`(() => {
        const button = document.querySelector('[data-match-index="${index}"]');
        button.scrollIntoView({ block: 'nearest' }); button.focus();
    })()`);
    assert.equal(await evaluate(`Number(document.activeElement.dataset.matchIndex)`), index, 'result receives keyboard focus');
    await key('Enter', 'Enter');
    await waitFor(`document.getElementById('findResults').textContent.startsWith('${index + 1} /')`);
    await waitFor(`!!document.querySelector('.search-highlight.active')`);
}
const visibleMatch = `(() => {
    const match = document.querySelector('.search-highlight.active');
    if (!match) return false;
    const r = match.getBoundingClientRect(), v = document.getElementById('viewerContainer').getBoundingClientRect();
    return r.top >= v.top && r.bottom <= v.bottom && r.left >= v.left && r.right <= v.right;
})()`;
async function screenshot(name) {
    if (!process.env.VIEWER_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.VIEWER_SCREENSHOT_DIR, { recursive: true });
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.VIEWER_SCREENSHOT_DIR, name + '.png'), Buffer.from(data, 'base64'));
}

async function run() {
    const pdf = await PDFLib.PDFDocument.create();
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    for (let p = 0; p < 6; p++) {
        const page = pdf.addPage([612, 900]);
        for (let line = 0; line < 30; line++) {
            page.drawText(`needle reference ${p * 30 + line + 1}: <b>literal text</b> & reading context`, {
                x: 60, y: 840 - line * 24, size: 12, font
            });
        }
    }
    const fixture = Buffer.from(await pdf.save()).toString('base64');
    tab = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = event => {
        const message = JSON.parse(event.data), p = pending.get(message.id);
        if (p) { pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); }
        if (message.method === 'Runtime.exceptionThrown' && message.params.exceptionDetails.url?.includes('custom-viewer')) {
            console.error('Viewer exception:', JSON.stringify(message.params.exceptionDetails));
        }
        if (message.method === 'Fetch.requestPaused') {
            send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
                responseHeaders: [{ name: 'Content-Type', value: 'application/pdf' }], body: fixture }).catch(console.error);
        }
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: 'http://127.0.0.1:8793/tests/focus-search-fixture.pdf' }] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.clear(); localStorage.setItem('uiTheme', 'light');` });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:8793/pdf/web/custom-viewer.html?file=/tests/focus-search-fixture.pdf' });
    await waitFor(`!!document.querySelector('.page .textLayer span') && document.getElementById('page_count').textContent === '6'`);

    await click('icon-tab-comments');
    await evaluate(`document.getElementById('viewerContainer').scrollTop = 180`);
    const before = await evaluate(`document.getElementById('viewerContainer').scrollTop`);
    await click('focus_mode_toggle');
    assert.deepEqual(await evaluate(`(() => {
        const r = document.getElementById('viewerContainer').getBoundingClientRect();
        return [r.top, r.left, r.width, r.height];
    })()`), [0, 0, 1440, 900], 'focus lends the entire viewport to reading');
    assert.equal(await evaluate(`document.getElementById('viewerContainer').scrollTop`), before, 'entering focus preserves the reading offset');
    assert.equal(await evaluate(`getComputedStyle(document.getElementById('sidebar')).display`), 'none');
    assert.equal(await evaluate(`document.activeElement.id`), 'viewerContainer');
    await click('focus-show-controls');
    assert.equal(await evaluate(`document.getElementById('focus-show-controls').getAttribute('aria-expanded')`), 'true');
    assert.notEqual(await evaluate(`getComputedStyle(document.getElementById('toolbar')).display`), 'none');
    assert.equal(await evaluate(`document.getElementById('icon-tab-comments').classList.contains('active')`), true);
    await click('focus-show-controls');
    await key('Escape', 'Escape');
    assert.equal(await evaluate(`document.body.classList.contains('focus-mode')`), false);
    assert.equal(await evaluate(`document.activeElement.id`), 'focus_mode_toggle');
    await click('close_sidebar');
    await click('findInput');
    await key('f', 'KeyF');
    assert.equal(await evaluate(`document.body.classList.contains('focus-mode')`), false, 'F does not hijack text fields');
    await evaluate(`window.testHost = document.createElement('div'); document.body.appendChild(testHost); testHost.attachShadow({ mode: 'open' }).innerHTML = '<input>'; testHost.shadowRoot.querySelector('input').focus();`);
    await key('f', 'KeyF');
    assert.equal(await evaluate(`document.body.classList.contains('focus-mode')`), false, 'F respects editors inside popup shadow DOM');
    await evaluate(`testHost.remove(); document.getElementById('viewerContainer').focus()`);
    await key('f', 'KeyF');
    assert.equal(await evaluate(`document.body.classList.contains('focus-mode')`), true, 'F enters focus outside text fields');
    await key('f', 'KeyF', 2);
    assert.equal(await evaluate(`document.activeElement.id`), 'findInput', 'Ctrl+F reveals an accessible search field');
    assert.equal(await evaluate(`document.getElementById('icon-tab-search').getAttribute('aria-expanded')`), 'true');
    await search('needle');
    assert.equal(await evaluate(`document.querySelectorAll('.search-result-card').length`), 100, 'large result sets have bounded DOM size');
    assert.equal(await evaluate(`document.getElementById('findResults').textContent`), '1 / 180');
    assert.equal(await evaluate(`document.activeElement.id`), 'findInput', 'search does not steal typing focus');
    assert.ok(await evaluate(`document.querySelector('.search-result-snippet').textContent.includes('<b>literal text</b>')`));
    assert.equal(await evaluate(`document.querySelectorAll('.search-result-snippet b').length`), 0, 'PDF content is text, not HTML');
    await key('ArrowDown', 'ArrowDown');
    assert.equal(await evaluate(`document.activeElement.dataset.matchIndex`), '0', 'Arrow Down reaches results directly from Find');
    await chooseResult(29);
    assert.equal(await evaluate(`document.body.classList.contains('focus-controls-visible')`), false, 'choosing a passage resumes focused reading');
    await waitFor(visibleMatch);
    await screenshot('pdf-focus-light');
    await key('Escape', 'Escape');
    assert.equal(await evaluate(`document.body.classList.contains('focus-mode')`), false);
    await click('search-results-next');
    assert.equal(await evaluate(`document.querySelectorAll('.search-result-card').length`), 80);
    assert.equal(await evaluate(`document.getElementById('search-result-range').textContent`), '101–180 of 180');
    await chooseResult(179);
    await waitFor(visibleMatch);
    assert.equal(await evaluate(`document.getElementById('findResults').textContent`), '180 / 180');
    await click('findNext');
    assert.equal(await evaluate(`document.getElementById('findResults').textContent`), '1 / 180');
    assert.equal(await evaluate(`document.querySelector('[data-match-index="0"]').getAttribute('aria-current')`), 'true');
    await screenshot('pdf-search-light');
    await click('dark_mode_toggle');
    await screenshot('pdf-search-dark');
    await search('absent-word');
    assert.equal(await evaluate(`document.querySelectorAll('.search-result-card').length`), 0);
    assert.match(await evaluate(`document.getElementById('search-panel-status').textContent`), /No matches/);
    await search('<b>');
    assert.equal(await evaluate(`document.querySelector('.search-result-snippet mark').textContent`), '<b>');
    await evaluate(`document.getElementById('findInput').value = ''; document.getElementById('findInput').dispatchEvent(new Event('input'))`);
    assert.equal(await evaluate(`document.querySelectorAll('.search-result-card, .search-highlight').length`), 0);
    assert.match(await evaluate(`document.getElementById('search-panel-status').textContent`), /press Enter/);

    for (const width of [390, 320]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
        await pause(150);
        await click('fit_width');
        await pause(250);
        await search('needle');
        assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth`), false);
        await chooseResult(0);
        assert.equal(await evaluate(`document.getElementById('sidebar').classList.contains('hidden')`), true, 'mobile selection closes the overlapping results panel');
        await waitFor(visibleMatch);
        await click('focus_mode_toggle');
        await pause(250);
        await waitFor(visibleMatch);
        assert.ok(await evaluate(`(() => { const r = document.getElementById('focus-controls').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`));
        await screenshot('pdf-focus-dark-' + width);
        await click('focus-exit');
        await waitFor(`!document.body.classList.contains('focus-mode')`);
        await evaluate(`document.getElementById('findInput').value = ''; document.getElementById('findInput').dispatchEvent(new Event('input'))`);
    }
    console.log('Focus mode and search panel passed: keyboard, preserved position, safe snippets, pagination, exact matches, empty states and mobile reading.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    ws?.close();
    if (tab) await fetch('http://127.0.0.1:9333/json/close/' + tab.id).catch(() => {});
});
