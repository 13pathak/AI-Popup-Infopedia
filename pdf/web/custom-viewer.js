import * as pdfjsLib from '../build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../build/pdf.worker.mjs';

let pdfDoc = null;
let scale = 1.25; // Adjusted scale as default zoom
const viewerContainer = document.getElementById('viewer');
const pageCountSpan = document.getElementById('page_count');
const zoomLevelSpan = document.getElementById('zoom_level');

// Store highlights in memory: { id: 1, pageNum: 1, rects: [], color: '#FFFF98', text: '...' }
let highlights = [];
let highlightCounter = 0;
let currentSelection = null; // Store temp selection
let activeHighlightId = null;

// Extract PDF URL from query string, e.g. custom-viewer.html?file=abc.pdf
const urlParams = new URLSearchParams(window.location.search);
let fileUrl = urlParams.get('file');

if (!fileUrl) {
    // Fallback for testing
    fileUrl = '../../test.pdf';
}

async function loadHighlights() {
    return new Promise((resolve) => {
        if (!chrome || !chrome.storage) {
            resolve(); // Not running in extension context
            return;
        }
        
        const storageKey = 'pdf_highlights_' + fileUrl;
        chrome.storage.local.get([storageKey], (result) => {
            if (result[storageKey]) {
                highlights = result[storageKey];
                if (highlights.length > 0) {
                    highlightCounter = Math.max(...highlights.map(h => h.id || 0));
                }
            }
            resolve();
        });
    });
}

function saveHighlights() {
    if (!chrome || !chrome.storage) return;
    const storageKey = 'pdf_highlights_' + fileUrl;
    chrome.storage.local.set({ [storageKey]: highlights });
}

async function setupPage(num) {
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: scale });

    // Create wrapper for this page
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.style.width = `${Math.floor(viewport.width)}px`;
    pageDiv.style.height = `${Math.floor(viewport.height)}px`;
    pageDiv.dataset.pageNumber = num;
    pageDiv.dataset.loaded = "false";
    
    // Store page and viewport for lazy loading
    pageDiv._pdfPage = page;
    pageDiv._viewport = viewport;

    viewerContainer.appendChild(pageDiv);
    pageObserver.observe(pageDiv);
}

async function renderPageContent(pageDiv) {
    if (pageDiv.dataset.loaded === "true") return;
    pageDiv.dataset.loaded = "true";

    const page = pageDiv._pdfPage;
    const viewport = pageDiv._viewport;
    const outputScale = window.devicePixelRatio || 1;

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height =  Math.floor(viewport.height) + "px";
    pageDiv.appendChild(canvas);

    // Create text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
    textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
    textLayerDiv.style.setProperty('--scale-factor', viewport.scale);
    pageDiv.appendChild(textLayerDiv);

    // Render PDF page into canvas context
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
    const renderContext = {
        canvasContext: ctx,
        transform: transform,
        viewport: viewport
    };
    
    // Render text and canvas in parallel
    const renderTask = page.render(renderContext).promise;
    
    const textContent = await page.getTextContent();
    const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport,
        textDivs: []
    });
    
    await Promise.all([renderTask, textLayer.render()]);
    
    // Draw existing highlights for this page
    drawHighlightsForPage(parseInt(pageDiv.dataset.pageNumber), pageDiv, viewport);
}

const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            renderPageContent(entry.target);
        }
    });
}, {
    root: document.getElementById('viewerContainer'),
    rootMargin: '100% 0px 100% 0px' // Load 1 viewport above and below
});

async function loadPDF() {
    try {
        await loadHighlights();
        pdfDoc = await pdfjsLib.getDocument(fileUrl).promise;
        pageCountSpan.textContent = pdfDoc.numPages;
        renderAllPages();
    } catch (e) {
        console.error("Error loading PDF:", e);
    }
}

async function renderAllPages() {
    const scrollContainer = document.getElementById('viewerContainer');
    const scrollRatio = scrollContainer.scrollHeight > 0 ? (scrollContainer.scrollTop / scrollContainer.scrollHeight) : 0;
    
    viewerContainer.innerHTML = ''; // clear
    pageObserver.disconnect();
    zoomLevelSpan.textContent = Math.round(scale * 100) + "%";
    
    // Setup page containers without rendering content
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        await setupPage(i);
    }
    
    // Restore scroll position
    scrollContainer.scrollTop = scrollContainer.scrollHeight * scrollRatio;
    updatePageNumber();
}

