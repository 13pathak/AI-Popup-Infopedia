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
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  maximize: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  minimize: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'
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

// --- First-paint theme mirrors ---
// chrome.storage reads are async, so the page used to paint with the CSS
// light defaults before loadStorageData() resolved and flipped the class.
// theme-bootstrap.js (parser-blocking, top of <body>) applies the class
// from these localStorage mirrors before first paint. They are written at
// every point below where the theme is applied or changed; chrome.storage
// stays the source of truth and re-corrects any stale mirror on load.
// All writes are best-effort: a missing mirror only costs the old flash,
// never correctness.
function mirrorPerDocTheme(darkModeKey, isDark) {
  try { localStorage.setItem(darkModeKey, isDark ? '1' : '0'); } catch (e) {}
}

function clearPerDocThemeMirror(darkModeKey) {
  try { localStorage.removeItem(darkModeKey); } catch (e) {}
}

// Same key options.js mirrors its global uiTheme into; both pages share
// this origin, so one entry serves both.
function rememberUiThemeMirror(theme) {
  try { localStorage.setItem('uiTheme', theme); } catch (e) {}
}

// Icon + title + hint for empty sidebar tabs (static strings, no user data).
function sidebarEmptyHtml(iconName, title, hint) {
  return `<div class="sidebar-empty-msg">${viewerIconSvg(iconName, 26)}<div>${title}</div><div class="sidebar-empty-hint">${hint}</div></div>`;
}

// --- Lightweight modal dialogs (replace native alert/prompt) ---
// Titles/messages/initial values are set via textContent/value, so nothing
// is parsed as HTML. Resolves: alert -> undefined; prompt -> string, or
// null when cancelled (Escape / backdrop / Cancel), matching window.prompt.
// Dismissal hook for whichever modal currently holds the screen. Opening
// a replacement must settle the outgoing dialog — resolving its awaiter
// as cancelled and detaching its capture-phase keydown guard — because
// removing the overlay node alone leaves both dangling: the ghost
// listener's Escape would close the new modal too, and the old promise
// would hang any awaiting caller forever.
let activeViewerModalDismiss = null;

function buildViewerModal({ title, message = '', placeholder = '', initialValue = '', confirmText = 'OK', cancelText = null, wantInput = false }) {
  return new Promise((resolve) => {
    // One modal at a time.
    if (activeViewerModalDismiss) activeViewerModalDismiss(null);

    const overlay = document.createElement('div');
    overlay.id = 'viewer-modal-overlay';

    const box = document.createElement('div');
    box.className = 'viewer-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
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

    let settled = false;
    function done(result) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (activeViewerModalDismiss === dismiss) activeViewerModalDismiss = null;
      resolve(result);
    }
    // Stable registry reference; done() is closed over per-invocation.
    function dismiss() { done(null); }

    // Escape closes the dialog but must not also close AI popups behind it.
    // Tab is trapped inside the card: without this, keyboard focus escapes
    // the overlay into the toolbar and page content behind the backdrop.
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(null);
        return;
      }
      if (e.key === 'Tab') {
        const focusables = box.querySelectorAll('button, input');
        if (!focusables.length) { e.preventDefault(); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!box.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);

    // Clicking the dark backdrop cancels; clicks inside the card are stopped above.
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) done(null);
    });

    document.body.appendChild(overlay);
    activeViewerModalDismiss = dismiss;

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
const sidebar = document.getElementById('sidebar');
const tabComments = document.getElementById('icon-tab-comments');
const tabOutline = document.getElementById('icon-tab-outline');
const tabBookmarks = document.getElementById('icon-tab-bookmarks');
const contentComments = document.getElementById('sidebar-content-comments');
const contentOutline = document.getElementById('sidebar-content-outline');
const contentBookmarks = document.getElementById('sidebar-content-bookmarks');
const sidebarTitle = document.getElementById('sidebar-title');

// Store highlights in memory: { id: 1, pageNum: 1, rects: [], color: '#FFFF98', text: '...' }
let highlights = [];
let highlightCounter = 0;
let currentSelection = null; // Store temp selection
let activeHighlightId = null;
// Sidebar-click flash for a highlight whose page may not be rendered yet
// (virtualized pages draw their overlays only after the scroll, via
// drawHighlight). The expiry keeps a flash that was never consumed — user
// clicked but never actually reached the page — from firing much later.
let pendingFlashHighlightId = null;
let pendingFlashHighlightUntil = 0;

// Store bookmarks in memory: { id: 1, pageNum: 5, title: 'Chapter 1' }
let bookmarks = [];
let bookmarkCounter = 0;
let autoSavedLastPage = 1;
let cachedPdfAuthorName = 'You';

// Extract PDF URL from query string, e.g. custom-viewer.html?file=abc.pdf
const urlParams = new URLSearchParams(window.location.search);
let fileUrl = urlParams.get('file');

// Plain-browser test contexts (no chrome.storage) keep the historical
// default document. Extension pages are always opened with ?file= by the
// background interception; a manual open without one used to chase this
// path, which is not in the package, and died in the load-error card.
// Those now get an explanatory state instead — see loadPDF.
if (!fileUrl && !hasChromeStorage()) {
    fileUrl = '../../test_highlight.pdf';
}

function hasChromeStorage() {
    return typeof chrome !== 'undefined' && Boolean(chrome && chrome.storage && chrome.storage.local);
}

// Storage-key namespace for this document. Declared ahead of every
// function that closes over it (loadStorageData, the save* helpers, the
// onChanged listener) so a future top-level call cannot hit the temporal
// dead zone; the values need fileUrl, resolved just above.
//
// Hash fragments (#page=3 and friends) are view state, not document
// identity: the same PDF opened bare, at a page hash, or at different
// hashes must share one annotation/theme namespace or saved highlights
// fragment across invisible copies. Query strings stay in the key —
// servers do serve genuinely distinct documents from them. String()
// preserves the historical 'pdf_*_null' keys when fileUrl is absent.
const storageFileUrl = String(fileUrl).replace(/#.*$/, '');
const SYNC_KEYS = {
    highlights: 'pdf_highlights_' + storageFileUrl,
    bookmarks: 'pdf_bookmarks_' + storageFileUrl,
    lastPage: 'pdf_lastpage_' + storageFileUrl
};

// Whether this document has its own dark-mode override, once known.
// Tri-state so storage.onChanged events arriving while loadStorageData
// is still in flight can be ignored safely: the loader reads fresh values
// anyway, and acting early would race its resolution order. The per-doc
// override outranks the global uiTheme exactly as at load time; without
// this gate a live global-theme change would restyle an open document
// that explicitly opted out.
let perDocThemeActive = null;

async function loadStorageData() {
    return new Promise((resolve) => {
        if (!hasChromeStorage()) {
            resolve(); // Not running in extension context
            return;
        }

        const highlightsKey = SYNC_KEYS.highlights;
        const bookmarksKey = SYNC_KEYS.bookmarks;
        const lastPageKey = SYNC_KEYS.lastPage;
        // Per-document toggle override; when unset, the viewer defaults to
        // the extension-wide uiTheme (supersedes the old global
        // 'pdf_dark_mode' key, which is no longer read).
        const darkModeKey = 'pdf_dark_mode_' + storageFileUrl;

        chrome.storage.local.get([highlightsKey, bookmarksKey, lastPageKey, darkModeKey, 'pdf_author_name'], (result) => {
            if (result && result.pdf_author_name && typeof result.pdf_author_name === 'string') {
                cachedPdfAuthorName = result.pdf_author_name.trim() || 'You';
            }
            // Theme settlement the promise waits on: null when the
            // override branch decides synchronously. Without awaiting the
            // sync read here, resolve() used to fire with
            // perDocThemeActive still unknown, leaving the live
            // global-theme gate blind for a racy span after load.
            let themePending = null;
            if (result[darkModeKey] !== undefined) {
                perDocThemeActive = true;
                mirrorPerDocTheme(darkModeKey, result[darkModeKey] === true);
                applyViewerDarkMode(result[darkModeKey] === true);
            } else if (chrome.storage && chrome.storage.sync) {
                themePending = new Promise((themeDone) => {
                    chrome.storage.sync.get({ uiTheme: 'dark' }, (syncData) => {
                        perDocThemeActive = false;
                        const theme = (syncData && syncData.uiTheme) || 'dark';
                        rememberUiThemeMirror(theme);
                        // No per-doc override anymore: drop any stale mirror
                        // entry so the bootstrap falls through to uiTheme.
                        clearPerDocThemeMirror(darkModeKey);
                        applyViewerDarkMode(uiThemePrefersDark(theme));
                        themeDone();
                    });
                });
            } else {
                // No override and no sync surface: nothing will ever set
                // the tri-state later; park it at "follows global" so the
                // adoption gate starts deterministically.
                perDocThemeActive = false;
            }
            if (result[highlightsKey]) {
                highlights = sanitizeStoredHighlights(result[highlightsKey]);
                if (highlights.length > 0) {
                    highlightCounter = highlights.reduce((max, h) => Math.max(max, (h && h.id) || 0), 0);
                }
            }
            if (result[bookmarksKey]) {
                bookmarks = sanitizeStoredBookmarks(result[bookmarksKey]);
                if (bookmarks.length > 0) {
                    bookmarkCounter = bookmarks.reduce((max, b) => Math.max(max, (b && b.id) || 0), 0);
                }
            }
            if (result[lastPageKey]) {
                autoSavedLastPage = parseInt(result[lastPageKey], 10) || 1;
            }
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof renderBookmarks === 'function') renderBookmarks();
            // Annotation state above is already parsed and rendered; only
            // the theme round-trip can hold the promise open briefly.
            Promise.resolve(themePending).then(() => resolve());
        });
    });
}

// ==================== Rich Text Comment Utilities ====================

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Whitelist-only HTML sanitizer for comments: preserves <b>, <strong>, <u>, <i>, <em>, <br>, <div>, <p>, <span>
// and strips all scripts, handlers, style attributes, and unwanted nodes.
function sanitizeRichNote(html) {
    if (!html || typeof html !== 'string') return '';
    const template = document.createElement('template');
    template.innerHTML = html;

    const allowedTags = new Set(['b', 'strong', 'u', 'i', 'em', 'br', 'div', 'p', 'span']);
    const dropTags = new Set(['script', 'style', 'noscript', 'iframe', 'object', 'embed']);

    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.nodeValue);
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            if (dropTags.has(tag)) {
                return null;
            }
            if (allowedTags.has(tag)) {
                const cleanEl = document.createElement(tag);
                for (const child of node.childNodes) {
                    const cleanChild = cleanNode(child);
                    if (cleanChild) cleanEl.appendChild(cleanChild);
                }
                return cleanEl;
            } else {
                // Unwrap disallowed tag, preserving child content
                const frag = document.createDocumentFragment();
                for (const child of node.childNodes) {
                    const cleanChild = cleanNode(child);
                    if (cleanChild) frag.appendChild(cleanChild);
                }
                return frag;
            }
        }
        return null;
    }

    const frag = document.createDocumentFragment();
    for (const child of template.content.childNodes) {
        const cleanChild = cleanNode(child);
        if (cleanChild) frag.appendChild(cleanChild);
    }

    const wrapper = document.createElement('div');
    wrapper.appendChild(frag);
    let result = wrapper.innerHTML.trim();
    // Collapse redundant empty tags (e.g. <b></b>, <u></u>)
    result = result.replace(/<([a-z]+)[^>]*>\s*<\/\1>/gi, '');
    return result;
}

function setRichNoteContent(el, hl) {
    if (!el) return;
    const note = (hl && hl.note) || '';
    if (!note) {
        el.innerHTML = '';
        el.classList.add('is-empty');
        return;
    }
    if (hl && hl.noteFmt === 'html') {
        el.innerHTML = sanitizeRichNote(note);
    } else {
        // Legacy plain text note: escape HTML entities and convert newlines to <br>
        el.innerHTML = escapeHtml(note).replace(/\r\n|\r|\n/g, '<br>');
    }
    const isEmpty = !el.textContent.trim();
    el.classList.toggle('is-empty', isEmpty);
}

function getRichNoteContent(el) {
    if (!el) return null;
    const text = el.textContent.trim();
    if (!text) return null;
    const cleanHtml = sanitizeRichNote(el.innerHTML);
    return cleanHtml || null;
}

function noteHtmlToMarkdown(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            let inner = '';
            for (const child of node.childNodes) inner += walk(child);
            if (!inner.trim() && tag !== 'br') return '';
            if (tag === 'b' || tag === 'strong') return `**${inner}**`;
            if (tag === 'u') return `<u>${inner}</u>`;
            if (tag === 'i' || tag === 'em') return `*${inner}*`;
            if (tag === 'br') return '\n';
            if (tag === 'div' || tag === 'p') return '\n' + inner;
            return inner;
        }
        return '';
    }
    return walk(div).replace(/\n{3,}/g, '\n\n').trim();
}

function noteHtmlToPlainText(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            let inner = '';
            for (const child of node.childNodes) inner += walk(child);
            if (tag === 'br') return '\n';
            if (tag === 'div' || tag === 'p') return '\n' + inner;
            return inner;
        }
        return '';
    }
    return walk(div).replace(/\n{3,}/g, '\n\n').trim();
}

function attachRichEditor(el, { getInitial, onSave, onInput } = {}) {
    if (!el) return;

    let initialContent = '';

    const updateEmptyState = () => {
        const text = el.textContent.trim();
        const isEmpty = !text;
        el.classList.toggle('is-empty', isEmpty);
        if (isEmpty && el.innerHTML !== '') {
            el.innerHTML = '';
        }
    };

    const notifyInput = () => {
        updateEmptyState();
        if (typeof onInput === 'function') {
            onInput(getRichNoteContent(el));
        }
    };

    el.addEventListener('focus', () => {
        initialContent = typeof getInitial === 'function' ? getInitial() : el.innerHTML;
    });

    el.addEventListener('input', () => {
        notifyInput();
    });

    el.addEventListener('keydown', (e) => {
        // Prevent document-level keyboard shortcuts (e.g. arrow-key page navigation) from hijacking cursor movement
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End') {
            e.stopPropagation();
            return;
        }

        // Intercept Enter to insert uniform <br> line break via execCommand (recorded in undo stack)
        if (e.key === 'Enter') {
            e.preventDefault();
            document.execCommand('insertLineBreak', false, null);
            notifyInput();
            return;
        }

        // Intercept Ctrl+B / Cmd+B for bold
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            document.execCommand('bold', false, null);
            notifyInput();
            return;
        }

        // Intercept Ctrl+U / Cmd+U for underline (CRITICAL: prevents Chrome opening "View Page Source")
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
            e.preventDefault();
            document.execCommand('underline', false, null);
            notifyInput();
            return;
        }
    });

    // Intercept paste to ensure clipboard data pastes as clean text (preserving newlines) without foreign styling
    el.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        if (text) {
            document.execCommand('insertText', false, text);
            notifyInput();
        }
    });

    el.addEventListener('blur', () => {
        updateEmptyState();
        if (typeof onSave === 'function') {
            const currentClean = getRichNoteContent(el);
            const initialClean = initialContent ? sanitizeRichNote(initialContent) : null;
            if (currentClean !== initialClean) {
                onSave(currentClean);
            }
        }
    });
}

function saveHighlights(reRenderSidebar = true) {
    if (!hasChromeStorage()) return;
    const storageKey = SYNC_KEYS.highlights;
    const entry = rememberOwnWrite(storageKey, highlights);
    chrome.storage.local.set({ [storageKey]: highlights }, () => settlePendingWrite(entry));
    if (reRenderSidebar && typeof renderSidebar === 'function') renderSidebar();
}

function saveBookmarks() {
    if (!hasChromeStorage()) return;
    const storageKey = SYNC_KEYS.bookmarks;
    const entry = rememberOwnWrite(storageKey, bookmarks);
    chrome.storage.local.set({ [storageKey]: bookmarks }, () => settlePendingWrite(entry));
    if (typeof renderBookmarks === 'function') renderBookmarks();
}

function saveLastPage(pageNum) {
    if (!hasChromeStorage()) return;
    const storageKey = SYNC_KEYS.lastPage;
    const entry = rememberOwnWrite(storageKey, pageNum);
    chrome.storage.local.set({ [storageKey]: pageNum }, () => settlePendingWrite(entry));
}

