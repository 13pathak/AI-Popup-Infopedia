// node tests/test-initial-navigation.js
// Real load/deep-link/hashchange logic with controllable PDF resolution and timers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8').replace(/\r\n/g, '\n');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function harness({ hash = '', resumePage = 1, ratio = null, destination, pageIndex, build, loading } = {}) {
    const jumps = [], timers = [], errors = [], destinationCalls = [];
    const container = { scrollHeight: 1000, scrollTop: 0 };
    let hashListener, mergeOffers = 0;
    const doc = {
        numPages: 10, getOutline: async () => [],
        getDestination(name) { destinationCalls.push(name); return destination ? destination(name) : Promise.resolve([2]); },
        getPageIndex: pageIndex || (async () => 2)
    };
    const context = vm.createContext({
        window: { location: { hash }, addEventListener(type, listener) { if (type === 'hashchange') hashListener = listener; } },
        document: { querySelector: () => null, getElementById: () => container },
        pdfjsLib: { getDocument: () => ({ promise: loading ? loading.promise : Promise.resolve(doc) }) },
        loadStorageData: async () => {}, recoverEmbeddedAnnotations: async () => {},
        renderAllPages: () => build ? build.promise : Promise.resolve(),
        pageCountSpan: {}, renderOutline() {}, updatePageNumber() {},
        scrollToPage(page) { jumps.push(page); container.scrollTop = page * 100; },
        offerVariantAnnotationMerge() { mergeOffers++; },
        setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        console: { error(...args) { errors.push(args); } }, showLoadError(error) { errors.push(error); }
    });
    const run = code => vm.runInContext(code, context);
    run(`let pdfDoc = null, scale = 1, initialResumeSettled = false, pendingIdentityFromLoad = false;
        const fileUrl = 'https://example.com/test.pdf';
        let autoSavedLastPage = ${resumePage};
        let savedViewState = ${ratio === null ? 'null' : JSON.stringify({ zoom: 1, scrollRatio: ratio })};`);
    for (const name of ['parseDeepLinkTarget', 'resolveDeepLinkPage', 'loadPDF']) {
        const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
        assert.ok(start >= 0);
        run(source.slice(start, source.indexOf('\n}', start) + 2));
    }
    const start = source.indexOf('let deepLinkGeneration = 0;');
    run(source.slice(start, source.indexOf('\nloadPDF();', start)));
    return { run, doc, jumps, container, destinationCalls,
        load: () => context.loadPDF(),
        async changeHash(hash) { context.window.location.hash = hash; hashListener(); await tick(); },
        fireTimers() {
            timers.splice(0).forEach(({ callback }) => callback());
            assert.deepEqual(errors, []);
        },
        get mergeOffers() { return mergeOffers; }
    };
}

