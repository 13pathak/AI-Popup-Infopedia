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

// Store bookmarks in memory: { id: 1, pageNum: 5, title: 'Chapter 1' }
let bookmarks = [];
let bookmarkCounter = 0;
let autoSavedLastPage = 1;

// Extract PDF URL from query string, e.g. custom-viewer.html?file=abc.pdf
const urlParams = new URLSearchParams(window.location.search);
let fileUrl = urlParams.get('file');

if (!fileUrl) {
    // Fallback for testing
    fileUrl = '../../test.pdf';
}

function hasChromeStorage() {
    return typeof chrome !== 'undefined' && Boolean(chrome && chrome.storage && chrome.storage.local);
}

async function loadStorageData() {
    return new Promise((resolve) => {
        if (!hasChromeStorage()) {
            resolve(); // Not running in extension context
            return;
        }
        
        const highlightsKey = 'pdf_highlights_' + fileUrl;
        const bookmarksKey = 'pdf_bookmarks_' + fileUrl;
        const lastPageKey = 'pdf_lastpage_' + fileUrl;
        
        chrome.storage.local.get([highlightsKey, bookmarksKey, lastPageKey, 'pdf_dark_mode'], (result) => {
            if (result.pdf_dark_mode) {
                document.body.classList.add('dark-mode');
                const darkBtn = document.getElementById('dark_mode_toggle');
                if (darkBtn) darkBtn.innerHTML = '☀️ Light Mode';
            }
            if (result[highlightsKey]) {
                highlights = result[highlightsKey];
                if (highlights.length > 0) {
                    highlightCounter = highlights.reduce((max, h) => Math.max(max, (h && h.id) || 0), 0);
                }
            }
            if (result[bookmarksKey]) {
                bookmarks = result[bookmarksKey];
                if (bookmarks.length > 0) {
                    bookmarkCounter = bookmarks.reduce((max, b) => Math.max(max, (b && b.id) || 0), 0);
                }
            }
            if (result[lastPageKey]) {
                autoSavedLastPage = parseInt(result[lastPageKey], 10) || 1;
            }
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof renderBookmarks === 'function') renderBookmarks();
            resolve();
        });
    });
}

function saveHighlights() {
    if (!hasChromeStorage()) return;
    const storageKey = 'pdf_highlights_' + fileUrl;
    chrome.storage.local.set({ [storageKey]: highlights });
    if (typeof renderSidebar === 'function') renderSidebar();
}

function saveBookmarks() {
    if (!hasChromeStorage()) return;
    const storageKey = 'pdf_bookmarks_' + fileUrl;
    chrome.storage.local.set({ [storageKey]: bookmarks });
    if (typeof renderBookmarks === 'function') renderBookmarks();
}

function saveLastPage(pageNum) {
    if (!hasChromeStorage()) return;
    const storageKey = 'pdf_lastpage_' + fileUrl;
    chrome.storage.local.set({ [storageKey]: pageNum });
}

async function setupPage(num) {
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: scale });

    // Create wrapper for this page
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;
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
    // Ensure ultra-crisp text by rendering at a higher internal resolution (at least 2x)
    const outputScale = Math.max(window.devicePixelRatio || 1, 2);

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    
    // Use exact floating point dimensions for CSS to avoid subpixel scaling blur
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    pageDiv.appendChild(canvas);

    // Create text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
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
    drawSearchHighlightsForPage(parseInt(pageDiv.dataset.pageNumber), pageDiv, viewport);
    renderLinkAnnotations(page, pageDiv, viewport);
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
        await loadStorageData();
        pdfDoc = await pdfjsLib.getDocument(fileUrl).promise;
        pageCountSpan.textContent = pdfDoc.numPages;
        await renderAllPages();
        
        pdfDoc.getOutline().then(outline => {
            renderOutline(outline);
        }).catch(err => console.error("Error fetching outline", err));
        
        // Auto-resume
        if (autoSavedLastPage > 1 && autoSavedLastPage <= pdfDoc.numPages) {
            setTimeout(() => {
                scrollToPage(autoSavedLastPage);
            }, 300); // small delay to ensure rendering has caught up
        }
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
let currentZoomMode = 'custom';

