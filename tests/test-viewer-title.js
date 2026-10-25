// node tests/test-viewer-title.js
// The viewer names its tab after the open PDF: from the address at once,
// then from the loaded document's download name or embedded title.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../pdf/web/custom-viewer.js'), 'utf8').replace(/\r\n/g, '\n');

function harness(fileUrl, meta) {
    const document = { title: 'AI Popup Infopedia - Custom Viewer' };
    const context = vm.createContext({
        window: { location: { href: 'chrome-extension://abc/pdf/web/custom-viewer.html?file=x' } },
        document, URL,
        pdfDoc: { getMetadata: () => (meta instanceof Error ? Promise.reject(meta) : Promise.resolve(meta || {})) }
    });
    const run = code => vm.runInContext(code, context);
    run(`var fileUrl = ${JSON.stringify(fileUrl)};`);
    for (const name of ['urlFileName', 'embeddedPdfTitle', 'documentTitleFor', 'applyDocumentTitle']) {
        const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
        assert.ok(start >= 0, name);
        run(source.slice(start, source.indexOf('\n}', start) + 2));
    }
    // The address-derived title set at startup.
    const initial = source.indexOf('if (fileUrl && /\\.pdf$/i.test(urlFileName(fileUrl))) {');
    assert.ok(initial >= 0, 'startup title block');
    run(source.slice(initial, source.indexOf('\n}', initial) + 2));
    return { document, apply: () => context.applyDocumentTitle() };
}

const metadataWith = (dcTitle) => ({ get: (key) => (key === 'dc:title' ? dcTitle : null) });

(async () => {
    // Local file: named from the address before loading; nothing better arrives.
    let h = harness('file:///G:/My%20Drive/Readers/C7A.pdf', { info: { Title: 'Microsoft Word - C7A.docx' } });
    assert.equal(h.document.title, 'C7A.pdf', 'startup title comes from the address');
    await h.apply();
    assert.equal(h.document.title, 'C7A.pdf', 'a .pdf name in the address outranks the embedded title');

    // Drive download: the address names nothing until the server's filename arrives.
    h = harness('https://drive.usercontent.google.com/download?id=1kq&export=download&authuser=0',
        { contentDispositionFilename: 'Booklist 2026.pdf', info: { Title: 'Untitled document' } });
    assert.equal(h.document.title, 'AI Popup Infopedia - Custom Viewer', 'no startup title from an endpoint address');
    await h.apply();
    assert.equal(h.document.title, 'Booklist 2026.pdf', 'the download name wins');

    // Viewer endpoints with a hash path: the embedded title beats the hash.
    h = harness('https://doc-08.googleusercontent.com/viewer/secure/pdf/01fn17e44', { info: { Title: 'Info Title' }, metadata: metadataWith('Annual Report') });
    await h.apply();
    assert.equal(h.document.title, 'Annual Report', 'dc:title is preferred over the Info title');

    h = harness('https://doc-08.googleusercontent.com/viewer/secure/pdf/01fn17e44', { info: { Title: 'Info Title' }, metadata: metadataWith('Untitled') });
    await h.apply();
    assert.equal(h.document.title, 'Info Title', 'an "Untitled" dc:title falls back to the Info title');

    h = harness('https://doc-08.googleusercontent.com/viewer/secure/pdf/01fn17e44', { info: { Title: 'Info Title' }, metadata: metadataWith('Bad\uFFFDtitle') });
    await h.apply();
    assert.equal(h.document.title, 'Info Title', 'a mis-encoded dc:title falls back to the Info title');

    // No embedded title either: whatever the address ends in.
    h = harness('https://arxiv.org/pdf/2401.12345', { info: {} });
    await h.apply();
    assert.equal(h.document.title, '2401.12345', 'the last path segment is the final fallback');

    // Percent-encoding is decoded once; a literal % that is not an escape survives.
    h = harness('https://example.com/files/Report%2050%25%20Final.pdf', {});
    assert.equal(h.document.title, 'Report 50% Final.pdf', 'encoded names are decoded');
    h = harness('https://example.com/files/100%.pdf', {});
    assert.equal(h.document.title, '100%.pdf', 'a malformed escape keeps the raw name');

    // Metadata failures keep the address-derived title.
    h = harness('https://example.com/a/b/paper.pdf', new Error('worker gone'));
    await h.apply();
    assert.equal(h.document.title, 'paper.pdf', 'a metadata error leaves the startup title');

    // Relative test path (plain-browser fallback) resolves against the page.
    h = harness('../../test_highlight.pdf', {});
    assert.equal(h.document.title, 'test_highlight.pdf', 'relative addresses resolve');

    console.log('VIEWER-TITLE TEST PASSED');
})().catch(e => { console.error('VIEWER-TITLE TEST FAILED:', e && e.stack || e); process.exit(1); });