// --- Cross-tab consistency ---
// Every tab of the same document holds its own copy of these arrays and
// writes them wholesale, so without storage monitoring two tabs clobber
// each other: each save pushes that tab's stale snapshot over whatever
// the other tab just wrote (lost update). chrome.storage.onChanged
// closes the loop — external writes are adopted into this tab's state
// and DOM before the next local save can revert them.
//
// Adoption is wholesale rather than id-merged because every local
// mutation persists immediately: at listener time the only unwritten
// local state is this tab's own in-flight write(s), tracked as an
// ordered FIFO of serialized snapshots per key. Events are delivered in
// storage-commit order, so an event equal to the FRONT entry is this
// tab's own echo confirming that write; anything else arriving while
// entries are outstanding committed BEFORE them, meaning the newest
// pending write ends up as the final storage value. Such interim values
// must be ignored, not adopted: adopting one repaints superseded data
// and lets an edit typed inside that window commit on top of it,
// clobbering the newer payload with stale content.
//
// Suppression is only lossless while every pending entry corresponds to
// a write that actually lands. The set() completion callback provides
// that signal precisely: success keeps the entry (its echo is still
// needed to classify the upcoming notification), failure splices it out
// immediately — without that splice, a failed write would suppress
// external adoptions for the whole TTL and leave this tab silently
// stale, its next wholesale save clobbering the other tab's newer
// annotations. The short TTL remains purely as a backstop for the
// lost-callback pathology (tab torn down mid-set); echoes land within
// milliseconds, so it never binds in normal operation.
const PENDING_WRITE_CONFIRM_MS = 2000;
const PENDING_WRITE_HISTORY = 8;
const pendingOwnWrites = new Map();

function rememberOwnWrite(key, value) {
    let queue = pendingOwnWrites.get(key);
    if (!queue) {
        queue = [];
        pendingOwnWrites.set(key, queue);
    }
    const entry = { value: JSON.stringify(value), at: Date.now() };
    queue.push(entry);
    // Drop the oldest past the cap.
    while (queue.length > PENDING_WRITE_HISTORY) queue.shift();
    return entry;
}

// Precise settle for one write's set() callback: on failure the entry
// leaves the queue at once (see rationale above); on success nothing
// happens here and the entry drains via its own echo as usual.
function settlePendingWrite(entry) {
    if (!entry) return;
    if (!chrome.runtime.lastError) return;
    for (const [key, queue] of pendingOwnWrites) {
        const i = queue.indexOf(entry);
        if (i !== -1) {
            queue.splice(i, 1);
            if (!queue.length) pendingOwnWrites.delete(key);
        }
    }
}

// Expire entries whose confirmation never arrived, returning the live
// queue (or null once empty) so classification never sees stale fronts.
function livePendingWrites(key) {
    const queue = pendingOwnWrites.get(key);
    if (!queue) return null;
    const now = Date.now();
    while (queue.length && now - queue[0].at > PENDING_WRITE_CONFIRM_MS) {
        queue.shift();
    }
    if (!queue.length) pendingOwnWrites.delete(key);
    return pendingOwnWrites.get(key) || null;
}

// --- Stored-record validation ---
// chrome.storage contents are untrusted: an interrupted write or an
// older/buggier writer can leave malformed records in the highlights/
// bookmarks arrays. Before this guard, one malformed entry threw inside
// drawHighlight during renderPageContent, whose catch marks the whole
// page data-loaded="error" — a single bad record blanked a page. Every
// consumer (canvas overlays, click hit-testing, sidebar, exports) assumes
// the canonical shape, so validate once at the two ingestion points
// (initial load + cross-tab adoption) rather than defending each
// consumer. Storage is not rewritten on load; the cleaned array is
// persisted organically by the next saveHighlights()/saveBookmarks().
//
// Kept records pass through untouched (forward-compatible with unknown
// extra fields); only structurally impossible geometry is dropped, and a
// record that is merely missing a usable id gets one assigned instead of
// being lost. A non-numeric id must never reach the counter reduces —
// Math.max(max, {}) yields NaN and would poison every subsequently
// created id. One exception to "untouched": known-but-corrupt optional
// fields are stripped rather than trusted — see hasValidCornerQuad.
function isValidStoredRect(r) {
    return !!r && typeof r === 'object' &&
        Number.isFinite(r.pdfX) && Number.isFinite(r.pdfY) &&
        Number.isFinite(r.pdfWidth) && Number.isFinite(r.pdfHeight);
}

// Corner quads (cTL..cBL) carry the exact rotated-page geometry the PDF
// export prefers over the legacy axis-aligned fields, gating on their
// presence. They are optional with a documented fallback, so a corrupt or
// partial quad must be stripped wholesale — sending the export down the
// legacy derivation from the already-validated fields — instead of
// feeding NaN/null/non-array values into /Rect and /QuadPoints, where
// they serialize as broken annotation geometry. Absent corners are the
// normal pre-corner-storage shape and simply mean "use the fallback".
function hasValidCornerQuad(r) {
    return ['cTL', 'cTR', 'cBR', 'cBL'].every(k => {
        const c = r[k];
        return Array.isArray(c) && c.length >= 2 &&
            Number.isFinite(c[0]) && Number.isFinite(c[1]);
    });
}

// Largest usable id already present, so repairs cannot collide.
function maxStoredId(list) {
    let max = 0;
    if (Array.isArray(list)) {
        for (const item of list) {
            if (item && typeof item === 'object' &&
                Number.isInteger(item.id) && item.id > max) {
                max = item.id;
            }
        }
    }
    return max;
}

function sanitizeStoredHighlights(list) {
    const cleaned = [];
    if (!Array.isArray(list)) return cleaned;
    let idPool = maxStoredId(list);
    for (const hl of list) {
        if (!hl || typeof hl !== 'object') continue;
        if (!Number.isInteger(hl.pageNumber) || hl.pageNumber < 1) continue;
        if (!Array.isArray(hl.rects)) continue;
        const rects = hl.rects.filter(isValidStoredRect);
        // An empty rect list draws nothing and leaves a note without its
        // anchor (drawHighlight reads rects[0] for the indicator), so it
        // is as unusable as a missing list.
        if (rects.length === 0) continue;
        if (!Number.isInteger(hl.id) || hl.id < 1) hl.id = ++idPool;
        hl.rects = rects;
        // createdAt (sidebar timestamp) is a known optional field like the
        // corner quads below: strip a corrupt value rather than let a NaN
        // or string reach the age formatter. Absent means "saved before
        // timestamps existed" and is left untouched.
        if (!Number.isFinite(hl.createdAt) || hl.createdAt <= 0) {
            delete hl.createdAt;
        }
        // Strip corrupt corner quads so the export falls back to the
        // validated legacy geometry instead of emitting NaN/null
        // coordinates. The record itself stays usable — corners are an
        // optimization, not a requirement.
        for (const r of rects) {
            if (!hasValidCornerQuad(r)) {
                delete r.cTL;
                delete r.cTR;
                delete r.cBR;
                delete r.cBL;
            }
        }
        // Validate and sanitize note and note format flag
        if (hl.note !== undefined && hl.note !== null) {
            if (typeof hl.note !== 'string') {
                delete hl.note;
                delete hl.noteFmt;
            } else if (hl.noteFmt === 'html') {
                hl.note = sanitizeRichNote(hl.note);
                if (!hl.note) {
                    delete hl.note;
                    delete hl.noteFmt;
                }
            } else {
                delete hl.noteFmt;
            }
        } else {
            delete hl.note;
            delete hl.noteFmt;
        }
        cleaned.push(hl);
    }
    return cleaned;
}

function sanitizeStoredBookmarks(list) {
    const cleaned = [];
    if (!Array.isArray(list)) return cleaned;
    let idPool = maxStoredId(list);
    for (const bk of list) {
        if (!bk || typeof bk !== 'object') continue;
        if (!Number.isInteger(bk.pageNumber) || bk.pageNumber < 1) continue;
        if (!Number.isInteger(bk.id) || bk.id < 1) bk.id = ++idPool;
        cleaned.push(bk);
    }
    return cleaned;
}

if (hasChromeStorage()) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync') { adoptRemoteGlobalTheme(changes); return; }
        if (areaName !== 'local') return;
        for (const [key, change] of Object.entries(changes)) {
            // Per-document theme overrides. Only this document's key may
            // restyle us — other documents' tabs write their own
            // pdf_dark_mode_<url> keys — but every removal under the
            // prefix drops its localStorage mirror: the mirrors live in
            // origin-shared storage that outlives individual tabs, and a
            // mirror whose setting is gone would give the document's
            // next open a stale-themed first paint before loadStorageData
            // corrects it.
            if (key.startsWith('pdf_dark_mode_')) {
                if (change.newValue === undefined) clearPerDocThemeMirror(key);
                if (key === 'pdf_dark_mode_' + storageFileUrl) {
                    adoptRemoteViewerTheme(key, change.newValue);
                }
                continue;
            }
            if (key === 'pdf_author_name') {
                cachedPdfAuthorName = (change.newValue && typeof change.newValue === 'string' && change.newValue.trim()) || 'You';
                if (typeof renderSidebar === 'function') renderSidebar();
                continue;
            }
            const which = key === SYNC_KEYS.highlights ? 'highlights'
                : key === SYNC_KEYS.bookmarks ? 'bookmarks'
                : key === SYNC_KEYS.lastPage ? 'lastPage' : null;
            if (!which) continue; // e.g. pdf_dark_mode_*, other features

            const incoming = change.newValue;
            const serialized = incoming === undefined ? null : JSON.stringify(incoming);
            const queue = livePendingWrites(key);

            if (serialized !== null && queue && queue[0].value === serialized) {
                // In-order echo of this tab's own write: storage now holds
                // exactly what we sent. No DOM work is needed — local state
                // already reflects this write or a newer local one whose
                // own echo follows. Confirming must not re-render, or every
                // save would flicker.
                queue.shift();
                if (!queue.length) pendingOwnWrites.delete(key);
                continue;
            }
            if (queue && queue.length) {
                // Unrecognized value while our writes are still unconfirmed:
                // it committed before them, so it is transient. Ignoring it
                // keeps this tab on the payload that wins storage — adopting
                // instead would flash superseded data, could spuriously
                // close popups anchored to ids only present in the newer
                // payload, and opened a clobber window for edits typed in
                // between.
                continue;
            }

            if (which === 'highlights') {
                adoptRemoteHighlights(Array.isArray(incoming) ? incoming : []);
            } else if (which === 'bookmarks') {
                adoptRemoteBookmarks(Array.isArray(incoming) ? incoming : []);
            } else {
                // Resume position: adopt silently so this tab's next
                // debounced save doesn't restore a stale page — but do
                // not yank this tab's scroll to the other tab's spot.
                const num = parseInt(incoming, 10);
                if (num >= 1) autoSavedLastPage = num;
            }
        }
    });
}

// Another surface (the options page) changed the extension-wide uiTheme
// in sync storage. Restyle this open viewer live — previously the sync
// area was ignored entirely and the change only landed on next open.
// A document with its own override keeps it: precedence matches
// loadStorageData. Removal (Reset Everything / import without uiTheme)
// falls back to the dark default exactly as a fresh read would, and the
// bootstrap mirror is refreshed so the next open paints consistently.
function adoptRemoteGlobalTheme(changes) {
    const change = changes['uiTheme'];
    if (!change || perDocThemeActive !== false) return;
    const theme = typeof change.newValue === 'string' && change.newValue ? change.newValue : 'dark';
    rememberUiThemeMirror(theme);
    applyViewerDarkMode(uiThemePrefersDark(theme));
}

// Another tab of this document wrote a per-document theme override (or
// one was removed). Adopt it live so open tabs agree, and refresh the
// bootstrap mirror so the next open paints correctly on the first try.
// Own-toggle echoes land here too but are idempotent: the class already
// matches, so only the mirror is refreshed. Both branches keep the
// perDocThemeActive tri-state in step with what storage now holds — a
// boolean means an override exists (ours or another tab's), removal
// means this document follows the global theme again.
function adoptRemoteViewerTheme(key, value) {
    if (typeof value === 'boolean') {
        perDocThemeActive = true;
        if (document.body.classList.contains('dark-mode') !== value) {
            applyViewerDarkMode(value);
        }
        mirrorPerDocTheme(key, value);
    } else if (value === undefined) {
        perDocThemeActive = false;
        clearPerDocThemeMirror(key);
        if (chrome.storage.sync) {
            chrome.storage.sync.get({ uiTheme: 'dark' }, (syncData) => {
                const theme = (syncData && syncData.uiTheme) || 'dark';
                rememberUiThemeMirror(theme);
                applyViewerDarkMode(uiThemePrefersDark(theme));
            });
        }
    }
}

function adoptRemoteHighlights(remote) {
    highlights = sanitizeStoredHighlights(remote);
    // Keep id allocation above everything now known, or this tab's next
    // created highlight could collide with one from the other tab.
    highlightCounter = highlights.reduce((max, h) => Math.max(max, (h && h.id) || 0), highlightCounter);
    // Popups anchored to a highlight the other tab deleted would dangle.
    if (activeHighlightId !== null && !highlights.some(h => h.id === activeHighlightId)) {
        hidePopups();
    }
    redrawRenderedHighlights();
    renderSidebar();
}

function adoptRemoteBookmarks(remote) {
    bookmarks = sanitizeStoredBookmarks(remote);
    bookmarkCounter = bookmarks.reduce((max, b) => Math.max(max, (b && b.id) || 0), bookmarkCounter);
    renderBookmarks();
}