async function calculateScaleAndRender() {
    if (currentZoomMode === 'custom') {
        renderAllPages();
        return;
    }
    
    if (!pdfDoc) return;
    
    const page = await pdfDoc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const container = document.getElementById('viewerContainer');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    if (currentZoomMode === 'page-width') {
        scale = (containerWidth - 40) / unscaledViewport.width; // 40px padding for scrollbars
    } else if (currentZoomMode === 'page-fit') {
        const scaleWidth = (containerWidth - 40) / unscaledViewport.width;
        const scaleHeight = (containerHeight - 40) / unscaledViewport.height;
        scale = Math.min(scaleWidth, scaleHeight);
    }
    
    if (scale < 0.25) scale = 0.25;
    if (scale > 5.0) scale = 5.0;
    
    renderAllPages();
}

document.getElementById('zoom_in').addEventListener('click', () => {
    if (!pdfDoc) return;
    currentZoomMode = 'custom';
    scale += 0.25;
    renderAllPages();
});

document.getElementById('zoom_out').addEventListener('click', () => {
    if (!pdfDoc) return;
    currentZoomMode = 'custom';
    if (scale <= 0.5) return;
    scale -= 0.25;
    renderAllPages();
});

document.getElementById('fit_width').addEventListener('click', () => {
    if (!pdfDoc) return;
    currentZoomMode = 'page-width';
    calculateScaleAndRender();
});

document.getElementById('fit_page').addEventListener('click', () => {
    if (!pdfDoc) return;
    currentZoomMode = 'page-fit';
    calculateScaleAndRender();
});

window.addEventListener('resize', () => {
    if (currentZoomMode !== 'custom') {
        calculateScaleAndRender();
    }
});
// Update page number based on scroll
const container = document.getElementById('viewerContainer');
container.addEventListener('scroll', updatePageNumber);
let scrollSaveTimeout = null;

function updatePageNumber() {
    // Do not update while the user is actively typing in the input
    if (document.activeElement === document.getElementById('page_num')) return;
    
    const pages = document.querySelectorAll('.page');
    const containerCenter = container.scrollTop + (container.clientHeight / 2);
    
    for (const page of pages) {
        if (page.offsetTop <= containerCenter && (page.offsetTop + page.clientHeight) > containerCenter) {
            const currentNum = parseInt(page.dataset.pageNumber, 10);
            document.getElementById('page_num').value = currentNum;
            
            // Auto-resume save logic (debounced to avoid spamming storage)
            if (autoSavedLastPage !== currentNum) {
                autoSavedLastPage = currentNum;
                clearTimeout(scrollSaveTimeout);
                scrollSaveTimeout = setTimeout(() => {
                    saveLastPage(currentNum);
                }, 1000);
            }
            break;
        }
    }
}

// Handle page navigation via input
const pageNumInput = document.getElementById('page_num');
pageNumInput.addEventListener('change', () => {
    let num = parseInt(pageNumInput.value);
    if (isNaN(num)) return;
    if (num < 1) num = 1;
    if (pdfDoc && num > pdfDoc.numPages) num = pdfDoc.numPages;
    
    pageNumInput.value = num;
    pageNumInput.blur(); // remove focus
    
    if (typeof scrollToPage === 'function') {
        scrollToPage(num);
    }
});

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

// Markup tools logic
let currentMarkupType = 'Highlight';
document.querySelectorAll('.markup-tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.markup-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMarkupType = btn.dataset.type;
    });
});

