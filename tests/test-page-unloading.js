// node tests/test-page-unloading.js
// Run the real observer/render/unload functions with deferred PDF.js tasks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8').replace(/\r\n/g, '\n');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function harness() {
    const canvases = [], errors = [];
    let observer, overlays = 0;
    function element(tagName) {
        const classes = new Set();
        const node = {
            tagName, dataset: {}, children: [], style: { setProperty() {} },
            classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
            appendChild(child) { child.remove(); this.children.push(child); child.parentNode = this; },
            remove() {
                if (this.parentNode) {
                    this.parentNode.children = this.parentNode.children.filter(child => child !== this);
                    this.parentNode = null;
                }
            },
            set innerHTML(value) { assert.equal(value, ''); this.children.forEach(child => { child.parentNode = null; }); this.children = []; },
            querySelectorAll(selector) {
                return this.children.filter(child => selector === 'canvas' ? child.tagName === 'canvas' : child.className === selector.slice(1));
            },
            addEventListener() {}, getContext() { return {}; }
        };
        if (tagName === 'canvas') canvases.push(node);
        return node;
    }
    const viewport = scale => ({ width: 100 * scale, height: 200 * scale, scale,
        convertToViewportPoint: (x, y) => [x * scale, (200 - y) * scale] });
    const context = vm.createContext({
        console: { error(...args) { errors.push(args); } },
        document: { createElement: element, getElementById: () => ({}) },
        window: { devicePixelRatio: 1 },
        IntersectionObserver: class { constructor(callback) { observer = callback; } },
        getAnnotationRenderPage: async page => page,
        pdfjsLib: {
            AnnotationMode: { ENABLE_STORAGE: 3 },
            TextLayer: class {
                constructor({ container }) { this.page = container.parentNode._pdfPage; }
                render() { return this.page.jobs.at(-1).text.promise; }
            }
        },
        drawHighlightsForPage() { overlays++; }, drawSearchHighlightsForPage() { overlays++; }
    });
    for (const name of ['renderPageContent', 'unloadPageContent', 'renderLinkAnnotations']) {
        const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
        assert.ok(start >= 0, name);
        vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
    }
    const observerStart = source.indexOf('const pageObserver = new IntersectionObserver');
    vm.runInContext(source.slice(observerStart, source.indexOf('\n});', observerStart) + 4), context);
    return { canvases, errors, element, viewport,
        get overlays() { return overlays; },
        observe(page, visible) { observer([{ target: page, isIntersecting: visible }]); },
        page(number = 1, annotations = Promise.resolve([])) {
            const page = element('div');
            page.dataset = { pageNumber: String(number), loaded: 'false' };
            page._viewport = viewport(1);
            page._pdfPage = {
                pageNumber: number, jobs: [],
                getTextContent: async () => ({ items: [], styles: {} }),
                getAnnotations: () => annotations,
                render() {
                    const job = { raster: deferred(), text: deferred() };
                    this.jobs.push(job);
                    return { promise: job.raster.promise };
                }
            };
            return page;
        },
        async finish(page) {
            const job = page._pdfPage.jobs.at(-1);
            job.raster.resolve(); job.text.resolve();
            await tick();
        }
    };
}