// Intentionally replaced during above chunk

loadPDF();

// Zoom logic
document.getElementById('zoom_in').addEventListener('click', () => {
    scale += 0.25;
    renderAllPages();
});

document.getElementById('zoom_out').addEventListener('click', () => {
    if (scale <= 0.5) return;
    scale -= 0.25;
    renderAllPages();
});

// Update page number based on scroll
const container = document.getElementById('viewerContainer');
container.addEventListener('scroll', updatePageNumber);
function updatePageNumber() {
    const pages = document.querySelectorAll('.page');
    const containerCenter = container.scrollTop + (container.clientHeight / 2);
    
    for (const page of pages) {
        if (page.offsetTop <= containerCenter && (page.offsetTop + page.clientHeight) > containerCenter) {
            document.getElementById('page_num').textContent = page.dataset.pageNumber;
            break;
        }
    }
}

// Handle text selection
document.addEventListener('mouseup', (e) => {
    // Ignore clicks on popups or their shadow roots
    if (e.target.closest('#color-picker-popup') || e.target.closest('#edit-highlight-popup') || e.target.closest('#note-editor-popup') || e.composedPath().some(el => el.shadowRoot)) {
        return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
        // If they just clicked (no selection), hide the color picker
        // Don't hide edit popup here, click handler deals with it
        document.getElementById('color-picker-popup').classList.add('hidden');
        currentSelection = null;
        return;
    }

    // Ensure selection is inside a textLayer
    const range = selection.getRangeAt(0);
    const containerNode = range.commonAncestorContainer;
    const textLayerDiv = containerNode.nodeType === 3 
        ? containerNode.parentElement.closest('.textLayer') 
        : (containerNode.closest ? containerNode.closest('.textLayer') : null);
    
    if (!textLayerDiv) {
        hidePopups();
        return;
    }

    const pageDiv = textLayerDiv.closest('.page');
    const pageNumber = parseInt(pageDiv.dataset.pageNumber);
    const selectedText = selection.toString();

    // Get viewport to convert coordinates
    pdfDoc.getPage(pageNumber).then(page => {
        const viewport = page.getViewport({ scale: scale });
        
        // Get bounding rects relative to the page div
        const pageRect = pageDiv.getBoundingClientRect();
        const range = selection.getRangeAt(0);
        const rects = Array.from(range.getClientRects());
        
        const relativeRects = rects.map(r => {
            // CSS pixels relative to page container
            const left = r.left - pageRect.left;
            const top = r.top - pageRect.top;
            
            // Convert to PDF points
            const pt1 = viewport.convertToPdfPoint(left, top);
            const pt2 = viewport.convertToPdfPoint(left + r.width, top + r.height);
            
            return {
                cssLeft: left,
                cssTop: top,
                cssWidth: r.width,
                cssHeight: r.height,
                pdfX: pt1[0],
                pdfY: pt1[1],
                pdfWidth: pt2[0] - pt1[0],
                pdfHeight: pt1[1] - pt2[1] // PDF origin is bottom-left
            };
        });

        currentSelection = {
            pageNumber,
            pageDiv,
            viewport,
            text: selectedText,
            rects: relativeRects
        };

        // Show popups near the last rect
        const lastRect = rects[rects.length - 1];
        showColorPicker(lastRect.left + window.scrollX, lastRect.bottom + window.scrollY);
    });
});

function showColorPicker(x, y) {
    const popup = document.getElementById('color-picker-popup');
    popup.style.left = `${x}px`;
    popup.style.top = `${y + 10}px`;
    popup.classList.remove('hidden');
}

function hidePopups() {
    const editPopup = document.getElementById('edit-highlight-popup');
    editPopup.style.display = '';
    editPopup.style.visibility = '';
    editPopup.classList.add('hidden');
    
    document.getElementById('color-picker-popup').classList.add('hidden');
    document.getElementById('note-editor-popup').classList.add('hidden');
    currentSelection = null;
    activeHighlightId = null;
    document.querySelectorAll('.custom-highlight.active').forEach(el => el.classList.remove('active'));
}

