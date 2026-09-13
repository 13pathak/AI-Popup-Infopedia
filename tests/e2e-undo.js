// CDP-driven E2E test for annotation undo/redo (issue #18).
// Drives the real viewer page in headless Edge: real DOM selection drags,
// real button clicks, real key events. Run with the viewer served on
// http://127.0.0.1:8793 and headless Edge on port 9333:
//   node tests/e2e-undo.js
const CDP_PORT = 9333;
const VIEWER_URL = 'http://127.0.0.1:8793/pdf/web/custom-viewer.html?file=/tests/test_highlight.pdf';

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evalPage(expression, awaitPromise = false) {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function mouseDrag(from, to) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 });
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
        await send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: from.x + (to.x - from.x) * i / steps,
            y: from.y + (to.y - from.y) * i / steps,
            button: 'left', buttons: 1
        });
        await sleep(15);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
    await sleep(250);
}

async function clickAt(x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(250);
}

async function key(code, key, modifiers = 0) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, key, code, windowsVirtualKeyCode: 0 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, key, code, windowsVirtualKeyCode: 0 });
    await sleep(250);
}

const CTRL = 2;

// Distinct highlight record ids present in the page overlays + full state.
const stateExpr = `(() => {
    const ids = [...document.querySelectorAll('.custom-highlight')].map(e => e.dataset.hlId);
    const undoBtn = document.getElementById('undo_annotation');
    const redoBtn = document.getElementById('redo_annotation');
    return {
        records: [...new Set(ids)].length,
        divs: ids.length,
        ids: ids.join(','),
        noteInd: document.querySelectorAll('.note-indicator').length,
        cards: document.querySelectorAll('#sidebar-content-comments .sidebar-item').length,
        bmkItems: document.querySelectorAll('#sidebar-content-bookmarks .sidebar-item').length,
        undoDisabled: undoBtn ? undoBtn.disabled : null,
        redoDisabled: redoBtn ? redoBtn.disabled : null
    };
})()`;