// Rebuild the annotation overlays of every currently rendered page from
// the adopted arrays. In-flight page renders draw from the same arrays
// when they finish, so nothing else is needed. drawHighlight restores
// the .active class for activeHighlightId on its own.
function redrawRenderedHighlights() {
    document.querySelectorAll('.page[data-loaded="true"]').forEach(pageDiv => {
        pageDiv.querySelectorAll('.custom-highlight, .note-indicator').forEach(el => el.remove());
        if (pageDiv._viewport) {
            drawHighlightsForPage(parseInt(pageDiv.dataset.pageNumber, 10), pageDiv, pageDiv._viewport);
        }
    });
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
    // Rescale transition: a zoom marked this page while its previous
    // render was still on screen. Draw the fresh frame on top of the
    // stretched stale one and swap only once fully painted, so zooming
    // never shows a blank page.
    const isRescale = pageDiv.dataset.rescale === "true";
    delete pageDiv.dataset.rescale;
    pageDiv.dataset.loaded = "rendering";

    try {
        const page = pageDiv._pdfPage;
        const viewport = pageDiv._viewport;
        // Match the backing store to the display's real pixel density.
        // The old unconditional floor of 2 quadrupled every page's canvas
        // memory (scale² in both dimensions) even on 1x monitors, where
        // the compositor just discards the extra resolution, and
        // oversampled fractional OS scaling (125%/150%) too. HiDPI
        // displays are covered by devicePixelRatio itself; `|| 1` guards
        // environments that report 0 or undefined. Same convention as
        // pdf.js's own viewer. The caps below still bound extreme pages.
        let outputScale = Math.max(window.devicePixelRatio || 1, 1);
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

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        const renderTask = page.render({
            canvasContext: ctx,
            transform,
            viewport,
            annotationMode: (pdfjsLib.AnnotationMode ? pdfjsLib.AnnotationMode.DISABLE : 0)
        }).promise;
        const textContent = await page.getTextContent();

        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.setProperty('--scale-factor', viewport.scale);

        if (isRescale) {
            // The fresh canvas goes on top of the stretched stale one: it
            // starts transparent (old frame keeps showing through), turns
            // opaque as the crisp render paints over it. .zoom-transition
            // keeps text/overlays hidden until the swap below.
            pageDiv.appendChild(canvas);
            pageDiv.appendChild(textLayerDiv);
            const textLayer = new pdfjsLib.TextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            });

            await Promise.all([renderTask, textLayer.render()]);

            // A zoom landing mid-draw swapped _viewport again: carry this
            // finished frame forward as the next transition backdrop
            // instead of dropping into a blank page.
            if (pageDiv._viewport !== viewport) {
                pageDiv.dataset.rescale = 'true';
                pageDiv.classList.add('zoom-transition');
                pageDiv.dataset.loaded = 'false';
                renderPageContent(pageDiv);
                return;
            }

            // Atomic swap inside one synchronous block: no intermediate
            // blank frame ever paints.
            pageDiv.innerHTML = '';
            pageDiv.appendChild(canvas);
            pageDiv.appendChild(textLayerDiv);
            drawHighlightsForPage(parseInt(pageDiv.dataset.pageNumber), pageDiv, viewport);
            drawSearchHighlightsForPage(parseInt(pageDiv.dataset.pageNumber), pageDiv, viewport);
            renderLinkAnnotations(page, pageDiv, viewport);
            pageDiv.classList.remove('zoom-transition');
            pageDiv.dataset.loaded = 'true';
            return;
        }

        // Clean up any leftover DOM nodes from a previous failed attempt
        pageDiv.innerHTML = '';
        pageDiv.appendChild(canvas);
        pageDiv.appendChild(textLayerDiv);
        const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
        });

        await Promise.all([renderTask, textLayer.render()]);

        // A zoom/fit during the awaits above swapped pageDiv._viewport and
        // resized the div, but everything so far used the stale viewport,
        // so redo the render at the current scale here.
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
        pageDiv.classList.remove('zoom-transition');
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
//
// `signal` optionally wires the caller's AbortController into this XHR:
// XMLHttpRequest predates AbortSignal, so without the bridge a hung
// file:// transfer would never settle the returned promise and a caller
// like the Save-PDF watchdog could not time it out.
function readLocalFileViaXhr(url, signal) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const rejectAborted = () => {
            // Same shape fetch's abort rejection takes, so callers can
            // treat both transports identically via err.name.
            const err = new Error('Local file read timed out.');
            err.name = 'AbortError';
            reject(err);
        };
        if (signal) {
            if (signal.aborted) {
                rejectAborted();
                return;
            }
            // once: the listener's whole job is this one xhr.abort();
            // afterwards the signal outliving the request is harmless.
            signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
            // A completed load means the transfer itself succeeded. A
            // zero-byte file legitimately arrives as an empty buffer
            // (falsy in some engines) — resolving it here lets PDF.js
            // raise its own "not a valid PDF" error instead of the
            // misleading file-permission guidance below. Genuine access
            // failures surface via onerror, which is where the toggle
            // hint belongs.
            resolve(new Uint8Array(xhr.response || 0));
        };
        xhr.onerror = () => {
            // Near-always the "Allow access to file URLs" toggle being off.
            const err = new Error('Local file could not be read.');
            err.name = 'LocalFileException';
            reject(err);
        };
        // Fires for our own signal-driven abort() (and would fire for any
        // other); rejecting here is the single settle point so a racing
        // onload/onerror stays harmless — later settles are ignored.
        xhr.onabort = rejectAborted;
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
        // Extension-page open without ?file= (manual navigation): nothing
        // to fetch, and pretending otherwise surfaced "Could not load PDF"
        // for a URL nobody requested. Say what actually happened instead.
        if (!fileUrl) {
            showNoDocumentState();
            return;
        }
        // CJK PDFs need CMap data and some PDFs rely on non-embedded
        // standard fonts; without these URLs glyphs render garbled and text
        // extraction (selection/search/highlights) fails on those documents.
        // This PDF.js build fetches both from the main thread, so the URLs
        // are document-relative (like workerSrc above).
        const docParams = {
            cMapUrl: './cmaps/',
            cMapPacked: true,
            standardFontDataUrl: './standard_fonts/',
            // Defense-in-depth for font parsing: disables pdf.js's compiled
            // glyph path (eval-based) optimization, closing the class of
            // FontMatrix injection vulnerabilities (CVE-2024-4367 et al.)
            // independent of the bundled version. Negligible cost — only
            // affects an optional rendering fast path.
            isEvalSupported: false,
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

// Direct open of custom-viewer.html without ?file=: no document, and
// nothing failed. Reuses the load-error card styling so typography,
// spacing, and dark-mode tokens all apply without new CSS; the copy makes
// clear this is an explanation rather than a failure.
function showNoDocumentState() {
    const box = document.createElement('div');
    box.className = 'pdf-load-error';

    const icon = document.createElement('div');
    icon.className = 'pdf-load-error-icon';
    icon.innerHTML = viewerIconSvg('messageSquare', 36);
    const title = document.createElement('h2');
    title.textContent = 'No document specified';
    const detail = document.createElement('p');
    detail.textContent = 'Open or click any PDF link while AI Popup Infopedia is enabled and it will load here automatically.';
    const hint = document.createElement('p');
    hint.textContent = 'To open one manually, add ?file= followed by the encoded PDF address to this page\u2019s URL.';

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(detail);
    box.appendChild(hint);
    document.getElementById('viewer').appendChild(box);
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
// True only while printPDF()'s own window.print() call is running, so the
// beforeprint handler can tell a pipeline print from a menu-initiated one.
let printFromPipeline = false;
// The guidance sheet, while one is mounted in #print-container. Tracked
// so a pipeline that starts after a menu print left it there can detach
// it again — otherwise it would ship as page 1 of the real preview.
let printNoticeSheet = null;

// True while one of the lightweight dialogs (viewerAlert /
// viewerPromptDialog) holds the screen. Keyboard shortcuts that launch
// heavyweight flows are suppressed meanwhile: the print progress overlay
// stacks below the dialog, so a Ctrl+P mid-question used to run an
// invisible pipeline behind it — and a prep failure would then replace
// the unanswered dialog outright. Pointer paths need no gate; the modal
// backdrop already blocks clicks to the toolbar.
function viewerModalOpen() {
    return !!document.getElementById('viewer-modal-overlay');
}

// Merges duplicate, overlapping, or immediately adjacent rectangles on the same line.
// range.getClientRects() frequently returns duplicate bounding boxes (e.g. for
// nested markedContent / inline text spans) and overlapping runs. Merging them
// ensures that highlights, underlines, strikethroughs, and print outputs render with
// uniform opacity and no multiplied/darkened overlap seams.
//
// scale is the CSS-pixels-per-PDF-point factor the boxes were produced at
// (viewport.scale of the caller). Every threshold below lives in CSS pixels,
// so a fixed value would decide differently at different zooms — a 40pt
// column gutter is 40px at 100% but only 10px at 25%, sliding under a fixed
// 12px word-gap floor. Factoring scale in keeps the merge decision (and
// therefore the persisted geometry vs. every re-render) zoom-invariant.
function mergeHighlightRectangles(rawRects, scale = 1) {
    if (!Array.isArray(rawRects)) return [];

    const rects = rawRects
        .map(r => {
            const left = r.left;
            const top = r.top;
            const width = r.width;
            const height = r.height;
            return {
                left,
                top,
                width,
                height,
                right: left + width,
                bottom: top + height
            };
        })
        .filter(r => r.width > 0 && r.height > 0);

    if (rects.length <= 1) return rects;

    // Sub-pixel duplicate/containment tolerance in CSS pixels.
    const tol = 0.5 * scale;
    // Same-line band for the reading-order sorts below.
    const lineBand = 4 * scale;

    // Filter out duplicate or fully contained rectangles
    const unique = [];
    for (let i = 0; i < rects.length; i++) {
        const a = rects[i];
        let isContained = false;
        for (let j = 0; j < rects.length; j++) {
            if (i === j) continue;
            const b = rects[j];
            if (a.left >= b.left - tol && a.right <= b.right + tol &&
                a.top >= b.top - tol && a.bottom <= b.bottom + tol) {
                if (Math.abs(a.left - b.left) < tol && Math.abs(a.right - b.right) < tol &&
                    Math.abs(a.top - b.top) < tol && Math.abs(a.bottom - b.bottom) < tol) {
                    if (i > j) { isContained = true; break; }
                } else {
                    isContained = true; break;
                }
            }
        }
        if (!isContained) unique.push(a);
    }

    // Sort primarily by vertical center, secondarily by left
    unique.sort((a, b) => {
        const aCenterY = a.top + a.height / 2;
        const bCenterY = b.top + b.height / 2;
        if (Math.abs(aCenterY - bCenterY) > lineBand) return aCenterY - bCenterY;
        return a.left - b.left;
    });

    // Group into horizontal text lines based on vertical overlap. The
    // overlap must clear half of the TALLER box: against the shorter one, a
    // tall fragment (an inline image beside text) overlaps each neighboring
    // text line by more than half its own height, absorbs both, and the
    // grown line bounds then cascade into one block that paints the
    // inter-line whitespace. Equal-height text neighbors still group
    // normally; only tall-vs-short pairs stay apart.
    const lines = [];
    for (const r of unique) {
        let placed = false;
        for (const line of lines) {
            const vOverlap = Math.min(line.bottom, r.bottom) - Math.max(line.top, r.top);
            const maxHeight = Math.max(line.bottom - line.top, r.height);
            if (vOverlap > maxHeight * 0.5) {
                line.rects.push(r);
                line.top = Math.min(line.top, r.top);
                line.bottom = Math.max(line.bottom, r.bottom);
                placed = true;
                break;
            }
        }
        if (!placed) {
            lines.push({ top: r.top, bottom: r.bottom, rects: [r] });
        }
    }

    // On each line, merge overlapping or adjacent word boxes
    const merged = [];
    for (const line of lines) {
        line.rects.sort((a, b) => a.left - b.left);
        let curr = line.rects[0];
        for (let i = 1; i < line.rects.length; i++) {
            const next = line.rects[i];
            const lineHeight = Math.min(curr.height, next.height);
            // Merge if overlapping or within word-spacing threshold. The
            // lineHeight term is already in current pixels and self-scales
            // with zoom; only the 12px floor needs the scale factor.
            const maxWordGap = Math.max(12 * scale, lineHeight * 0.5);
            if (next.left <= curr.right + maxWordGap) {
                const newLeft = Math.min(curr.left, next.left);
                const newRight = Math.max(curr.right, next.right);
                const newTop = Math.min(curr.top, next.top);
                const newBottom = Math.max(curr.bottom, next.bottom);
                curr = {
                    left: newLeft,
                    top: newTop,
                    right: newRight,
                    bottom: newBottom,
                    width: newRight - newLeft,
                    height: newBottom - newTop
                };
            } else {
                merged.push(curr);
                curr = next;
            }
        }
        merged.push(curr);
    }

    // Sort final merged rectangles in reading order
    merged.sort((a, b) => {
        if (Math.abs(a.top - b.top) > lineBand) return a.top - b.top;
        return a.left - b.left;
    });

    return merged;
}

// Paint this document's annotations onto a freshly rendered print page.
// The on-screen marks are overlay divs inside .page containers, which
// don't exist in #print-container — without this pass, printed paper
// silently omitted every highlight/underline/strikethrough. Fills use
// multiply blending, the print analogue of the translucent screen
// overlay: paper shows through and underlying text stays legible.
// Note indicators are intentionally not drawn — they are interactive UI
// chrome, not document content.
function drawPrintHighlights(ctx, viewport, pageNum) {
    for (const h of highlights) {
        if (h.pageNumber !== pageNum || !Array.isArray(h.rects)) continue;
        const type = h.markupType || 'Highlight';
        const rawBoxes = h.rects.map(r => {
            const pt1 = viewport.convertToViewportPoint(r.pdfX, r.pdfY);
            const pt2 = viewport.convertToViewportPoint(r.pdfX + r.pdfWidth, r.pdfY - r.pdfHeight);
            return {
                left: Math.min(pt1[0], pt2[0]),
                top: Math.min(pt1[1], pt2[1]),
                width: Math.abs(pt2[0] - pt1[0]),
                height: Math.abs(pt2[1] - pt1[1])
            };
        });
        const boxes = mergeHighlightRectangles(rawBoxes, viewport.scale);
        for (const box of boxes) {
            const left = box.left;
            const right = box.left + box.width;
            const top = box.top;
            const bottom = box.top + box.height;
            ctx.save();
            try {
                if (type === 'Underline' || type === 'StrikeOut') {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = h.color;
                    ctx.lineWidth = Math.max(1, viewport.scale * 1.5);
                    ctx.beginPath();
                    ctx.moveTo(left, type === 'Underline' ? bottom : (top + bottom) / 2);
                    ctx.lineTo(right, type === 'Underline' ? bottom : (top + bottom) / 2);
                    ctx.stroke();
                } else {
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.fillStyle = h.color;
                    ctx.fillRect(left, top, box.width, box.height);
                }
            } finally {
                ctx.restore(); // also reverts any ignored invalid style set
            }
        }
    }
}

async function printPDF() {
    if (!pdfDoc || printInProgress || viewerModalOpen()) return;
    const overlay = document.getElementById('print-overlay');
    const progress = document.getElementById('print-progress');
    const container = document.getElementById('print-container');
    if (!overlay || !container) return;

    printInProgress = true;
    printJobCancelled = false;
    overlay.classList.remove('hidden');
    container.innerHTML = '';
    // Whatever sheet this wipe just detached is gone for good.
    printNoticeSheet = null;
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

            await page.render({
                canvasContext: ctx,
                viewport,
                annotationMode: (pdfjsLib.AnnotationMode ? pdfjsLib.AnnotationMode.DISABLE : 0)
            }).promise;

            // Composite this page's annotations onto the printed raster.
            drawPrintHighlights(ctx, viewport, pageNum);

            // A menu print that fired while page 1 was still rendering
            // may have left the guidance sheet in the (then empty)
            // container; it must not end up bound into the real preview.
            if (printNoticeSheet) {
                printNoticeSheet.remove();
                printNoticeSheet = null;
            }
            pageWrap.appendChild(canvas);
            container.appendChild(pageWrap);
        }

        if (!printJobCancelled) {
            printFromPipeline = true;
            try {
                window.print();
            } finally {
                printFromPipeline = false;
            }
        }
    } catch (err) {
        if (!printJobCancelled) {
            console.error('Print preparation failed:', err);
            viewerAlert('Print failed', 'Printing failed: ' + (err && err.message ? err.message : 'unknown error'));
        }
    } finally {
        overlay.classList.add('hidden');
        if (printJobCancelled) container.innerHTML = '';
        // The cancel branch above already wiped the whole container; on
        // every other exit the sheet is either detached or was never
        // added, so dropping the reference here is always safe.
        printNoticeSheet = null;
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

// Route Ctrl+S to the PDF viewer's Save button (saving highlights / document)
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        // If an active AI popup is open, let its own handler save the AI conversation
        if (typeof activePopups !== 'undefined' && Array.isArray(activePopups) && activePopups.length > 0) {
            return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        // Commit any pending open note editor before saving
        const notePopup = document.getElementById('note-editor-popup');
        if (notePopup && !notePopup.classList.contains('hidden')) {
            document.getElementById('note-btn-save')?.click();
        }
        const saveBtn = document.getElementById('save_pdf');
        if (saveBtn && !saveBtn.disabled) {
            saveBtn.click();
        }
    }
}, true);

// The ⋮ menu and File→Print open the preview directly — no keydown to
// intercept — and beforeprint is the only hook they fire. The pipeline
// above can't run from here: rendering is async and the preview snapshots
// the DOM the moment this handler returns, and the print can't be
// cancelled either. So instead of the silently blank paper an empty
// #print-container produces, swap in one sheet telling the user how to
// print the document. The afterprint handler below removes it.
//
// Only printPDF()'s own window.print() window is guarded — during that
// the container holds the real pages. Preparation, however, must fall
// through: an early return there snapshots a still-empty container and
// prints blank paper, the exact failure this handler exists to prevent.
// With some pages already rendered the snapshot prints those (the same
// partial-document semantics as cancelled-pipeline leftovers); with none,
// the guidance sheet below is the snapshot's only content.
window.addEventListener('beforeprint', () => {
    if (printFromPipeline) return; // pipeline's own preview: pages are in place
    if (!pdfDoc) return; // load-error screen; nothing useful to print
    const container = document.getElementById('print-container');
    // Pages left over from a pipeline print cancelled in the preview are
    // the real document — print those rather than replacing them here.
    if (!container || container.firstChild) return;

    const sheet = document.createElement('div');
    sheet.className = 'print-page print-notice';
    const heading = document.createElement('h1');
    heading.textContent = 'This document cannot be printed from the browser menu';
    const line = document.createElement('p');
    line.textContent = 'Use the Print button in this viewer\u2019s toolbar, or press Ctrl+P, to print the whole document.';
    sheet.appendChild(heading);
    sheet.appendChild(line);
    container.appendChild(sheet);
    // Tracked so printPDF can detach it before appending real pages.
    printNoticeSheet = sheet;
});

// Release the print canvases once the dialog closes; every print re-renders.
window.addEventListener('afterprint', () => {
    document.getElementById('print-container').innerHTML = '';
});

// Only one Case-2 build may run at a time. pdfDoc is assigned before the
// initial build finishes, so a zoom/fit/pinch landing inside the
// Promise.all(setupPage) window below used to start a second build, and
// both completions appended their fragments — doubling every .page div
// and its observer until the next full rebuild. While a build is in
// flight, further requests only set rebuildQueued; once the build lands,
// the last request is replayed through the Case-1 fast path at the
// newest scale.
let pageBuildActive = false;
let rebuildQueued = false;
// Focal point carried by the request queued behind an active build. A
// gated call loses its arguments entirely, so without this a pinch that
// lands mid-build replayed center-anchored instead of on the gesture
// origin. Nulls mean "no focal preference" — button/fit zooms anchor at
// the view center by design. Every gated call overwrites both values so
// the newest request wins wholesale, matching the last-request-wins
// replay rule above.
let queuedFocalX = null;
let queuedFocalY = null;

