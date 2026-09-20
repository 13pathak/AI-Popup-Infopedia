// node tests/test-pdf-annotation-recovery.js
// Real PDF dictionaries/bytes and the viewer's actual recovery, Save, overlay,
// storage-write and undo functions. Only browser/chrome UI surfaces are stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const PDFLib = require('../pdf-lib.min.js');
const viewerSource = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8');
function fn(name) {
    const start = viewerSource.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    return viewerSource.slice(start, viewerSource.indexOf('\n}', start) + 2);
}

(async () => {
    const helpers = await import('../pdf/web/pdf-annotations.mjs');
    const pdfjsLib = await import('../pdf/build/pdf.mjs');
    const { PDFDocument, PDFName, PDFHexString, PDFString } = PDFLib;
    const n = PDFName.of;
    const quad = [40, 120, 130, 120, 40, 100, 130, 100];
    const rotatedQuad = [180, 50, 180, 150, 200, 50, 200, 150];
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 3; i++) {
        const page = pdf.addPage([300, 400]);
        if (i) page.setRotation(PDFLib.degrees(i * 90));
        page.drawText('recover this text', { x: 40, y: 105, size: 10 });
        const markup = pdf.context.obj({
            Type: 'Annot', Subtype: ['Highlight', 'Underline', 'StrikeOut'][i],
            Rect: [40, 50, 200, 120], QuadPoints: i ? rotatedQuad : [...quad, 40, 90, 100, 90, 40, 80, 100, 80],
            C: i === 0 ? [1, 0.5, 0] : i === 1 ? [0.25] : [1, 0, 0, 0],
            Contents: PDFHexString.fromText('नोट 中文 🙂\nsecond line <b>plain</b>'),
            T: PDFHexString.fromText('Zoë 作者'),
            CreationDate: PDFString.fromDate(new Date('2026-01-02T03:04:05Z'))
        });
        const ref = pdf.context.register(markup);
        const popup = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Popup', Parent: ref, Rect: [0, 0, 1, 1] }));
        markup.set(n('Popup'), popup);
        const annots = pdf.context.obj([ref, popup]);
        if (i === 0) {
            for (const subtype of ['Link', 'Text', 'FreeText', 'Squiggly']) {
                annots.push(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: subtype,
                    Rect: [0, 0, 20, 20], QuadPoints: quad, Contents: PDFHexString.fromText('Keep ' + subtype) })));
            }
            // Malformed markup must survive, including its own popup.
            const broken = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Highlight',
                Rect: [0, 0, 20, 20], QuadPoints: [1, 2], Contents: PDFString.of('Keep broken') }));
            annots.push(broken);
            annots.push(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Popup', Parent: broken })));
        }
        page.node.set(n('Annots'), annots);
    }
    const bytes = await pdf.save();
    const imported = helpers.readEmbeddedMarkups(await PDFDocument.load(bytes), PDFLib);
    assert.equal(imported.records.length, 3);
    assert.equal(imported.unreadable, 1);
    assert.equal(imported.records[0].rects.length, 2);
    assert.equal(imported.records[0].color, '#FF8000');
    assert.equal(imported.records[1].color, '#404040');
    assert.equal(imported.records[2].color, '#00FFFF');
    assert.deepEqual(imported.records[1].rects[0].cTL, [180, 50]);
    assert.deepEqual(helpers.rectsFromQuadPoints([1, 2, NaN, 4, 5, 6, 7, 8]), []);
    assert.deepEqual(helpers.rectsFromQuadPoints([1, 2, 1, 2, 1, 2, 1, 2]), []);

    const documents = [];
    async function harness(input = bytes, initial = {}, options = {}) {
        const storage = structuredClone(initial);
        const pdfDoc = await pdfjsLib.getDocument({ data: input.slice(), disableFontFace: true,
            useSystemFonts: true, isEvalSupported: false }).promise;
        documents.push(pdfDoc);
        const alerts = [], draws = [], handlers = {};
        let savedBlob;
        const element = () => ({ dataset: {}, style: {}, disabled: false,
            classList: { add() {}, remove() {} }, appendChild(child) { draws.push(child); },
            addEventListener(type, handler) { handlers[type] = handler; }, click() {} });
        const button = element();
        const context = vm.createContext({
            ...helpers, PDFLib, pdfjsLib, pdfDoc, crypto: globalThis.crypto, TextEncoder,
            Blob, DOMException, setTimeout, clearTimeout, structuredClone, Uint8Array,
            console: { warn() {}, error() {}, log() {} },
            URL: { createObjectURL(blob) { savedBlob = blob; return 'blob:test'; } },
            document: { getElementById() { return button; }, createElement: element,
                querySelector() { return null; }, querySelectorAll() { return []; } },
            chrome: options.noStorage ? undefined : { storage: { local: {
                set(data, callback) { Object.assign(storage, structuredClone(data)); callback?.(); },
                get(keys, callback) { callback(storage); }
            } } },
            viewerAlert(...args) { alerts.push(args); }, renderSidebar() {},
            rememberOwnWrite() {}, settlePendingWrite() {}, recordDocumentIdentity() {},
            redrawExistingHighlight() {}, endNoteUndoSession() {}, endNoteUndoSessionIfFor() {},
            revokeObjectUrlLater() {}, documentBaseName() { return 'test'; },
            viewerIconSvg() { return ''; }, sanitizeRichNote: s => s,
            noteHtmlToPlainText: s => s.replace(/<[^>]*>/g, '')
        });
        vm.runInContext(`
            let highlights = ${JSON.stringify(initial.highlights || [])}, highlightCounter = 0;
            let annotationRevision = 0, annotationRecoveryReady = false, embeddedMarkups = new Map();
            let annotationSource = null, storedAnnotationSource = ${JSON.stringify(initial.annotationSource || null)};
            let storedHighlightsExplicitlyEmpty = ${Array.isArray(initial.highlights) && initial.highlights.length === 0};
            let activeHighlightId = null, pendingFlashHighlightId = null, pendingFlashHighlightUntil = 0;
            let savePdfInProgress = false;
            const SAVE_FETCH_TIMEOUT_MS = 1000;
            const SYNC_KEYS = { highlights: 'highlights', annotationSource: 'annotationSource' };
            const ANNOTATION_UNDO_LIMIT = 100, annotationUndoStack = [], annotationRedoStack = [];
        `, context);
        for (const name of ['hasChromeStorage', 'isValidStoredRect', 'hasValidCornerQuad', 'maxStoredId',
            'sanitizeStoredHighlights', 'recoverEmbeddedAnnotations', 'saveHighlights', 'hexToRgb',
            'drawHighlight', 'mergeHighlightRectangles', 'cloneAnnotationRecord', 'registerUndoEntry',
            'runAnnotationUndo', 'runAnnotationRedo', 'updateUndoRedoButtons', 'pushHighlightDeletedUndo',
            'deleteHighlightForUndo', 'restoreHighlightForUndo', 'removeHighlightOverlaysById',
            'detachHighlightPopupsById', 'applyHighlightEditForUndo']) vm.runInContext(fn(name), context);
        const start = viewerSource.indexOf("document.getElementById('save_pdf').addEventListener");
        vm.runInContext(viewerSource.slice(start, viewerSource.indexOf('\n});', start) + 4), context);
        return { context, storage, alerts, draws, pdfDoc,
            run: code => vm.runInContext(code, context),
            recover: () => vm.runInContext('recoverEmbeddedAnnotations()', context),
            async save() { savedBlob = undefined; await handlers.click(); return savedBlob && new Uint8Array(await savedBlob.arrayBuffer()); }
        };
    }

    const fresh = await harness();
    const unlocked = await helpers.readUnlockedMarkups(fresh.pdfDoc);
    assert.equal(unlocked.records.length, 3, 'PDF.js fallback reads supported annotations');
    assert.equal(unlocked.records[0].note, imported.records[0].note);
    assert.equal(unlocked.records[1].color, '#404040');
    await fresh.save();
    assert.equal(fresh.alerts.length, 1, 'Save must be gated before recovery');
    fresh.alerts.length = 0;
    await fresh.recover();
    assert.equal(fresh.run('highlights.length'), 3);
    assert.equal(fresh.run('highlightCounter'), 3);
    assert.equal(fresh.storage.highlights.length, 3, 'recovery is persisted');
    assert.match(fresh.run('highlights[0].text'), /recover this/);
    assert.equal(fresh.run('highlights[0].noteFmt'), undefined, 'PDF comments are plain text');
    assert.equal(fresh.run('highlights[0].author'), 'Zoë 作者');
    assert.equal(fresh.run('highlights[0].createdAt'), Date.parse('2026-01-02T03:04:05Z'));
    for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
        fresh.context.viewport = (await fresh.pdfDoc.getPage(pageNumber)).getViewport({ scale: 1.5 });
        fresh.run(`drawHighlight(highlights[${pageNumber - 1}], document.createElement('div'), viewport)`);
    }
    assert.equal(fresh.draws.filter(d => d.className === 'note-indicator').length, 3);
    for (const overlay of fresh.draws.filter(d => d.className === 'custom-highlight')) {
        assert.ok(parseFloat(overlay.style.width) > 0 && parseFloat(overlay.style.height) > 0);
        assert.ok(overlay.dataset.hlId > 0, 'recovered overlays are clickable by id');
    }

    const firstSave = await fresh.save();
    assert.ok(firstSave);
    assert.deepEqual(fresh.alerts, []);
    const savedPdf = await PDFDocument.load(firstSave);
    const savedMarks = helpers.readEmbeddedMarkups(savedPdf, PDFLib);
    assert.equal(savedMarks.records.length, 3, 'no duplicate marks');
    assert.equal(savedMarks.unreadable, 1, 'broken original preserved');
    assert.equal(savedPdf.getPage(0).node.Annots().size(), 7, 'unsupported types and broken popup preserved');
    assert.equal(savedMarks.records[0].note, imported.records[0].note, 'Unicode note round-trip');
    assert.deepEqual(savedMarks.records[1].rects, imported.records[1].rects, 'raw rotated quad round-trip');

    const reopened = await harness(firstSave);
    await reopened.recover();
    assert.equal(reopened.run('highlights.length'), 3, 'reopen with wiped storage');
    assert.equal(reopened.run('highlights[0].text'), fresh.run('highlights[0].text'), 'exact quote round-trip');
    const secondSave = await reopened.save();
    assert.equal(helpers.readEmbeddedMarkups(await PDFDocument.load(secondSave), PDFLib).records.length, 3);

    fresh.run(`
        const snapshot = cloneAnnotationRecord(highlights[0]);
        deleteHighlightForUndo(snapshot.id);
        pushHighlightDeletedUndo(snapshot);
    `);
    assert.equal(fresh.run('highlights.length'), 2);
    fresh.run('runAnnotationUndo()');
    assert.equal(fresh.run('highlights.length'), 3);
    fresh.run('runAnnotationRedo()');
    assert.equal(fresh.run('highlights.length'), 2);
    fresh.run("applyHighlightEditForUndo(highlights[0].id, { color: '#123456', note: 'Edited 🙂', markupType: 'Highlight' })");
    const edited = helpers.readEmbeddedMarkups(await PDFDocument.load(await fresh.save()), PDFLib);
    assert.equal(edited.records.length, 2);
    assert.equal(edited.records[0].color, '#123456');
    assert.equal(edited.records[0].note, 'Edited 🙂');
    assert.equal(edited.records[0].markupType, 'Highlight');

    fresh.run('highlights = []; saveHighlights()');
    const intentional = await harness(bytes, fresh.storage);
    await intentional.recover();
    assert.equal(intentional.run('highlights.length'), 0, 'intentional deletion is not resurrected');
    const deleted = helpers.readEmbeddedMarkups(await PDFDocument.load(await intentional.save()), PDFLib);
    assert.equal(deleted.records.length, 0, 'deleted marks removed on Save');
    assert.equal(deleted.unreadable, 1);
    const missing = await harness(bytes, { annotationSource: fresh.storage.annotationSource });
    await missing.recover();
    assert.equal(missing.run('highlights.length'), 3, 'missing key recovers despite stale marker');
    const empty = await harness(bytes, { highlights: [] });
    await empty.recover();
    assert.equal(empty.run('highlights.length'), 3, 'legacy empty storage recovers');
    const changed = await harness(firstSave, fresh.storage);
    await changed.recover();
    assert.equal(changed.run('highlights.length'), 3, 'changed embedded payload invalidates deletion marker');
    const existing = await harness(bytes, { highlights: [imported.records[1]] });
    await existing.recover();
    assert.equal(existing.run('highlights.length'), 1, 'nonempty local records remain authoritative');
    const browser = await harness(bytes, {}, { noStorage: true });
    await browser.recover();
    assert.equal(browser.run('highlights.length'), 3, 'works without chrome.storage');

    const racing = await harness();
    const recovery = racing.recover();
    racing.run('annotationRevision++; highlights = []');
    await recovery;
    assert.equal(racing.run('highlights.length'), 0, 'remote deletion during scan wins');
    const failed = await harness();
    failed.context.pdfDoc = { getData: async () => { throw new Error('read failure'); } };
    await failed.recover();
    assert.equal(failed.run('annotationRecoveryReady'), false);
    assert.equal(await failed.save(), undefined, 'failed recovery cannot prune/download');

    const noText = await harness();
    const getPage = noText.context.pdfDoc.getPage.bind(noText.context.pdfDoc);
    noText.context.pdfDoc.getPage = async pageNumber => {
        const page = await getPage(pageNumber);
        return { getTextContent: async () => { throw new Error('font extraction failure'); } };
    };
    await noText.recover();
    assert.equal(noText.run('highlights.length'), 3, 'text extraction failure does not drop notes');
    assert.equal(noText.run('annotationRecoveryReady'), true);

    const rectOnlyPdf = await PDFDocument.create();
    const rectOnlyPage = rectOnlyPdf.addPage();
    // Direct annotation dictionaries and Rect-only producers are supported.
    rectOnlyPage.node.set(n('Annots'), rectOnlyPdf.context.obj([
        { Type: 'Annot', Subtype: 'Underline', Rect: [10, 20, 30, 40], Contents: PDFString.of('Rect only') }
    ]));
    const rectOnly = helpers.readEmbeddedMarkups(rectOnlyPdf, PDFLib);
    assert.equal(rectOnly.records.length, 1);
    assert.equal(rectOnly.records[0].rects[0].pdfWidth, 20);
    assert.equal(helpers.pruneEmbeddedMarkups(rectOnlyPdf, rectOnly.managed, PDFLib), 1);

    await Promise.all(documents.map(doc => doc.destroy()));
    console.log('PDF annotation recovery: import, rendering, persistence, undo/edit/delete, safe Save and round-trips passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
