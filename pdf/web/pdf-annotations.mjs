// PDF ingestion is independent of the DOM and chrome.storage. Read the raw
// dictionaries: PDF.js normalizes QuadPoints to bounding boxes, which loses
// the vertex order of marks saved on rotated pages.
const EDITABLE_MARKUPS = new Set(['Highlight', 'Underline', 'StrikeOut']);

function numbers(value, PDFLib) {
    if (!(value instanceof PDFLib.PDFArray)) return null;
    const out = [];
    for (let i = 0; i < value.size(); i++) {
        const n = value.lookup(i);
        if (!(n instanceof PDFLib.PDFNumber) || !Number.isFinite(n.asNumber())) return null;
        out.push(n.asNumber());
    }
    return out;
}

function pdfText(value, PDFLib) {
    return value instanceof PDFLib.PDFString || value instanceof PDFLib.PDFHexString
        ? value.decodeText() : '';
}

function colorHex(components) {
    let rgb = [1, 1, 0];
    if (components?.length === 1) rgb = Array(3).fill(components[0]);
    if (components?.length === 3) rgb = components;
    if (components?.length === 4) {
        const [c, m, y, k] = components;
        rgb = [c, m, y].map(v => 1 - Math.min(1, v + k));
    }
    return '#' + rgb.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rectsFromQuadPoints(points) {
    if (!points?.length || points.length % 8 || !points.every(Number.isFinite)) return [];
    const rects = [];
    for (let i = 0; i < points.length; i += 8) {
        const cTL = points.slice(i, i + 2), cTR = points.slice(i + 2, i + 4);
        const cBL = points.slice(i + 4, i + 6), cBR = points.slice(i + 6, i + 8);
        const xs = [cTL[0], cTR[0], cBL[0], cBR[0]];
        const ys = [cTL[1], cTR[1], cBL[1], cBR[1]];
        const pdfX = Math.min(...xs), pdfY = Math.max(...ys);
        const pdfWidth = Math.max(...xs) - pdfX, pdfHeight = pdfY - Math.min(...ys);
        // Never claim a partially readable annotation: Save must preserve
        // the original dictionary if any of its quads are unusable.
        if (pdfWidth <= 0 || pdfHeight <= 0) return [];
        rects.push({ pdfX, pdfY, pdfWidth, pdfHeight, cTL, cTR, cBL, cBR });
    }
    return rects;
}

export function readEmbeddedMarkups(pdf, PDFLib) {
    const records = [];
    const managed = new Map();
    let unreadable = 0;
    pdf.getPages().forEach((page, pageIndex) => {
        const annots = page.node.Annots();
        if (!annots) return;
        const indices = new Set();
        for (let index = 0; index < annots.size(); index++) {
            try {
                const dict = annots.lookup(index);
                if (!(dict instanceof PDFLib.PDFDict)) continue;
                const get = name => dict.lookup(PDFLib.PDFName.of(name));
                const subtype = get('Subtype');
                if (!(subtype instanceof PDFLib.PDFName)) continue;
                const markupType = subtype.decodeText();
                if (!EDITABLE_MARKUPS.has(markupType)) continue;
                let points = numbers(get('QuadPoints'), PDFLib);
                // Some producers supply only Rect. A present but broken quad
                // is left untouched instead of replacing it with guessed data.
                if (!dict.has(PDFLib.PDFName.of('QuadPoints'))) {
                    const r = numbers(get('Rect'), PDFLib);
                    if (r?.length === 4 && r[2] > r[0] && r[3] > r[1]) {
                        points = [r[0], r[3], r[2], r[3], r[0], r[1], r[2], r[1]];
                    }
                }
                const rects = rectsFromQuadPoints(points);
                if (!rects.length) { unreadable++; continue; }
                const record = {
                    id: records.length + 1,
                    pageNumber: pageIndex + 1,
                    markupType,
                    rects,
                    color: colorHex(numbers(get('C'), PDFLib)),
                    text: pdfText(get('InfopediaText'), PDFLib),
                    note: pdfText(get('Contents'), PDFLib),
                    author: pdfText(get('T'), PDFLib)
                };
                const date = pdfText(get('CreationDate'), PDFLib);
                if (date) record.pdfCreationDate = date;
                records.push(record);
                indices.add(index);
            } catch (error) {
                unreadable++;
                console.warn('Preserving an unreadable PDF annotation', error);
            }
        }
        managed.set(pageIndex, indices);
    });
    return { records, managed, unreadable };
}

// Password-protected PDFs can be read by PDF.js after its password prompt,
// while pdf-lib cannot export them. Retain that reading/editing workflow.
export async function readUnlockedMarkups(pdf) {
    const records = [];
    let unreadable = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        for (const annot of await page.getAnnotations()) {
            if (!EDITABLE_MARKUPS.has(annot.subtype)) continue;
            const points = annot.quadPoints?.flatMap(quad => quad.flatMap(p => [p.x, p.y]));
            const rects = rectsFromQuadPoints(points);
            if (!rects.length) { unreadable++; continue; }
            records.push({
                id: records.length + 1, pageNumber, rects, markupType: annot.subtype,
                color: colorHex(annot.color ? Array.from(annot.color, c => c / 255) : null),
                text: '', note: annot.contentsObj?.str || '', author: annot.titleObj?.str || '',
                pdfCreationDate: annot.creationDate || ''
            });
        }
    }
    return { records, managed: new Map(), unreadable };
}

