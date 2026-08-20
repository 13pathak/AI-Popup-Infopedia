import * as pdfjsLib from '../build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../build/pdf.worker.mjs';

// Inline SVG icon set (currentColor, follows light/dark button colors).
const VIEWER_ICON_PATHS = {
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  alertTriangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  messageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  highlighter: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'
};

function viewerIconSvg(name, size = 14) {
  const paths = VIEWER_ICON_PATHS[name];
  if (!paths) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;" aria-hidden="true">${paths}</svg>`;
}

// The toolbar toggle swaps its whole content on state change; keep the
// markup identical to the static HTML in custom-viewer.html.
function darkModeButtonHtml(isDark) {
  return isDark
    ? `${viewerIconSvg('sun', 14)} Light Mode`
    : `${viewerIconSvg('moon', 14)} Dark Mode`;
}

function applyViewerDarkMode(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  const darkBtn = document.getElementById('dark_mode_toggle');
  if (darkBtn) darkBtn.innerHTML = darkModeButtonHtml(isDark);
}

// uiTheme ('dark' | 'light' | 'auto') is the extension-wide theme from the
// options page. 'auto' resolves to dark unless the system prefers light,
// matching the popup CSS in content.js, whose no-match default is dark.
function uiThemePrefersDark(uiTheme) {
  if (uiTheme === 'light') return false;
  if (uiTheme === 'auto') {
    return !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }
  return true;
}

// Icon + title + hint for empty sidebar tabs (static strings, no user data).
function sidebarEmptyHtml(iconName, title, hint) {
  return `<div class="sidebar-empty-msg">${viewerIconSvg(iconName, 26)}<div>${title}</div><div class="sidebar-empty-hint">${hint}</div></div>`;
}

// --- Lightweight modal dialogs (replace native alert/prompt) ---
// Titles/messages/initial values are set via textContent/value, so nothing
// is parsed as HTML. Resolves: alert -> undefined; prompt -> string, or
// null when cancelled (Escape / backdrop / Cancel), matching window.prompt.
function buildViewerModal({ title, message = '', placeholder = '', initialValue = '', confirmText = 'OK', cancelText = null, wantInput = false }) {
  return new Promise((resolve) => {
    // One modal at a time.
    document.getElementById('viewer-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'viewer-modal-overlay';

    const box = document.createElement('div');
    box.className = 'viewer-modal';
    box.addEventListener('mousedown', (e) => e.stopPropagation());

    const heading = document.createElement('h3');
    heading.textContent = title;
    box.appendChild(heading);

    if (message) {
      const msg = document.createElement('p');
      msg.textContent = message;
      box.appendChild(msg);
    }

    let input = null;
    if (wantInput) {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.value = initialValue;
      box.appendChild(input);
    }

    const actions = document.createElement('div');
    actions.className = 'viewer-modal-actions';

    const primary = document.createElement('button');
    primary.className = 'viewer-modal-primary';
    primary.textContent = confirmText;
    primary.addEventListener('click', () => done(input ? input.value : undefined));
    actions.appendChild(primary);

    if (cancelText) {
      const secondary = document.createElement('button');
      secondary.className = 'viewer-modal-secondary';
      secondary.textContent = cancelText;
      secondary.addEventListener('click', () => done(null));
      actions.appendChild(secondary);
    }
    box.appendChild(actions);
    overlay.appendChild(box);

    function done(result) {
      // Capture-phase Escape guard is removed with the dialog itself.
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }

    // Escape closes the dialog but must not also close AI popups behind it.
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(null);
      }
    }
    document.addEventListener('keydown', onKey, true);

    // Clicking the dark backdrop cancels; clicks inside the card are stopped above.
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) done(null);
    });

    document.body.appendChild(overlay);

    if (input) {
      input.focus();
      input.select();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          done(input.value);
        }
      });
    } else {
      primary.focus();
    }
  });
}

function viewerAlert(title, message) {
  return buildViewerModal({ title, message, confirmText: 'OK' });
}

function viewerPromptDialog(title, message, initialValue, placeholder) {
  return buildViewerModal({
    title,
    message,
    initialValue,
    placeholder,
    confirmText: 'Save',
    cancelText: 'Cancel',
    wantInput: true
  });
}