async function renderAllPages(focalClientX = null, focalClientY = null) {
    if (!pdfDoc) return;
    if (pageBuildActive) {
        rebuildQueued = true;
        queuedFocalX = focalClientX;
        queuedFocalY = focalClientY;
        return;
    }

    const scrollContainer = document.getElementById('viewerContainer');
    const scrollRatio = scrollContainer.scrollHeight > 0 ? (scrollContainer.scrollTop / scrollContainer.scrollHeight) : 0;

    updateZoomLabel();
    const existingPageDivs = viewerContainer.querySelectorAll('.page');

    // Case 1: Zoom / scale change on an already-built document ->
    // fast in-place resize, no DOM destruction, no flash.
    if (existingPageDivs.length === pdfDoc.numPages) {
        // Anchor whatever content point sits at the focal position of the
        // view (pinch origin when provided, else the vertical center),
        // measured in screen space before any resize. Restoring the old
        // scrollTop/scrollHeight ratio instead let the view drift a little
        // on every step: fixed page gaps and mixed page sizes don't scale
        // with the zoom factor. Fractions within the anchor page are
        // scale-invariant, so re-projecting them through the resized rect
        // returns the exact same content point to the exact same position
        // — including the horizontal axis once pages overflow the width.
        const containerRectBefore = scrollContainer.getBoundingClientRect();
        const focalX = focalClientX !== null &&
                focalClientX >= containerRectBefore.left && focalClientX <= containerRectBefore.right
            ? focalClientX
            : containerRectBefore.left + scrollContainer.clientWidth / 2;
        const anchorScreenY = focalClientY !== null &&
                focalClientY >= containerRectBefore.top && focalClientY <= containerRectBefore.bottom
            ? focalClientY
            : containerRectBefore.top + scrollContainer.clientHeight / 2;
        let anchorPageNum = null;
        let anchorFracX = 0;
        let anchorFracY = 0;
        for (const pageDiv of existingPageDivs) {
            const rect = pageDiv.getBoundingClientRect();
            if (anchorScreenY < rect.top) break; // pages are stacked in order
            anchorPageNum = parseInt(pageDiv.dataset.pageNumber, 10);
            if (rect.height > 0 && anchorScreenY <= rect.bottom) {
                anchorFracY = (anchorScreenY - rect.top) / rect.height;
            } else {
                anchorFracY = 1; // anchor fell into the gap below this page
            }
            const w = Math.max(rect.width, 1);
            anchorFracX = Math.min(1, Math.max(0, (focalX - rect.left) / w));
        }
        const hasAnchor = anchorPageNum !== null;

        existingPageDivs.forEach(pageDiv => {
            if (pageDiv._pdfPage) {
                const newViewport = pageDiv._pdfPage.getViewport({ scale: scale });
                pageDiv._viewport = newViewport;
                pageDiv.style.width = `${newViewport.width}px`;
                pageDiv.style.height = `${newViewport.height}px`;
            }
            if (pageDiv.dataset.loaded === 'true') {
                // Zoom transition: keep the previous paint on screen,
                // stretched to the new box (.zoom-transition in the CSS),
                // instead of blanking every page; renderPageContent swaps
                // the crisp redraw in atomically when it finishes.
                // Clearing `loaded` is what makes that redraw eligible —
                // renderPageContent early-returns while it reads "true",
                // and a stuck flag would leave this class on forever,
                // hiding the text layer and killing selection.
                pageDiv.dataset.rescale = 'true';
                pageDiv.classList.add('zoom-transition');
                pageDiv.dataset.loaded = 'false';
            }

            // Resizing alone doesn't cross an IntersectionObserver threshold
            // for pages that were already visible, so it won't re-fire the
            // callback on its own. Re-observing forces a fresh check of
            // current intersection state, so visible pages actually redraw.
            pageObserver.unobserve(pageDiv);
            pageObserver.observe(pageDiv);
        });

        // Re-project the anchor through its page's new geometry: the
        // fractions within that page are scale-invariant, so this returns
        // the exact same content point to the exact same screen position
        // on both axes.
        if (hasAnchor) {
            const anchorDiv = viewerContainer.querySelector(`.page[data-page-number="${anchorPageNum}"]`);
            if (anchorDiv) {
                const rectAfter = anchorDiv.getBoundingClientRect();
                // Both rectAfter.* and the focal coords are viewport-relative,
                // so each delta is exactly how far the anchored point moved
                // on screen during relayout; scrolling by it cancels the move.
                scrollContainer.scrollTop += (rectAfter.top + anchorFracY * rectAfter.height) - anchorScreenY;
                const widthAfter = Math.max(rectAfter.width, 1);
                scrollContainer.scrollLeft += (rectAfter.left + anchorFracX * widthAfter) - focalX;
            } else {
                scrollContainer.scrollTop = scrollContainer.scrollHeight * scrollRatio;
            }
        } else {
            // Anchor was in the top padding region; nothing meaningful to
            // hold, keep the legacy ratio restore.
            scrollContainer.scrollTop = scrollContainer.scrollHeight * scrollRatio;
        }
        updatePageNumber();
        return;
    }

    // Case 2: Initial load -> fetch all pages in parallel, build off-DOM,
    // insert in a single mutation.
    pageBuildActive = true;
    try {
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
    } catch (e) {
        // A dead build's queued request is stale: leaving it set would
        // attach a phantom replay to whichever unrelated build succeeds
        // next. Nothing user-visible is lost by dropping it — scale and
        // other mutations happen synchronously before queuing, so the
        // next real interaction rebuilds at current values anyway.
        // Rethrow unchanged: loadPDF relies on this rejection to surface
        // its load-error card instead of a broken half-built viewer.
        rebuildQueued = false;
        queuedFocalX = null;
        queuedFocalY = null;
        throw e;
    } finally {
        pageBuildActive = false;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight * scrollRatio;
    updatePageNumber();

    // A request arrived mid-build (scale changed under us). The appended
    // divs may mix scales — setupPage reads the global at getPage time —
    // so replay once: this now takes the Case-1 fast path and settles
    // every page at the current scale. Synchronous, so loadPDF's await
    // above still resumes against the finished DOM. The queued request's
    // focal point rides along — a pinch that landed mid-build must
    // re-anchor on its gesture origin, not snap to the view center.
    if (rebuildQueued) {
        rebuildQueued = false;
        const fx = queuedFocalX;
        const fy = queuedFocalY;
        queuedFocalX = null;
        queuedFocalY = null;
        renderAllPages(fx, fy);
    }
}

// Intentionally replaced during above chunk

// theme-bootstrap.js may have applied dark-mode from the mirror before
// this module ran; align the toggle button's icon/label with that state
// now instead of waiting for the async storage read.
const bootstrappedToggle = document.getElementById('dark_mode_toggle');
if (bootstrappedToggle) {
    bootstrappedToggle.innerHTML = darkModeButtonHtml(document.body.classList.contains('dark-mode'));
}

loadPDF();

// Zoom logic
let currentZoomMode = 'custom';

// Single writer for the toolbar zoom % so every path — buttons, fit
// modes, pinch ticks, queued rebuild replays — formats identically from
// the one authoritative `scale`.
function updateZoomLabel() {
    zoomLevelSpan.textContent = Math.round(scale * 100) + "%";
}

// The static HTML placeholder reads 100% while the viewer actually starts
// at the adjusted default above; sync immediately so the label matches
// even before the first build lands (and permanently if loading fails).
updateZoomLabel();

async function calculateScaleAndRender() {
    if (currentZoomMode === 'custom') {
        renderAllPages();
        return;
    }
    
    if (!pdfDoc) return;

    // Fit the page the user is actually looking at: measuring page 1
    // misfit every differently-sized page in mixed-size documents.
    let targetNum = parseInt(document.getElementById('page_num').value, 10);
    if (!Number.isInteger(targetNum) || targetNum < 1) targetNum = 1;
    if (targetNum > pdfDoc.numPages) targetNum = pdfDoc.numPages;
    const page = await pdfDoc.getPage(targetNum);
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

// The highlight popups are position:fixed with static px coordinates set
// at click time, so a document scroll would leave them floating detached
// over unrelated text. Shift them by the scroll delta instead of
// dismissing them: the note editor can hold unsaved typed text, and
// hidePopups() would silently discard it.
let popupAnchorScrollTop = container.scrollTop;
function shiftPopupsWithScroll() {
    const delta = container.scrollTop - popupAnchorScrollTop;
    popupAnchorScrollTop = container.scrollTop;
    if (delta === 0) return;
    ['color-picker-popup', 'edit-highlight-popup', 'note-editor-popup'].forEach(id => {
        const popup = document.getElementById(id);
        if (!popup || popup.classList.contains('hidden')) return;
        const top = parseFloat(popup.style.top);
        if (!Number.isNaN(top)) popup.style.top = `${top - delta}px`;
    });
}

container.addEventListener('scroll', () => {
    shiftPopupsWithScroll();
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
    let idx = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const page = pages[mid];
        if (page.offsetTop > containerCenter) {
            hi = mid - 1;
        } else if (page.offsetTop + page.clientHeight <= containerCenter) {
            lo = mid + 1;
        } else {
            idx = mid;
            break;
        }
    }

    // The center fell between pages: .page has a 10px bottom margin, and a
    // stop inside that gap satisfies neither branch above. Attribute it to
    // the page the search narrowed to (lo - 1); the clamps also cover
    // centering above page 1 or below the last page.
    if (idx === -1) idx = Math.min(Math.max(lo - 1, 0), pages.length - 1);

    const currentNum = parseInt(pages[idx].dataset.pageNumber, 10);
    document.getElementById('page_num').value = currentNum;

    // Auto-resume save logic (debounced to avoid spamming storage)
    if (autoSavedLastPage !== currentNum) {
        autoSavedLastPage = currentNum;
        // The current-page comment filter follows the view
        refreshCommentsForPageFilter();
        clearTimeout(scrollSaveTimeout);
        scrollSaveTimeout = setTimeout(() => {
            saveLastPage(currentNum);
        }, 1000);
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

// Concatenates the characters of the range within one text layer.
// Returns null when the range captures no characters at all — both when
// it touches no text node (e.g. a selection over page chrome) and when
// it merely grazes node boundaries without covering any character:
// intersectsNode is boundary-inclusive, so a range starting at one
// node's end offset or ending at the next node's start flags a hit
// whose slice is empty. Returning null there lets the caller discard
// such phantom groups instead of storing/exporting text:'' annotations.
function extractSelectedText(range, textLayer) {
    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
    let text = '';
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!range.intersectsNode(node)) continue;
        const s = node === range.startContainer ? range.startOffset : 0;
        const e = node === range.endContainer ? range.endOffset : node.data.length;
        if (e > s) text += node.data.slice(s, e);
    }
    return text !== '' ? text : null;
}

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

    // A selection spanning a page break has a common ancestor above both
    // text layers (typically #viewer), so requiring the ancestor itself
    // to sit inside ONE .textLayer made cross-page selections silently
    // do nothing. Instead, collect every rendered page the range touches
    // and split the selection into one group per page; each group then
    // flows through the ordinary single-page highlight pipeline.
    const range = selection.getRangeAt(0);

    // Only rendered pages can hold selected text — unloaded ones have no
    // textLayer. Page rects are read in this same synchronous block:
    // getPage() below resolves asynchronously, and a zoom or scroll
    // landing in that gap would mix stale coordinates.
    const loadedPages = Array.from(viewerContainer.querySelectorAll('.page[data-loaded="true"]'))
        .filter(pageDiv => pageDiv.querySelector('.textLayer'))
        .map(pageDiv => ({ pageDiv, rect: pageDiv.getBoundingClientRect() }));

    const clientRects = Array.from(range.getClientRects())
        .filter(r => r.width > 0 && r.height > 0);
    if (!pdfDoc || clientRects.length === 0 || loadedPages.length === 0) {
        return;
    }

    // Assign each line box to the page whose vertical band contains its
    // center, preserving reading order (Map keeps insertion order).
    const rectsByPage = new Map();
    for (const r of clientRects) {
        const centerY = r.top + r.height / 2;
        let entry = loadedPages.find(p => centerY >= p.rect.top && centerY < p.rect.bottom);
        if (!entry) {
            // Fractional gaps between page boxes: nearest band wins.
            entry = loadedPages.reduce((best, p) =>
                Math.abs(centerY - (p.rect.top + p.rect.height / 2)) <
                Math.abs(centerY - (best.rect.top + best.rect.height / 2)) ? p : best);
        }
        const list = rectsByPage.get(entry) || [];
        list.push(r);
        rectsByPage.set(entry, list);
    }

    const selectedText = selection.toString();
    const lastRawRect = clientRects[clientRects.length - 1];

    const assemblies = [...rectsByPage.entries()].map(([entry, rects]) => ({
        entry,
        rects,
        text: extractSelectedText(range, entry.pageDiv.querySelector('.textLayer'))
    })).filter(a => a.text !== null);

    // Get viewports to convert coordinates
    Promise.all(assemblies.map(a => pdfDoc.getPage(parseInt(a.entry.pageDiv.dataset.pageNumber, 10)))).then(pages => {
        const groups = assemblies.map((a, i) => {
            const viewport = pages[i].getViewport({ scale: scale });
            const pageRelativeRaw = a.rects.map(r => ({
                left: r.left - a.entry.rect.left,
                top: r.top - a.entry.rect.top,
                width: r.width,
                height: r.height
            }));
            const mergedRects = mergeHighlightRectangles(pageRelativeRaw, viewport.scale);

            const relativeRects = mergedRects.map(r => {
                const left = r.left;
                const top = r.top;

                // Convert to PDF points. All four corners are stored:
                // convertToPdfPoint includes the page's /Rotate transform,
                // so on rotated pages a screen-aligned box is NOT
                // axis-aligned in PDF space, and width/height deltas alone
                // lose that orientation (the export used to skew such
                // highlights). The legacy fields stay for on-screen
                // drawing and click-detection, which round-trip exactly.
                const ptTL = viewport.convertToPdfPoint(left, top);
                const ptBR = viewport.convertToPdfPoint(left + r.width, top + r.height);
                const ptTR = viewport.convertToPdfPoint(left + r.width, top);
                const ptBL = viewport.convertToPdfPoint(left, top + r.height);

                return {
                    cssLeft: left,
                    cssTop: top,
                    cssWidth: r.width,
                    cssHeight: r.height,
                    pdfX: ptTL[0],
                    pdfY: ptTL[1],
                    pdfWidth: ptBR[0] - ptTL[0],
                    pdfHeight: ptTL[1] - ptBR[1], // PDF origin is bottom-left
                    cTL: ptTL,
                    cTR: ptTR,
                    cBR: ptBR,
                    cBL: ptBL
                };
            });
            return {
                pageNumber: parseInt(a.entry.pageDiv.dataset.pageNumber, 10),
                pageDiv: a.entry.pageDiv,
                viewport,
                rects: relativeRects,
                text: a.text
            };
        }).filter(g => g.rects.length > 0);

        if (groups.length === 0) {
            hidePopups();
            return;
        }

        currentSelection = {
            text: selectedText,
            groups
        };

        // Show popups near the last rect of the selection (end of the
        // last page group).
        showColorPicker(lastRawRect.left + window.scrollX, lastRawRect.bottom + window.scrollY);
    }).catch(err => {
        console.error("Error obtaining page for selection:", err);
    });
});

// Keep an absolutely-positioned popup entirely on screen. Coordinates are
// viewport-space (the page chrome never scrolls), so clamping against
// innerWidth/innerHeight is exact. Call AFTER the popup becomes measurable.
function clampPopupToViewport(popup, margin = 8) {
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    if (!width || !height) return;
    let left = parseFloat(popup.style.left) || 0;
    let top = parseFloat(popup.style.top) || 0;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    popup.style.left = `${Math.min(Math.max(left, margin), maxLeft)}px`;
    popup.style.top = `${Math.min(Math.max(top, margin), maxTop)}px`;
}

function showColorPicker(x, y) {
    const popup = document.getElementById('color-picker-popup');
    popup.style.left = `${x}px`;
    popup.style.top = `${y + 10}px`;
    popup.classList.remove('hidden');
    clampPopupToViewport(popup);
}

// --- Floating Note Editor Real-Time Auto-Save ---
let noteAutoSaveTimeout = null;
let noteStatusFadeTimeout = null;
let isNoteDirty = false;

function getNotePopupTargetHighlight() {
    const notePopup = document.getElementById('note-editor-popup');
    if (!notePopup) return null;
    const rawId = notePopup.dataset.hlId;
    if (!rawId) return null;
    const targetId = parseInt(rawId, 10);
    return highlights.find(h => h.id === targetId) || null;
}