// Only prune dictionaries that ingestion could represent, plus their popups.
// In particular, Squiggly, Text, FreeText, links, widgets, and broken markup
// remain in the file. Indices refer to the exact source bytes read at startup.
export function pruneEmbeddedMarkups(pdf, managed, PDFLib) {
    let count = 0;
    for (const [pageIndex, indices] of managed) {
        const page = pdf.getPage(pageIndex);
        const annots = page.node.Annots();
        if (!annots) continue;
        const removed = new Set();
        for (const index of indices) {
            const item = annots.get(index);
            removed.add(item);
            const popup = pdf.context.lookup(item).get(PDFLib.PDFName.of('Popup'));
            if (popup) removed.add(popup);
        }
        for (let i = 0; i < annots.size(); i++) {
            const item = annots.get(i);
            const dict = pdf.context.lookup(item);
            if (!(dict instanceof PDFLib.PDFDict)) continue;
            const subtype = dict.get(PDFLib.PDFName.of('Subtype'));
            if (subtype instanceof PDFLib.PDFName && subtype.decodeText() === 'Popup' &&
                removed.has(dict.get(PDFLib.PDFName.of('Parent')))) removed.add(item);
        }
        const kept = pdf.context.obj([]);
        for (let i = 0; i < annots.size(); i++) {
            const item = annots.get(i);
            if (removed.has(item)) count++;
            else kept.push(item);
        }
        page.node.set(PDFLib.PDFName.of('Annots'), kept);
    }
    return count;
}

// Text is a convenience, never a prerequisite for recovering the mark/note.
// PDF text runs may cover a whole line. Select proportional character slices
// along the run's writing direction instead of quoting unrelated whole lines.
export function textUnderMarkup(record, content) {
    const parts = [];
    for (const item of content.items) {
        if (!item.str || !Array.isArray(item.transform)) continue;
        const [a, b, c, d, x, y] = item.transform;
        const vertical = content.styles?.[item.fontName]?.vertical;
        const length = Math.hypot(vertical ? c : a, vertical ? d : b);
        if (!length) continue;
        const dx = (vertical ? c : a) / length, dy = (vertical ? d : b) / length;
        const extent = vertical ? item.height : item.width;
        const chars = Array.from(item.str);
        let selected = '';
        chars.forEach((char, i) => {
            const offset = extent * (i + 0.5) / chars.length;
            const cx = x + dx * offset - dy * length * 0.3;
            const cy = y + dy * offset + dx * length * 0.3;
            if (record.rects.some(r => cx >= r.pdfX && cx <= r.pdfX + r.pdfWidth &&
                cy <= r.pdfY && cy >= r.pdfY - r.pdfHeight)) selected += char;
        });
        if (selected) parts.push(selected + (item.hasEOL ? '\n' : ' '));
    }
    return parts.join('').trim();
}