let pdfDoc = null;
let scale = 1.25; // Adjusted scale as default zoom
// Every scale writer (zoom buttons, fit modes, pinch) clamps to this
// shared range; unbounded zoom pushes canvas backing stores past
// browser limits and pages stop rendering.
const MIN_SCALE = 0.25;
const MAX_SCALE = 5.0;
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
    fileUrl = '../../test_highlight.pdf';
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
        // Per-document toggle override; when unset, the viewer defaults to
        // the extension-wide uiTheme (supersedes the old global
        // 'pdf_dark_mode' key, which is no longer read).
        const darkModeKey = 'pdf_dark_mode_' + fileUrl;

        chrome.storage.local.get([highlightsKey, bookmarksKey, lastPageKey, darkModeKey], (result) => {
            if (result[darkModeKey] !== undefined) {
                applyViewerDarkMode(result[darkModeKey] === true);
            } else if (chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get({ uiTheme: 'dark' }, (syncData) => {
                    applyViewerDarkMode(uiThemePrefersDark(syncData && syncData.uiTheme));
                });
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
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;
    pageDiv.dataset.pageNumber = num;
    pageDiv.dataset.loaded = "false";

    pageDiv._pdfPage = page;
    pageDiv._viewport = viewport;
    return pageDiv;
}

async function renderPageContent(pageDiv) {
    if (pageDiv.dataset.loaded === "true" || pageDiv.dataset.loaded === "rendering") return;
    pageDiv.dataset.loaded = "rendering";

    try {
        // Clean up any leftover DOM nodes from a previous failed attempt
        pageDiv.innerHTML = '';

        const page = pageDiv._pdfPage;
        const viewport = pageDiv._viewport;
        let outputScale = Math.max(window.devicePixelRatio || 1, 2);
        // Cap the backing store below browser canvas limits (Chrome:
        // 65535 px per side, 2^28 total pixels) — exceeding them makes
        // the page render blank. Lowering outputScale only softens the
        // image; the canvas keeps its viewport-sized CSS dimensions.
        const cssLongSide = Math.max(viewport.width, viewport.height);
        if (cssLongSide * outputScale > 65535 ||
            viewport.width * viewport.height * outputScale * outputScale > 2 ** 28) {
            const sideFactor = 65535 / cssLongSide;
            const areaFactor = Math.sqrt((2 ** 28) / (viewport.width * viewport.height));
            outputScale = Math.max(1, Math.min(sideFactor, areaFactor));
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";
        pageDiv.appendChild(canvas);

        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.setProperty('--scale-factor', viewport.scale);
        pageDiv.appendChild(textLayerDiv);

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        const renderContext = { canvasContext: ctx, transform, viewport };

        const renderTask = page.render(renderContext).promise;
        const textContent = await page.getTextContent();
        const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
        });

        await Promise.all([renderTask, textLayer.render()]);

        // A zoom/fit during the awaits above swapped pageDiv._viewport and
        // resized the div, but everything so far used the stale viewport.
        // The zoom path skips "rendering" pages (unload no-ops, re-render
        // early-returns), so redo the render at the current scale here.
        if (pageDiv._viewport !== viewport) {
            pageDiv.dataset.loaded = "false";
            renderPageContent(pageDiv);
            return;
        }

        drawHighlightsForPage(parseInt(pageDiv.dataset.pageNumber), pageDiv, viewport);
        drawSearchHighlightsForPage(parseInt(pageDiv.dataset.pageNumber), pageDiv, viewport);
        renderLinkAnnotations(page, pageDiv, viewport);

        pageDiv.dataset.loaded = "true";
    } catch (err) {
        console.error(`Error rendering page ${pageDiv.dataset.pageNumber}:`, err);
        pageDiv.innerHTML = '';
        pageDiv.dataset.loaded = "error";
    }
}

function unloadPageContent(pageDiv) {
    if (pageDiv.dataset.loaded !== "true") return;

    const canvas = pageDiv.querySelector('canvas');
    if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
    }

    pageDiv.innerHTML = '';
    pageDiv.dataset.loaded = "false";
}