// Color buttons logic
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        
        if (activeHighlightId !== null) {
            // Edit existing highlight
            const hl = highlights.find(h => h.id === activeHighlightId);
            if (hl) {
                hl.color = color;
                // re-draw all pages just to be safe, or just find its divs
                document.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => {
                    el.style.backgroundColor = color;
                });
                saveHighlights();
            }
            hidePopups();
            return;
        }

        if (!currentSelection) return;
        
        const hl = {
            id: ++highlightCounter,
            pageNumber: currentSelection.pageNumber,
            rects: currentSelection.rects,
            color: color,
            text: currentSelection.text
        };
        
        highlights.push(hl);
        saveHighlights();
        drawHighlight(hl, currentSelection.pageDiv, currentSelection.viewport);
        
        // Clear browser selection
        window.getSelection().removeAllRanges();
        hidePopups();
    });
});

document.getElementById('close-color-picker').addEventListener('click', () => {
    hidePopups();
});

function drawHighlight(hl, pageDiv, viewport) {
    hl.rects.forEach(r => {
        const div = document.createElement('div');
        div.className = 'custom-highlight';
        if (hl.id === activeHighlightId) {
            div.classList.add('active');
        }
        div.dataset.hlId = hl.id;
        
        // Recalculate CSS pixels from PDF coordinates for the current zoom scale
        // pdfX and pdfY represent bottom-left in PDF space, but top-left in CSS space when we converted earlier
        // Wait, earlier we stored pt1 = viewport.convertToPdfPoint(left, top)
        // Let's use convertToViewportPoint to get it back
        const pt1 = viewport.convertToViewportPoint(r.pdfX, r.pdfY);
        const pt2 = viewport.convertToViewportPoint(r.pdfX + r.pdfWidth, r.pdfY - r.pdfHeight);
        
        const cssLeft = Math.min(pt1[0], pt2[0]);
        const cssTop = Math.min(pt1[1], pt2[1]);
        const cssWidth = Math.abs(pt2[0] - pt1[0]);
        const cssHeight = Math.abs(pt2[1] - pt1[1]);

        div.style.left = `${cssLeft}px`;
        div.style.top = `${cssTop}px`;
        div.style.width = `${cssWidth}px`;
        div.style.height = `${cssHeight}px`;
        div.style.backgroundColor = hl.color;
        pageDiv.appendChild(div);
    });

    // Draw note indicator if a note exists
    if (hl.note) {
        // Anchor to the top-left of the first rect
        const firstRect = hl.rects[0];
        const pt1 = viewport.convertToViewportPoint(firstRect.pdfX, firstRect.pdfY);
        const cssLeft = pt1[0];
        const cssTop = pt1[1];

        const indicator = document.createElement('div');
        indicator.className = 'note-indicator';
        indicator.dataset.hlId = hl.id;
        indicator.textContent = '💬';
        indicator.style.left = `${cssLeft}px`;
        indicator.style.top = `${cssTop}px`;
        pageDiv.appendChild(indicator);
    }
}

function drawHighlightsForPage(pageNumber, pageDiv, viewport) {
    highlights.filter(h => h.pageNumber === pageNumber).forEach(hl => {
        drawHighlight(hl, pageDiv, viewport);
    });
}

