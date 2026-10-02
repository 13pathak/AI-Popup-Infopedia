// node tests/test-search-geometry.js
// Real PDF.js text transforms and viewports, using the viewer's search and
// overlay functions. Only the DOM and search navigation controls are stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PDFLib = require('../pdf-lib.min.js');
const source = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8');
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-5,
    `${label}: expected ${expected}, got ${actual}`);

(async () => {
    const pdfjs = await import('../pdf/build/pdf.mjs');
    const pdf = await PDFLib.PDFDocument.create();
    const font = await pdf.embedFont(PDFLib.StandardFonts.Courier);
    const angles = [0, 90, 180, 270, 30];
    for (const angle of angles) {
        pdf.addPage([400, 400]).drawText('ABCDE', { x: 100, y: 100, size: 20, font, rotate: PDFLib.degrees(angle) });
    }
    const doc = await pdfjs.getDocument({ data: await pdf.save(), disableFontFace: true, useSystemFonts: true,
        isEvalSupported: false }).promise;
    try {
        const pages = [], content = [];
        for (let i = 1; i <= angles.length; i++) {
            const page = await doc.getPage(i);
            pages.push(page); content.push(await page.getTextContent());
        }
        const originalTransforms = content.map(c => c.items.map(item => item.transform.slice()));
        const context = vm.createContext({
            pdfDoc: { numPages: pages.length, getPage: async n => ({ getTextContent: async () => content[n - 1] }) },
            document: { createElement: () => ({ style: {}, classList: { add() {} } }) },
            findResultsSpan: { textContent: '' },
            updateSearchUI() {}, renderAllSearchHighlights() {}, scrollToActiveMatch() {}
        });
        const run = code => vm.runInContext(code, context);
        run("let searchGeneration = 0, currentSearchQuery = '', searchResults = [], activeMatchIndex = -1;");
        for (const name of ['buildPageText', 'performSearch', 'drawSearchHighlightsForPage']) {
            const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
            assert.ok(start >= 0, name);
            run(source.slice(start, source.indexOf('\n}', start) + 2));
        }
        for (const [query, offsetChars] of [['DE', 3], ['BC', 1], ['AB', 0], ['ABCDE', 0]]) {
            await context.performSearch(query);
            assert.equal(run('searchResults.length'), angles.length);
            for (let i = 0; i < angles.length; i++) {
                const angle = angles[i] * Math.PI / 180;
                const offset = font.widthOfTextAtSize('ABCDE'.slice(0, offsetChars), 20);
                const width = font.widthOfTextAtSize(query, 20);
                const originX = 100 + Math.cos(angle) * offset;
                const originY = 100 + Math.sin(angle) * offset;
                const topX = originX - Math.sin(angle) * 20;
                const topY = originY + Math.cos(angle) * 20;
                for (const rotation of [0, 90, 180, 270]) {
                    for (const scale of [1, 1.75]) {
                        const viewport = pages[i].getViewport({ scale, rotation });
                        const divs = [];
                        context.drawSearchHighlightsForPage(i + 1, { querySelectorAll: () => [], appendChild: div => divs.push(div) }, viewport);
                        assert.equal(divs.length, 1);
                        const style = divs[0].style;
                        const top = viewport.convertToViewportPoint(topX, topY);
                        const end = viewport.convertToViewportPoint(topX + Math.cos(angle) * width, topY + Math.sin(angle) * width);
                        const bottom = viewport.convertToViewportPoint(originX + Math.cos(angle) * width, originY + Math.sin(angle) * width);
                        const label = `${query}, text ${angles[i]}°, page ${rotation}°, zoom ${scale}`;
                        if (style.transform) {
                            close(parseFloat(style.left), top[0], label + ' left');
                            close(parseFloat(style.top), top[1], label + ' top');
                            const drawnAngle = parseFloat(style.transform.slice('rotate('.length));
                            const expectedAngle = Math.atan2(end[1] - top[1], end[0] - top[0]);
                            close(Math.cos(drawnAngle), Math.cos(expectedAngle), label + ' direction x');
                            close(Math.sin(drawnAngle), Math.sin(expectedAngle), label + ' direction y');
                            close(parseFloat(style.width), width * scale, label + ' width');
                            close(parseFloat(style.height), 20 * scale, label + ' height');
                        } else {
                            close(parseFloat(style.left), Math.min(top[0], bottom[0]), label + ' left');
                            close(parseFloat(style.top), Math.min(top[1], bottom[1]), label + ' top');
                            close(parseFloat(style.width), Math.abs(bottom[0] - top[0]), label + ' width');
                            close(parseFloat(style.height), Math.abs(bottom[1] - top[1]), label + ' height');
                        }
                    }
                }
            }
        }
        assert.deepEqual(content.map(c => c.items.map(item => item.transform)), originalTransforms,
            'partial searches never mutate cached PDF.js text transforms');

        // Exact axis-aligned half-turn matrices can have zero off-diagonal
        // components; they still need the directional path for substring offsets.
        content[2].items[0].transform = [-20, 0, 0, -20, 100, 100];
        await context.performSearch('DE');
        const halfTurn = run('searchResults[2].rects[0]');
        assert.ok(halfTurn.matrix, '180-degree text uses directional geometry');
        close(halfTurn.matrix[4], 64, 'half-turn substring origin x');
        close(halfTurn.matrix[5], 100, 'half-turn substring origin y');

        // A match crossing two rotated chunks needs a separate local offset
        // for each chunk, rather than reusing the page-wide match position.
        const runItem = content[1].items[0];
        content[1].items = [
            { ...runItem, str: 'ABC', width: 36, transform: [0, 20, -20, 0, 100, 100], hasEOL: false },
            { ...runItem, str: 'DE', width: 24, transform: [0, 20, -20, 0, 100, 136], hasEOL: false }
        ];
        await context.performSearch('CD');
        const chunks = run('searchResults[1].rects');
        assert.equal(chunks.length, 2);
        close(chunks[0].matrix[5], 124, 'first chunk advances to C');
        close(chunks[1].matrix[5], 136, 'second chunk starts at D');
        chunks.forEach(rect => close(rect.dirWidth, 12, 'each chunk highlights one character'));
        console.log('Search geometry: partial/full matches, rotated runs, page rotations, zoom and transform immutability passed.');
    } finally {
        await doc.destroy();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
