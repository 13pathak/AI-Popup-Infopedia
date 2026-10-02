// node tests/test-pdf-annotation-recovery.js
// Real PDF dictionaries/bytes and the viewer's actual recovery, Save, overlay,
// storage-write and undo functions. Only browser/chrome UI surfaces are stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const PDFLib = require('../pdf-lib.min.js');
const viewerSource = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8');
function fn(name, source = viewerSource) {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
}

// Run the production backup encoder and restore handler with storage,
// download and file-input surfaces stubbed, then reopen the original PDF.
function backupAndRestore(localData, type, includePdf = true, customInclude = null) {
    const background = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
    const options = fs.readFileSync(path.join(__dirname, '../options.js'), 'utf8');
    const area = data => ({
        get(keys, callback) {
            callback(keys === null ? structuredClone(data) :
                Object.fromEntries(keys.filter(key => key in data).map(key => [key, structuredClone(data[key])])));
        },
        set(values, callback) { Object.assign(data, structuredClone(values)); callback?.(); },
        remove(keys) { keys.forEach(key => delete data[key]); }
    });
    let downloaded;
    const context = vm.createContext({
        chrome: {
            runtime: {},
            storage: { local: area(structuredClone(localData)), sync: area({ backupInclude: { pdf: includePdf } }) },
            downloads: { download({ url }, callback) { downloaded = url; callback(1); } }
        },
        TextEncoder, btoa, console: { log() {}, error() {} },
        normalizeHistoryListIds() {}, setTimeout() {},
        updateRestoreStatus(message, status) { assert.equal(status, 'success', message); }
    });
    const defaultsStart = background.indexOf('const DEFAULT_BACKUP_INCLUDE =');
    vm.runInContext(background.slice(defaultsStart, background.indexOf('\n};', defaultsStart) + 3), context);
    vm.runInContext(fn('base64EncodeUtf8', background), context);
    vm.runInContext(fn('triggerBackup', background), context);
    context.triggerBackup(type, customInclude);
    assert.ok(downloaded, 'backup produced a download');
    const json = Buffer.from(downloaded.split(',')[1], 'base64').toString('utf8');
    const restored = {};
    context.chrome.storage.local = area(restored);
    context.chrome.storage.sync = area({});
    context.document = { getElementById: () => ({ files: [json] }) };
    context.FileReader = class {
        readAsText(content) { this.onload({ target: { result: content } }); }
    };
    vm.runInContext(fn('restoreBackup', options), context);
    context.restoreBackup();
    return { backup: JSON.parse(json), restored };
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
            Type: 'Annot', Subtype: ['Highlight', 'Underline', 'StrikeOut'][i], F: 4,
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
            // A real printable stamp appearance, outside the editable types.
            const appearance = pdf.context.register(pdf.context.flateStream('1 0 0 rg 0 0 40 20 re f', {
                Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 40, 20], Resources: {}
            }));
            annots.push(pdf.context.register(pdf.context.obj({
                Type: 'Annot', Subtype: 'Stamp', Rect: [220, 300, 260, 320], F: 4,
                AP: { N: appearance }, Contents: PDFString.of('Keep stamp')
            })));
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
            classList: { add() {}, remove() {}, contains() { return true; } }, appendChild(child) { draws.push(child); },
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
        if (options.unlockedFallback) {
            context.PDFLib = { ...PDFLib, PDFDocument: {
                load: async () => { throw new Error('Input document is encrypted'); }
            } };
        }
        vm.runInContext(`
            let highlights = ${JSON.stringify(initial.highlights || [])}, highlightCounter = 0;
            let annotationRevision = 0, annotationRecoveryReady = false, embeddedMarkups = new Map();
            let annotationRenderDoc = null;
            let annotationSource = null, storedAnnotationSource = ${JSON.stringify(initial.annotationSource || null)};
            let storedHighlightsExplicitlyEmpty = ${Array.isArray(initial.highlights) && initial.highlights.length === 0};
            let activeHighlightId = null, pendingFlashHighlightId = null, pendingFlashHighlightUntil = 0;
            let savePdfInProgress = false;
            const richEditorCommits = new WeakMap();
            const SAVE_FETCH_TIMEOUT_MS = 1000;
            const SYNC_KEYS = { highlights: 'highlights', annotationSource: 'annotationSource' };
            const ANNOTATION_UNDO_LIMIT = 100, annotationUndoStack = [], annotationRedoStack = [];
        `, context);
        for (const name of ['hasChromeStorage', 'isValidStoredRect', 'hasValidCornerQuad', 'maxStoredId',
            'sanitizeStoredHighlights', 'getAnnotationRenderPage', 'recoverEmbeddedAnnotations', 'saveHighlights', 'hexToRgb',
            'drawHighlight', 'mergeHighlightRectangles', 'cloneAnnotationRecord', 'registerUndoEntry',
            'runAnnotationUndo', 'runAnnotationRedo', 'updateUndoRedoButtons', 'pushHighlightDeletedUndo',
            'deleteHighlightForUndo', 'restoreHighlightForUndo', 'removeHighlightOverlaysById',
            'detachHighlightPopupsById', 'applyHighlightEditForUndo']) vm.runInContext(fn(name), context);
        const start = viewerSource.indexOf("document.getElementById('save_pdf').addEventListener");
        vm.runInContext(viewerSource.slice(start, viewerSource.indexOf('\n});', start) + 4), context);
        let shortcutHandler;
        context.window = { addEventListener(type, handler) { shortcutHandler = handler; } };
        const shortcutStart = viewerSource.indexOf("window.addEventListener('keydown'", viewerSource.indexOf('// Route Ctrl+S'));
        vm.runInContext(viewerSource.slice(shortcutStart, viewerSource.indexOf('}, true);', shortcutStart) + 9), context);
        return { context, storage, alerts, draws, pdfDoc,
            run: code => vm.runInContext(code, context),
            async recover() {
                await vm.runInContext('recoverEmbeddedAnnotations()', context);
                const renderDoc = vm.runInContext('annotationRenderDoc', context);
                if (renderDoc) documents.push(renderDoc);
            },
            async save() { savedBlob = undefined; await handlers.click(); return savedBlob && new Uint8Array(await savedBlob.arrayBuffer()); },
            async shortcutSave(modifier) {
                savedBlob = undefined;
                let saving;
                button.click = () => { saving = handlers.click(); };
                shortcutHandler({ [modifier]: true, key: 's', code: 'KeyS', preventDefault() {}, stopImmediatePropagation() {} });
                await saving;
                return savedBlob && new Uint8Array(await savedBlob.arrayBuffer());
            }
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

    // Feed the actual screen/print render options into PDF.js's operator-list
    // pipeline: this tests native appearance generation without a fake canvas.
    async function nativeAppearanceIds(h, pageNumber, print = false) {
        const page = await h.pdfDoc.getPage(pageNumber);
        const renderPage = await h.context.getAnnotationRenderPage(page);
        const source = fn(print ? 'printPDF' : 'renderPageContent');
        const options = source.match(/renderPage\.render\((\{[\s\S]*?\})\)/)[1];
        const params = vm.runInNewContext(`(${options})`, {
            pdfjsLib, ctx: null, transform: null, viewport: page.getViewport({ scale: 1 })
        });
        const ops = await renderPage.getOperatorList(params);
        return { annotations: await renderPage.getAnnotations(),
            ids: ops.fnArray.flatMap((op, i) => op === pdfjsLib.OPS.beginAnnotation ? [ops.argsArray[i][0]] : []) };
    }
    async function assertStampOnly(h) {
        for (const print of [false, true]) {
            const { annotations, ids } = await nativeAppearanceIds(h, 1, print);
            const stamp = annotations.find(a => a.subtype === 'Stamp');
            assert.ok(stamp && ids.includes(stamp.id), `stamp appearance survives ${print ? 'print' : 'display'}`);
            assert.ok(!annotations.some(a => a.subtype === 'Highlight' && a.quadPoints),
                'recovered native highlight is removed, so edits/deletions cannot reveal a duplicate');
        }
    }
    await assertStampOnly(fresh);
    assert.ok((await (await fresh.pdfDoc.getPage(1)).getAnnotations()).some(a => a.subtype === 'Highlight' && a.quadPoints),
        'original source document remains intact for Save');
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
    assert.equal(savedPdf.getPage(0).node.Annots().size(), 8, 'stamp, unsupported types and broken popup preserved');
    assert.equal(savedMarks.records[0].note, imported.records[0].note, 'Unicode note round-trip');
    assert.deepEqual(savedMarks.records[1].rects, imported.records[1].rects, 'raw rotated quad round-trip');

    const reopened = await harness(firstSave);
    await reopened.recover();
    await assertStampOnly(reopened);
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
    const documentUrl = 'https://example.com/notes.pdf';
    const highlightsKey = 'pdf_highlights_' + documentUrl;
    const sourceKey = 'pdf_annotation_source_' + documentUrl;
    const backupStorage = {
        [highlightsKey]: fresh.storage.highlights,
        [sourceKey]: fresh.storage.annotationSource,
        'pdf_annotation_source_file:///C:/other.pdf': 'other-document-marker',
        'pdf_highlights_file:///C:/other.pdf': [],
        unrelated: 'not part of PDF state'
    };
    for (const type of ['Manual', 'Auto']) {
        const { backup, restored } = backupAndRestore(backupStorage, type);
        assert.equal(backup.pdfAnnotations[sourceKey], fresh.storage.annotationSource, `${type} backup keeps deletion marker`);
        assert.deepEqual(backup.pdfAnnotations[highlightsKey], [], 'empty annotation list is retained');
        assert.equal(backup.pdfAnnotations.unrelated, undefined);
        assert.equal(restored[sourceKey], fresh.storage.annotationSource, 'restore writes deletion marker unchanged');
        assert.equal(restored['pdf_annotation_source_file:///C:/other.pdf'], 'other-document-marker');
        const reopenedBackup = await harness(bytes, {
            highlights: restored[highlightsKey], annotationSource: restored[sourceKey]
        });
        await reopenedBackup.recover();
        assert.equal(reopenedBackup.run('highlights.length'), 0, `${type} backup/restore must not resurrect three deleted marks`);
    }
    for (const [type, includePdf, customInclude] of [['Auto', false, null], ['Manual', true, { pdf: false }]]) {
        const { backup, restored } = backupAndRestore(backupStorage, type, includePdf, customInclude);
        assert.equal(backup.pdfAnnotations, undefined, 'excluding PDFs also excludes deletion markers');
        assert.equal(restored[sourceKey], undefined);
    }
    const legacyStorage = { ...backupStorage };
    delete legacyStorage[sourceKey];
    const legacy = backupAndRestore(legacyStorage, 'Manual').restored;
    const reopenedLegacy = await harness(bytes, { highlights: legacy[highlightsKey], annotationSource: legacy[sourceKey] });
    await reopenedLegacy.recover();
    assert.equal(reopenedLegacy.run('highlights.length'), 3, 'marker-less legacy backups still recover embedded annotations');
    const intentional = await harness(bytes, fresh.storage);
    await intentional.recover();
    await assertStampOnly(intentional);
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
    for (const print of [false, true]) {
        const { annotations, ids } = await nativeAppearanceIds(failed, 1, print);
        for (const subtype of ['Stamp', 'Highlight']) {
            assert.ok(annotations.some(a => a.subtype === subtype && ids.includes(a.id)),
                `failed recovery retains native ${subtype} appearances`);
        }
    }

    // Exercise the encrypted-input branch with a real unlocked PDF.js proxy;
    // only pdf-lib's inability to open encrypted bytes is simulated.
    const encrypted = await harness(bytes, {}, { unlockedFallback: true });
    await encrypted.recover();
    assert.equal(encrypted.run('annotationRecoveryReady'), true);
    assert.equal(encrypted.run('highlights.length'), 3);
    assert.equal(encrypted.run('annotationRenderDoc'), null);
    for (const print of [false, true]) {
        const { annotations, ids } = await nativeAppearanceIds(encrypted, 1, print);
        assert.ok(annotations.some(a => a.subtype === 'Stamp' && ids.includes(a.id)));
        assert.ok(!annotations.some(a => a.subtype === 'Highlight' && ids.includes(a.id)),
            'unlocked recovered marks are suppressed by their exact PDF.js IDs');
    }

    // Focused sidebar notes use the real editor, sidebar save callback,
    // shortcut listener and PDF Save handler. Only the DOM surface is mocked.
    const sidebar = await harness();
    await sidebar.recover();
    const editorEvents = new Map();
    const noteInput = {
        innerHTML: 'Original sidebar note',
        get textContent() { return this.innerHTML.replace(/<[^>]*>/g, ''); },
        classList: { toggle() {} },
        addEventListener(type, listener) {
            if (!editorEvents.has(type)) editorEvents.set(type, []);
            editorEvents.get(type).push(listener);
        },
        closest() { return this; }
    };
    Object.assign(sidebar.context, {
        noteInput, escapeHtml: s => s,
        updateHighlightIndicatorsOnPage() {}, syncFloatingNoteEditorForUndo() {}
    });
    sidebar.context.document.activeElement = noteInput;
    sidebar.run("let noteUndoSession = null; const hl = highlights[0]; hl.note = 'Original sidebar note'; hl.noteFmt = 'html';");
    for (const name of ['attachRichEditor', 'getRichNoteContent', 'beginNoteUndoSession',
        'commitNoteUndoEntry', 'applyNoteForUndo']) sidebar.run(fn(name));
    const editorStart = viewerSource.indexOf('attachRichEditor(noteInput, {');
    sidebar.run(viewerSource.slice(editorStart, viewerSource.indexOf('\n        });', editorStart) + 12));
    editorEvents.get('focus').forEach(listener => listener());
    sidebar.run('beginNoteUndoSession(hl)');
    async function checkSidebarSave(html, modifier) {
        noteInput.innerHTML = html;
        editorEvents.get('input').forEach(listener => listener());
        const output = modifier ? await sidebar.shortcutSave(modifier) : await sidebar.save();
        assert.ok(output, 'Save exports a PDF with the sidebar still focused');
        const records = helpers.readEmbeddedMarkups(await PDFDocument.load(output), PDFLib).records;
        assert.equal(records[0].note, html.replace(/<[^>]*>/g, ''), 'export uses current editor text');
        assert.equal(sidebar.storage.highlights[0].note, html || null, 'current rich text is persisted');
        assert.equal(sidebar.context.document.activeElement, noteInput, 'Save does not change focus');
    }
    await checkSidebarSave('Fresh <b>bold</b> 中文 🙂', 'ctrlKey');
    await checkSidebarSave('Continued <u>edit</u>', 'metaKey');
    await checkSidebarSave('Button edit');
    await checkSidebarSave('', 'ctrlKey');
    await checkSidebarSave('', 'ctrlKey');
    editorEvents.get('blur').forEach(listener => listener());
    assert.equal(sidebar.run('annotationUndoStack.length'), 1, 'Save and blur keep one undo step per session');
    sidebar.run('runAnnotationUndo()');
    assert.equal(sidebar.run('highlights[0].note'), 'Original sidebar note');
    sidebar.run('runAnnotationRedo()');
    assert.ok(!sidebar.run('highlights[0].note'), 'redo restores cleared note');

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
    const direct = await harness(await rectOnlyPdf.save());
    await direct.recover();
    assert.equal(direct.run('highlights.length'), 1);
    for (const print of [false, true]) {
        assert.equal((await nativeAppearanceIds(direct, 1, print)).ids.length, 0,
            'direct annotation dictionary is rendered only by our overlay');
    }
    assert.equal(helpers.pruneEmbeddedMarkups(rectOnlyPdf, rectOnly.managed, PDFLib), 1);

    await Promise.all(documents.map(doc => doc.destroy()));
    console.log('PDF annotation recovery: import, rendering, persistence, undo/edit/delete, safe Save and round-trips passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