// Color buttons logic
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        
        if (activeHighlightId !== null) {
            // Edit existing highlight
            const hl = highlights.find(h => h.id === activeHighlightId);
            if (hl) {
                hl.color = color;
                document.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => {
                    if (hl.markupType === 'Underline' || hl.markupType === 'StrikeOut') {
                        el.style.borderColor = color;
                    } else {
                        el.style.backgroundColor = color;
                    }
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
            text: currentSelection.text,
            markupType: currentMarkupType
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
        
        const mType = hl.markupType || 'Highlight';
        if (mType === 'Underline') {
            div.classList.add('markup-underline');
            div.style.borderColor = hl.color;
        } else if (mType === 'StrikeOut') {
            div.classList.add('markup-strikethrough');
            div.style.borderColor = hl.color;
        } else {
            div.style.backgroundColor = hl.color;
        }
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

document.getElementById('dark_mode_toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const btn = document.getElementById('dark_mode_toggle');
    btn.innerHTML = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
    if (hasChromeStorage()) {
        chrome.storage.local.set({ 'pdf_dark_mode': isDark });
    }
});

document.getElementById('bookmark_page').addEventListener('click', () => {
    const pageNum = parseInt(document.getElementById('page_num').value) || 1;
    
    // Check if already bookmarked
    if (bookmarks.some(b => b.pageNumber === pageNum)) {
        alert(`Page ${pageNum} is already bookmarked!`);
        return;
    }
    
    const customName = prompt(`Enter a name for this bookmark:`, `Page ${pageNum}`);
    if (customName !== null) { // if not cancelled
        bookmarkCounter++;
        const newBookmark = {
            id: bookmarkCounter,
            pageNumber: pageNum,
            title: customName.trim() || `Page ${pageNum}`
        };
        bookmarks.push(newBookmark);
        saveBookmarks();
        
        // Open the bookmarks sidebar tab to show feedback
        document.getElementById('icon-tab-bookmarks').click();
    }
});

document.getElementById('summarize_page').addEventListener('click', async () => {
    const pageNum = parseInt(document.getElementById('page_num').value) || 1;
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(i => i.str).join(' ');

    if (!pageText.trim()) {
        alert('No text found on this page to summarize.');
        return;
    }

    // Position popup near the center of the viewer
    const containerRect = document.getElementById('viewerContainer').getBoundingClientRect();
    const rect = {
        left: containerRect.left + (containerRect.width / 2) - 150,
        top: containerRect.top + 100,
        bottom: containerRect.top + 100,
        right: containerRect.left + (containerRect.width / 2) - 150
    };

    const prompt = "Please generate a concise, bulleted summary of the following page content:\n\n{word}";

    const event = new CustomEvent('trigger-ai-popup', {
        detail: { rect: rect, text: pageText, prompt: prompt }
    });
    document.dispatchEvent(event);
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

// Convert hex color to rgb ratios for pdf-lib (returns { r: 0-1, g: 0-1, b: 0-1 })
function hexToRgb(hex) {
    const defaultColor = { r: 1, g: 1, b: 152 / 255 }; // Default yellow #FFFF98
    if (!hex || typeof hex !== 'string') {
        return defaultColor;
    }
    let cleanHex = hex.trim().replace(/^#/, '');
    if (cleanHex.length === 3 || cleanHex.length === 4) {
        cleanHex = cleanHex.slice(0, 3).split('').map(c => c + c).join('');
    }
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(cleanHex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : defaultColor;
}

document.getElementById('export_md').addEventListener('click', () => {
    if (highlights.length === 0) {
        alert("No annotations to export.");
        return;
    }
    
    // Sort highlights by page, then by Y position (top to bottom visually)
    const sortedHighlights = [...highlights].sort((a, b) => {
        if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
        const aTop = a.rects && a.rects[0] ? a.rects[0].pdfY : 0;
        const bTop = b.rects && b.rects[0] ? b.rects[0].pdfY : 0;
        return bTop - aTop;
    });

    let mdContent = "# PDF Annotations & Notes\n\n";
    let currentPage = -1;
    
    sortedHighlights.forEach(hl => {
        if (hl.pageNumber !== currentPage) {
            currentPage = hl.pageNumber;
            mdContent += `## Page ${currentPage}\n\n`;
        }
        
        const cleanText = (hl.text || '').replace(/\n/g, ' ');
        if (hl.markupType === 'Underline') {
            mdContent += `> <u>${cleanText}</u>\n`;
        } else if (hl.markupType === 'StrikeOut') {
            mdContent += `> ~~${cleanText}~~\n`;
        } else {
            mdContent += `> ==${cleanText}==\n`;
        }
        
        if (hl.note) {
            mdContent += `\n**Note:** ${hl.note}\n`;
        }
        mdContent += "\n---\n\n";
    });
    
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Annotations.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

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
                Subtype: hl.markupType || 'Highlight',
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

// ==================== Find Feature ====================
let currentSearchQuery = '';
let searchResults = [];
let activeMatchIndex = -1;
let isSearching = false;

const findInput = document.getElementById('findInput');
const findResultsSpan = document.getElementById('findResults');
const findNextBtn = document.getElementById('findNext');
const findPrevBtn = document.getElementById('findPrevious');

if (findNextBtn) findNextBtn.addEventListener('click', () => navigateSearch(1));
if (findPrevBtn) findPrevBtn.addEventListener('click', () => navigateSearch(-1));
if (findInput) {
    findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = findInput.value.trim();
            if (query === currentSearchQuery && query !== '') {
                navigateSearch(1);
            } else {
                performSearch(query);
            }
        }
    });
}

async function performSearch(query) {
    if (!query) {
        clearSearch();
        return;
    }
    
    if (isSearching) return;
    isSearching = true;
    currentSearchQuery = query;
    searchResults = [];
    activeMatchIndex = -1;
    findResultsSpan.textContent = "Searching...";

    const lowerQuery = query.toLowerCase();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        let pageText = '';
        const textItems = [];
        
        for (const item of textContent.items) {
            if (!item.str && item.width === 0) continue;
            
            textItems.push({
                ...item,
                startIndex: pageText.length,
                endIndex: pageText.length + item.str.length
            });
            pageText += item.str;
            
            if (item.hasEOL) {
                pageText += ' ';
            }
        }
        
        const lowerPageText = pageText.toLowerCase();
        
        let startIndex = 0;
        let index;
        while ((index = lowerPageText.indexOf(lowerQuery, startIndex)) > -1) {
            const matchStart = index;
            const matchEnd = index + lowerQuery.length;
            
            const matchItems = textItems.filter(item => 
                (matchStart < item.endIndex) && (matchEnd > item.startIndex)
            );
            
            if (matchItems.length > 0) {
                const rects = matchItems.map(item => {
                    const height = Math.abs(item.transform[3]);
                    return {
                        pdfX: item.transform[4],
                        pdfY: item.transform[5] + height, // top edge
                        pdfWidth: item.width,
                        pdfHeight: height
                    };
                });
                
                searchResults.push({
                    pageNumber: i,
                    rects: rects
                });
            }
            startIndex = index + 1;
        }
    }
    
    isSearching = false;
    
    if (searchResults.length > 0) {
        activeMatchIndex = 0;
        updateSearchUI();
        renderAllSearchHighlights();
        scrollToActiveMatch();
    } else {
        findResultsSpan.textContent = "0 / 0";
        renderAllSearchHighlights();
    }
}

function clearSearch() {
    currentSearchQuery = '';
    searchResults = [];
    activeMatchIndex = -1;
    findResultsSpan.textContent = "0 / 0";
    renderAllSearchHighlights();
}

function navigateSearch(direction) {
    if (searchResults.length === 0) return;
    
    activeMatchIndex += direction;
    if (activeMatchIndex >= searchResults.length) activeMatchIndex = 0;
    if (activeMatchIndex < 0) activeMatchIndex = searchResults.length - 1;
    
    updateSearchUI();
    renderAllSearchHighlights();
    scrollToActiveMatch();
}

function updateSearchUI() {
    findResultsSpan.textContent = `${activeMatchIndex + 1} / ${searchResults.length}`;
}

function scrollToActiveMatch() {
    if (activeMatchIndex === -1) return;
    const match = searchResults[activeMatchIndex];
    
    const pageDiv = document.querySelector(`.page[data-page-number="${match.pageNumber}"]`);
    if (pageDiv) {
        const container = document.getElementById('viewerContainer');
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageDiv.getBoundingClientRect();
        
        if (pageRect.top < containerRect.top || pageRect.bottom > containerRect.bottom) {
            container.scrollTop = container.scrollTop + (pageRect.top - containerRect.top) - 20;
        }
    } else {
        // Find approximate position if page not rendered yet
        const container = document.getElementById('viewerContainer');
        // We know roughly 800px per page or just scroll by percentage
        const scrollHeight = container.scrollHeight;
        container.scrollTop = (match.pageNumber / pdfDoc.numPages) * scrollHeight;
    }
}

function drawSearchHighlightsForPage(pageNumber, pageDiv, viewport) {
    pageDiv.querySelectorAll('.search-highlight').forEach(el => el.remove());
    if (searchResults.length === 0) return;
    
    searchResults.forEach((match, index) => {
        if (match.pageNumber === pageNumber) {
            match.rects.forEach(r => {
                const div = document.createElement('div');
                div.className = 'search-highlight';
                if (index === activeMatchIndex) div.classList.add('active');
                
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
                pageDiv.appendChild(div);
            });
        }
    });
}

function renderAllSearchHighlights() {
    const pages = document.querySelectorAll('.page[data-loaded="true"]');
    pages.forEach(pageDiv => {
        const pageNum = parseInt(pageDiv.dataset.pageNumber);
        if (pageDiv._viewport) {
            drawSearchHighlightsForPage(pageNum, pageDiv, pageDiv._viewport);
        }
    });
}

// Intercept Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea (except Escape)
    const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    
    if (e.key === 'Escape') {
        hidePopups();
        if (isInput) document.activeElement.blur();
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const findInput = document.getElementById('findInput');
        if (findInput) {
            findInput.focus();
            findInput.select();
        }
        return;
    }
    
    // Zoom shortcuts
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        document.getElementById('zoom_in').click();
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        document.getElementById('zoom_out').click();
        return;
    }
    
    if (!isInput) {
        // Page Navigation with Left/Right Arrows
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const currentPage = parseInt(document.getElementById('page_num').value) || 1;
            if (currentPage < pdfDoc.numPages) {
                if (typeof scrollToPage === 'function') scrollToPage(currentPage + 1);
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const currentPage = parseInt(document.getElementById('page_num').value) || 1;
            if (currentPage > 1) {
                if (typeof scrollToPage === 'function') scrollToPage(currentPage - 1);
            }
        }
    }
});

// ==================== Interactive Links ====================
async function renderLinkAnnotations(page, pageDiv, viewport) {
    try {
        const annots = await page.getAnnotations();
        const linkAnnots = annots.filter(a => a.subtype === 'Link');
        
        if (linkAnnots.length === 0) return;
        
        const annotationLayerDiv = document.createElement('div');
        annotationLayerDiv.className = 'annotationLayer';
        pageDiv.appendChild(annotationLayerDiv);
        
        linkAnnots.forEach(annot => {
            if (!annot.rect) return;
            
            const rect = annot.rect;
            const pt1 = viewport.convertToViewportPoint(rect[0], rect[1]);
            const pt2 = viewport.convertToViewportPoint(rect[2], rect[3]);
            
            const cssLeft = Math.min(pt1[0], pt2[0]);
            const cssTop = Math.min(pt1[1], pt2[1]);
            const cssWidth = Math.abs(pt2[0] - pt1[0]);
            const cssHeight = Math.abs(pt2[1] - pt1[1]);
            
            const linkEl = document.createElement('div');
            linkEl.className = 'linkAnnotation';
            linkEl.style.left = `${cssLeft}px`;
            linkEl.style.top = `${cssTop}px`;
            linkEl.style.width = `${cssWidth}px`;
            linkEl.style.height = `${cssHeight}px`;
            linkEl.title = annot.url || "Go to page";
            
            linkEl.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (annot.url) {
                    window.open(annot.url, '_blank', 'noopener,noreferrer');
                } else if (annot.dest) {
                    try {
                        let dest = annot.dest;
                        if (typeof dest === 'string') {
                            dest = await pdfDoc.getDestination(dest);
                        }
                        
                        if (dest && dest[0]) {
                            const pageIndex = await pdfDoc.getPageIndex(dest[0]);
                            const targetPageNumber = pageIndex + 1;
                            scrollToPage(targetPageNumber);
                        }
                    } catch (err) {
                        console.error("Error resolving link destination:", err);
                    }
                }
            });
            
            annotationLayerDiv.appendChild(linkEl);
        });
    } catch (e) {
        console.error("Error rendering annotations", e);
    }
}