function handleFloatingNoteInput() {
    const hl = getNotePopupTargetHighlight();
    if (!hl) return;

    const noteEl = document.getElementById('note-textarea');
    if (!noteEl) return;

    const cleanContent = getRichNoteContent(noteEl);
    const hadNote = !!hl.note;
    const hasNote = !!cleanContent;

    // 1. Instant in-memory sync (0 ms lag) strictly to bound highlight
    hl.note = cleanContent;
    hl.noteFmt = cleanContent ? 'html' : undefined;
    isNoteDirty = true;

    // If indicator presence toggled (empty <-> non-empty), update page indicator badge
    if (hadNote !== hasNote) {
        updateHighlightIndicatorsOnPage(hl);
    }

    // Sync to open sidebar card in real time if present
    const sidebarNoteInput = document.querySelector(`.sidebar-item[data-hl-id="${hl.id}"] .sidebar-item-note-input`);
    if (sidebarNoteInput && document.activeElement !== sidebarNoteInput) {
        setRichNoteContent(sidebarNoteInput, hl);
    }

    // 2. Update status badge to "Saving…"
    const statusEl = document.getElementById('note-save-status');
    if (statusEl) {
        if (noteStatusFadeTimeout) clearTimeout(noteStatusFadeTimeout);
        statusEl.textContent = 'Saving…';
        statusEl.classList.add('visible');
    }

    // 3. Debounced storage write (~300ms)
    if (noteAutoSaveTimeout) clearTimeout(noteAutoSaveTimeout);
    noteAutoSaveTimeout = setTimeout(() => {
        flushFloatingNoteSave();
    }, 300);
}

function flushFloatingNoteSave() {
    if (noteAutoSaveTimeout) {
        clearTimeout(noteAutoSaveTimeout);
        noteAutoSaveTimeout = null;
    }

    if (!isNoteDirty) return;

    const hl = getNotePopupTargetHighlight();
    if (!hl) {
        isNoteDirty = false;
        return;
    }

    isNoteDirty = false;

    const noteEl = document.getElementById('note-textarea');
    if (noteEl) {
        const cleanContent = getRichNoteContent(noteEl);
        hl.note = cleanContent;
        hl.noteFmt = cleanContent ? 'html' : undefined;
    }

    // Persist to storage without destroying sidebar DOM
    saveHighlights(false);

    // Show "Saved" status and fade after 1.5s
    const statusEl = document.getElementById('note-save-status');
    if (statusEl) {
        statusEl.textContent = 'Saved';
        statusEl.classList.add('visible');
        if (noteStatusFadeTimeout) clearTimeout(noteStatusFadeTimeout);
        noteStatusFadeTimeout = setTimeout(() => {
            statusEl.classList.remove('visible');
        }, 1500);
    }
}

function hidePopups() {
    const editPopup = document.getElementById('edit-highlight-popup');
    editPopup.style.display = '';
    editPopup.style.visibility = '';
    editPopup.classList.add('hidden');
    
    const notePopup = document.getElementById('note-editor-popup');
    if (notePopup && !notePopup.classList.contains('hidden')) {
        const targetHl = getNotePopupTargetHighlight();
        flushFloatingNoteSave();
        if (targetHl) {
            updateHighlightIndicatorsOnPage(targetHl);
        }
        delete notePopup.dataset.hlId;
        notePopup.classList.add('hidden');
    }
    
    document.getElementById('color-picker-popup').classList.add('hidden');
    currentSelection = null;
    activeHighlightId = null;
    document.querySelectorAll('.custom-highlight.active').forEach(el => el.classList.remove('active'));
}

// Markup tools logic
let currentMarkupType = 'Highlight';

// Re-render an existing highlight's overlays after an in-place edit
// (type conversion or recolor): drop its divs anywhere and redraw through
// the ordinary drawHighlight path, so variant classes, inline styles, and
// the .active state always match the stored record instead of being
// hand-patched piecemeal.
function redrawExistingHighlight(hl) {
    document.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"], .note-indicator[data-hl-id="${hl.id}"]`)
        .forEach(el => el.remove());
    const pageDiv = document.querySelector(`.page[data-page-number="${hl.pageNumber}"]`);
    if (pageDiv && pageDiv._viewport) drawHighlight(hl, pageDiv, pageDiv._viewport);
}

document.querySelectorAll('.markup-tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const activateTool = () => {
            document.querySelectorAll('.markup-tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMarkupType = btn.dataset.type;
        };
        // Editing context (picker opened via edit-btn-color): convert the
        // active highlight's type in place instead of silently rewriting
        // only the future-selection default. The tool also becomes the
        // future default and takes the visual active state — one source
        // of truth, no desync between what the picker shows and what a
        // fresh selection would use.
        if (activeHighlightId !== null) {
            const hl = highlights.find(h => h.id === activeHighlightId);
            if (!hl) return;
            hl.markupType = btn.dataset.type;
            activateTool();
            redrawExistingHighlight(hl);
            saveHighlights();
            return; // picker stays open for a follow-up color choice
        }
        activateTool();
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
                // Redraw through the shared path: any type conversion made
                // via the tool buttons above must be reflected in the same
                // pass, and hand-patched inline styles would go stale.
                redrawExistingHighlight(hl);
                saveHighlights();
            }
            hidePopups();
            return;
        }

        if (!currentSelection) return;

        // One highlight per page: a selection spanning a page break was
        // split at mouseup, and each group stores as an ordinary
        // single-page highlight — storage, export, and click-detection
        // all assume one page per highlight.
        let lastCreatedHlId = null;
        let lastCreatedPage = null;
        currentSelection.groups.forEach(group => {
            const hl = {
                id: ++highlightCounter,
                pageNumber: group.pageNumber,
                rects: group.rects,
                color: color,
                text: group.text,
                markupType: currentMarkupType,
                // Sidebar "x ago" stamp. Optional by design: records from
                // before this field existed simply render without one.
                createdAt: Date.now()
            };

            highlights.push(hl);
            // Resolve the viewport at draw time, not mouseup time: the user
            // may zoom while the picker is open, and the stored PDF-space
            // rects only land correctly through the page's live _viewport.
            drawHighlight(hl, group.pageDiv, group.pageDiv._viewport || group.viewport);
            lastCreatedHlId = hl.id;
            lastCreatedPage = hl.pageNumber;
        });

        // When creating a highlight on a partially visible neighbouring page while
        // the current-page filter is active, follow the user's focus so the newly
        // added card is visible in the sidebar rather than being filtered out.
        if (lastCreatedPage !== null && commentsCurrentPageOnly && autoSavedLastPage !== lastCreatedPage) {
            autoSavedLastPage = lastCreatedPage;
            const pageNumInput = document.getElementById('page_num');
            if (pageNumInput) pageNumInput.value = lastCreatedPage;
        }

        saveHighlights();

        if (lastCreatedHlId !== null) {
            focusSidebarComment(lastCreatedHlId);
        }

        // Clear browser selection
        window.getSelection().removeAllRanges();
        hidePopups();
    });
});

document.getElementById('close-color-picker').addEventListener('click', () => {
    hidePopups();
});

function drawHighlight(hl, pageDiv, viewport) {
    const rawBoxes = hl.rects.map(r => {
        const pt1 = viewport.convertToViewportPoint(r.pdfX, r.pdfY);
        const pt2 = viewport.convertToViewportPoint(r.pdfX + r.pdfWidth, r.pdfY - r.pdfHeight);
        return {
            left: Math.min(pt1[0], pt2[0]),
            top: Math.min(pt1[1], pt2[1]),
            width: Math.abs(pt2[0] - pt1[0]),
            height: Math.abs(pt2[1] - pt1[1])
        };
    });
    const boxes = mergeHighlightRectangles(rawBoxes, viewport.scale);

    boxes.forEach(box => {
        const div = document.createElement('div');
        div.className = 'custom-highlight';
        if (hl.id === activeHighlightId) {
            div.classList.add('active');
        }
        // Consume the sidebar-click flash when this page's overlays were
        // drawn only after scrollToHighlight's scroll landed here.
        if (hl.id === pendingFlashHighlightId && Date.now() <= pendingFlashHighlightUntil) {
            div.classList.add('active');
            setTimeout(() => div.classList.remove('active'), 2000);
        }
        div.dataset.hlId = hl.id;
        
        div.style.left = `${box.left}px`;
        div.style.top = `${box.top}px`;
        div.style.width = `${box.width}px`;
        div.style.height = `${box.height}px`;
        
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
        // translate(-100%,-50%) renders the box to the LEFT of and above
        // the anchor; highlights starting at a page's top/left edge would
        // clip it. Measure post-insert and nudge it fully inside.
        const iw = indicator.offsetWidth || 18;
        const ih = indicator.offsetHeight || 16;
        if (cssLeft - iw < 2) indicator.style.left = `${iw + 2}px`;
        if (cssTop - ih / 2 < 2) indicator.style.top = `${ih / 2 + 2}px`;
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
    if (!pageDiv || !pageDiv._viewport) {
        hidePopups();
        return;
    }

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
                // Extents can be negative on /Rotate pages: every rotation
                // transform is an axis swap/flip, so the stored box keeps
                // its axis-aligned region but one of pdfWidth/pdfHeight
                // flips sign. Normalize both axes like drawHighlight's
                // min/max reconstruction, or the containment interval
                // inverts and every interior click misses.
                const minX = Math.min(r.pdfX, r.pdfX + r.pdfWidth);
                const maxX = Math.max(r.pdfX, r.pdfX + r.pdfWidth);
                const minY = Math.min(r.pdfY - r.pdfHeight, r.pdfY);
                const maxY = Math.max(r.pdfY - r.pdfHeight, r.pdfY);
                // Add a small 2-point padding for easier clicking
                return pdfX >= minX - 2 && pdfX <= maxX + 2 && pdfY >= minY - 2 && pdfY <= maxY + 2;
            });
        });
    }

    if (clickedIdx !== -1) {
        // Close and flush any previously open popup (e.g. note editor) before activating a new highlight
        hidePopups();

        const hl = highlights[clickedIdx];
        activeHighlightId = hl.id;

        // Add active class
        document.querySelectorAll('.custom-highlight.active').forEach(el => el.classList.remove('active'));
        pageDiv.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => el.classList.add('active'));

        // Adobe-style reverse navigation: with the Comments tab open, the
        // click also locates this highlight's card in the sidebar. Runs
        // after the page-side .active update so both surfaces light up
        // together; a no-op whenever the comments list isn't visible.
        focusSidebarComment(hl.id);

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
        clampPopupToViewport(popup);
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

    // Anchor the popup at the end of the selection (last rect of the
    // last page group); the prompt text is the full cross-page string.
    const lastGroup = currentSelection.groups[currentSelection.groups.length - 1];
    const rects = lastGroup.rects;
    const lastRect = rects[rects.length - 1];
    const pageRect = lastGroup.pageDiv.getBoundingClientRect();
    
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
        // Writing the override must move the tri-state too, or
        // adoptRemoteGlobalTheme would keep treating this document as
        // global-themed and let a later options-page change clobber the
        // explicit choice just made.
        perDocThemeActive = true;
        chrome.storage.local.set({ ['pdf_dark_mode_' + storageFileUrl]: isDark });
        mirrorPerDocTheme('pdf_dark_mode_' + storageFileUrl, isDark);
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
    // Same EOL-aware builder the search feature uses: a naive
    // join-with-spaces shredded intra-line run fragments into "Hel lo"
    // soup and padded around empty positioning items.
    const pageText = buildPageText(textContent).text;

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
    
    notePopup.dataset.hlId = String(hl.id);
    notePopup.style.left = editPopup.style.left;
    notePopup.style.top = editPopup.style.top;
    
    const noteEl = document.getElementById('note-textarea');
    setRichNoteContent(noteEl, hl);
    noteEl.style.height = ''; // reset any manual drag height on open
    isNoteDirty = false;
    if (noteAutoSaveTimeout) {
        clearTimeout(noteAutoSaveTimeout);
        noteAutoSaveTimeout = null;
    }
    const statusEl = document.getElementById('note-save-status');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.remove('visible');
    }
    
    editPopup.classList.add('hidden');
    notePopup.classList.remove('hidden');

    const isExpanded = getStoredNotePopupExpanded();
    notePopup.classList.toggle('expanded', isExpanded);
    const expandBtn = document.getElementById('note-btn-expand');
    if (expandBtn) {
        expandBtn.innerHTML = viewerIconSvg(isExpanded ? 'minimize' : 'maximize', 13);
        expandBtn.title = isExpanded ? 'Shrink writing area' : 'Expand writing area';
        expandBtn.setAttribute('aria-label', isExpanded ? 'Shrink writing area' : 'Expand writing area');
    }

    // The note editor is taller than the edit popup it inherits its
    // position from; clamp with its own real dimensions.
    clampPopupToViewport(notePopup);
    noteEl.focus();
});

function getStoredNotePopupExpanded() {
    try {
        return localStorage.getItem('pdf_note_popup_expanded') === 'true';
    } catch (e) {
        return false;
    }
}

function setStoredNotePopupExpanded(val) {
    try {
        localStorage.setItem('pdf_note_popup_expanded', String(val));
    } catch (e) {}
}

const noteEditorEl = document.getElementById('note-textarea');
if (noteEditorEl) {
    attachRichEditor(noteEditorEl, {
        onInput: handleFloatingNoteInput,
        onSave: () => {
            flushFloatingNoteSave();
        }
    });
}

const noteExpandBtn = document.getElementById('note-btn-expand');
if (noteExpandBtn) {
    noteExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const notePopup = document.getElementById('note-editor-popup');
        if (!notePopup) return;
        const willBeExpanded = !notePopup.classList.contains('expanded');
        notePopup.classList.toggle('expanded', willBeExpanded);
        
        const noteEl = document.getElementById('note-textarea');
        if (noteEl) noteEl.style.height = ''; // clear any manual drag height
        
        noteExpandBtn.innerHTML = viewerIconSvg(willBeExpanded ? 'minimize' : 'maximize', 13);
        noteExpandBtn.title = willBeExpanded ? 'Shrink writing area' : 'Expand writing area';
        noteExpandBtn.setAttribute('aria-label', willBeExpanded ? 'Shrink writing area' : 'Expand writing area');
        setStoredNotePopupExpanded(willBeExpanded);
        
        clampPopupToViewport(notePopup);
        if (noteEl) noteEl.focus();
    });
}

const notePopupEl = document.getElementById('note-editor-popup');
if (notePopupEl && typeof ResizeObserver !== 'undefined') {
    const notePopupResizeObserver = new ResizeObserver(() => {
        if (!notePopupEl.classList.contains('hidden')) {
            clampPopupToViewport(notePopupEl);
        }
    });
    notePopupResizeObserver.observe(notePopupEl);
}

document.getElementById('note-btn-cancel').addEventListener('click', () => {
    hidePopups();
});

document.getElementById('note-btn-save').addEventListener('click', () => {
    hidePopups();
});

window.addEventListener('beforeunload', () => {
    flushFloatingNoteSave();
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushFloatingNoteSave();
    }
});

document.getElementById('edit-btn-color').addEventListener('click', () => {
    // Show color picker exactly where the edit popup is
    const editPopup = document.getElementById('edit-highlight-popup');
    const colorPicker = document.getElementById('color-picker-popup');
    colorPicker.style.left = editPopup.style.left;
    colorPicker.style.top = editPopup.style.top;
    editPopup.classList.add('hidden');
    // Measurable only once .hidden (display:none) is lifted — same
    // ordering as every other popup shower.
    colorPicker.classList.remove('hidden');
    // The picker stacks its tools vertically, so it is taller than the
    // edit popup whose clamped box it inherited; re-clamp with its own
    // real dimensions or its bottom overflows the viewport.
    clampPopupToViewport(colorPicker);
});