const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            renderPageContent(entry.target);
        } else {
            unloadPageContent(entry.target);
        }
    });
}, {
    root: document.getElementById('viewerContainer'),
    rootMargin: '200% 0px 200% 0px' // Buffer 2 viewports above and below
});

// fetch() — which is what PDF.js uses for every URL — cannot read file://
// origins: Chromium rejects the scheme outright, "Allow access to file
// URLs" or not. XMLHttpRequest still honours that toggle, so local files
// take a detour: read the bytes here and hand PDF.js a buffer instead of
// a URL (giving up range requests, which local reads don't need anyway).
function readLocalFileViaXhr(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
            if (xhr.response) {
                resolve(new Uint8Array(xhr.response));
            } else {
                const err = new Error('Local file read returned no data.');
                err.name = 'LocalFileException';
                reject(err);
            }
        };
        xhr.onerror = () => {
            // Near-always the "Allow access to file URLs" toggle being off.
            const err = new Error('Local file could not be read.');
            err.name = 'LocalFileException';
            reject(err);
        };
        xhr.send();
    });
}

async function loadPDF() {
    // Distinguishes "user closed the password prompt" from real failures
    // for the catch below: destroy() rejects with an internal PDF.js error
    // that would otherwise print a scary generic message.
    let passwordCancelled = false;
    try {
        await loadStorageData();
        // CJK PDFs need CMap data and some PDFs rely on non-embedded
        // standard fonts; without these URLs glyphs render garbled and text
        // extraction (selection/search/highlights) fails on those documents.
        // This PDF.js build fetches both from the main thread, so the URLs
        // are document-relative (like workerSrc above).
        const docParams = {
            cMapUrl: './cmaps/',
            cMapPacked: true,
            standardFontDataUrl: './standard_fonts/',
            // This page's origin is chrome-extension://, so PDF.js's
            // default credentials:"same-origin" never matches the PDF's
            // site and session cookies are dropped — yet the intercepted
            // navigation would have sent them. "include" restores
            // cookie-authenticated PDFs (university proxies etc.);
            // host_permissions already exempts the fetch from CORS.
            withCredentials: true
        };
        if (/^file:/i.test(fileUrl)) {
            docParams.data = await readLocalFileViaXhr(fileUrl);
        } else {
            docParams.url = fileUrl;
        }
        const loadingTask = pdfjsLib.getDocument(docParams);
        // Protected documents open here instead of dead-ending: PDF.js
        // requests the password through this callback (reason 1 on the
        // first ask, 2 after a wrong password) and retries on its own once
        // updatePassword runs. Cancelling tears the load down.
        loadingTask.onPassword = async (updatePassword, reason) => {
            const isRetry = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
            const password = await promptForPassword(isRetry);
            if (password === null) {
                passwordCancelled = true;
                loadingTask.destroy();
            } else {
                updatePassword(password);
            }
        };
        pdfDoc = await loadingTask.promise;
        document.querySelector('.pdf-password-prompt')?.remove();
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
        showLoadError(passwordCancelled ? { name: 'PasswordCancelled' } : e);
    }
}

// Shared "hand this document to Chrome's own viewer" button, offered on the
// password prompt and the load-error screen. The background worker marks
// the tab as bypassed before navigating, so the interception listeners
// don't immediately pull the document back into this viewer. Messages from
// extension pages like this one don't reliably carry sender.tab, so the
// page names its own tab via chrome.tabs.getCurrent and includes the id.
// Returns null when there is no meaningful target (relative test path) or
// no runtime.
function buildNativeViewerButton() {
    if (!/^(https?|file):/i.test(fileUrl)) return null;
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return null;
    const nativeBtn = document.createElement('button');
    nativeBtn.className = 'pdf-load-error-retry';
    nativeBtn.textContent = "Open in Chrome's built-in viewer";
    nativeBtn.addEventListener('click', () => {
        nativeBtn.disabled = true;
        const send = (tabId) => chrome.runtime.sendMessage({ type: 'openNativeViewer', url: fileUrl, tabId }, (resp) => {
            if (chrome.runtime.lastError || !resp || !resp.ok) {
                // Navigation never started (no tab id, blocked URL, dead
                // worker); leave the button usable instead of a dead end.
                nativeBtn.disabled = false;
            }
        });
        if (chrome.tabs && chrome.tabs.getCurrent) {
            chrome.tabs.getCurrent((tab) => {
                void chrome.runtime.lastError;
                send(tab ? tab.id : undefined);
            });
        } else {
            send(undefined);
        }
    });
    return nativeBtn;
}