function scrollToPage(pageNumber) {
    const pageDiv = document.querySelector(`.page[data-page-number="${pageNumber}"]`);
    const container = document.getElementById('viewerContainer');
    if (pageDiv) {
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageDiv.getBoundingClientRect();
        container.scrollTop = container.scrollTop + (pageRect.top - containerRect.top) - 20;
    } else {
        // Approximate position if page not loaded yet
        const scrollHeight = container.scrollHeight;
        container.scrollTop = ((pageNumber - 1) / pdfDoc.numPages) * scrollHeight;
    }
}

// ==================== Sidebar & Outline Feature ====================
const sidebar = document.getElementById('sidebar');
const tabComments = document.getElementById('icon-tab-comments');
const tabOutline = document.getElementById('icon-tab-outline');
const tabBookmarks = document.getElementById('icon-tab-bookmarks');
const contentComments = document.getElementById('sidebar-content-comments');
const contentOutline = document.getElementById('sidebar-content-outline');
const contentBookmarks = document.getElementById('sidebar-content-bookmarks');
const sidebarTitle = document.getElementById('sidebar-title');

function switchTab(tabName) {
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        window.dispatchEvent(new Event('resize'));
    }
    
    tabComments.classList.remove('active');
    tabOutline.classList.remove('active');
    tabBookmarks.classList.remove('active');
    contentComments.classList.add('hidden');
    contentOutline.classList.add('hidden');
    contentBookmarks.classList.add('hidden');
    
    if (tabName === 'comments') {
        tabComments.classList.add('active');
        contentComments.classList.remove('hidden');
        sidebarTitle.textContent = 'Comments';
        renderSidebar(); // re-render comments
    } else if (tabName === 'outline') {
        tabOutline.classList.add('active');
        contentOutline.classList.remove('hidden');
        sidebarTitle.textContent = 'Outline';
    } else if (tabName === 'bookmarks') {
        tabBookmarks.classList.add('active');
        contentBookmarks.classList.remove('hidden');
        sidebarTitle.textContent = 'Bookmarks';
        renderBookmarks(); // re-render bookmarks
    }
}