(async () => {
    // Initial named destination lookup must not claim the newer generation
    // when its old result finally arrives (including unknown/failed lookups).
    for (const result of ['page', 'missing', 'error']) {
        const destination = deferred();
        const h = harness({ hash: '#OldChapter', resumePage: 5, ratio: 0.6, destination: () => destination.promise });
        const loaded = h.load();
        await tick();
        assert.deepEqual(h.destinationCalls, ['OldChapter']);
        await h.changeHash('#page=7');
        assert.deepEqual(h.jumps, [7]);
        if (result === 'error') destination.reject(new Error('unknown destination'));
        else destination.resolve(result === 'page' ? [2] : null);
        await loaded;
        h.fireTimers();
        assert.deepEqual(h.jumps, [7], `late ${result} result must not navigate backward`);
        assert.equal(h.container.scrollTop, 700, 'stale resolution must not fall back to the saved ratio');
        assert.equal(h.run('initialResumeSettled'), true, 'cancelled initial navigation releases the save gate');
        assert.equal(h.mergeOffers, 1, 'cancellation does not skip other post-load work');
    }

    const index = deferred();
    const indexed = harness({ hash: '#OldChapter', destination: async () => [{ num: 42, gen: 0 }], pageIndex: () => index.promise });
    const indexedLoad = indexed.load(); await tick();
    await indexed.changeHash('#page=8');
    index.resolve(2); await indexedLoad; indexed.fireTimers();
    assert.deepEqual(indexed.jumps, [8], 'cancellation also covers asynchronous page-index lookup');

    // Every initial timer uses the same guard, including legacy page-only
    // resume and a hash that is cleared or becomes unusable before it fires.
    for (const options of [{ hash: '#page=3' }, { resumePage: 5 }, { ratio: 0.6 }]) {
        for (const newHash of ['#page=7', '#page=abc', '']) {
            const h = harness(options);
            await h.load();
            assert.equal(h.run('initialResumeSettled'), false);
            await h.changeHash(newHash);
            h.fireTimers();
            assert.deepEqual(h.jumps, newHash === '#page=7' ? [7] : []);
            assert.equal(h.container.scrollTop, newHash === '#page=7' ? 700 : 0);
            assert.equal(h.run('initialResumeSettled'), true);
        }
    }

    const build = deferred();
    const building = harness({ hash: '#page=3', build });
    const buildLoad = building.load(); await tick();
    await building.changeHash('#page=7');
    build.resolve(); await buildLoad; building.fireTimers();
    assert.deepEqual(building.jumps, [7], 'initial setup must not replay navigation already handled during the build');

    // Hash edits made before PDF.js is available still need the initial path
    // to honor the latest hash once the document can resolve it.
    const loading = deferred();
    const early = harness({ hash: '#page=3', loading });
    const earlyLoad = early.load(); await tick();
    await early.changeHash('#page=7');
    loading.resolve(early.doc); await earlyLoad; early.fireTimers();
    assert.deepEqual(early.jumps, [7]);

    // Normal initial destinations and both resume formats remain functional.
    for (const [options, jumps, scroll] of [
        [{ hash: '#OldChapter' }, [3], 300],
        [{ resumePage: 5 }, [5], 500],
        [{ ratio: 0.6 }, [], 600],
        [{}, [], 0]
    ]) {
        const h = harness(options);
        await h.load(); h.fireTimers();
        assert.deepEqual(h.jumps, jumps);
        assert.equal(h.container.scrollTop, scroll);
        assert.equal(h.run('initialResumeSettled'), true);
    }

    // Explicit destinations with zero-based page index 0 (Page 1) must navigate
    // to page 1 for both link annotations and outline items.
    {
        const jumps = [];
        const testDoc = {
            numPages: 10,
            async getDestination(name) {
                return name === 'FirstNamed' ? [0, { name: 'Fit' }] : null;
            },
            async getPageIndex(ref) {
                if (ref && ref.num === 1) return 0;
                throw new Error('Unknown ref');
            }
        };
        const makeElement = (tag = 'div') => {
            const handlers = new Map();
            const kids = [];
            const el = {
                tagName: tag.toUpperCase(),
                className: '',
                style: {},
                dataset: {},
                children: kids,
                classList: { add() {}, remove() {}, toggle() {} },
                appendChild(c) { kids.push(c); return c; },
                querySelectorAll() { return []; },
                addEventListener(type, fn) {
                    if (!handlers.has(type)) handlers.set(type, []);
                    handlers.get(type).push(fn);
                },
                async click(event = { stopPropagation() {} }) {
                    for (const fn of handlers.get('click') || []) await fn(event);
                }
            };
            return el;
        };
        const contentOutlineEl = makeElement('div');
        const context = vm.createContext({
            pdfDoc: testDoc,
            document: { createElement: makeElement },
            contentOutline: contentOutlineEl,
            scrollToPage: page => jumps.push(page),
            isSafeExternalUrl: () => false,
            console: { error(...args) { console.error('Unexpected error in test:', ...args); } }
        });
        for (const name of ['renderLinkAnnotations', 'renderOutline']) {
            const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
            assert.ok(start >= 0);
            vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
        }

        // 1. Link annotations
        for (const [dest, expectedPage, desc] of [
            [[0, { name: 'Fit' }], 1, 'explicit 0-based page index 0 links to page 1'],
            ['FirstNamed', 1, 'named destination resolving to index 0 links to page 1'],
            [[{ num: 1, gen: 0 }], 1, 'Ref resolving to index 0 links to page 1'],
            [[2, { name: 'XYZ' }], 3, 'explicit index 2 links to page 3']
        ]) {
            jumps.length = 0;
            const pageDiv = makeElement('div');
            const viewport = { convertToViewportPoint: (x, y) => [x, y] };
            pageDiv._viewport = viewport;
            const page = {
                getAnnotations: async () => [{ subtype: 'Link', rect: [0, 0, 50, 20], dest }]
            };
            await context.renderLinkAnnotations(page, pageDiv, viewport);
            const layer = pageDiv.children.find(c => c.className === 'annotationLayer');
            assert.ok(layer, 'annotation layer created');
            const linkEl = layer.children[0];
            assert.ok(linkEl, 'link element created');
            await linkEl.click();
            assert.deepEqual(jumps, [expectedPage], desc);
        }

        // Invalid link destination does not navigate
        jumps.length = 0;
        const pageDiv = makeElement('div');
        const viewport = { convertToViewportPoint: (x, y) => [x, y] };
        pageDiv._viewport = viewport;
        await context.renderLinkAnnotations({
            getAnnotations: async () => [{ subtype: 'Link', rect: [0, 0, 50, 20], dest: [] }]
        }, pageDiv, viewport);
        await pageDiv.children[0].children[0].click();
        assert.deepEqual(jumps, [], 'empty dest array does not trigger jump');

        // 2. Outline items
        for (const [dest, expectedPage, desc] of [
            [[0, { name: 'Fit' }], 1, 'explicit 0-based page index 0 in outline navigates to page 1'],
            ['FirstNamed', 1, 'named destination resolving to index 0 in outline navigates to page 1'],
            [[{ num: 1, gen: 0 }], 1, 'Ref resolving to index 0 in outline navigates to page 1'],
            [[4, { name: 'Fit' }], 5, 'explicit index 4 in outline navigates to page 5']
        ]) {
            jumps.length = 0;
            context.renderOutline([{ title: 'Item', dest }]);
            const itemDiv = contentOutlineEl.children.at(-1);
            const titleRow = itemDiv.children.find(c => c.className === 'outline-item-title');
            await titleRow.click();
            assert.deepEqual(jumps, [expectedPage], desc);
        }
    }

    console.log('Initial navigation: delayed destinations, hash races, resume timers, link/outline page 1 destinations and normal loading passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