// In-viewer password prompt. PDF.js re-invokes onPassword after every wrong
// attempt, so each call builds a fresh box replacing the previous disabled
// "checking…" one. Resolves the entered password, or null when cancelled.
function promptForPassword(isRetry) {
    return new Promise((resolve) => {
        const box = document.createElement('div');
        box.className = 'pdf-load-error pdf-password-prompt';

        const icon = document.createElement('div');
        icon.className = 'pdf-load-error-icon';
        icon.innerHTML = viewerIconSvg('lock', 36);
        const title = document.createElement('h2');
        title.textContent = 'This PDF is password protected';
        const msg = document.createElement('p');
        msg.textContent = 'Enter the password to open it here — highlights and popups stay available.';
        box.appendChild(icon);
        box.appendChild(title);
        box.appendChild(msg);

        if (isRetry) {
            const retry = document.createElement('p');
            retry.className = 'pdf-password-error';
            retry.textContent = 'Incorrect password, please try again.';
            box.appendChild(retry);
        }

        const form = document.createElement('form');
        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'pdf-password-input';
        input.placeholder = 'Password';
        input.autocomplete = 'off';
        const unlockBtn = document.createElement('button');
        unlockBtn.type = 'submit';
        unlockBtn.className = 'pdf-load-error-retry';
        unlockBtn.textContent = 'Unlock';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'pdf-password-cancel';
        cancelBtn.textContent = 'Cancel';
        form.appendChild(input);
        form.appendChild(unlockBtn);
        form.appendChild(cancelBtn);
        box.appendChild(form);

        const nativeBtn = buildNativeViewerButton();
        if (nativeBtn) box.appendChild(nativeBtn);

        // Submitting keeps the box up in a disabled state: PDF.js only
        // re-invokes onPassword once it knows the password is wrong, and
        // success removes the box in loadPDF.
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!input.value) return;
            input.disabled = true;
            unlockBtn.disabled = true;
            cancelBtn.disabled = true;
            resolve(input.value);
        });
        cancelBtn.addEventListener('click', () => {
            box.remove();
            resolve(null);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cancelBtn.click();
        });

        document.querySelector('.pdf-password-prompt')?.remove();
        document.getElementById('viewer').appendChild(box);
        input.focus();
    });
}

// Visible failure state: without this a fetch/render error leaves the
// user staring at an empty gray viewer.
function showLoadError(err) {
    const reasons = {
        PasswordException: 'This PDF is password protected.',
        PasswordCancelled: 'Password entry was cancelled.',
        InvalidPDFException: 'This file is not a valid PDF.',
        MissingPDFException: 'The PDF file could not be found at the requested location.',
        UnexpectedResponseException: 'The server sent an unexpected response while fetching the PDF.',
        LocalFileException: 'This local file could not be read. Check that "Allow access to file URLs" is enabled for this extension on chrome://extensions, and that the file still exists.'
    };
    // A password prompt may still be on screen if the load failed after
    // unlocking (or the user cancelled); it has nothing more to say.
    document.querySelector('.pdf-password-prompt')?.remove();
    const box = document.createElement('div');
    box.className = 'pdf-load-error';

    const icon = document.createElement('div');
    icon.className = 'pdf-load-error-icon';
    icon.innerHTML = viewerIconSvg('alertTriangle', 36);
    const title = document.createElement('h2');
    title.textContent = 'Could not load PDF';
    const detail = document.createElement('p');
    let detailText = (err && reasons[err.name]) || 'The file could not be fetched or read.';
    // A 401/403 on a document that opens fine in a normal tab means the
    // session cookie didn't reach this fetch (expired login, cookie
    // rules); say so instead of a generic fetch failure.
    if (err && err.name === 'UnexpectedResponseException' && (err.status === 401 || err.status === 403)) {
        detailText = `The server denied access (HTTP ${err.status}). If this document requires a login, sign in on the site in a normal tab, then reopen the PDF here.`;
    } else if (err && err.name === 'UnexpectedResponseException' && err.status) {
        detailText += ` (HTTP ${err.status})`;
    }
    detail.textContent = detailText;
    const urlLine = document.createElement('p');
    urlLine.className = 'pdf-load-error-url';
    urlLine.textContent = fileUrl;

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(detail);
    box.appendChild(urlLine);

    // Escape hatch: failures here are often things Chrome's own viewer
    // handles fine. See buildNativeViewerButton for why this goes through
    // the background worker instead of a direct navigation.
    const nativeBtn = buildNativeViewerButton();
    if (nativeBtn) box.appendChild(nativeBtn);

    document.getElementById('viewer').appendChild(box);
}

