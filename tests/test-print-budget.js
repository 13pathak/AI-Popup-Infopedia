// Exercise the real print pipeline without allocating large raster buffers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8').replace(/\r\n/g, '\n');

function harness(sizes, { cancelAt, failAt } = {}) {
    const elements = new Map(), canvases = [], renders = [], overlays = [], alerts = [];
    let printCount = 0;
    const element = tag => {
        const classes = new Set(['hidden']);
        return {
            children: [], classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
            appendChild(child) { this.children.push(child); },
            set innerHTML(value) { assert.equal(value, ''); this.children = []; },
            getContext() { return {}; }
        };
    };
    const context = vm.createContext({
        console: { error() {} },
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, element('div'));
                return elements.get(id);
            },
            createElement(tag) { const el = element(tag); if (tag === 'canvas') canvases.push(el); return el; }
        },
        pdfDoc: {
            numPages: sizes.length,
            async getPage(number) {
                const [width, height] = sizes[number - 1];
                return {
                    getViewport: ({ scale }) => ({ width: width * scale, height: height * scale, scale }),
                    render(options) {
                        renders.push(options);
                        if (number === cancelAt) vm.runInContext('printJobCancelled = true', context);
                        return { promise: number === failAt ? Promise.reject(new Error('render failed')) : Promise.resolve() };
                    }
                };
            }
        },
        getAnnotationRenderPage: async page => page,
        drawPrintHighlights(ctx, viewport, number) { overlays.push({ viewport, number }); },
        pdfjsLib: { AnnotationMode: { ENABLE_STORAGE: 3 } },
        viewerModalOpen: () => false,
        viewerAlert(...args) { alerts.push(args); },
        window: { print() { printCount++; } }
    });
    vm.runInContext(source.slice(source.indexOf('const PRINT_TOTAL_PIXEL_BUDGET'), source.indexOf('// True only while printPDF')), context);
    vm.runInContext('let printFromPipeline = false, printNoticeSheet = null', context);
    const start = source.indexOf('async function printPDF()');
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
    return { canvases, renders, overlays, alerts, elements,
        run: () => vm.runInContext('printPDF()', context),
        get printCount() { return printCount; },
        get budget() { return vm.runInContext('PRINT_TOTAL_PIXEL_BUDGET', context); },
        get busy() { return vm.runInContext('printInProgress', context); }
    };
}

(async () => {
    for (const sizes of [
        [[612, 792]],
        Array.from({ length: 500 }, () => [612, 792]),
        [[200, 300], [20000, 20000], [100000, 100], [792, 612]],
        Array.from({ length: 800 }, (_, i) => i % 2 ? [2000, 3000] : [612, 792])
    ]) {
        const h = harness(sizes);
        await h.run();
        const totalPixels = h.canvases.reduce((sum, c) => sum + c.width * c.height, 0);
        assert.ok(totalPixels <= h.budget, `${sizes.length} pages exceed the total budget: ${totalPixels}`);
        assert.ok(h.canvases.every(c => c.width > 0 && c.height > 0 && c.width <= 65535 && c.height <= 65535 && c.width * c.height <= 2 ** 28));
        assert.equal(h.printCount, 1);
        assert.equal(h.elements.get('print-container').children.length, sizes.length);
        assert.equal(h.overlays.length, sizes.length, 'every printed page retains annotations');
        assert.ok(h.renders.every(r => r.intent === 'print' && r.annotationMode === 3));
        assert.ok(h.overlays.every((o, i) => o.viewport === h.renders[i].viewport));
        if (sizes.length === 1) assert.equal(h.renders[0].viewport.scale, 3, 'short documents keep full print resolution');
        assert.equal(h.busy, false);
        assert.ok(h.elements.get('print-overlay').classList.contains('hidden'));
    }
    for (const options of [{ cancelAt: 2 }, { failAt: 2 }]) {
        const h = harness(Array.from({ length: 3 }, () => [612, 792]), options);
        await h.run();
        assert.equal(h.printCount, 0, 'incomplete jobs never print');
        assert.equal(h.elements.get('print-container').children.length, 0, 'incomplete jobs release retained pages');
        assert.equal(h.alerts.length, options.failAt ? 1 : 0);
        assert.equal(h.busy, false);
    }
    console.log('Print budget: long/mixed-size documents, raster limits, annotations, cancellation and failures passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