// Interactivity: delete highlight on click
document.addEventListener('click', (e) => {
    // Ignore if selecting text
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;

    // Ignore if clicking on popups or buttons or AI shadow roots
    if (e.target.closest('#color-picker-popup') || e.target.closest('#edit-highlight-popup') || e.target.closest('#note-editor-popup') || e.target.closest('button') || e.composedPath().some(el => el.shadowRoot)) {
        return;
    }

    const pageDiv = e.target.closest('.page');
    if (!pageDiv || !pageDiv._viewport) return;

    let clickedIdx = -1;

    // Direct click on note indicator
    if (e.target.classList.contains('note-indicator')) {
        const hlId = parseInt(e.target.dataset.hlId);
        clickedIdx = highlights.findIndex(hl => hl.id === hlId);
    } else {
        // Fallback to geometric check for clicking the highlight itself
        const pageNumber = parseInt(pageDiv.dataset.pageNumber);
        const pageRect = pageDiv.getBoundingClientRect();
        const clickX = e.clientX - pageRect.left;
        const clickY = e.clientY - pageRect.top;

        const pt = pageDiv._viewport.convertToPdfPoint(clickX, clickY);
        const pdfX = pt[0];
        const pdfY = pt[1];

        clickedIdx = highlights.findIndex(hl => {
            if (hl.pageNumber !== pageNumber) return false;
            return hl.rects.some(r => {
                const minX = r.pdfX;
                const maxX = r.pdfX + r.pdfWidth;
                const minY = r.pdfY - r.pdfHeight;
                const maxY = r.pdfY;
                // Add a small 2-point padding for easier clicking
                return pdfX >= minX - 2 && pdfX <= maxX + 2 && pdfY >= minY - 2 && pdfY <= maxY + 2;
            });
        });
    }

    if (clickedIdx !== -1) {
        const hl = highlights[clickedIdx];
        activeHighlightId = hl.id;
        
        // Add active class
        document.querySelectorAll('.custom-highlight.active').forEach(el => el.classList.remove('active'));
        pageDiv.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => el.classList.add('active'));

        const popup = document.getElementById('edit-highlight-popup');
        
        let popupTop = e.clientY - 60;
        let popupLeft = e.clientX - 50;
        
        // Ensure it doesn't go off the top edge
        if (popupTop < 10) popupTop = e.clientY + 20;

        popup.style.left = `${popupLeft}px`;
        popup.style.top = `${popupTop}px`;
        
        // Brute force visibility
        popup.style.display = 'flex';
        popup.style.visibility = 'visible';
        popup.style.zIndex = '2147483647'; // Max z-index
        popup.classList.remove('hidden');
    } else {
        hidePopups();
    }
});

// Edit Popup Handlers
document.getElementById('edit-btn-ai').addEventListener('click', () => {
    if (activeHighlightId === null) return;
    const hl = highlights.find(h => h.id === activeHighlightId);
    if (!hl) return;

    const firstRect = hl.rects[0];
    const pageDiv = document.querySelector(`.page[data-page-number="${hl.pageNumber}"]`);
    if (!pageDiv) return;

    const pageRect = pageDiv.getBoundingClientRect();
    const viewport = pageDiv._viewport;
    
    // Convert PDF points back to CSS
    const pt1 = viewport.convertToViewportPoint(firstRect.pdfX, firstRect.pdfY);
    const pt2 = viewport.convertToViewportPoint(firstRect.pdfX + firstRect.pdfWidth, firstRect.pdfY - firstRect.pdfHeight);
    
    const cssLeft = Math.min(pt1[0], pt2[0]);
    const cssTop = Math.min(pt1[1], pt2[1]);
    const cssWidth = Math.abs(pt2[0] - pt1[0]);
    const cssHeight = Math.abs(pt2[1] - pt1[1]);

    const globalRect = {
        left: pageRect.left + cssLeft,
        top: pageRect.top + cssTop,
        bottom: pageRect.top + cssTop + cssHeight,
        right: pageRect.left + cssLeft + cssWidth
    };

    const event = new CustomEvent('trigger-ai-popup', {
        detail: { rect: globalRect, text: hl.text }
    });
    document.dispatchEvent(event);
    
    hidePopups();
});

document.getElementById('ai-btn-new').addEventListener('click', () => {
    if (!currentSelection) return;
    
    const rects = currentSelection.rects;
    const lastRect = rects[rects.length - 1];
    const pageRect = currentSelection.pageDiv.getBoundingClientRect();
    
    const globalRect = {
        left: pageRect.left + lastRect.cssLeft,
        top: pageRect.top + lastRect.cssTop,
        bottom: pageRect.top + lastRect.cssTop + lastRect.cssHeight,
        right: pageRect.left + lastRect.cssLeft + lastRect.cssWidth
    };

    const event = new CustomEvent('trigger-ai-popup', {
        detail: { rect: globalRect, text: currentSelection.text }
    });
    document.dispatchEvent(event);
    
    window.getSelection().removeAllRanges();
    hidePopups();
});

document.getElementById('edit-btn-note').addEventListener('click', () => {
    if (activeHighlightId === null) return;
    const hl = highlights.find(h => h.id === activeHighlightId);
    if (!hl) return;

    const editPopup = document.getElementById('edit-highlight-popup');
    const notePopup = document.getElementById('note-editor-popup');
    
    notePopup.style.left = editPopup.style.left;
    notePopup.style.top = editPopup.style.top;
    
    document.getElementById('note-textarea').value = hl.note || '';
    
    editPopup.classList.add('hidden');
    notePopup.classList.remove('hidden');
    document.getElementById('note-textarea').focus();
});