(async () => {
    const h = harness();
    const page = h.page();
    h.observe(page, true);
    await tick();
    const canvas = page.querySelectorAll('canvas')[0];
    h.observe(page, false);
    assert.equal(page.dataset.loaded, 'rendering');
    assert.ok(canvas.width > 0, 'never zero a canvas while PDF.js is drawing');
    page._pdfPage.jobs[0].raster.resolve();
    await tick();
    assert.equal(page.dataset.loaded, 'rendering', 'wait for text rendering too');
    page._viewport = h.viewport(1.5);
    await h.finish(page);
    assert.equal(page.dataset.loaded, 'false', 'offscreen completion unloads without another observer event');
    assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
    assert.equal(page.children.length, 0);
    assert.equal(h.overlays, 0, 'offscreen completion skips overlay work');
    assert.equal(page._pdfPage.jobs.length, 1, 'offscreen initial renders do not retry a changed viewport');

    // Re-entry while work is in flight cancels the unload intention.
    h.observe(page, true);
    await tick();
    h.observe(page, false);
    h.observe(page, true);
    await h.finish(page);
    assert.equal(page.dataset.loaded, 'true');
    assert.equal(page._pdfPage.jobs.length, 2, 're-entry reuses the in-flight render');
    assert.ok(page.querySelectorAll('canvas')[0].width > 0);
    h.observe(page, false);
    assert.equal(page.children.length, 0, 'completed pages still unload immediately');

    // Zoom backdrops and freshly rendered canvases both release backing memory.
    const zoom = h.page(2), backdrop = h.element('canvas');
    backdrop.width = 100; backdrop.height = 200;
    zoom.appendChild(backdrop);
    zoom.dataset.rescale = 'true'; zoom.classList.add('zoom-transition');
    h.observe(zoom, true);
    await tick();
    const zoomCanvases = zoom.querySelectorAll('canvas');
    assert.equal(zoomCanvases.length, 2);
    zoom._viewport = h.viewport(2); // Another zoom during this render.
    h.observe(zoom, false);
    await h.finish(zoom);
    assert.equal(zoom._pdfPage.jobs.length, 1, 'offscreen pages do not retry a stale viewport');
    assert.ok(zoomCanvases.every(c => c.width === 0 && c.height === 0));
    assert.equal(zoom.dataset.rescale, undefined);
    assert.ok(!zoom.classList.contains('zoom-transition'));
    h.observe(zoom, true);
    await tick(); await h.finish(zoom);
    assert.equal(zoom.dataset.loaded, 'true');
    assert.equal(zoom.querySelectorAll('canvas')[0].width, 200, 're-entry renders the newest scale');
    h.observe(zoom, false);

    // A zoom-marked page can leave the buffer before its fresh render starts.
    const waiting = h.page(3), stale = h.element('canvas');
    stale.width = 300; stale.height = 600;
    waiting.appendChild(stale); waiting.dataset.rescale = 'true';
    h.observe(waiting, false);
    assert.equal(stale.width, 0);
    assert.equal(waiting.children.length, 0);

    // Visible zoom retries still complete, rather than leaving a blank page.
    const visibleZoom = h.page(4);
    h.observe(visibleZoom, true); await tick();
    visibleZoom._viewport = h.viewport(2);
    await h.finish(visibleZoom);
    assert.equal(visibleZoom._pdfPage.jobs.length, 2);
    await h.finish(visibleZoom);
    assert.equal(visibleZoom.dataset.loaded, 'true');
    h.observe(visibleZoom, false);

    // Delayed link annotation work must not repopulate an unloaded page.
    const annotations = deferred(), linked = h.page(5, annotations.promise);
    h.observe(linked, true); await tick(); await h.finish(linked);
    h.observe(linked, false);
    annotations.resolve([{ subtype: 'Link', rect: [10, 20, 30, 40], url: 'https://example.com' }]);
    await tick();
    assert.equal(linked.children.length, 0);

    // Simulate scrolling rapidly through a batch before any page finishes.
    const batchCanvasStart = h.canvases.length;
    const pages = Array.from({ length: 30 }, (_, i) => h.page(i + 6));
    pages.forEach(p => h.observe(p, true)); await tick();
    pages.forEach(p => h.observe(p, false));
    await Promise.all(pages.map(p => h.finish(p)));
    assert.ok(pages.every(p => p.dataset.loaded === 'false' && p.children.length === 0));
    assert.ok(h.canvases.slice(batchCanvasStart).every(c => c.width === 0 && c.height === 0), 'all rapidly scrolled canvas backing stores released');
    assert.deepEqual(h.errors, []);
    console.log('Page unloading: in-flight exits, re-entry, zoom transitions, delayed links and rapid scrolling passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