tabComments.addEventListener('click', () => switchTab('comments'));
tabOutline.addEventListener('click', () => switchTab('outline'));
tabBookmarks.addEventListener('click', () => switchTab('bookmarks'));

document.getElementById('close_sidebar').addEventListener('click', () => {
    sidebar.classList.add('hidden');
    tabComments.classList.remove('active');
    tabOutline.classList.remove('active');
    tabBookmarks.classList.remove('active');
    window.dispatchEvent(new Event('resize'));
});

function renderSidebar() {
    const sidebarContent = document.getElementById('sidebar-content-comments');
    if (!sidebarContent) return;
    
    sidebarContent.innerHTML = '';
    
    if (highlights.length === 0) {
        sidebarContent.innerHTML = '<div class="sidebar-empty-msg">No comments or highlights yet.</div>';
        return;
    }
    
    // Sort highlights by page number, then by vertical position
    const sortedHighlights = [...highlights].sort((a, b) => {
        if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
        const aTop = a.rects && a.rects[0] ? a.rects[0].pdfY : 0;
        const bTop = b.rects && b.rects[0] ? b.rects[0].pdfY : 0;
        return bTop - aTop; // In PDF space, higher Y is visually higher on the page
    });
    
    sortedHighlights.forEach(hl => {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        
        // Header (Page & Color)
        const header = document.createElement('div');
        header.className = 'sidebar-item-header';
        
        const pageSpan = document.createElement('span');
        pageSpan.className = 'sidebar-item-page';
        
        let typeIcon = '🖌️';
        if (hl.markupType === 'Underline') typeIcon = '<u>U</u>';
        else if (hl.markupType === 'StrikeOut') typeIcon = '<s>S</s>';
        
        pageSpan.innerHTML = `Page ${hl.pageNumber} <span style="margin-left: 5px; font-size: 10px;">${typeIcon}</span>`;
        
        const colorSpan = document.createElement('span');
        colorSpan.className = 'sidebar-item-color';
        colorSpan.style.backgroundColor = hl.color;
        
        header.appendChild(pageSpan);
        header.appendChild(colorSpan);
        item.appendChild(header);
        
        // Highlighted text snippet
        if (hl.text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'sidebar-item-text';
            textDiv.textContent = hl.text;
            item.appendChild(textDiv);
        }
        
        // Note Input
        const noteInput = document.createElement('textarea');
        noteInput.className = 'sidebar-item-note-input';
        noteInput.placeholder = 'Add a comment...';
        noteInput.value = hl.note || '';
        
        noteInput.addEventListener('change', () => {
            hl.note = noteInput.value.trim() || null;
            saveHighlights();
            updateHighlightIndicatorsOnPage(hl);
        });
        
        item.appendChild(noteInput);
        
        // Actions (Delete)
        const actions = document.createElement('div');
        actions.className = 'sidebar-item-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'sidebar-item-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent clicking the item itself
            
            // Remove from global array
            highlights = highlights.filter(h => h.id !== hl.id);
            saveHighlights();
            
            // Remove from DOM
            document.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => el.remove());
            document.querySelectorAll(`.note-indicator[data-hl-id="${hl.id}"]`).forEach(el => el.remove());
        });
        
        actions.appendChild(deleteBtn);
        item.appendChild(actions);
        
        // Click to jump to highlight
        item.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'textarea' || e.target.tagName.toLowerCase() === 'button') {
                return; // Let user type or click button
            }
            scrollToHighlight(hl);
        });
        
        sidebarContent.appendChild(item);
    });
}

