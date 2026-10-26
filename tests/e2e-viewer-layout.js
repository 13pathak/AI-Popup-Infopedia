// Real-browser checks for the responsive PDF workspace and page controls.
// Run via run-all.js, or with the test server / browser on ports 8793 / 9333.
// VIEWER_SCREENSHOT_DIR optionally saves visual QA captures outside the repo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
        const el = document.getElementById(${JSON.stringify(id)});
        const r = el.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        if (!el.contains(document.elementFromPoint(x, y))) throw new Error('Obscured control: ' + el.id);
        return { x, y };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await pause(120);
}
async function screenshot(name) {
    if (!process.env.VIEWER_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.VIEWER_SCREENSHOT_DIR, { recursive: true });
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.VIEWER_SCREENSHOT_DIR, name + '.png'), Buffer.from(data, 'base64'));
}

async function run() {
    tab = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = event => {
        const message = JSON.parse(event.data), p = pending.get(message.id);
        if (p) { pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); }
    };
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.clear(); localStorage.setItem('uiTheme', 'light');` });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:8793/pdf/web/custom-viewer.html?file=/tests/test_highlight.pdf' });
    await waitFor(`!!document.querySelector('.page .textLayer span') && !document.getElementById('next_page').disabled`);
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate(`document.getElementById('document-title').textContent`), 'test_highlight.pdf');
    assert.equal(await evaluate(`document.getElementById('previous_page').disabled`), true);
    await click('next_page');
    await waitFor(`document.getElementById('page_num').value === '2'`);
    await click('next_page');
    await waitFor(`document.getElementById('page_num').value === '3' && document.getElementById('next_page').disabled`);
    await click('previous_page');
    await waitFor(`document.getElementById('page_num').value === '2' && !document.getElementById('next_page').disabled`);
    await evaluate(`const pageInput = document.getElementById('page_num'); pageInput.value = '1'; pageInput.dispatchEvent(new Event('change'));`);
    await waitFor(`document.getElementById('previous_page').disabled`);

    for (const dark of [false, true]) {
        if (dark) await click('dark_mode_toggle');
        assert.equal(await evaluate(`document.body.classList.contains('dark-mode')`), dark);
        assert.equal(await evaluate(`document.getElementById('dark_mode_toggle').getAttribute('aria-pressed')`), String(dark));
        for (const width of [1440, 1024, 800, 640, 390, 320]) {
            await send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: false });
            await pause(180);
            const layout = await evaluate(`(() => {
                const toolbar = document.getElementById('toolbar').getBoundingClientRect();
                const viewer = document.getElementById('viewerContainer').getBoundingClientRect();
                const controls = [...document.querySelectorAll('#toolbar button, #toolbar input')]
                    .filter(el => !el.closest('#export-format-menu'));
                return {
                    overflow: document.documentElement.scrollWidth > innerWidth,
                    overlapsViewer: toolbar.bottom > viewer.top + 1,
                    clipped: controls.filter(el => {
                        const r = el.getBoundingClientRect();
                        return r.width < 20 || r.x < 0 || r.right > innerWidth || r.top < 0 || r.bottom > toolbar.bottom;
                    }).map(el => el.id),
                    covered: controls.filter(el => {
                        if (el.disabled) return false;
                        const r = el.getBoundingClientRect();
                        return !el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
                    }).map(el => el.id)
                };
            })()`);
            assert.deepEqual(layout, { overflow: false, overlapsViewer: false, clipped: [], covered: [] }, `toolbar ${width}px, dark=${dark}`);
            await click('export_toggle');
            assert.equal(await evaluate(`(() => { const r = document.getElementById('export-format-menu').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()`), true, 'export menu remains on screen');
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            assert.equal(await evaluate(`document.getElementById('export_toggle').getAttribute('aria-expanded')`), 'false');
            await click('icon-tab-comments');
            assert.equal(await evaluate(`document.getElementById('icon-tab-comments').getAttribute('aria-expanded')`), 'true');
            assert.equal(await evaluate(`(() => {
                const panel = document.getElementById('sidebar').getBoundingClientRect();
                const rail = document.getElementById('sidebar-icons').getBoundingClientRect();
                return panel.left >= 0 && panel.right <= rail.left + 1 && panel.bottom <= innerHeight;
            })()`), true, 'sidebar stays within reading area');
            if ([1440, 390].includes(width)) await screenshot(`viewer-${dark ? 'dark' : 'light'}-${width}`);
            await click('close_sidebar');
            assert.equal(await evaluate(`document.activeElement.id`), 'icon-tab-comments', 'closing the panel returns keyboard focus');
            assert.equal(await evaluate(`document.getElementById('icon-tab-comments').getAttribute('aria-expanded')`), 'false');
            assert.equal(await evaluate(`(() => {
                const viewer = document.getElementById('viewerContainer');
                viewer.scrollLeft = 0;
                return document.querySelector('.page').getBoundingClientRect().left >= viewer.getBoundingClientRect().left;
            })()`), true, 'the left edge of an oversized page remains reachable');
        }
    }
    await click('fit_width');
    await pause(300);
    assert.equal(await evaluate(`document.getElementById('fit_width').getAttribute('aria-pressed')`), 'true');
    assert.equal(await evaluate(`(() => {
        const page = document.querySelector('.page').getBoundingClientRect();
        const viewer = document.getElementById('viewerContainer').getBoundingClientRect();
        return page.left >= viewer.left && page.right <= viewer.right;
    })()`), true, 'fit width uses the remaining document area on narrow screens');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
    await click('fit_page');
    await pause(300);
    assert.equal(await evaluate(`document.getElementById('fit_page').getAttribute('aria-pressed')`), 'true');
    assert.equal(await evaluate(`document.querySelector('.page').clientHeight <= document.getElementById('viewerContainer').clientHeight`), true);
    await click('zoom_in');
    await pause(300);
    assert.equal(await evaluate(`document.querySelectorAll('.fit-button[aria-pressed="true"]').length`), 0, 'manual zoom leaves fit mode');
    await click('findInput');
    await send('Input.insertText', { text: 'alpha' });
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor(`document.querySelectorAll('.search-highlight').length > 0`);
    await evaluate(`document.getElementById('findInput').value = ''; document.getElementById('findInput').dispatchEvent(new Event('input'));`);
    assert.equal(await evaluate(`document.querySelectorAll('.search-highlight').length`), 0, 'clearing the search field clears match overlays');
    console.log('PDF workspace passed: navigation, title, search, fit controls, menus, focus, and six viewport widths in both themes.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (ws) ws.close();
    if (tab) await fetch('http://127.0.0.1:9333/json/close/' + tab.id).catch(() => {});
});