document.getElementById('note-btn-cancel').addEventListener('click', () => {
    hidePopups();
});

document.getElementById('note-btn-save').addEventListener('click', () => {
    if (activeHighlightId === null) return;
    const hl = highlights.find(h => h.id === activeHighlightId);
    if (!hl) return;

    const noteText = document.getElementById('note-textarea').value.trim();
    hl.note = noteText || null;
    saveHighlights();
    
    // Redraw this highlight's indicators
    const pageDiv = document.querySelector(`.page[data-page-number="${hl.pageNumber}"]`);
    if (pageDiv) {
        pageDiv.querySelectorAll(`.note-indicator[data-hl-id="${hl.id}"]`).forEach(el => el.remove());
        if (hl.note) {
            // Completely redraw this highlight's rects and indicator
            pageDiv.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => el.remove());
            drawHighlight(hl, pageDiv, pageDiv._viewport);
        }
    }

    hidePopups();
});

document.getElementById('edit-btn-color').addEventListener('click', () => {
    // Show color picker exactly where the edit popup is
    const editPopup = document.getElementById('edit-highlight-popup');
    const colorPicker = document.getElementById('color-picker-popup');
    colorPicker.style.left = editPopup.style.left;
    colorPicker.style.top = editPopup.style.top;
    editPopup.classList.add('hidden');
    colorPicker.classList.remove('hidden');
});

document.getElementById('edit-btn-trash').addEventListener('click', () => {
    if (activeHighlightId === null) return;
    
    highlights = highlights.filter(h => h.id !== activeHighlightId);
    saveHighlights();
    
    // Remove divs from DOM
    document.querySelectorAll(`.custom-highlight[data-hl-id="${activeHighlightId}"]`).forEach(el => el.remove());
    document.querySelectorAll(`.note-indicator[data-hl-id="${activeHighlightId}"]`).forEach(el => el.remove());
    
    hidePopups();
});

// Convert hex color to rgb ratios for pdf-lib
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : null;
}

document.getElementById('save_pdf').addEventListener('click', async () => {
    try {
        const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        
        // Add highlights
        highlights.forEach(hl => {
            const page = pdfDoc.getPage(hl.pageNumber - 1);
            const colorRgb = hexToRgb(hl.color);
            
            // Calculate bounding box for the entire highlight
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const quadPoints = [];

            hl.rects.forEach(r => {
                const x1 = r.pdfX;
                const y1 = r.pdfY - r.pdfHeight; // Bottom edge
                const x2 = r.pdfX + r.pdfWidth;
                const y2 = r.pdfY;               // Top edge
                
                minX = Math.min(minX, x1);
                minY = Math.min(minY, y1);
                maxX = Math.max(maxX, x2);
                maxY = Math.max(maxY, y2);

                // Add 8 coordinates for this rectangle's quad points
                quadPoints.push(
                    x1, y2, // Top-Left
                    x2, y2, // Top-Right
                    x1, y1, // Bottom-Left
                    x2, y1  // Bottom-Right
                );
            });
            
            if (quadPoints.length === 0) return;

            const annotObj = {
                Type: 'Annot',
                Subtype: 'Highlight',
                Rect: [minX, minY, maxX, maxY], // Bounding box of all quads
                QuadPoints: quadPoints,
                C: [colorRgb.r, colorRgb.g, colorRgb.b],
                F: 4 // Print flag
            };

            if (hl.note) {
                // PDF-lib supports text contents via PDFString
                annotObj.Contents = PDFLib.PDFString.of(hl.note);
            }

            const annot = pdfDoc.context.obj(annotObj);
            
            let annots = page.node.Annots();
            if (!annots) {
                annots = pdfDoc.context.obj([]);
                page.node.set(PDFLib.PDFName.of('Annots'), annots);
            }
            annots.push(pdfDoc.context.register(annot));
        });

        const pdfBytes = await pdfDoc.save();
        
        // Trigger download
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "highlighted_document.pdf";
        link.click();
        
    } catch (e) {
        console.error("Failed to save PDF", e);
        alert("Error saving PDF. Check console.");
    }
});