document.getElementById('edit-btn-trash').addEventListener('click', () => {
    if (activeHighlightId === null) return;
    
    const deletingId = activeHighlightId;
    const notePopup = document.getElementById('note-editor-popup');
    if (notePopup && parseInt(notePopup.dataset.hlId, 10) === deletingId) {
        isNoteDirty = false;
        delete notePopup.dataset.hlId;
    }

    highlights = highlights.filter(h => h.id !== deletingId);
    saveHighlights();
    
    // Remove divs from DOM
    document.querySelectorAll(`.custom-highlight[data-hl-id="${deletingId}"]`).forEach(el => el.remove());
    document.querySelectorAll(`.note-indicator[data-hl-id="${deletingId}"]`).forEach(el => el.remove());
    
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

// Base filename (extension stripped) of the open document, for naming
// exports after it instead of a generic fixed name. Resolves the
// relative test fallback, decodes percent-encoding, and degrades to
// "document" for odd URLs; Chrome sanitizes filesystem-illegal
// characters in download names on its own.
function documentBaseName() {
    try {
        const name = decodeURIComponent(new URL(fileUrl, window.location.href).pathname.split('/').pop() || '');
        return (/\.pdf$/i.test(name) ? name.slice(0, -4) : name) || 'document';
    } catch {
        return 'document';
    }
}

// Deferred object-URL release for anchor downloads. Revoking in the same
// synchronous block as click() works in current Chrome only because the
// browser happens to dereference the blob during click dispatch; engines
// and past Chrome versions that fetched the blob from a later task saw
// revoked-before-fetch URLs fail the download outright. The generous
// delay outlasts any realistic commit stall without meaningfully pinning
// one export-sized blob.
const REVOKE_OBJECT_URL_DELAY_MS = 30000;
function revokeObjectUrlLater(url) {
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_OBJECT_URL_DELAY_MS);
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
            const formattedNote = hl.noteFmt === 'html' ? noteHtmlToMarkdown(hl.note) : hl.note;
            mdContent += `\n**Note:** ${formattedNote}\n`;
        }
        mdContent += "\n---\n\n";
    });
    
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
        const a = document.createElement('a');
        a.href = url;
        a.download = documentBaseName() + '-annotations.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        revokeObjectUrlLater(url);
});

// One export at a time: every click used to launch a full
// fetch→parse→serialize pipeline in parallel (duplicate downloads), and
// a stalled server hung the fetch indefinitely with no feedback and no
// way to retry cleanly.
const SAVE_FETCH_TIMEOUT_MS = 60000;
let savePdfInProgress = false;