function renderBookmarks() {
    const sidebarContent = document.getElementById('sidebar-content-bookmarks');
    if (!sidebarContent) return;
    
    sidebarContent.innerHTML = '';
    
    if (bookmarks.length === 0) {
        sidebarContent.innerHTML = '<div class="sidebar-empty-msg">No bookmarks yet.</div>';
        return;
    }
    
    // Sort bookmarks by page number
    const sortedBookmarks = [...bookmarks].sort((a, b) => a.pageNumber - b.pageNumber);
    
    sortedBookmarks.forEach(bk => {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        
        const header = document.createElement('div');
        header.className = 'sidebar-item-header';
        
        const pageSpan = document.createElement('span');
        pageSpan.className = 'sidebar-item-page';
        pageSpan.innerHTML = `Page ${bk.pageNumber} <span style="margin-left: 5px; font-size: 10px;">📌</span>`;
        
        header.appendChild(pageSpan);
        item.appendChild(header);
        
        // Editable Title Input
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'sidebar-item-note-input'; // reusing styling
        titleInput.placeholder = 'Name this bookmark...';
        titleInput.value = bk.title || '';
        titleInput.style.marginTop = '5px';
        titleInput.style.padding = '4px';
        titleInput.style.width = 'calc(100% - 10px)';
        
        titleInput.addEventListener('change', () => {
            bk.title = titleInput.value.trim() || `Page ${bk.pageNumber}`;
            saveBookmarks();
        });
        
        item.appendChild(titleInput);
        
        // Actions (Delete)
        const actions = document.createElement('div');
        actions.className = 'sidebar-item-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'sidebar-item-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bookmarks = bookmarks.filter(b => b.id !== bk.id);
            saveBookmarks();
        });
        
        actions.appendChild(deleteBtn);
        item.appendChild(actions);
        
        // Click to jump to bookmark
        item.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button') {
                return;
            }
            scrollToPage(bk.pageNumber);
        });
        
        sidebarContent.appendChild(item);
    });
}


