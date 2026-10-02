// node tests/test-deferred-navigation.js
// Exercise real navigation functions with controlled layout and animation frames.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8').replace(/\r\n/g, '\n');

function harness() {
    const frames = new Map(), pages = new Map(), scrolls = [];
    let nextFrame = 0, scrollTop = 0;
    const container = {
        scrollHeight: 10000, clientHeight: 800,
        get scrollTop() { return scrollTop; },
        set scrollTop(value) { scrollTop = value; scrolls.push(value); },
        getBoundingClientRect: () => ({ top: 0, bottom: 800 })
    };
    const context = vm.createContext({
        document: {
            getElementById: () => container,
            querySelector(selector) { return pages.get(Number(selector.match(/page-number="(\d+)"/)[1])); },
            querySelectorAll: () => []
        },
        requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame(id) { frames.delete(id); },
        setTimeout() {}
    });
    const run = code => vm.runInContext(code, context);
    run('let pdfDoc = { numPages: 10 }, activeMatchIndex = -1, searchResults = []; let pendingFlashHighlightId = null, pendingFlashHighlightUntil = 0;');
    const start = source.indexOf('const DEFERRED_SCROLL_MAX_FRAMES =');
    run(source.slice(start, source.indexOf('\nfunction drawSearchHighlightsForPage', start)));
    for (const name of ['scrollToPage', 'scrollToHighlight']) {
        const start = source.indexOf(`function ${name}(`);
        run(source.slice(start, source.indexOf('\n}', start) + 2));
    }
    return {
        run, frames, scrolls, container,
        addPage(number, top = number * 1000) {
            pages.set(number, {
                offsetTop: top,
                _viewport: { convertToViewportPoint: (x, y) => [x, y] },
                getBoundingClientRect: () => ({ top: top - scrollTop, bottom: top + 600 - scrollTop }),
                querySelectorAll: () => []
            });
        },
        frame() {
            const batch = [...frames.values()];
            frames.clear();
            batch.forEach(callback => callback());
        },
        search(page) { run(`searchResults = [{ pageNumber: ${page} }]; activeMatchIndex = 0; scrollToActiveMatch();`); }
    };
}

// Page 3 was queued without layout. Once layout appears, an immediate page 7
// jump must own the final position, even if the old frame has already retried.
for (const retry of [false, true]) {
    const h = harness();
    h.run('scrollToPage(3)');
    if (retry) h.frame();
    h.addPage(3); h.addPage(7);
    h.run('scrollToPage(7)');
    h.frame();
    assert.deepEqual(h.scrolls, [6980], 'queued page 3 must not override immediate page 7');
    assert.equal(h.frames.size, 0);
}

// Search navigation also supersedes pending page jumps, even when its result
// is already fully visible and no physical scroll is needed.
for (const visible of [false, true]) {
    const h = harness();
    h.run('scrollToPage(3)');
    h.addPage(3); h.addPage(7, visible ? 100 : 7000);
    h.search(7); h.frame();
    assert.deepEqual(h.scrolls, visible ? [] : [6980]);
    assert.equal(h.frames.size, 0);
}

// A deferred search must not override a newer page jump either.
{
    const h = harness();
    h.search(3);
    h.addPage(3); h.addPage(7);
    h.run('scrollToPage(7)'); h.frame();
    assert.deepEqual(h.scrolls, [6980]);
}

// Comment-card jumps scroll to an annotation within the page directly.
{
    const h = harness();
    h.run('scrollToPage(3)');
    h.addPage(3); h.addPage(7);
    h.run('scrollToHighlight({ id: 1, pageNumber: 7, rects: [{ pdfX: 10, pdfY: 200 }] })');
    h.frame();
    assert.deepEqual(h.scrolls, [6800]);
}

// Normal deferred jumps, including replacement by another deferred target,
// still wait for layout and then land on the newest requested page.
for (const replace of [false, true]) {
    const h = harness();
    h.run('scrollToPage(3)'); h.frame();
    assert.deepEqual(h.scrolls, []);
    if (replace) h.run('scrollToPage(7)');
    h.addPage(3); h.addPage(7); h.frame();
    assert.deepEqual(h.scrolls, [replace ? 6980 : 2980]);
    assert.equal(h.frames.size, 0);
}

// Deferred search retains its only-if-outside behavior once layout appears.
{
    const h = harness();
    h.search(3); h.addPage(3, 100); h.frame();
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.frames.size, 0);
}

// The bounded fallback remains available if layout never materializes.
{
    const h = harness();
    h.run('scrollToPage(3)');
    for (let i = 0; i < 300; i++) h.frame();
    assert.deepEqual(h.scrolls, [2000]);
    assert.equal(h.frames.size, 0);
}

console.log('Deferred navigation: newer page/search/annotation jumps win; layout waiting and fallback passed.');