// --- Whole-document printing ---
// The screen viewer is virtualized (IntersectionObserver keeps canvases
// only for visible pages), so Chrome's print of this page produces blank
// paper — the offscreen page divs have nothing in them. Instead, render
// every page from the already-loaded pdfDoc into the hidden #print-container
// at a fixed print scale; @media print swaps it in for the viewer chrome.
// Raster scale bounds in PDF points: 1.5x (~108dpi) is the legibility
// floor, 3x (~216dpi) the crispness ceiling. Long documents step down
// along a total-pixel budget: hundreds of full-resolution print canvases
// exceed Chrome's canvas memory, and evicted backing stores raster as
// black boxes in the print preview.
const PRINT_TOTAL_PIXEL_BUDGET = 2e8;
let printInProgress = false;
let printJobCancelled = false;

async function printPDF() {
    if (!pdfDoc || printInProgress) return;
    const overlay = document.getElementById('print-overlay');
    const progress = document.getElementById('print-progress');
    const container = document.getElementById('print-container');
    if (!overlay || !container) return;

    printInProgress = true;
    printJobCancelled = false;
    overlay.classList.remove('hidden');
    container.innerHTML = '';
    let printScale = 3;

    try {
        const total = pdfDoc.numPages;
        for (let pageNum = 1; pageNum <= total; pageNum++) {
            if (printJobCancelled) return;
            progress.textContent = `Preparing page ${pageNum} of ${total} for printing…`;

            const page = await pdfDoc.getPage(pageNum);

            if (pageNum === 1) {
                const base = page.getViewport({ scale: 1 });
                // Paper declaration + scale budget, both derived from page 1.
                // PDF points are 1/72in; .print-page wrappers are sized to
                // exactly these values (clamped by the page box) and clip
                // their canvases, which is what keeps pages whose sizes
                // differ from page 1 from fragmenting onto phantom sheets.
                const wIn = (base.width / 72).toFixed(3);
                const hIn = (base.height / 72).toFixed(3);
                let pageStyle = document.getElementById('print-page-size');
                if (!pageStyle) {
                    pageStyle = document.createElement('style');
                    pageStyle.id = 'print-page-size';
                    document.head.appendChild(pageStyle);
                }
                pageStyle.textContent = `@page { size: ${wIn}in ${hIn}in; margin: 0; }
:root { --print-paper-w: ${wIn}in; --print-paper-h: ${hIn}in; }`;

                printScale = Math.min(
                    3,
                    Math.max(1.5, Math.sqrt((PRINT_TOTAL_PIXEL_BUDGET / total) / (base.width * base.height))),
                    65535 / Math.max(base.width, base.height),
                    Math.sqrt((2 ** 28) / (base.width * base.height))
                );
            }

            const viewport = page.getViewport({ scale: printScale });

            const pageWrap = document.createElement('div');
            pageWrap.className = 'print-page';

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            pageWrap.appendChild(canvas);
            container.appendChild(pageWrap);
        }

        if (!printJobCancelled) window.print();
    } catch (err) {
        if (!printJobCancelled) {
            console.error('Print preparation failed:', err);
            viewerAlert('Print failed', 'Printing failed: ' + (err && err.message ? err.message : 'unknown error'));
        }
    } finally {
        overlay.classList.add('hidden');
        if (printJobCancelled) container.innerHTML = '';
        printInProgress = false;
    }
}