function updateHighlightIndicatorsOnPage(hl) {
    const pageDiv = document.querySelector(`.page[data-page-number="${hl.pageNumber}"]`);
    if (pageDiv) {
        pageDiv.querySelectorAll(`.note-indicator[data-hl-id="${hl.id}"]`).forEach(el => el.remove());
        if (hl.note) {
            // Remove existing rects and redraw them to place the indicator back correctly
            pageDiv.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => el.remove());
            drawHighlight(hl, pageDiv, pageDiv._viewport);
        }
    }
}

function scrollToHighlight(hl) {
    if (!hl || !hl.rects || hl.rects.length === 0) return;
    
    const pageDiv = document.querySelector(`.page[data-page-number="${hl.pageNumber}"]`);
    const container = document.getElementById('viewerContainer');
    
    if (pageDiv && pageDiv._viewport) {
        // Target specific Y position within the page
        const firstRect = hl.rects[0];
        const pt = pageDiv._viewport.convertToViewportPoint(firstRect.pdfX, firstRect.pdfY);
        const yPosInPage = pt[1];
        
        container.scrollTop = pageDiv.offsetTop + yPosInPage - (container.clientHeight / 2);
        
        // Briefly flash active highlight
        document.querySelectorAll('.custom-highlight.active').forEach(el => el.classList.remove('active'));
        pageDiv.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => {
            el.classList.add('active');
            setTimeout(() => el.classList.remove('active'), 2000);
        });
        
    } else {
        // Page not loaded yet, just scroll to page
        scrollToPage(hl.pageNumber);
    }
}