function assert(cond, label, extra) {
    if (!cond) {
        console.log('FAIL: ' + label + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
        process.exitCode = 1;
    } else {
        console.log('pass: ' + label);
    }
}

async function main() {
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id);
            pending.delete(m.id);
            m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        }
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: VIEWER_URL });
    await sleep(2500);

    const rendered = await evalPage(`new Promise(res => {
        const t0 = Date.now();
        const check = () => {
            const p = document.querySelector('.page[data-page-number="1"] .textLayer');
            if (p && p.querySelectorAll('span').length) res(true);
            else if (Date.now() - t0 > 8000) res(false);
            else setTimeout(check, 200);
        };
        check();
    })`, true);
    assert(rendered, 'page 1 rendered with text layer');

    let s = await evalPage(stateExpr);
    assert(s.undoDisabled === true && s.redoDisabled === true, 'buttons disabled at baseline', s);

    // ---- Test 1: highlight create -> undo -> redo ----
    // Coordinates must stay inside the visible viewport: the page can be
    // wider than it at high zoom (spans start at negative x), and CDP
    // clamps off-viewport points into a much larger selection.
    const coords = await evalPage(`(() => {
        const span = document.querySelector('.page[data-page-number="1"] .textLayer span');
        const r = span.getBoundingClientRect();
        const vc = document.getElementById('viewerContainer').getBoundingClientRect();
        const y = Math.round(r.top + r.height / 2);
        const x1 = Math.max(Math.round(r.left + 2), Math.round(vc.left) + 30);
        const x2 = Math.min(Math.round(r.left + r.width * 0.9), Math.round(vc.right) - 30);
        return { x1, y, x2: Math.max(x2, x1 + 60) };
    })()`);
    await mouseDrag({ x: coords.x1, y: coords.y }, { x: coords.x2, y: coords.y });
    let selCheck = await evalPage(`window.getSelection().toString()`);
    assert(selCheck.length > 0 && !selCheck.includes('\n'), 'single-line selection made', selCheck);
    let pickerOpen = await evalPage(`!document.getElementById('color-picker-popup').classList.contains('hidden')`);
    assert(pickerOpen, 'color picker opened after selection');

    const btnPos = await evalPage(`(() => {
        const b = document.querySelector('#color-picker-popup .color-btn');
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await clickAt(btnPos.x, btnPos.y);

    s = await evalPage(stateExpr);
    console.log('  after create:', JSON.stringify(s));
    assert(s.records === 1, 'one highlight record created', s);
    assert(s.cards === 1, 'sidebar card rendered', s);
    assert(s.undoDisabled === false, 'undo enabled after create', s);

    await key('KeyZ', 'z', CTRL);
    s = await evalPage(stateExpr);
    console.log('  after undo:', JSON.stringify(s));
    assert(s.records === 0, 'undo removed highlight', s);
    assert(s.cards === 0, 'sidebar card gone after undo', s);
    assert(s.undoDisabled === true && s.redoDisabled === false, 'stacks after undo', s);

    await key('KeyY', 'y', CTRL);
    s = await evalPage(stateExpr);
    console.log('  after redo:', JSON.stringify(s));
    assert(s.records === 1, 'redo restored highlight', s);
    assert(s.cards === 1, 'sidebar card back after redo', s);
    assert(s.undoDisabled === false && s.redoDisabled === true, 'stacks after redo', s);

    // ---- Test 2: delete via trash -> undo -> redo ----
    const hlPos = await evalPage(`(() => {
        const d = document.querySelector('.custom-highlight');
        const r = d.getBoundingClientRect();
        return {
            x: Math.min(Math.max(Math.round(r.left + r.width / 2), 60), Math.round(window.innerWidth) - 60),
            y: Math.round(r.top + r.height / 2)
        };
    })()`);
    await clickAt(hlPos.x, hlPos.y);
    const editVisible = await evalPage(`!document.getElementById('edit-highlight-popup').classList.contains('hidden')`);
    assert(editVisible, 'edit popup opened on highlight click');

    await evalPage(`document.getElementById('edit-btn-trash').click()`);
    await sleep(300);
    s = await evalPage(stateExpr);
    console.log('  after trash:', JSON.stringify(s));
    assert(s.records === 0, 'trash deleted highlight (no leftover divs)', s);
    assert(s.undoDisabled === false, 'undo enabled after delete', s);

    await key('KeyZ', 'z', CTRL);
    s = await evalPage(stateExpr);
    console.log('  after undo delete:', JSON.stringify(s));
    assert(s.records === 1, 'undo restored deleted highlight', s);

    await key('KeyY', 'y', CTRL);
    s = await evalPage(stateExpr);
    console.log('  after redo delete:', JSON.stringify(s));
    assert(s.records === 0, 'redo re-deleted highlight', s);

    await key('KeyZ', 'z', CTRL);
    s = await evalPage(stateExpr);
    assert(s.records === 1, 'undo again -> highlight back', s);

    // ---- Test 3: recolor via edit popup ----
    const colorBefore = await evalPage(`getComputedStyle(document.querySelector('.custom-highlight')).backgroundColor`);
    await clickAt(hlPos.x, hlPos.y);
    await evalPage(`document.getElementById('edit-btn-color').click()`);
    await sleep(200);
    const pos2 = await evalPage(`(() => {
        const b = document.querySelectorAll('#color-picker-popup .color-btn')[4];
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await clickAt(pos2.x, pos2.y);
    const colorAfter = await evalPage(`getComputedStyle(document.querySelector('.custom-highlight')).backgroundColor`);
    assert(colorBefore !== colorAfter, 'recolor changed color', { colorBefore, colorAfter });

    await key('KeyZ', 'z', CTRL);
    const colorUndone = await evalPage(`getComputedStyle(document.querySelector('.custom-highlight')).backgroundColor`);
    assert(colorUndone === colorBefore, 'undo restored original color', { colorUndone, colorBefore });
    await key('KeyY', 'y', CTRL);
    const colorRedone = await evalPage(`getComputedStyle(document.querySelector('.custom-highlight')).backgroundColor`);
    assert(colorRedone === colorAfter, 'redo restored new color', { colorRedone, colorAfter });

    // ---- Test 3b: markup type conversion -> undo ----
    await clickAt(hlPos.x, hlPos.y);
    await evalPage(`document.getElementById('edit-btn-color').click()`);
    await sleep(200);
    await evalPage(`document.querySelector('.markup-tool-btn[data-type="Underline"]').click()`);
    await sleep(200);
    let cls = await evalPage(`document.querySelector('.custom-highlight').className`);
    assert(cls.includes('markup-underline'), 'type converted to underline', cls);
    await evalPage(`document.getElementById('close-color-picker').click()`);
    await sleep(200);
    await key('KeyZ', 'z', CTRL);
    cls = await evalPage(`document.querySelector('.custom-highlight').className`);
    assert(!cls.includes('markup-underline'), 'undo restored highlight type', cls);
    await key('KeyY', 'y', CTRL);
    cls = await evalPage(`document.querySelector('.custom-highlight').className`);
    assert(cls.includes('markup-underline'), 'redo re-applied underline', cls);

    // ---- Test 4: note add -> one undo step for the whole burst ----
    await clickAt(hlPos.x, hlPos.y);
    await evalPage(`document.getElementById('edit-btn-note').click()`);
    await sleep(200);
    await evalPage(`(() => {
        const el = document.getElementById('note-textarea');
        el.focus();
        document.execCommand('insertText', false, 'first burst');
        el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(600); // autosave flush fires between bursts
    await evalPage(`(() => {
        const el = document.getElementById('note-textarea');
        document.execCommand('insertText', false, ' second burst');
        el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(600);
    let noteState = await evalPage(`(() => {
        return { text: document.getElementById('note-textarea').textContent, ind: document.querySelectorAll('.note-indicator').length };
    })()`);
    assert(noteState.text.includes('second burst'), 'note text typed', noteState);
    assert(noteState.ind === 1, 'note indicator appeared', noteState);

    await evalPage(`document.getElementById('note-btn-save').click()`);
    await sleep(400);

    await key('KeyZ', 'z', CTRL);
    noteState = await evalPage(`document.querySelectorAll('.note-indicator').length`);
    assert(noteState === 0, 'one undo removed the whole note (coalesced bursts)', noteState);
    await key('KeyY', 'y', CTRL);
    noteState = await evalPage(`document.querySelectorAll('.note-indicator').length`);
    assert(noteState === 1, 'redo restored the note', noteState);

    // ---- Test 5: bookmark create -> undo -> redo ----
    await evalPage(`document.getElementById('bookmark_page').click()`);
    await sleep(300);
    const confirmed = await evalPage(`(() => {
        const btn = document.querySelector('#viewer-modal-overlay .viewer-modal-confirm, #viewer-modal-overlay button');
        if (!btn) return false;
        btn.click();
        return true;
    })()`);
    assert(confirmed, 'bookmark dialog confirmed');
    await sleep(400);
    s = await evalPage(stateExpr);
    console.log('  after bookmark create:', JSON.stringify(s));
    assert(s.bmkItems === 1, 'bookmark item rendered', s);

    await key('KeyZ', 'z', CTRL);
    s = await evalPage(stateExpr);
    console.log('  after bookmark undo:', JSON.stringify(s));
    assert(s.bmkItems === 0, 'undo removed bookmark', s);
    await key('KeyY', 'y', CTRL);
    s = await evalPage(stateExpr);
    assert(s.bmkItems === 1, 'redo restored bookmark', s);

    // ---- Test 5b: bookmark rename -> undo ----
    await evalPage(`(() => {
        const inp = document.querySelector('#sidebar-content-bookmarks .sidebar-item input');
        inp.value = 'Renamed chapter';
        inp.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(200);
    let bmkTitle = await evalPage(`document.querySelector('#sidebar-content-bookmarks .sidebar-item input').value`);
    assert(bmkTitle === 'Renamed chapter', 'bookmark renamed', bmkTitle);
    await key('KeyZ', 'z', CTRL);
    bmkTitle = await evalPage(`document.querySelector('#sidebar-content-bookmarks .sidebar-item input').value`);
    assert(bmkTitle === 'Page 1', 'undo restored bookmark title', bmkTitle);
    await key('KeyY', 'y', CTRL);
    bmkTitle = await evalPage(`document.querySelector('#sidebar-content-bookmarks .sidebar-item input').value`);
    assert(bmkTitle === 'Renamed chapter', 'redo restored new title', bmkTitle);

    // ---- Test 6: Ctrl+Z while typing in an input must not fire annotation undo ----
    await evalPage(`document.getElementById('findInput').focus()`);
    const before = await evalPage(stateExpr);
    await key('KeyZ', 'z', CTRL);
    const after = await evalPage(stateExpr);
    assert(after.bmkItems === before.bmkItems && after.undoDisabled === before.undoDisabled,
        'Ctrl+Z inside input did not trigger annotation undo', { before, after });
    // Outside inputs it must work again (top entry here is the rename).
    await evalPage(`document.getElementById('findInput').blur()`);
    await key('KeyZ', 'z', CTRL);
    const titleAfterOutside = await evalPage(`document.querySelector('#sidebar-content-bookmarks .sidebar-item input').value`);
    assert(titleAfterOutside === 'Page 1', 'Ctrl+Z outside input still undoes (rename reverted)', titleAfterOutside);
    await key('KeyY', 'y', CTRL);

    // ---- Test 7: multi-page selection -> ONE undo removes all fragments ----
    // Synthetic CDP drags don't auto-scroll across the page break, so the
    // cross-page selection is laid down as a real DOM range over both
    // pages' text layers and fed through the viewer's genuine mouseup
    // handler (same path a real selection takes). Record counts come
    // from the sidebar cards (overlays are viewport-dependent).
    await evalPage(`(() => {
        const s1 = document.querySelectorAll('.page[data-page-number="1"] .textLayer span')[1];
        const s2 = document.querySelector('.page[data-page-number="2"] .textLayer span');
        const range = document.createRange();
        range.setStartBefore(s1.firstChild);
        range.setEndAfter(s2.firstChild);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const vc = document.getElementById('viewerContainer');
        vc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 600, clientY: 300 }));
    })()`);
    await sleep(500);
    selCheck = await evalPage(`window.getSelection().toString()`);
    assert(selCheck.includes('\n') && selCheck.includes('Page two'), 'cross-page selection made', selCheck);
    pickerOpen = await evalPage(`!document.getElementById('color-picker-popup').classList.contains('hidden')`);
    assert(pickerOpen, 'picker opened for cross-page selection');
    // The picker reopened at the new selection's end; recompute its swatch.
    const btnPos2 = await evalPage(`(() => {
        const b = document.querySelector('#color-picker-popup .color-btn');
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await clickAt(btnPos2.x, btnPos2.y);
    s = await evalPage(stateExpr);
    console.log('  after multi-page create:', JSON.stringify(s));
    const cardsAfterCreate = s.cards;
    assert(cardsAfterCreate >= 3, 'multi-page selection created highlights on several pages', s);

    await key('KeyZ', 'z', CTRL);
    s = await evalPage(stateExpr);
    assert(s.cards === 1, 'single undo removed ALL records from the multi-page create', s);
    await key('KeyY', 'y', CTRL);
    s = await evalPage(stateExpr);
    assert(s.cards === cardsAfterCreate, 'redo restored all of them', s);

    s = await evalPage(stateExpr);
    console.log('final state:', JSON.stringify(s));
    console.log(process.exitCode ? 'E2E FAILED' : 'E2E PASSED');
    ws.close();
    process.exit(process.exitCode || 0);
}

main().catch(e => { console.error('E2E ERROR:', e.message); process.exit(1); });