document.getElementById('print_pdf').addEventListener('click', printPDF);
document.getElementById('print-cancel').addEventListener('click', () => {
    printJobCancelled = true;
});

// Route Ctrl+P through the same flow: without this, the shortcut prints
// the virtualized on-screen document and comes out blank.
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        printPDF();
    }
});

// Release the print canvases once the dialog closes; every print re-renders.
window.addEventListener('afterprint', () => {
    document.getElementById('print-container').innerHTML = '';
});

async function renderAllPages() {
    if (!pdfDoc) return;

    const scrollContainer = document.getElementById('viewerContainer');
    const scrollRatio = scrollContainer.scrollHeight > 0 ? (scrollContainer.scrollTop / scrollContainer.scrollHeight) : 0;

    zoomLevelSpan.textContent = Math.round(scale * 100) + "%";
    const existingPageDivs = viewerContainer.querySelectorAll('.page');

    // Case 1: Zoom / scale change on an already-built document ->
    // fast in-place resize, no DOM destruction, no flash.
    if (existingPageDivs.length === pdfDoc.numPages) {
        existingPageDivs.forEach(pageDiv => {
            if (pageDiv._pdfPage) {
                const newViewport = pageDiv._pdfPage.getViewport({ scale: scale });
                pageDiv._viewport = newViewport;
                pageDiv.style.width = `${newViewport.width}px`;
                pageDiv.style.height = `${newViewport.height}px`;
            }
            unloadPageContent(pageDiv);

            // Resizing alone doesn't cross an IntersectionObserver threshold
            // for pages that were already visible, so it won't re-fire the
            // callback on its own. Re-observing forces a fresh check of
            // current intersection state, so visible pages actually redraw.
            pageObserver.unobserve(pageDiv);
            pageObserver.observe(pageDiv);
        });

        scrollContainer.scrollTop = scrollContainer.scrollHeight * scrollRatio;
        updatePageNumber();
        return;
    }

    // Case 2: Initial load -> fetch all pages in parallel, build off-DOM,
    // insert in a single mutation.
    viewerContainer.innerHTML = '';
    pageObserver.disconnect();

    const pagePromises = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        pagePromises.push(setupPage(i));
    }
    const pageElements = await Promise.all(pagePromises);

    const fragment = document.createDocumentFragment();
    pageElements.forEach(pageDiv => fragment.appendChild(pageDiv));
    viewerContainer.appendChild(fragment);

    pageElements.forEach(pageDiv => pageObserver.observe(pageDiv));

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
    
    if (scale < MIN_SCALE) scale = MIN_SCALE;
    if (scale > MAX_SCALE) scale = MAX_SCALE;
    
    renderAllPages();
}

document.getElementById('zoom_in').addEventListener('click', () => {
    if (!pdfDoc) return;
    currentZoomMode = 'custom';
    const newScale = Math.min(scale + 0.25, MAX_SCALE);
    if (newScale === scale) return; // already at max, nothing to re-render
    scale = newScale;
    renderAllPages();
});

document.getElementById('zoom_out').addEventListener('click', () => {
    if (!pdfDoc) return;
    currentZoomMode = 'custom';
    const newScale = Math.max(scale - 0.25, MIN_SCALE);
    if (newScale === scale) return; // already at min, nothing to re-render
    scale = newScale;
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

let resizeTimeout = null;
window.addEventListener('resize', () => {
    if (currentZoomMode !== 'custom') {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            calculateScaleAndRender();
        }, 100);
    }
});
// Update page number based on scroll
const container = document.getElementById('viewerContainer');
let pageNumberRafId = null;
container.addEventListener('scroll', () => {
    // Coalesce scroll bursts into at most one update per rendered
    // frame; offsetTop/clientHeight reads only force a reflow when
    // styles are dirty, but they still shouldn't run per scroll event.
    if (pageNumberRafId !== null) return;
    pageNumberRafId = requestAnimationFrame(() => {
        pageNumberRafId = null;
        updatePageNumber();
    });
}, { passive: true });
let scrollSaveTimeout = null;