function renderOutline(outline) {
    if (!outline || outline.length === 0) {
        contentOutline.innerHTML = '<div class="sidebar-empty-msg">No outline available.</div>';
        return;
    }
    
    contentOutline.innerHTML = '';
    
    const renderItems = (items, container) => {
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'outline-item';
            
            const titleRow = document.createElement('div');
            titleRow.className = 'outline-item-title';
            
            // Toggle chevron
            const toggle = document.createElement('span');
            toggle.className = 'outline-toggle';
            if (item.items && item.items.length > 0) {
                toggle.textContent = '▼';
            } else {
                toggle.textContent = '';
                toggle.style.cursor = 'default';
            }
            titleRow.appendChild(toggle);
            
            // Title text
            const titleLink = document.createElement('a');
            titleLink.textContent = item.title;
            titleLink.title = item.title;
            titleLink.href = 'javascript:void(0)';
            
            if (item.bold) titleLink.style.fontWeight = 'bold';
            if (item.italic) titleLink.style.fontStyle = 'italic';
            
            titleRow.appendChild(titleLink);
            itemDiv.appendChild(titleRow);
            
            // Children container
            let childrenContainer = null;
            if (item.items && item.items.length > 0) {
                childrenContainer = document.createElement('div');
                childrenContainer.className = 'outline-children';
                renderItems(item.items, childrenContainer);
                itemDiv.appendChild(childrenContainer);
                
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    childrenContainer.classList.toggle('hidden');
                    toggle.classList.toggle('collapsed');
                });
            }
            
            // Click to navigate
            titleRow.addEventListener('click', async (e) => {
                if (e.target === toggle) return; // ignore toggle clicks
                
                if (item.url) {
                    window.open(item.url, '_blank', 'noopener,noreferrer');
                } else if (item.dest) {
                    try {
                        let dest = item.dest;
                        if (typeof dest === 'string') {
                            dest = await pdfDoc.getDestination(dest);
                        }
                        if (dest && dest[0]) {
                            const pageIndex = await pdfDoc.getPageIndex(dest[0]);
                            scrollToPage(pageIndex + 1);
                        }
                    } catch (err) {
                        console.error("Error resolving outline destination:", err);
                    }
                }
            });
            
            container.appendChild(itemDiv);
        });
    };
    
    renderItems(outline, contentOutline);
}

// --- NEW: Trackpad Pinch-to-Zoom Support ---
let pinchZoomTimeout = null;
let currentPinchScale = 1.0;
let initialScaleBeforePinch = 1.0;
let isPinching = false;

document.getElementById('viewerContainer').addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault(); // Prevent default browser zoom
        isPinching = true;
        
        if (pinchZoomTimeout === null) {
             initialScaleBeforePinch = scale;
        }

        // Adjust scale smoothly based on delta
        const delta = -e.deltaY * 0.01;
        let newScale = scale * Math.exp(delta);
        
        if (newScale < 0.5) newScale = 0.5;
        if (newScale > 3.0) newScale = 3.0;
        
        scale = newScale;
        
        // Update UI
        const zoomSpan = document.getElementById('zoom_level');
        if(zoomSpan) {
            zoomSpan.textContent = Math.round(scale * 100) + "%";
        }
        
        // Visual feedback using CSS transform for smoothness
        currentPinchScale = scale / initialScaleBeforePinch;
        const viewer = document.getElementById('viewer');
        if (viewer) {
            // Set transform origin based on mouse position relative to viewer
            const rect = viewer.getBoundingClientRect();
            const originX = e.clientX - rect.left;
            const originY = e.clientY - rect.top;
            
            // Only set origin once at start of pinch to prevent jitter
            if (!viewer.style.transformOrigin || pinchZoomTimeout === null) {
                viewer.style.transformOrigin = `${originX}px ${originY}px`;
            }
            
            viewer.style.transform = `scale(${currentPinchScale})`;
        }

        clearTimeout(pinchZoomTimeout);
        pinchZoomTimeout = setTimeout(() => {
            isPinching = false;
            if (viewer) {
                viewer.style.transform = 'none';
                viewer.style.transformOrigin = ''; // reset
            }
            pinchZoomTimeout = null;
            renderAllPages(); // Re-render at new crisp resolution
        }, 200);
    } else if (isPinching) {
        // Prevent accidental scrolling while the user is actively pinching
        e.preventDefault();
    }
}, { passive: false });