document.getElementById('save_pdf').addEventListener('click', async () => {
    if (savePdfInProgress) return;
    const saveBtn = document.getElementById('save_pdf');
    // Bound the transfer wait so a stalled connection or a hung local
    // file read can't hang the export forever; 60s stays generous for
    // large files on slow links. Both transports take this signal: fetch
    // natively, the file:// XHR via its AbortSignal bridge.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SAVE_FETCH_TIMEOUT_MS);
    savePdfInProgress = true;
    saveBtn.disabled = true;
    try {
        // Retrieve the PDF bytes. Prefer in-memory data already parsed by PDF.js
        // via pdfDoc.getData() for instant retrieval without network latency.
        // Fall back to local file XHR or fetch if pdfDoc is not yet ready.
        let existingPdfBytes;
        if (pdfDoc && typeof pdfDoc.getData === 'function') {
            try {
                existingPdfBytes = await pdfDoc.getData();
            } catch (getDataErr) {
                console.warn('pdfDoc.getData() failed, falling back to fetch/read', getDataErr);
            }
        }
        if (!existingPdfBytes) {
            if (/^file:/i.test(fileUrl)) {
                existingPdfBytes = await readLocalFileViaXhr(fileUrl, controller.signal);
            } else {
                const res = await fetch(fileUrl, { credentials: 'include', signal: controller.signal });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText || 'Failed to fetch PDF file'}`);
                }
                existingPdfBytes = await res.arrayBuffer();
            }
        }

        // Highlight coordinates were captured against the viewer's copy;
        // the fresh bytes below may have changed since it was opened.
        // Snapshot the viewer's page count before the parse await so the
        // drift comparison below pairs one coherent viewer-side reading
        // with the freshly loaded file — robust even if module-level
        // pdfDoc ever gains a second assignment site.
        const viewerPageCount = pdfDoc ? pdfDoc.numPages : null;
        // Distinct name on purpose: this is pdf-lib's document, not the
        // pdf.js one above, and it shadows nothing.
        // parseSpeed: Infinity eliminates yielding to setTimeout(0) on every 100 objects,
        // accelerating load on 500+ page PDFs by orders of magnitude.
        const pdfLibDoc = await PDFLib.PDFDocument.load(existingPdfBytes, {
            parseSpeed: Infinity,
            updateMetadata: false
        });
        // Page-count drift proves the remote file changed. Same-count
        // content changes can't be detected cheaply and degrade to
        // alignment risk, flagged after the download below.
        const pageCount = pdfLibDoc.getPageCount();
        const staleDocument = viewerPageCount !== null && pageCount !== viewerPageCount;
        let skippedStale = 0;

        // Prune previous markup annotations from all pages before appending
        // current highlights. This prevents duplicate annotations from stacking
        // and darkening when overwriting the same file repeatedly, and ensures
        // deleted highlights do not persist as zombies. Non-markup annotations
        // (such as Links and Form Widgets) are strictly preserved.
        const MARKUP_SUBTYPES = new Set(['/Highlight', '/Underline', '/StrikeOut', '/Squiggly']);
        let prunedCount = 0;
        for (let i = 0; i < pageCount; i++) {
            const page = pdfLibDoc.getPage(i);
            const annots = page.node.Annots();
            if (annots && typeof annots.size === 'function') {
                const prunedRefs = new Set();
                const totalAnnots = annots.size();

                // First pass: identify markup annotations and any linked popup references
                for (let j = 0; j < totalAnnots; j++) {
                    const item = annots.get(j);
                    const dict = pdfLibDoc.context.lookup(item);
                    if (dict instanceof PDFLib.PDFDict) {
                        const subtype = dict.get(PDFLib.PDFName.of('Subtype'));
                        if (subtype && MARKUP_SUBTYPES.has(subtype.asString())) {
                            prunedRefs.add(item);
                            const popup = dict.get(PDFLib.PDFName.of('Popup'));
                            if (popup) prunedRefs.add(popup);
                        }
                    }
                }

                // Second pass: catch popup annotations whose Parent is one of the pruned annotations
                for (let j = 0; j < totalAnnots; j++) {
                    const item = annots.get(j);
                    if (prunedRefs.has(item)) continue;
                    const dict = pdfLibDoc.context.lookup(item);
                    if (dict instanceof PDFLib.PDFDict) {
                        const subtype = dict.get(PDFLib.PDFName.of('Subtype'));
                        if (subtype && subtype.asString() === '/Popup') {
                            const parent = dict.get(PDFLib.PDFName.of('Parent'));
                            if (parent && prunedRefs.has(parent)) {
                                prunedRefs.add(item);
                            }
                        }
                    }
                }

                if (prunedRefs.size > 0) {
                    prunedCount += prunedRefs.size;
                    const keptAnnots = pdfLibDoc.context.obj([]);
                    for (let j = 0; j < totalAnnots; j++) {
                        const item = annots.get(j);
                        if (!prunedRefs.has(item)) {
                            keptAnnots.push(item);
                        }
                    }
                    page.node.set(PDFLib.PDFName.of('Annots'), keptAnnots);
                }
            }
        }

        // Fast path: If there are no highlights to bake into the PDF AND no
        // previous markup annotations were pruned, download the in-memory bytes
        // directly and avoid PDF-Lib re-serialization overhead.
        if ((!highlights || highlights.length === 0) && prunedCount === 0) {
            const blob = new Blob([existingPdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = documentBaseName() + ".pdf";
            link.click();
            revokeObjectUrlLater(url);
            return;
        }

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
            // Skip annotations whose target page no longer exists (or was
            // never valid) instead of letting getPage throw and abort the
            // whole export; the user is told below.
            if (!Number.isInteger(hl.pageNumber) || hl.pageNumber < 1 || hl.pageNumber > pageCount) {
                skippedStale++;
                return;
            }
            const page = pdfLibDoc.getPage(hl.pageNumber - 1);
            const colorRgb = hexToRgb(hl.color);
            
            // Calculate bounding box for the entire highlight
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const quadPoints = [];

            hl.rects.forEach(r => {
                // Prefer the stored corners: on rotated pages the box is
                // not axis-aligned in PDF space, and rebuilding it from
                // width/height deltas would skew the exported quad.
                // Highlights saved before corner storage fall back to the
                // legacy axis-aligned derivation (correct for unrotated
                // pages, which is all they could have been made on).
                // Validated, not merely truthy: this also covers records
                // created this session (they bypass the storage
                // sanitizer), so garbage corners can never reach QuadPoints.
                let tl, tr, bl, br;
                if (hasValidCornerQuad(r)) {
                    tl = r.cTL; tr = r.cTR; br = r.cBR; bl = r.cBL;
                } else {
                    const x1 = r.pdfX;
                    const y1 = r.pdfY - r.pdfHeight; // Bottom edge
                    const x2 = r.pdfX + r.pdfWidth;
                    const y2 = r.pdfY;               // Top edge
                    tl = [x1, y2]; tr = [x2, y2]; br = [x2, y1]; bl = [x1, y1];
                }

                minX = Math.min(minX, tl[0], tr[0], bl[0], br[0]);
                minY = Math.min(minY, tl[1], tr[1], bl[1], br[1]);
                maxX = Math.max(maxX, tl[0], tr[0], bl[0], br[0]);
                maxY = Math.max(maxY, tl[1], tr[1], bl[1], br[1]);

                // Add 8 coordinates for this rectangle's quad points —
                // same vertex order the legacy path used (TL, TR, BL, BR).
                quadPoints.push(
                    tl[0], tl[1], // Top-Left
                    tr[0], tr[1], // Top-Right
                    bl[0], bl[1], // Bottom-Left
                    br[0], br[1]  // Bottom-Right
                );
            });
            
            if (quadPoints.length === 0) return;

            const isMarkupLine = hl.markupType === 'Underline' || hl.markupType === 'StrikeOut';
            const annotObj = {
                Type: 'Annot',
                Subtype: hl.markupType || 'Highlight',
                Rect: [minX, minY, maxX, maxY], // Bounding box of all quads
                QuadPoints: quadPoints,
                C: [colorRgb.r, colorRgb.g, colorRgb.b],
                CA: isMarkupLine ? 1.0 : 0.5, // Match CSS 0.5 opacity for highlights
                F: 4 // Print flag
            };

            if (hl.note) {
                // PDF-lib supports text contents via PDFString
                const plainNote = hl.noteFmt === 'html' ? noteHtmlToPlainText(hl.note) : hl.note;
                annotObj.Contents = PDFLib.PDFString.of(plainNote);
            }

            if (authorName) {
                // /T (annotation author) must be a string; a plain string
                // here would become a PDFName via context.obj().
                annotObj.T = PDFLib.PDFString.of(authorName);
            }

            const annot = pdfLibDoc.context.obj(annotObj);
            
            let annots = page.node.Annots();
            if (!annots) {
                annots = pdfLibDoc.context.obj([]);
                page.node.set(PDFLib.PDFName.of('Annots'), annots);
            }
            annots.push(pdfLibDoc.context.register(annot));
        });

        // objectsPerTick: Infinity eliminates yielding to setTimeout(0) for every 50 objects,
        // reducing serialization time on 500+ page documents from multiple seconds to milliseconds.
        const pdfBytes = await pdfLibDoc.save({
            objectsPerTick: Infinity,
            useObjectStreams: false,
            updateFieldAppearances: false
        });
        
        // Trigger download
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = documentBaseName() + "-highlighted.pdf";
        link.click();
        // Deferred release (see revokeObjectUrlLater): same timing as
        // export_md, and safe regardless of when the browser fetches the
        // blob for the download.
        revokeObjectUrlLater(url);

        // Honest feedback when the source moved under us: the download
        // above is still delivered, but its fidelity must not be silent.
        if (skippedStale > 0) {
            viewerAlert(
                'Export incomplete',
                `The file appears to have changed since you opened it — ${skippedStale} annotation(s) referenced pages missing from the current file and were left out of this export.`
            );
        } else if (staleDocument) {
            viewerAlert('Document changed', 'The file now has a different page count than the document you annotated. The export succeeded, but placed marks may not align with the new content.');
        }
        
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
        if (e && e.name === 'AbortError') {
            viewerAlert('Save timed out', 'Fetching the PDF took too long and was cancelled. Check your connection and try again.');
        } else if (/is encrypted/i.test(String(e && e.message))) {
            viewerAlert('Cannot save highlights', "Saving highlights isn't supported for password-protected PDFs — use Export MD or Print instead.");
        } else {
            viewerAlert('Error saving PDF', 'Error saving PDF. Check the console for details.');
        }
    } finally {
        // Whatever the outcome, release the one-at-a-time gate and the
        // button — without this the first export disabled Save for the
        // rest of the tab's lifetime. Also disarm the watchdog so a
        // completed export doesn't leave a timer firing into an
        // already-settled controller for the next 60 seconds.
        clearTimeout(timeoutId);
        savePdfInProgress = false;
        saveBtn.disabled = false;
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
            // Trim only to detect emptiness: leading/trailing spaces are
            // meaningful (whole-word queries like " the "), so the raw
            // value is what gets searched.
            const query = findInput.value.trim() === '' ? '' : findInput.value;
            if (query === currentSearchQuery && query !== '') {
                navigateSearch(e.shiftKey ? -1 : 1);
            } else {
                performSearch(query);
            }
        }
    });
}

// Reconstructs a page's text from a pdf.js text-content payload, shared
// by search matching and the summarize feature so the two can never
// drift apart again (summarize used to join every item with a space,
// which shredded kerned intra-line runs and padded around empty ones).
// Runs are concatenated directly — pdf.js splits a line into items at
// arbitrary chunk boundaries — and a single space is added only at
// hasEOL boundaries, where inter-word spacing is genuinely implied.
// Zero-length zero-width items are positioning artifacts, not text.
// Returns { text, items } where each item carries its startIndex/endIndex
// within text so callers can map match offsets back to runs.
function buildPageText(textContent) {
    let text = '';
    const items = [];
    for (const item of textContent.items) {
        if (!item.str && item.width === 0) continue;

        items.push({
            ...item,
            startIndex: text.length,
            endIndex: text.length + item.str.length
        });
        text += item.str;

        if (item.hasEOL) {
            text += ' ';
        }
    }
    return { text, items };
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

        const built = buildPageText(textContent);
        const pageText = built.text;
        const textItems = built.items;
        
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
                const rects = [];
                for (const item of matchItems) {
                    // Clip the item to the part actually covered by the
                    // match and scale proportionally by character count.
                    // Highlighting the whole overlapping item used to paint
                    // entire runs for a partial query hit.
                    const s = Math.max(matchStart, item.startIndex);
                    const e = Math.min(matchEnd, item.endIndex);
                    const chars = item.str.length || 1;
                    const unitW = item.width / chars;
                    const spanChars = e - s;
                    if (spanChars <= 0 || unitW <= 0) continue;
                    const t = item.transform;
                    // Vertical extent via hypot(c,d): equals |d| (the old
                    // baseline+height value) for upright text, but stays
                    // correct when the run is rotated/skewed and |d| alone
                    // collapses to 0.
                    const height = Math.hypot(t[2], t[3]);
                    const rect = {
                        pdfX: t[4] + (s - item.startIndex) * unitW,
                        pdfY: t[5] + height,
                        pdfWidth: spanChars * unitW,
                        pdfHeight: height
                    };
                    if (t[1] !== 0 || t[2] !== 0) {
                        // Non-upright runs carry their full matrix so the
                        // draw step can place a rotated quad; upright text
                        // keeps the axis-aligned fast path untouched.
                        rect.matrix = t.slice();
                        rect.dirWidth = rect.pdfWidth;
                        rect.dirHeight = height;
                    }
                    rects.push(rect);
                }

                if (rects.length > 0) {
                    searchResults.push({
                        pageNumber: i,
                        rects: rects
                    });
                }
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

// Page jumps can arrive before any .page div exists: pdfDoc resolves
// ahead of renderAllPages' batched DOM append, and zoom rebuilds blank
// #viewer for a moment. scrollHeight is degenerate in exactly those
// windows (~viewport height, no children), so the old proportional
// fallback assumed uniform page heights AND landed near the top on every
// document shape. Instead, hold the request briefly and perform the exact
// scroll once the target div exists — div heights come from each page's
// real viewport, so mixed-size documents land correctly too. The
// proportional formula remains only as the capped last resort.
const DEFERRED_SCROLL_MAX_FRAMES = 300; // ~5s at 60fps
let deferredScrollPage = null;
let deferredScrollOnlyIfOutside = false;
let deferredScrollFrames = 0;
let deferredScrollRaf = 0;

function requestDeferredScroll(pageNumber, onlyIfOutside) {
    deferredScrollPage = pageNumber;
    deferredScrollOnlyIfOutside = onlyIfOutside;
    if (deferredScrollRaf) return; // loop already running; latest target wins
    deferredScrollFrames = 0;
    const tick = () => {
        deferredScrollRaf = 0;
        const container = document.getElementById('viewerContainer');
        if (!container || !pdfDoc || deferredScrollPage === null) {
            deferredScrollPage = null;
            return;
        }
        const pageNumber = deferredScrollPage;
        const pageDiv = document.querySelector(`.page[data-page-number="${pageNumber}"]`);
        if (!pageDiv && ++deferredScrollFrames < DEFERRED_SCROLL_MAX_FRAMES) {
            deferredScrollRaf = requestAnimationFrame(tick);
            return;
        }
        deferredScrollPage = null;
        if (!pageDiv) {
            // Layout never materialized (load failed mid-build): legacy
            // proportional floor so the jump still does something.
            container.scrollTop = ((pageNumber - 1) / pdfDoc.numPages) * container.scrollHeight;
            return;
        }
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageDiv.getBoundingClientRect();
        if (!deferredScrollOnlyIfOutside ||
            pageRect.top < containerRect.top || pageRect.bottom > containerRect.bottom) {
            container.scrollTop = container.scrollTop + (pageRect.top - containerRect.top) - 20;
        }
    };
    deferredScrollRaf = requestAnimationFrame(tick);
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
        // Layout not built yet (initial load / rebuild window): hold the
        // jump until the page skeleton exists, then scroll exactly.
        requestDeferredScroll(match.pageNumber, true);
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

                if (r.matrix) {
                    // Rotated/skewed run: map the run's origin, top-left,
                    // and end corners through the viewport, then place the
                    // highlight as a div rotated into the text direction.
                    // convertToViewportPoint returns [x, y] arrays — index
                    // them like the upright branch below (.x/.y are
                    // undefined and would emit "NaNpx"/"undefinedpx").
                    const [a, b, c, d, e, f] = r.matrix;
                    const m = Math.hypot(a, b);
                    const ux = a / m, uy = b / m;   // advance direction
                    const nx = -b / m, ny = a / m;  // run "up" normal
                    const pO = viewport.convertToViewportPoint(e, f);
                    const pT = viewport.convertToViewportPoint(e + nx * r.dirHeight, f + ny * r.dirHeight);
                    const pE = viewport.convertToViewportPoint(
                        e + nx * r.dirHeight + ux * r.dirWidth,
                        f + ny * r.dirHeight + uy * r.dirWidth
                    );
                    div.style.left = `${pT[0]}px`;
                    div.style.top = `${pT[1]}px`;
                    div.style.width = `${Math.hypot(pE[0] - pT[0], pE[1] - pT[1])}px`;
                    div.style.height = `${Math.hypot(pT[0] - pO[0], pT[1] - pO[1])}px`;
                    div.style.transformOrigin = '0 0';
                    div.style.transform = `rotate(${Math.atan2(pE[1] - pT[1], pE[0] - pT[0])}rad)`;
                } else {
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
                }
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
    // Ignore if typing in input/textarea/contenteditable (except Escape)
    const isInput = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable ||
        !!(document.activeElement.closest && document.activeElement.closest('[contenteditable="true"]'))
    );
    
    if (e.key === 'Escape') {
        // Progressive dismissal, closest overlay first: an open annotation
        // popup consumes this press; only when none is showing does Esc
        // dismiss search results — previously those had no keyboard way
        // out (focus the input, empty it, press Enter). Gating on the
        // query rather than the result count also cancels an in-flight
        // search: clearSearch bumps searchGeneration, which performSearch
        // checks between pages. Modal dialogs never reach this handler at
        // all — their capture-phase Escape guard stops propagation above.
        const popupWasOpen = ['color-picker-popup', 'edit-highlight-popup', 'note-editor-popup']
            .some(id => { const p = document.getElementById(id); return !!p && !p.classList.contains('hidden'); });
        hidePopups();
        if (!popupWasOpen && currentSearchQuery !== '') clearSearch();
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
    
    // Zoom shortcuts (Ctrl/Cmd + Plus/Minus/Zero, numpad and all keyboard layouts included)
    const isZoomInKey = (e.ctrlKey || e.metaKey) && (
        e.key === '=' || e.key === '+' || e.key === 'Add' ||
        e.code === 'Equal' || e.code === 'NumpadAdd'
    );
    if (isZoomInKey) {
        e.preventDefault();
        const zoomInBtn = document.getElementById('zoom_in');
        if (zoomInBtn) zoomInBtn.click();
        return;
    }
    
    const isZoomOutKey = (e.ctrlKey || e.metaKey) && (
        e.key === '-' || e.key === '_' || e.key === 'Subtract' ||
        e.code === 'Minus' || e.code === 'NumpadSubtract'
    );
    if (isZoomOutKey) {
        e.preventDefault();
        const zoomOutBtn = document.getElementById('zoom_out');
        if (zoomOutBtn) zoomOutBtn.click();
        return;
    }
    
    // Actual-size reset (Ctrl+0 / Cmd+0, numpad included).
    const isZoomResetKey = (e.ctrlKey || e.metaKey) && (
        e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0'
    );
    if (isZoomResetKey) {
        e.preventDefault();
        resetBrowserTabZoom();
        if (!pdfDoc) return;
        currentZoomMode = 'custom';
        if (scale === 1) return; // already actual size, nothing to re-render
        scale = 1;
        renderAllPages();
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
// External targets harvested from untrusted documents (link annotations,
// outline entries) reach window.open here, so this sink validates the
// scheme itself instead of trusting whichever upstream layer built the
// string. The set mirrors pdf.js's createValidAbsoluteUrl whitelist
// (_isValidProtocol), which already filters annot.url/item.url today —
// keeping it in sync means no reachable URL changes behavior, while
// javascript:/data:/unknown schemes stay blocked even if that upstream
// filter ever slips. Same defense-in-depth as the popup's markdown
// renderer, which whitelists protocols before emitting links.
const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'ftp:', 'mailto:', 'tel:']);

function isSafeExternalUrl(url) {
    try {
        return SAFE_EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
    } catch {
        return false;
    }
}

async function renderLinkAnnotations(page, pageDiv, viewport) {
    try {
        const annots = await page.getAnnotations();
        const linkAnnots = annots.filter(a => a.subtype === 'Link');

        if (linkAnnots.length === 0) return;

        // The await above can straddle a zoom: a rescale swaps
        // pageDiv._viewport and re-renders the page, and that fresh render
        // appends its own annotation layer. Appending this call's layer —
        // positioned for the old scale — on top of it would duplicate the
        // link boxes and their click handlers. Same staleness bail the
        // render path itself applies after its awaits.
        if (pageDiv._viewport !== viewport) return;

        // A retry after an error re-renders at the *same* viewport while an
        // earlier call may still be in flight; only one layer may exist.
        pageDiv.querySelectorAll('.annotationLayer').forEach(el => el.remove());

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
                if (annot.url && isSafeExternalUrl(annot.url)) {
                    window.open(annot.url, '_blank', 'noopener,noreferrer');
                } else if (annot.dest) {
                    try {
                        let dest = annot.dest;
                        if (typeof dest === 'string') {
                            dest = await pdfDoc.getDestination(dest);
                        }
                        
                        if (dest && dest[0]) {
                            // dest[0] is normally a page Ref ({num, gen}),
                            // but some producers emit explicit destinations
                            // whose first entry is already a zero-based
                            // page index; getPageIndex accepts only a Ref
                            // and throws on anything else — pdf.js's own
                            // viewer branches the same way.
                            const pageIndex = Number.isInteger(dest[0]) && dest[0] >= 0
                                ? dest[0]
                                : await pdfDoc.getPageIndex(dest[0]);
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
        // Layout not built yet: defer for an exact scroll (see
        // requestDeferredScroll) instead of guessing proportionally.
        requestDeferredScroll(pageNumber, false);
    }
}

// ==================== Sidebar & Outline Feature ====================
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
    
    const headerActions = document.getElementById('sidebar-header-actions');
    if (headerActions) headerActions.innerHTML = '';
    
    if (tabName === 'comments') {
        tabComments.classList.add('active');
        contentComments.classList.remove('hidden');
        sidebarTitle.textContent = highlights.length > 0 ? `Comments (${highlights.length})` : 'Comments';
        renderSidebar(); // re-render comments
    } else if (tabName === 'outline') {
        tabOutline.classList.add('active');
        contentOutline.classList.remove('hidden');
        sidebarTitle.textContent = 'Outline';
    } else if (tabName === 'bookmarks') {
        tabBookmarks.classList.add('active');
        contentBookmarks.classList.remove('hidden');
        sidebarTitle.textContent = bookmarks.length > 0 ? `Bookmarks (${bookmarks.length})` : 'Bookmarks';
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
    const headerActions = document.getElementById('sidebar-header-actions');
    if (headerActions) headerActions.innerHTML = '';
    window.dispatchEvent(new Event('resize'));
});

// Adobe-style per-comment time: the creation stamp rendered as a coarse
// relative age ("just now", "5m ago", "3h ago", "2d ago") that rolls over
// to a calendar date ("Sep 1", or "Sep 1, 2025" across years) after a
// week. Ages refresh naturally on the next renderSidebar — no interval
// timer churns the list just to tick them. Returns '' for missing, corrupt,
// or future stamps so the subtitle simply shows without the segment.
function formatCommentAge(ts, now = Date.now()) {
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const ageMs = now - ts;
    if (ageMs < 0) return ''; // clock skew / future stamp: show nothing
    const mins = Math.floor(ageMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const d = new Date(ts);
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return sameYear
        ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Comments list: page dividers + current-page filter ---
// Session-only view state (resets on reload, never persisted):
// commentsCurrentPageOnly is the filter chip's on/off; commentsFilterLastPage
// records which page the filtered list was last rendered for, so a filter or
// page change restarts the list at the top instead of restoring a scroll
// offset computed against different content.
let commentsCurrentPageOnly = false;
let commentsFilterLastPage = null;

// Keeps the current-page filter in step with the viewed page; hooked into
// updatePageNumber's page-changed branch. A near-zero no-op unless the
// filter is on and the Comments list is visible. A focused note textarea
// defers the refresh: rebuilding the list would destroy the field
// mid-typing (its change event commits only on blur) — blur re-renders via
// saveHighlights anyway, and the next page change after that re-syncs.
function refreshCommentsForPageFilter() {
    if (!commentsCurrentPageOnly) return;
    if (!sidebar || sidebar.classList.contains('hidden')) return;
    if (!tabComments || !tabComments.classList.contains('active')) return;
    const ae = document.activeElement;
    if (ae && ae.closest && ae.closest('.sidebar-item-note-input')) return;
    renderSidebar();
}

// Heuristic check for whether text likely overflows maxLines in the sidebar.
// CJK and full-width characters count as 2 Latin visual units.
// Used as fallback when renderSidebar runs while the sidebar is hidden.
function estimateTextExceedsLines(str, maxLines = 3) {
    if (!str) return false;
    let weight = 0;
    for (let i = 0; i < str.length; i++) {
        weight += str.charCodeAt(i) > 0x2e80 ? 2 : 1;
    }
    return weight > maxLines * 38;
}

function renderSidebar() {
    const sidebarContent = document.getElementById('sidebar-content-comments');
    if (!sidebarContent) return;
    
    if (sidebarTitle && tabComments.classList.contains('active')) {
        sidebarTitle.textContent = highlights.length > 0 ? `Comments (${highlights.length})` : 'Comments';
    }
    
    const prevScrollTop = sidebarContent.scrollTop;
    sidebarContent.innerHTML = '';
    
    const headerActions = document.getElementById('sidebar-header-actions');
    const isCommentsActive = tabComments && tabComments.classList.contains('active');

    if (highlights.length === 0) {
        if (headerActions && isCommentsActive) headerActions.innerHTML = '';
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

    // --- Current-page filter (scan aid for documents with many comments) ---
    // autoSavedLastPage is the viewer's live page tracker (load, scroll,
    // and cross-tab adoption all keep it current).
    const filterPage = commentsCurrentPageOnly ? autoSavedLastPage : null;
    const visibleHighlights = filterPage === null
        ? sortedHighlights
        : sortedHighlights.filter(hl => hl.pageNumber === filterPage);

    if (sidebarTitle && isCommentsActive) {
        sidebarTitle.textContent = filterPage === null
            ? `Comments (${sortedHighlights.length})`
            : `Comments (${visibleHighlights.length} of ${sortedHighlights.length})`;
    }

    // Filter chip rides in the pinned header actions bar so it never scrolls
    // away out of view as users browse comments deep into the document.
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sidebar-filter-chip' + (filterPage === null ? '' : ' active');
    chip.textContent = filterPage === null ? 'Current page' : `Page ${filterPage} only`;
    chip.title = filterPage === null
        ? `Show only comments on current page (Page ${autoSavedLastPage})`
        : `Showing Page ${filterPage} only — click to show all comments`;
    chip.setAttribute('aria-pressed', String(filterPage !== null));
    chip.setAttribute('aria-label', filterPage === null
        ? `Filter comments to current page (Page ${autoSavedLastPage})`
        : `Filter active: showing Page ${filterPage} only. Click to show all comments.`);
    chip.addEventListener('click', () => {
        commentsCurrentPageOnly = !commentsCurrentPageOnly;
        renderSidebar();
    });

    if (headerActions && isCommentsActive) {
        headerActions.innerHTML = '';
        headerActions.appendChild(chip);
    }

    // New content class under the filter (chip toggled, or the viewer
    // moved to a different page) restarts the list at the top; plain
    // mutations (note edits, deletes) keep their scroll position.
    const filterSwitched = filterPage !== commentsFilterLastPage;
    commentsFilterLastPage = filterPage;

    if (filterPage !== null && visibleHighlights.length === 0) {
        const wrap = document.createElement('div');
        wrap.innerHTML = sidebarEmptyHtml('messageSquare',
            `No comments on Page ${filterPage}.`,
            'Scroll the document or switch the filter off to see every comment.');
        sidebarContent.appendChild(wrap.firstElementChild);
        sidebarContent.scrollTop = 0;
        return;
    }

    // One sticky "Page N" divider per page group; a single-page filtered
    // list needs no grouping of its own.
    const countsPerPage = new Map();
    if (filterPage === null) {
        for (const hl of sortedHighlights) {
            countsPerPage.set(hl.pageNumber, (countsPerPage.get(hl.pageNumber) || 0) + 1);
        }
    }
    let dividerPage = null;

    visibleHighlights.forEach(hl => {
        if (filterPage === null && hl.pageNumber !== dividerPage) {
            dividerPage = hl.pageNumber;
            const targetPage = dividerPage;
            const divider = document.createElement('div');
            divider.className = 'sidebar-page-divider';
            divider.tabIndex = 0;
            divider.setAttribute('role', 'button');
            divider.setAttribute('aria-label', `Jump to page ${targetPage}`);
            divider.title = `Jump to page ${targetPage}`;
            divider.textContent = `Page ${targetPage} · ${countsPerPage.get(targetPage) || 1}`;
            divider.addEventListener('click', () => {
                scrollToPage(targetPage);
            });
            divider.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    scrollToPage(targetPage);
                }
            });
            sidebarContent.appendChild(divider);
        }
        let toolIconName = 'highlighter';
        let typeLabel = 'Highlighted Text';
        if (hl.markupType === 'Underline') {
            toolIconName = 'edit';
            typeLabel = 'Underline';
        } else if (hl.markupType === 'StrikeOut') {
            toolIconName = 'edit';
            typeLabel = 'Strikethrough';
        }

        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.tabIndex = 0;
        item.setAttribute('role', 'article');
        item.setAttribute('aria-label', `${typeLabel}, Page ${hl.pageNumber}`);
        // Locates this card from a page-side highlight click
        // (focusSidebarComment); renderSidebar runs on every mutation via
        // saveHighlights, so the attribute always matches the live list.
        item.dataset.hlId = hl.id;
        
        // Header Row: Avatar + Author Info + Delete button
        const header = document.createElement('div');
        header.className = 'sidebar-item-header';
        
        const authorInfo = document.createElement('div');
        authorInfo.className = 'sidebar-item-author-info';
        
        // Avatar circle with tool glyph tinted with highlight color
        const avatar = document.createElement('div');
        avatar.className = 'sidebar-item-avatar';
        avatar.style.borderColor = hl.color || 'var(--border-control)';
        avatar.style.backgroundColor = hl.color ? `${hl.color}22` : 'var(--surface-inset)';
        avatar.innerHTML = viewerIconSvg(toolIconName, 13);
        avatar.style.color = hl.color || 'var(--accent)';
        
        // Meta column: Author name + Subtitle (Type & Page)
        const meta = document.createElement('div');
        meta.className = 'sidebar-item-meta';
        
        const authorNameEl = document.createElement('span');
        authorNameEl.className = 'sidebar-item-author';
        authorNameEl.textContent = cachedPdfAuthorName || 'You';
        
        const subtitleEl = document.createElement('span');
        subtitleEl.className = 'sidebar-item-subtitle';
        // "Highlighted Text · Page 3 · 2h ago"; the age segment (and its
        // tooltip) simply drop off for records saved before timestamps
        // existed or whose stamp was stripped as corrupt.
        const age = formatCommentAge(hl.createdAt);
        subtitleEl.textContent = `${typeLabel} · Page ${hl.pageNumber}${age ? ` · ${age}` : ''}`;
        if (age) subtitleEl.title = new Date(hl.createdAt).toLocaleString();
        
        meta.appendChild(authorNameEl);
        meta.appendChild(subtitleEl);
        
        authorInfo.appendChild(avatar);
        authorInfo.appendChild(meta);
        header.appendChild(authorInfo);
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'sidebar-item-delete';
        deleteBtn.title = 'Delete comment';
        deleteBtn.innerHTML = viewerIconSvg('trash', 14);
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent clicking the item itself

            // Remove from global array
            highlights = highlights.filter(h => h.id !== hl.id);
            saveHighlights();

            // Remove from DOM
            document.querySelectorAll(`.custom-highlight[data-hl-id="${hl.id}"]`).forEach(el => el.remove());
            document.querySelectorAll(`.note-indicator[data-hl-id="${hl.id}"]`).forEach(el => el.remove());

            // If popups are anchored to the deleted highlight, close them
            const notePopup = document.getElementById('note-editor-popup');
            if (activeHighlightId === hl.id || (notePopup && parseInt(notePopup.dataset.hlId, 10) === hl.id)) {
                isNoteDirty = false;
                if (notePopup) delete notePopup.dataset.hlId;
                hidePopups();
            }
        });
        
        header.appendChild(deleteBtn);
        item.appendChild(header);
        
        // Highlighted text snippet
        let quoteToggleBtn = null;
        let quoteTextDiv = null;
        if (hl.text) {
            const trimmed = String(hl.text).trim();
            quoteTextDiv = document.createElement('div');
            quoteTextDiv.className = 'sidebar-item-text';
            quoteTextDiv.style.borderLeftColor = hl.color || 'var(--accent)';
            // The full text remains in textContent and title. Visual clamping
            // to 3 lines is handled by CSS (-webkit-line-clamp: 3) so that context
            // is preserved and non-Latin scripts (CJK, Thai) are clamped correctly
            // by the browser typography engine.
            quoteTextDiv.textContent = trimmed;
            quoteTextDiv.title = trimmed;
            item.appendChild(quoteTextDiv);

            // In-place expand/collapse button for quotes that exceed the 3-line clamp.
            // Accessible to touchscreens (direct tap target) and keyboard navigation.
            quoteToggleBtn = document.createElement('button');
            quoteToggleBtn.type = 'button';
            quoteToggleBtn.className = 'sidebar-item-text-toggle';
            quoteToggleBtn.style.display = 'none';
            quoteToggleBtn.setAttribute('aria-expanded', 'false');
            quoteToggleBtn.setAttribute('aria-label', 'Show full quote');
            quoteToggleBtn.innerHTML = `Show more ${viewerIconSvg('chevronDown', 12)}`;
            quoteToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent jumping to page highlight
                const isExpanded = quoteTextDiv.classList.toggle('is-expanded');
                quoteToggleBtn.setAttribute('aria-expanded', String(isExpanded));
                quoteToggleBtn.setAttribute('aria-label', isExpanded ? 'Show less quote' : 'Show full quote');
                quoteToggleBtn.innerHTML = isExpanded
                    ? `Show less ${viewerIconSvg('chevronUp', 12)}`
                    : `Show more ${viewerIconSvg('chevronDown', 12)}`;
            });
            item.appendChild(quoteToggleBtn);
        }
        
        // Note Input (Rich-text contenteditable)
        const noteInput = document.createElement('div');
        noteInput.className = 'sidebar-item-note-input is-empty';
        noteInput.contentEditable = 'true';
        noteInput.setAttribute('role', 'textbox');
        noteInput.setAttribute('aria-multiline', 'true');
        noteInput.dataset.placeholder = 'Add a comment...';
        setRichNoteContent(noteInput, hl);

        attachRichEditor(noteInput, {
            getInitial: () => hl.noteFmt === 'html' ? (hl.note || '') : (hl.note ? escapeHtml(hl.note).replace(/\r\n|\r|\n/g, '<br>') : ''),
            onSave: (cleanedHtml) => {
                hl.note = cleanedHtml || null;
                hl.noteFmt = cleanedHtml ? 'html' : undefined;
                saveHighlights(false); // Do NOT re-render sidebar on blur
                updateHighlightIndicatorsOnPage(hl);
            }
        });

        item.appendChild(noteInput);

        // Click to jump to highlight
        item.addEventListener('click', (e) => {
            if (e.target.closest('.sidebar-item-note-input') || e.target.closest('button')) {
                return; // Let user type or click button
            }
            scrollToHighlight(hl);
        });

        // Keyboard navigation: Enter or Space on card jumps to highlight
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                if (e.target.closest('.sidebar-item-note-input') || e.target.closest('button')) {
                    return; // Let user type or activate button
                }
                e.preventDefault();
                scrollToHighlight(hl);
            }
        });

        sidebarContent.appendChild(item);

        // Reveal the "Show more" toggle if the quote text overflows 3 lines.
        // Measures actual scrollHeight if connected to a visible container,
        // or uses a script-aware character weight estimation as fallback.
        if (quoteTextDiv && quoteToggleBtn) {
            const trimmed = String(hl.text).trim();
            const isOverflowing = quoteTextDiv.scrollHeight > quoteTextDiv.clientHeight + 1;
            const isLikelyLong = estimateTextExceedsLines(trimmed, 3);
            if ((quoteTextDiv.clientHeight > 0 && isOverflowing) || (quoteTextDiv.clientHeight === 0 && isLikelyLong)) {
                quoteToggleBtn.style.display = 'inline-flex';
            }
        }
    });

    sidebarContent.scrollTop = filterSwitched ? 0 : prevScrollTop;
}

// Reverse of scrollToHighlight: a click on a highlight (or its note
// indicator) in the page locates the matching card in the Comments list,
// like Acrobat's comment panel. Scoped to when the Comments tab is actually
// showing — with the sidebar closed or on Outline/Bookmarks the click keeps
// its existing behavior (page-side selection + edit popup) untouched.
let sidebarFlashTimer = null;
function focusSidebarComment(hlId) {
    if (!hlId || !sidebar || sidebar.classList.contains('hidden')) return;
    if (!tabComments || !tabComments.classList.contains('active')) return;

    const container = document.getElementById('sidebar-content-comments');
    let item = container && container.querySelector(`.sidebar-item[data-hl-id="${hlId}"]`);
    if (!item && commentsCurrentPageOnly) {
        // The current-page filter was hiding this card because the clicked
        // highlight is on an adjacent visible page. Rather than silently
        // deactivating the user's filter for the rest of the session, follow
        // the user's focus: switch the filter to that page and keep
        // commentsCurrentPageOnly active.
        const targetHl = highlights.find(h => h.id === hlId);
        if (targetHl && targetHl.pageNumber) {
            autoSavedLastPage = targetHl.pageNumber;
            const pageNumInput = document.getElementById('page_num');
            if (pageNumInput) pageNumInput.value = targetHl.pageNumber;
            renderSidebar();
            item = container && container.querySelector(`.sidebar-item[data-hl-id="${hlId}"]`);
        }
    }
    // Still missing means the list was never rendered for this highlight;
    // beyond the filter case above, never force a re-render here — it
    // would rebuild the note textareas while the user may be typing in one.
    if (!item) return;

    // Center the card in the list. Scroll math is manual on purpose:
    // Element.scrollIntoView also scrolls every scrollable ancestor, which
    // would nudge the PDF page container behind the sidebar.
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const target = container.scrollTop + (itemRect.top - containerRect.top)
        - (container.clientHeight - itemRect.height) / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });

    // Flash ring, mirroring the 2s page-side .active flash. Clearing every
    // flashing card plus the reflow read restarts the animation on rapid
    // repeat clicks of the same highlight.
    document.querySelectorAll('.sidebar-item.sidebar-flash').forEach(el => el.classList.remove('sidebar-flash'));
    if (sidebarFlashTimer) clearTimeout(sidebarFlashTimer);
    void item.offsetWidth;
    item.classList.add('sidebar-flash');
    sidebarFlashTimer = setTimeout(() => {
        item.classList.remove('sidebar-flash');
        sidebarFlashTimer = null;
    }, 2000);
}

function renderBookmarks() {
    const sidebarContent = document.getElementById('sidebar-content-bookmarks');
    if (!sidebarContent) return;
    
    if (sidebarTitle && tabBookmarks.classList.contains('active')) {
        sidebarTitle.textContent = bookmarks.length > 0 ? `Bookmarks (${bookmarks.length})` : 'Bookmarks';
    }
    
    const prevScrollTop = sidebarContent.scrollTop;
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
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'sidebar-item-delete';
        deleteBtn.title = 'Delete bookmark';
        deleteBtn.innerHTML = viewerIconSvg('trash', 14);
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bookmarks = bookmarks.filter(b => b.id !== bk.id);
            saveBookmarks();
        });
        
        header.appendChild(deleteBtn);
        item.appendChild(header);
        
        // Editable Title Input
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'sidebar-item-note-input';
        titleInput.placeholder = 'Name this bookmark...';
        titleInput.value = bk.title || '';
        
        titleInput.addEventListener('change', () => {
            bk.title = titleInput.value.trim() || `Page ${bk.pageNumber}`;
            saveBookmarks();
        });
        
        item.appendChild(titleInput);
        
        // Click to jump to bookmark
        item.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.closest('button')) {
                return;
            }
            scrollToPage(bk.pageNumber);
        });
        
        sidebarContent.appendChild(item);
    });

    sidebarContent.scrollTop = prevScrollTop;
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

    // Arm the flash first: on a virtualized (unrendered) page the overlay
    // divs below don't exist yet, and they're only created by drawHighlight
    // once the scroll brings the page into the IntersectionObserver's range.
    // The 5s acceptance window tolerates slow renders without letting a
    // stale flash fire long after the click.
    pendingFlashHighlightId = hl.id;
    pendingFlashHighlightUntil = Date.now() + 5000;

    const pageDiv = document.querySelector(`.page[data-page-number="${hl.pageNumber}"]`);
    const container = document.getElementById('viewerContainer');

    if (pageDiv && pageDiv._viewport) {
        // Target specific Y position within the page
        const firstRect = hl.rects[0];
        const pt = pageDiv._viewport.convertToViewportPoint(firstRect.pdfX, firstRect.pdfY);
        const yPosInPage = pt[1];

        container.scrollTop = pageDiv.offsetTop + yPosInPage - (container.clientHeight / 2);

        // Briefly flash active highlight. A no-op on an unloaded page —
        // the armed pending flash covers it when the render completes.
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
            // Deliberately no href: navigation is owned by the titleRow
            // click handler below. A placeholder like javascript:void(0)
            // violates extension-page CSP on every click and turns
            // middle-/ctrl-click into dead or phantom tabs, while an <a>
            // without href has no default action to suppress at all.
            // Styling (.outline-item-title a) keys off the tag name.
            
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
                
                if (item.url && isSafeExternalUrl(item.url)) {
                    window.open(item.url, '_blank', 'noopener,noreferrer');
                } else if (item.dest) {
                    try {
                        let dest = item.dest;
                        if (typeof dest === 'string') {
                            dest = await pdfDoc.getDestination(dest);
                        }
                        if (dest && dest[0]) {
                            // Same dest[0] duality as the link-annotation
                            // path above: Ref or already-resolved page index.
                            const pageIndex = Number.isInteger(dest[0]) && dest[0] >= 0
                                ? dest[0]
                                : await pdfDoc.getPageIndex(dest[0]);
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

// --- Tab Zoom Enforcement & Reset ---
function resetBrowserTabZoom() {
    if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.getCurrent === 'function') {
        try {
            chrome.tabs.getCurrent((tab) => {
                if (chrome.runtime.lastError || !tab) return;
                if (typeof chrome.tabs.setZoom === 'function') {
                    chrome.tabs.setZoom(tab.id, 1.0, () => {
                        void chrome.runtime.lastError;
                    });
                }
            });
        } catch (e) {}
    }
}

function enforceTabZoom() {
    if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.getCurrent === 'function') {
        try {
            chrome.tabs.getCurrent((tab) => {
                if (chrome.runtime.lastError || !tab) return;
                
                // If this tab was already zoomed from a previous session, reset it to 100%
                if (typeof chrome.tabs.getZoom === 'function' && typeof chrome.tabs.setZoom === 'function') {
                    chrome.tabs.getZoom(tab.id, (currentZoom) => {
                        if (chrome.runtime.lastError) return;
                        if (typeof currentZoom === 'number' && Math.abs(currentZoom - 1.0) > 0.01) {
                            chrome.tabs.setZoom(tab.id, 1.0, () => {
                                void chrome.runtime.lastError;
                            });
                        }
                    });
                }

                // Lock zoom settings to disabled so Chrome never zooms the entire web page
                if (typeof chrome.tabs.setZoomSettings === 'function') {
                    chrome.tabs.setZoomSettings(tab.id, {
                        mode: 'disabled',
                        scope: 'per-tab'
                    }, () => {
                        void chrome.runtime.lastError;
                    });
                }
            });
        } catch (e) {}
    }
}
enforceTabZoom();

// --- Trackpad Pinch-to-Zoom & Ctrl+Wheel Support ---
let pinchZoomTimeout = null;
let currentPinchScale = 1.0;
let initialScaleBeforePinch = 1.0;
let isPinching = false;
let pinchOriginClientX = 0;
let pinchOriginClientY = 0;

// Listen on window so Ctrl+wheel and pinch gestures anywhere (e.g. over sidebar,
// comments, toolbar, popups) never leak through to Chrome's native page zoom.
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault(); // Prevent default browser zoom across the entire window
        // No document yet (load-error / password screen): nothing to
        // zoom, and mutating scale here would silently change the zoom
        // level the next successful load starts from.
        if (!pdfDoc) return;
        isPinching = true;
        // A manual zoom overrides fit-width/fit-page; otherwise the next
        // window resize would snap back to the fitted scale.
        currentZoomMode = 'custom';

        const scrollContainer = document.getElementById('viewerContainer');
        const containerRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;

        if (pinchZoomTimeout === null) {
            initialScaleBeforePinch = scale;
            // If the gesture happens within the viewer, anchor at the cursor;
            // otherwise (e.g. over sidebar, toolbar, popups), anchor to the center of the viewer
            if (containerRect && e.clientX >= containerRect.left && e.clientX <= containerRect.right &&
                e.clientY >= containerRect.top && e.clientY <= containerRect.bottom) {
                pinchOriginClientX = e.clientX;
                pinchOriginClientY = e.clientY;
            } else if (containerRect) {
                pinchOriginClientX = containerRect.left + containerRect.width / 2;
                pinchOriginClientY = containerRect.top + containerRect.height / 2;
            } else {
                pinchOriginClientX = e.clientX;
                pinchOriginClientY = e.clientY;
            }
        }

        // Adjust scale smoothly based on delta
        const delta = -e.deltaY * 0.01;
        let newScale = scale * Math.exp(delta);

        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > MAX_SCALE) newScale = MAX_SCALE;

        scale = newScale;

        // Update UI
        updateZoomLabel();

        // Visual feedback using CSS transform for smoothness
        currentPinchScale = scale / initialScaleBeforePinch;
        const viewer = document.getElementById('viewer');
        if (viewer) {
            const rect = viewer.getBoundingClientRect();
            const originX = pinchOriginClientX - rect.left;
            const originY = pinchOriginClientY - rect.top;

            // Only set origin once at start of pinch to prevent jitter
            if (!viewer.style.transformOrigin || pinchZoomTimeout === null) {
                viewer.style.transformOrigin = `${originX}px ${originY}px`;
            }

            viewer.style.transform = `scale(${currentPinchScale})`;
        }

        clearTimeout(pinchZoomTimeout);
        pinchZoomTimeout = setTimeout(() => {
            isPinching = false;
            const viewerEl = document.getElementById('viewer');
            if (viewerEl) {
                viewerEl.style.transform = 'none';
                viewerEl.style.transformOrigin = ''; // reset
            }
            pinchZoomTimeout = null;
            // Re-render anchored on the gesture origin: renderAllPages'
            // focal-point math keeps the content under the finger exactly
            // where it was, so no separate compensation is needed here
            // (stacking one used to double-correct and drift the view).
            renderAllPages(pinchOriginClientX, pinchOriginClientY);
        }, 200);
    } else if (isPinching) {
        // Prevent accidental scrolling while the user is actively pinching
        e.preventDefault();
    }
}, { passive: false });

// Prevent macOS / WebKit gesture pinch zooming the entire document
window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