function updatePageNumber() {
    // Do not update while the user is actively typing in the input
    if (document.activeElement === document.getElementById('page_num')) return;

    const pages = document.querySelectorAll('.page');
    if (pages.length === 0) return;
    const containerCenter = container.scrollTop + (container.clientHeight / 2);

    // Pages are stacked in document order, so offsetTop increases
    // monotonically; binary search avoids touching every page on
    // every scroll frame in large documents.
    let lo = 0;
    let hi = pages.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const page = pages[mid];
        if (page.offsetTop > containerCenter) {
            hi = mid - 1;
        } else if (page.offsetTop + page.clientHeight <= containerCenter) {
            lo = mid + 1;
        } else {
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
            return;
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
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
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
    if (!pageDiv || !pageDiv.dataset.pageNumber || !pdfDoc) {
        return;
    }
    const pageNumber = parseInt(pageDiv.dataset.pageNumber);
    const selectedText = selection.toString();
    const clientRects = Array.from(range.getClientRects());

    if (clientRects.length === 0) {
        return;
    }

    // Read the page rect in the same instant as clientRects: getPage()
    // resolves asynchronously, and a zoom or scroll landing in that gap
    // would mix old-scale selection rects with a new-scale page rect.
    const pageRect = pageDiv.getBoundingClientRect();

    // Get viewport to convert coordinates
    pdfDoc.getPage(pageNumber).then(page => {
        const viewport = page.getViewport({ scale: scale });

        const relativeRects = clientRects.map(r => {
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
        const lastRect = clientRects[clientRects.length - 1];
        if (lastRect) {
            showColorPicker(lastRect.left + window.scrollX, lastRect.bottom + window.scrollY);
        }
    }).catch(err => {
        console.error("Error obtaining page for selection:", err);
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
        // Resolve the viewport at draw time, not mouseup time: the user
        // may zoom while the picker is open, and the stored PDF-space
        // rects only land correctly through the page's live _viewport.
        drawHighlight(hl, currentSelection.pageDiv, currentSelection.pageDiv._viewport || currentSelection.viewport);
        
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
        indicator.innerHTML = viewerIconSvg('messageSquare', 14);
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
    const isDark = !document.body.classList.contains('dark-mode');
    applyViewerDarkMode(isDark);
    if (hasChromeStorage()) {
        chrome.storage.local.set({ ['pdf_dark_mode_' + fileUrl]: isDark });
    }
});

document.getElementById('bookmark_page').addEventListener('click', async () => {
    if (!pdfDoc) return;
    const pageNum = parseInt(document.getElementById('page_num').value) || 1;
    if (pageNum < 1 || pageNum > pdfDoc.numPages) return;

    // Check if already bookmarked
    if (bookmarks.some(b => b.pageNumber === pageNum)) {
        viewerAlert('Already bookmarked', `Page ${pageNum} is already bookmarked.`);
        return;
    }

    const customName = await viewerPromptDialog(
        'Add bookmark',
        `Enter a name for page ${pageNum}.`,
        `Page ${pageNum}`,
        `Page ${pageNum}`
    );
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
    if (!pdfDoc) return;
    const pageNum = parseInt(document.getElementById('page_num').value) || 1;
    if (pageNum < 1 || pageNum > pdfDoc.numPages) return;
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(i => i.str).join(' ');

    if (!pageText.trim()) {
        viewerAlert('Nothing to summarize', 'No text found on this page to summarize.');
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
        viewerAlert('Nothing to export', 'No annotations to export yet.');
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
        if (!fileUrl) {
            throw new Error("No PDF file URL specified.");
        }
        // credentials:"include" to match getDocument above — without it
        // this export 401s on the cookie-authenticated PDFs the viewer
        // itself can now load. Local files bypass fetch for the same
        // reason as there: Chromium's fetch has no file:// support.
        let existingPdfBytes;
        if (/^file:/i.test(fileUrl)) {
            existingPdfBytes = await readLocalFileViaXhr(fileUrl);
        } else {
            const res = await fetch(fileUrl, { credentials: 'include' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText || 'Failed to fetch PDF file'}`);
            }
            existingPdfBytes = await res.arrayBuffer();
        }
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);

        // Custom Author Name from the options page, stored in local
        // chrome.storage. Callback style + hasChromeStorage() guard to
        // match loadStorageData — the viewer must also run in plain
        // non-extension test contexts where chrome.storage is absent.
        let authorName = '';
        if (hasChromeStorage()) {
            authorName = await new Promise((resolve) => {
                chrome.storage.local.get(['pdf_author_name'], (result) => {
                    resolve((result && result.pdf_author_name) || '');
                });
            });
        }

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

            if (authorName) {
                // /T (annotation author) must be a string; a plain string
                // here would become a PDFName via context.obj().
                annotObj.T = PDFLib.PDFString.of(authorName);
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
        // pdf-lib throws EncryptedPDFError for any document with an
        // /Encrypt dictionary — including books already unlocked here via
        // the password prompt, since this handler re-fetches the original
        // encrypted bytes. { ignoreEncryption: true } is not a way out: it
        // re-serializes still-encrypted streams into a corrupt file. The
        // error can only be detected by message: this bundle's minified
        // subclass is broken (Error.call(this, msg) returns a fresh plain
        // Error), so instances pass neither instanceof EncryptedPDFError
        // nor a .name check. Export MD and Print both work off the
        // decrypted in-memory document, so point the user there.
        if (/is encrypted/i.test(String(e && e.message))) {
            viewerAlert('Cannot save highlights', "Saving highlights isn't supported for password-protected PDFs — use Export MD or Print instead.");
        } else {
            viewerAlert('Error saving PDF', 'Error saving PDF. Check the console for details.');
        }
    }
});

// ==================== Find Feature ====================
let currentSearchQuery = '';
let searchResults = [];
let activeMatchIndex = -1;
let searchGeneration = 0;

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
    if (!pdfDoc) return;
    if (!query) {
        clearSearch();
        return;
    }
    
    // Start a new generation so any search still in flight aborts at
    // its next check instead of clobbering this one's state or scrolling.
    const gen = ++searchGeneration;
    currentSearchQuery = query;
    searchResults = [];
    activeMatchIndex = -1;
    findResultsSpan.textContent = "Searching...";

    const lowerQuery = query.toLowerCase();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        if (gen !== searchGeneration) return; // superseded or cleared

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
    
    if (gen !== searchGeneration) return;

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
    searchGeneration++; // abort any search still in flight
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
        const scrollHeight = container.scrollHeight;
        if (pdfDoc && pdfDoc.numPages) {
            container.scrollTop = ((match.pageNumber - 1) / pdfDoc.numPages) * scrollHeight;
        }
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
    
    // Arrow-key page navigation needs a loaded document (pdfDoc is null
    // until loadPDF() resolves; the zoom buttons guard the same way).
    if (!isInput && pdfDoc) {
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
    // Reachable with no loaded document (e.g. stored bookmark clicked
    // after the file failed to load) — nothing to scroll to.
    if (!pdfDoc) return;
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
        sidebarContent.innerHTML = sidebarEmptyHtml('messageSquare', 'No comments or highlights yet.', 'Select text in the document to highlight it, then add a comment.');
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
        
        let typeIcon = viewerIconSvg('highlighter', 10);
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
        sidebarContent.innerHTML = sidebarEmptyHtml('bookmark', 'No bookmarks yet.', 'Use the Bookmark button in the toolbar to mark this page.');
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
        pageSpan.innerHTML = `Page ${bk.pageNumber} <span style="margin-left: 5px; font-size: 10px; color: #888;">${viewerIconSvg('bookmark', 10)}</span>`;
        
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
        contentOutline.innerHTML = sidebarEmptyHtml('list', 'No outline available.', 'This PDF does not contain a table of contents.');
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
        // A manual zoom overrides fit-width/fit-page; otherwise the next
        // window resize would snap back to the fitted scale.
        currentZoomMode = 'custom';

        if (pinchZoomTimeout === null) {
             initialScaleBeforePinch = scale;
        }

        // Adjust scale smoothly based on delta
        const delta = -e.deltaY * 0.01;
        let newScale = scale * Math.exp(delta);
        
        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > MAX_SCALE) newScale = MAX_SCALE;
        
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
