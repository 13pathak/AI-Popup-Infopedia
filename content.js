// --- Global State for Stacked Popups ---
let activePopups = []; // Array of { container, popup, isInteracting, isClickInside }
let baseZIndex = 2100000000;

// Build marker: the DevTools console of any page shows which content.js
// build the tab is running — tabs opened before an extension reload keep the
// previous script until the page is refreshed.
console.log('[AI Popup] content script build 2026-08-27.1');

// --- Theme Cache & Management ---
let currentUiTheme = 'dark';

chrome.storage.sync.get({ uiTheme: 'dark' }, (data) => {
  if (data && data.uiTheme) {
    currentUiTheme = data.uiTheme;
    updateActivePopupsTheme();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.uiTheme) {
    currentUiTheme = changes.uiTheme.newValue || 'dark';
    updateActivePopupsTheme();
  }
});

function applyThemeToPopupContainer(container, theme) {
  if (!container) return;
  if (theme === 'auto') {
    container.removeAttribute('data-theme');
  } else {
    container.setAttribute('data-theme', theme || 'dark');
  }
}

function updateActivePopupsTheme() {
  activePopups.forEach((instance) => {
    if (instance && instance.container) {
      applyThemeToPopupContainer(instance.container, currentUiTheme);
    }
  });
}

// --- Styles ---
const googleSansUrl = chrome.runtime.getURL('fonts/GoogleSans-VariableFont_GRAD,opsz,wght.ttf');
const googleSansItalicUrl = chrome.runtime.getURL('fonts/GoogleSans-Italic-VariableFont_GRAD,opsz,wght.ttf');

function ensurePopupFontsInjected() {
  if (document.getElementById('ai-popup-font-face')) return;
  try {
    const style = document.createElement('style');
    style.id = 'ai-popup-font-face';
    style.textContent = `
      @font-face {
        font-family: 'Google Sans';
        src: url('${googleSansUrl}') format('truetype');
        font-weight: 100 900;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Google Sans';
        src: url('${googleSansItalicUrl}') format('truetype');
        font-weight: 100 900;
        font-style: italic;
        font-display: swap;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  } catch (e) {}

  if (typeof FontFace !== 'undefined' && document.fonts) {
    try {
      const fNormal = new FontFace('Google Sans', `url('${googleSansUrl}')`, { weight: '100 900', style: 'normal' });
      const fItalic = new FontFace('Google Sans', `url('${googleSansItalicUrl}')`, { weight: '100 900', style: 'italic' });
      fNormal.load().then((f) => document.fonts.add(f)).catch(() => {});
      fItalic.load().then((f) => document.fonts.add(f)).catch(() => {});
    } catch (_) {}
  }
}

// Preload fonts into the document
ensurePopupFontsInjected();

const popupStyles = `
  @font-face {
    font-family: 'Google Sans';
    src: url('${googleSansUrl}') format('truetype');
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Google Sans';
    src: url('${googleSansItalicUrl}') format('truetype');
    font-weight: 100 900;
    font-style: italic;
    font-display: swap;
  }

  :host {
    --popup-font-family: 'Google Sans', 'Google Sans Text', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-family: var(--popup-font-family);
    --popup-bg: linear-gradient(145deg, #252a35 0%, #171b24 100%);
    --popup-text: #eef3f8;
    --popup-text-muted: #a8b8cc;
    --popup-text-header: #f8fafc;
    --popup-border: rgba(255, 255, 255, 0.1);
    --popup-card-bg: #111c2c;
    --popup-field-bg: #101827;
    --popup-field-border: #475569;
    --popup-field-text: #eeeeee;
    --popup-accent-rgb: 45, 212, 191; /* #2dd4bf mint */
    --popup-accent-btn-bg: #5eead4;
    --popup-accent-btn-hover: #99f6e4;
    --popup-accent-btn-text: #072b2b;
    --popup-accent-btn-border: #99f6e4;
    --popup-btn-icon-color: #b9f6ed;
    --popup-btn-icon-hover: #e6fffb;
    --popup-toast-bg: #0b1220;
    --popup-shadow-1: rgba(0, 0, 0, 0.42);
    --popup-shadow-2: rgba(0, 0, 0, 0.28);
    --popup-dropdown-bg: #0f172a;
    --popup-dropdown-hover: #334155;
    --popup-dropdown-border: #475569;
    --popup-focus-ring-rgb: 45, 212, 191;
    --popup-context-label: #a8b8cc; /* muted: blue is reserved for links */
    --popup-role-user: #a8b8cc;
    --popup-role-ai: #2dd4bf; /* mint accent */
    --popup-link-color: #a5d6ff;
    --popup-error-text: #f87171;
    color-scheme: dark;
  }

  :host([data-theme="light"]) {
    --popup-bg: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
    --popup-text: #0f172a;
    --popup-text-muted: #64748b;
    --popup-text-header: #0f172a;
    --popup-border: rgba(15, 23, 42, 0.1);
    --popup-card-bg: #f1f5f9;
    --popup-field-bg: #ffffff;
    --popup-field-border: #cbd5e1;
    --popup-field-text: #0f172a;
    --popup-accent-rgb: 13, 148, 136; /* #0d9488 teal */
    --popup-accent-btn-bg: #0d9488;
    --popup-accent-btn-hover: #0f766e;
    --popup-accent-btn-text: #ffffff;
    --popup-accent-btn-border: #0d9488;
    --popup-btn-icon-color: #0d9488;
    --popup-btn-icon-hover: #115e59;
    --popup-toast-bg: #0f172a;
    --popup-shadow-1: rgba(15, 23, 42, 0.12);
    --popup-shadow-2: rgba(15, 23, 42, 0.08);
    --popup-dropdown-bg: #ffffff;
    --popup-dropdown-hover: #f1f5f9;
    --popup-dropdown-border: #cbd5e1;
    --popup-focus-ring-rgb: 13, 148, 136;
    --popup-context-label: #64748b;
    --popup-role-user: #64748b;
    --popup-role-ai: #0d9488;
    --popup-link-color: #0284c7;
    --popup-error-text: #dc2626;
    color-scheme: light;
  }

  @media (prefers-color-scheme: light) {
    :host:not([data-theme="dark"]) {
      --popup-bg: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
      --popup-text: #0f172a;
      --popup-text-muted: #64748b;
      --popup-text-header: #0f172a;
      --popup-border: rgba(15, 23, 42, 0.1);
      --popup-card-bg: #f1f5f9;
      --popup-field-bg: #ffffff;
      --popup-field-border: #cbd5e1;
      --popup-field-text: #0f172a;
      --popup-accent-rgb: 13, 148, 136;
      --popup-accent-btn-bg: #0d9488;
      --popup-accent-btn-hover: #0f766e;
      --popup-accent-btn-text: #ffffff;
      --popup-accent-btn-border: #0d9488;
      --popup-btn-icon-color: #0d9488;
      --popup-btn-icon-hover: #115e59;
      --popup-toast-bg: #0f172a;
      --popup-shadow-1: rgba(15, 23, 42, 0.12);
      --popup-shadow-2: rgba(15, 23, 42, 0.08);
      --popup-dropdown-bg: #ffffff;
      --popup-dropdown-hover: #f1f5f9;
      --popup-dropdown-border: #cbd5e1;
      --popup-focus-ring-rgb: 13, 148, 136;
      --popup-context-label: #64748b;
      --popup-role-user: #64748b;
      --popup-role-ai: #0d9488;
      --popup-link-color: #0284c7;
      --popup-error-text: #dc2626;
      color-scheme: light;
    }
  }

  button, input, textarea, select {
    font-family: inherit;
  }

  #ai-definition-popup {
    position: fixed; /* Use fixed positioning relative to the viewport */
    background: var(--popup-bg);
    color: var(--popup-text);
    border: 1px solid var(--popup-border);
    border-radius: 20px;
    padding: 18px 16px 16px 16px;
    font-family: var(--popup-font-family);
    font-size: 14px;
    line-height: 1.5;
    width: min(365px, calc(100vw - 24px));
    max-width: 365px;
    box-sizing: border-box;
    max-height: 85vh; /* Keep the popup within screen bounds */
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 18px 42px var(--popup-shadow-1), 0 3px 12px var(--popup-shadow-2), inset 0 1px 0 rgba(255, 255, 255, 0.09);
    pointer-events: auto; /* Re-enable pointer events for the popup itself */
    z-index: 1; /* z-index is now relative to its container */
    animation: ai-popup-enter 180ms ease-out;
  }

  @keyframes ai-popup-enter {
    from { opacity: 0; transform: translateY(6px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* --- Loading indicator (initial load, follow-ups, model reloads) --- */
  .ai-popup-loading {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--popup-text-muted);
    font-size: 13px;
    padding: 4px 0;
  }
  .ai-popup-loading-dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .ai-popup-loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(var(--popup-accent-rgb), 1);
    animation: ai-popup-dot-bounce 1.2s ease-in-out infinite;
  }
  .ai-popup-loading-dot:nth-child(2) { animation-delay: 0.15s; }
  .ai-popup-loading-dot:nth-child(3) { animation-delay: 0.3s; }
  @keyframes ai-popup-dot-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
  .ai-popup-loading-text {
    display: inline-block;
  }

  /* --- Toast (save feedback, STT/speech errors) --- */
  .ai-popup-toast {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    background: var(--popup-toast-bg);
    border: 1px solid rgba(var(--popup-accent-rgb), 0.35);
    border-radius: 8px;
    color: var(--popup-text);
    font-size: 12.5px;
    font-weight: 600;
    box-shadow: 0 6px 18px var(--popup-shadow-1);
    z-index: 3000;
    pointer-events: none;
    white-space: nowrap;
    animation: ai-popup-toast-enter 160ms ease-out;
  }
  .ai-popup-toast.toast-error { border-color: rgba(239, 68, 68, 0.5); }
  .ai-popup-toast.toast-hiding { opacity: 0; transition: opacity 200ms ease; }
  @keyframes ai-popup-toast-enter {
    from { opacity: 0; transform: translate(-50%, 6px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  #ai-popup-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    cursor: grab;
    user-select: none; /* the header drags the popup; text stays copyable via its tooltip */
  }
  #ai-popup-context:active { cursor: grabbing; }
  .ai-popup-context-copy { min-width: 0; flex: 1 1 auto; }
  .ai-popup-context-label {
    display: none;
  }
  .ai-popup-context-query {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--popup-text-header);
    font-size: 19px;
    letter-spacing: -0.02em; /* tighter tracking suits the bold display size */
    font-weight: 700;
    line-height: 1.25;
  }
  .ai-popup-context-model {
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 3px 7px;
    color: rgba(var(--popup-accent-rgb), 1);
    background: rgba(var(--popup-accent-rgb), 0.12);
    border: 1px solid rgba(var(--popup-accent-rgb), 0.22);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 650;
  }

  /* --- Styles for custom dropdown --- */
  .custom-select-container { position: relative; flex-grow: 1; min-width: 110px; }
  .custom-select {
      display: flex; align-items: center; justify-content: space-between;
      height: 33px; box-sizing: border-box;
      padding: 0 10px; background-color: var(--popup-field-bg);
      border: 1px solid var(--popup-field-border); border-radius: 999px;
      cursor: pointer; user-select: none; color: var(--popup-field-text);
      font-size: 12px; letter-spacing: -0.01em; font-family: inherit;
  }
  .custom-select-value {
      min-width: 0;
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  .custom-select > span:last-child { flex-shrink: 0; margin-left: 4px; }
  .custom-select:focus { outline: none; border-color: rgba(var(--popup-accent-rgb), 0.8); }

  /* --- Keyboard focus rings (matches the options page's ring pattern) --- */
  #ai-definition-popup button:focus-visible,
  #ai-definition-popup input:focus-visible,
  #ai-definition-popup select:focus-visible,
  #ai-popup-followup-input:focus-visible,
  .custom-select:focus-visible,
  .ai-feedback-close:focus-visible,
  .ai-feedback-btn:focus-visible {
    outline: none;
    border-color: rgba(var(--popup-focus-ring-rgb), 0.9);
    box-shadow: 0 0 0 3px rgba(var(--popup-focus-ring-rgb), 0.35);
  }
  #ai-open-button-popup:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--popup-focus-ring-rgb), 0.45);
  }
  .custom-options {
      position: absolute; bottom: 100%; left: 0; right: 0;
      background-color: var(--popup-dropdown-bg); border: 1px solid var(--popup-dropdown-border);
      border-radius: 16px; margin-bottom: 6px; max-height: 250px; overflow-y: auto;
      z-index: 2000; display: none; box-shadow: 0 -4px 10px var(--popup-shadow-1);
      font-size: 13px; font-family: inherit;
      padding: 6px; transform-origin: bottom center;
  }
  /* Top-row selectors (model/prompt) drop down instead of up */
  .custom-options.drop-down {
      top: 100%; bottom: auto;
      margin-top: 6px; margin-bottom: 0;
      box-shadow: 0 6px 16px var(--popup-shadow-1);
      transform-origin: top center;
  }
  .custom-options.show { display: block; animation: ai-popup-menu-in 130ms ease-out; }
  @keyframes ai-popup-menu-in {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
  .custom-option { padding: 7px 10px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; min-width: 0; color: var(--popup-field-text); }
  .custom-option:hover { background-color: var(--popup-dropdown-hover); }
  .custom-option.selected { background-color: rgba(var(--popup-accent-rgb), 0.18); }
  .custom-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .custom-option-check { flex-shrink: 0; display: inline-flex; color: rgba(var(--popup-accent-rgb), 1); }
  .custom-select.disabled { opacity: 0.6; cursor: not-allowed; }
  .expand-toggle { cursor: pointer; display: inline-block; width: 16px; text-align: center; color: var(--popup-text-muted); font-size: 10px;}
  .expand-toggle:hover { color: var(--popup-text-header); }
  .indent-spacer { display: inline-block; width: 16px; }

  /* --- Styles for selectors: labeled Model (primary) + Prompt (ghost) --- */
  #ai-popup-selectors-container {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }
  #ai-popup-selectors-container .selector-field {
    flex: 1 1 50%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  #ai-popup-selectors-container .custom-select-container {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }
  .selector-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--popup-text-muted);
    line-height: 1;
    padding-left: 10px;
    user-select: none;
  }
  .custom-select-leading-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    margin-right: 6px;
    opacity: 0.75;
  }
  .custom-select-container.is-model .custom-select-leading-icon {
    color: rgba(var(--popup-accent-rgb), 1);
    opacity: 1;
  }
  .custom-select-container.is-model .custom-select {
    background: rgba(var(--popup-accent-rgb), 0.14);
    border-color: rgba(var(--popup-accent-rgb), 0.4);
    font-weight: 600;
  }

  /* Wrapper for the AI-generated text */
  #ai-popup-content {
    position: relative;
    overflow-y: auto; /* Scroll if content overflows */
    padding: 2px 5px 2px 1px; /* Spacing for the scrollbar */
    font-size: 14px;
    line-height: 1.68;
    text-align: left;
  }

  /* Thin rounded scrollbars, accent-muted (shared pattern with options page and PDF viewer) */
  #ai-popup-content::-webkit-scrollbar,
  .custom-options::-webkit-scrollbar {
    width: 8px;
  }
  #ai-popup-content::-webkit-scrollbar-track,
  .custom-options::-webkit-scrollbar-track {
    background: transparent;
  }
  #ai-popup-content::-webkit-scrollbar-thumb,
  .custom-options::-webkit-scrollbar-thumb {
    background: rgba(var(--popup-accent-rgb), 0.4);
    border-radius: 8px;
  }
  #ai-popup-content::-webkit-scrollbar-thumb:hover,
  .custom-options::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--popup-accent-rgb), 0.65);
  }
  
  #ai-popup-content p {
    margin-top: 0;
    margin-bottom: 12px;
    text-align: left;
  }

  #ai-popup-content p:last-child {
    margin-bottom: 0;
  }

  /* --- Markdown blocks inside AI responses --- */
  #ai-popup-content h1, #ai-popup-content h2, #ai-popup-content h3,
  #ai-popup-content h4, #ai-popup-content h5, #ai-popup-content h6 {
    margin: 14px 0 6px;
    line-height: 1.3;
    color: var(--popup-text-header);
  }
  #ai-popup-content h1 { font-size: 1.3em; }
  #ai-popup-content h2 { font-size: 1.2em; }
  #ai-popup-content h3 { font-size: 1.1em; }
  #ai-popup-content h4, #ai-popup-content h5, #ai-popup-content h6 { font-size: 1em; }
  #ai-popup-content h1:first-child, #ai-popup-content h2:first-child,
  #ai-popup-content h3:first-child, #ai-popup-content h4:first-child {
    margin-top: 0;
  }

  #ai-popup-content ul, #ai-popup-content ol {
    margin: 0 0 12px;
    padding-left: 22px;
  }
  #ai-popup-content li { margin: 3px 0; }
  #ai-popup-content ul:last-child, #ai-popup-content ol:last-child,
  #ai-popup-content ul li:last-child, #ai-popup-content ol li:last-child { margin-bottom: 0; }

  #ai-popup-content code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 0.88em;
    background: var(--popup-field-bg);
    border: 1px solid var(--popup-border);
    border-radius: 5px;
    padding: 1px 5px;
    overflow-wrap: anywhere;
  }
  #ai-popup-content pre {
    margin: 0 0 12px;
    padding: 10px 12px;
    background: var(--popup-field-bg);
    border: 1px solid var(--popup-border);
    border-radius: 8px;
    overflow-x: auto;
  }
  #ai-popup-content pre code {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    font-size: 0.86em;
    white-space: pre;
  }
  #ai-popup-content pre:last-child { margin-bottom: 0; }

  #ai-popup-content blockquote {
    margin: 0 0 12px;
    padding: 2px 0 2px 12px;
    border-left: 3px solid rgba(var(--popup-accent-rgb), 0.55);
    color: var(--popup-text-muted);
  }
  #ai-popup-content blockquote:last-child { margin-bottom: 0; }

  #ai-popup-content .ai-md-table-wrap {
    max-width: 100%;
    margin: 0 0 12px;
    overflow-x: auto;
  }
  #ai-popup-content table {
    border-collapse: collapse;
    font-size: 0.92em;
  }
  #ai-popup-content th, #ai-popup-content td {
    border: 1px solid var(--popup-field-border);
    padding: 5px 9px;
    text-align: left;
    vertical-align: top;
  }
  #ai-popup-content th {
    background: var(--popup-field-bg);
    color: var(--popup-text-header);
  }

  #ai-popup-content a {
    color: rgb(var(--popup-accent-rgb));
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--popup-accent-rgb), 0.4);
    overflow-wrap: anywhere;
  }
  #ai-popup-content a:hover { border-bottom-color: rgb(var(--popup-accent-rgb)); }

  #ai-popup-content hr {
    border: none;
    border-top: 1px solid var(--popup-border);
    margin: 14px 0;
  }

  /* --- Follow-up conversation rows (chat-style transcript) --- */
  .ai-chat-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
    min-width: 0;
  }
  .ai-chat-row-user {
    justify-content: flex-end;
  }
  .ai-chat-icon {
    flex-shrink: 0;
    display: inline-flex;
    margin-top: 4px; /* optically centers the glyph on the first text line */
    color: var(--popup-role-ai);
  }
  .ai-chat-bubble {
    box-sizing: border-box;
    max-width: 85%;
    min-width: 0;
    padding: 7px 11px;
    background: var(--popup-field-bg);
    border: 1px solid var(--popup-field-border);
    border-radius: 12px 12px 4px 12px;
    overflow-wrap: anywhere;
  }
  .ai-chat-text {
    min-width: 0;
  }
  .ai-chat-retry {
    font-style: italic;
    color: var(--popup-text-muted);
  }

  /* --- STYLES FOR BUTTONS --- */
  /* Save-row: transparent (not a crowded pill). Icon buttons sit left,
     list picker + primary Save group right via margin-left:auto. */
  .ai-popup-actions {
    display: flex;
    align-items: center; /* Vertically center items */
    gap: 8px;
    margin-top: 10px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
  }

  .ai-popup-button {
    font-family: inherit;
    font-size: 12.5px; 
    font-weight: 600; 
    color: rgba(var(--popup-accent-rgb), 1);
    cursor: pointer;
    background: rgba(var(--popup-accent-rgb), 0.14);
    border: 1px solid rgba(var(--popup-accent-rgb), 0.35);
    border-radius: 999px;
    height: 30px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    white-space: nowrap; /* Prevent wrapping */
    flex-shrink: 0; /* Prevent button from shrinking */
    transition: all 140ms ease;
  }

  .ai-popup-button:hover {
    background: rgba(var(--popup-accent-rgb), 0.24);
    border-color: rgba(var(--popup-accent-rgb), 0.55);
  }

  /* Primary Save: solid accent, pairs with the 33px list picker. */
  .ai-popup-button-save {
    background: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border-color: var(--popup-accent-btn-border);
    height: 34px;
    padding: 0 18px;
    font-size: 13px;
  }
  .ai-popup-button-save:hover {
    background: var(--popup-accent-btn-hover);
    border-color: var(--popup-accent-btn-hover);
  }
  .ai-popup-button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  /* Resume button under the empty hotkey popup's greeting (Issue #26):
     full-width and quiet — an offer, not a call to action. */
  .ai-popup-restore-btn {
    width: 100%;
    margin-top: 12px;
    background: var(--popup-field-bg);
    border-color: var(--popup-field-border);
    color: var(--popup-text);
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    flex-shrink: 1;
    border-radius: 999px;
  }
  .ai-popup-restore-btn:hover {
    background: var(--popup-field-bg);
    border-color: rgba(var(--popup-accent-rgb), 0.6);
    color: var(--popup-text);
  }
  .ai-popup-button:active {
    transform: translateY(0) scale(0.98);
  }

  /* SPEECH & PDF BUTTONS */
  #ai-popup-speak-btn, #ai-popup-pdf-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    font-size: 15px;
    color: var(--popup-btn-icon-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 50%;
    transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease;
  }
  #ai-popup-speak-btn:hover, #ai-popup-pdf-btn:hover {
    color: var(--popup-btn-icon-hover);
    background: rgba(var(--popup-accent-rgb), 0.12);
    border-color: rgba(var(--popup-accent-rgb), 0.4);
  }
  #ai-popup-speak-btn:active, #ai-popup-pdf-btn:active {
    transform: translateY(0) scale(0.98);
  }

  /* PIN BUTTON (Header placement) */
  #ai-popup-pin-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--popup-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--popup-field-bg);
    border: 1px solid var(--popup-field-border);
    border-radius: 50%;
    transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease;
  }
  #ai-popup-pin-btn:hover {
    color: var(--popup-text-header);
    border-color: rgba(var(--popup-accent-rgb), 0.5);
    background: rgba(var(--popup-accent-rgb), 0.12);
  }
  #ai-popup-pin-btn:active {
    transform: translateY(0) scale(0.96);
  }
  #ai-popup-pin-btn.pinned {
    color: rgba(var(--popup-accent-rgb), 1);
    background: rgba(var(--popup-accent-rgb), 0.2);
    border-color: rgba(var(--popup-accent-rgb), 0.5);
    opacity: 1;
  }

  /* --- Follow-up Prompt --- */
  #ai-popup-followup-container {
    display: flex;
    position: relative;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--popup-border);
    align-items: center;
  }
  
  #ai-popup-followup-input {
    flex-grow: 1;
    background-color: var(--popup-field-bg);
    color: var(--popup-field-text);
    border: 1px solid var(--popup-field-border);
    border-radius: 999px;
    padding: 10px 74px 10px 16px;
    font-family: inherit;
    font-size: 12.5px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }

  /* Mouse users get the same ring keyboard users get via :focus-visible. */
  #ai-popup-followup-input:focus {
    outline: none;
    border-color: rgba(var(--popup-focus-ring-rgb), 0.9);
    box-shadow: 0 0 0 3px rgba(var(--popup-focus-ring-rgb), 0.35);
  }
  
  #ai-popup-followup-input::placeholder {
    color: var(--popup-text-muted);
  }

  .ai-popup-followup-send {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 120ms ease, background-color 120ms ease;
  }

  .ai-popup-followup-send:hover {
    background: var(--popup-accent-btn-hover);
    transform: translateY(-50%) scale(1.05);
  }
  .ai-popup-followup-send:active {
    transform: translateY(-50%) scale(0.95);
  }

  /* --- Stop Button (Issue #24) --- */
  /* Sits exactly where the mic sits while a generation is in flight (the two
     are never shown together), so the row's layout never shifts on stop. */
  .ai-popup-followup-stop {
    position: absolute;
    right: 39px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(220, 38, 38, 0.92);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 120ms ease, background-color 120ms ease;
  }
  .ai-popup-followup-stop:hover {
    background: rgba(185, 28, 28, 0.95);
    transform: translateY(-50%) scale(1.05);
  }
  .ai-popup-followup-stop:active {
    transform: translateY(-50%) scale(0.95);
  }
  .ai-popup-followup-stop:disabled {
    opacity: 0.75;
    cursor: default;
    transform: translateY(-50%);
  }

  /* --- Follow-up Mic Button --- */
  .ai-popup-followup-mic {
    position: absolute;
    right: 39px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    color: var(--popup-text-muted);
    border: 1px solid transparent;
    box-sizing: border-box;
    padding: 4px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    border-radius: 50%;
    width: 26px;
    height: 26px;
  }

  .ai-popup-followup-mic:hover {
    color: var(--popup-field-text);
    background: rgba(var(--popup-accent-rgb), 0.15);
    border-color: rgba(var(--popup-accent-rgb), 0.4);
  }

  .ai-popup-followup-mic.recording {
    background: #e53935;
    color: #fff;
    border-color: #e53935;
    animation: ai-popup-pulse 1.5s infinite;
  }

  @keyframes ai-popup-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  /* --- Open Button Popup --- */
  #ai-open-button-group {
    position: fixed;
    display: flex;
    align-items: stretch;
    gap: 6px;
    pointer-events: auto;
    z-index: 1;
  }
  #ai-open-button-popup {
    background-color: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 8px;
    padding: 6px 12px;
    font-family: var(--popup-font-family);
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 6px var(--popup-shadow-1);
  }
  #ai-clip-button-popup {
    background-color: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 8px;
    padding: 6px 9px;
    font-family: var(--popup-font-family);
    cursor: pointer;
    box-shadow: 0 2px 6px var(--popup-shadow-1);
    display: inline-flex;
    align-items: center;
  }
  #ai-clip-button-popup:disabled {
    opacity: 0.7;
    cursor: default;
  }
  #ai-open-button-popup:hover,
  #ai-clip-button-popup:hover:not(:disabled) {
    background-color: var(--popup-accent-btn-hover);
  }

  /* --- Feedback Prompt Banner Styles --- */
  .ai-feedback-banner {
    margin-top: 10px;
    padding: 10px 12px;
    background: var(--popup-card-bg);
    border: 1px solid var(--popup-border);
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.4;
    box-sizing: border-box;
    animation: ai-popup-enter 180ms ease-out;
  }
  .ai-feedback-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--popup-text-header);
    font-size: 12px;
  }
  .ai-feedback-close {
    background: none;
    border: none;
    color: var(--popup-text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    line-height: 1;
    border-radius: 8px;
  }
  .ai-feedback-close:hover {
    color: var(--popup-text-header);
    background: rgba(var(--popup-accent-rgb), 0.15);
  }
  .ai-feedback-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .ai-feedback-btn {
    background: var(--popup-field-bg);
    border: 1px solid var(--popup-field-border);
    border-radius: 10px;
    color: var(--popup-text);
    padding: 5px 9px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
    transition: all 0.15s ease;
  }
  .ai-feedback-btn:hover {
    background: var(--popup-dropdown-hover);
    border-color: var(--popup-field-border);
    color: var(--popup-text-header);
  }
  .ai-feedback-btn.primary {
    background: var(--popup-accent-btn-bg);
    border-color: var(--popup-accent-btn-border);
    color: var(--popup-accent-btn-text);
  }
  .ai-feedback-btn.primary:hover {
    background: var(--popup-accent-btn-hover);
  }

  .ai-popup-error-text {
    color: var(--popup-error-text);
  }
  .ai-popup-error-reload {
    margin-left: 5px;
  }

  .ai-popup-retry-btn {
    background: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 10px;
    cursor: pointer;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .ai-popup-retry-btn:hover {
    background: var(--popup-accent-btn-hover);
  }

  /* Citations in Popup */
  .ai-popup-citations {
    margin-top: 8px;
    padding: 7px 9px;
    border-radius: 8px;
    background-color: rgba(var(--popup-accent-rgb), 0.1);
    border-left: 3px solid rgba(var(--popup-accent-rgb), 0.9);
    font-size: 12px;
  }
  .ai-popup-citations summary {
    cursor: pointer;
    color: var(--popup-context-label);
    font-weight: 600;
  }
  .ai-popup-citations a {
    color: var(--popup-link-color);
    text-decoration: underline;
  }

  /* Verification Badges in Popup */
  .ai-popup-verification {
    margin-top: 12px;
    padding: 8px;
    border-radius: 8px;
    font-size: 12px;
    color: inherit;
  }
  .ai-popup-verification.pending {
    background-color: rgba(59, 130, 246, 0.1);
    border-left: 3px solid #3b82f6;
  }
  .ai-popup-verification.failed {
    background-color: rgba(100, 116, 139, 0.1);
    border-left: 3px solid #64748b;
  }
  .ai-popup-verification.hallucination {
    background-color: rgba(239, 68, 68, 0.1);
    border-left: 3px solid #ef4444;
  }
  .ai-popup-verification.verified {
    background-color: rgba(var(--popup-accent-rgb), 0.1);
    border-left: 3px solid rgba(var(--popup-accent-rgb), 0.9);
  }

  /* --- Multi-model compare (Issue #27): horizontal card slider ---
     One card fills the popup; the row of cards is dragged/swiped/scrolled
     sideways, snapping to the nearest model. Compare is the popup's normal
     answering mode — no toggle, the slider is simply how answers appear. */
  #ai-popup-content.ai-compare-mode {
    overflow: hidden;
    padding: 2px 0 0 0;
  }
  .ai-compare-viewport {
    overflow: hidden;
    position: relative;
    touch-action: pan-y; /* vertical answer scrolling stays native; horizontal is ours */
  }
  .ai-compare-track {
    display: flex;
    align-items: stretch;
    width: 100%;
    will-change: transform;
  }
  .ai-compare-track.animating { transition: transform 200ms ease-out; }
  .ai-compare-card {
    flex: 0 0 100%;
    min-width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--popup-border);
    background: var(--popup-card-bg);
    border-radius: 16px;
    padding: 14px 16px;
  }
  .ai-compare-header {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;
    padding: 5px 11px;
    background: rgba(var(--popup-accent-rgb), 0.06);
    border: 1px solid var(--popup-border);
    border-radius: 999px;
    min-width: 0;
  }
  .ai-compare-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--popup-text-muted);
    flex-shrink: 0;
  }
  .ai-compare-dot.streaming {
    background: rgba(var(--popup-accent-rgb), 1);
    animation: ai-popup-dot-bounce 1.2s ease-in-out infinite;
  }
  .ai-compare-dot.done { background: rgba(52, 211, 153, 1); }
  .ai-compare-dot.error { background: var(--popup-error-text); }
  .ai-compare-model {
    font-weight: 600;
    font-size: 11.5px;
    color: var(--popup-text-muted);
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ai-compare-model::after {
    content: '•';
    margin-left: 7px;
    opacity: 0.45;
  }
  .ai-compare-status {
    margin-left: auto;
    font-size: 11.5px;
    color: var(--popup-text-muted);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .ai-compare-status svg { opacity: 0.9; flex-shrink: 0; }
  .ai-compare-status.is-done svg { color: rgba(52, 211, 153, 1); opacity: 1; }
  .ai-compare-status.is-error { color: var(--popup-error-text); }
  .ai-compare-status.is-error svg { opacity: 1; }
  .ai-compare-body {
    position: relative;
    font-size: 14px;
    line-height: 1.68;
    text-align: left;
    overflow-y: auto;
    overscroll-behavior: contain;
    max-height: 38vh;
    min-height: 96px;
    padding-right: 4px;
    overflow-wrap: break-word;
  }
  .ai-compare-body::-webkit-scrollbar { width: 8px; }
  .ai-compare-body::-webkit-scrollbar-track { background: transparent; }
  .ai-compare-body::-webkit-scrollbar-thumb {
    background: rgba(var(--popup-accent-rgb), 0.4);
    border-radius: 8px;
  }
  .ai-compare-body p { margin-top: 0; margin-bottom: 12px; text-align: left; }
  .ai-compare-body p:last-child { margin-bottom: 0; }
  /* Stacked conversation turns: follow-up answers land below earlier ones,
     separated by a hairline so the thread reads clearly. */
  .ai-compare-turn + .ai-compare-turn,
  .ai-compare-turn + .ai-chat-row,
  .ai-chat-row + .ai-compare-turn {
    border-top: 1px solid var(--popup-border);
    margin-top: 10px;
    padding-top: 10px;
  }
  .ai-compare-turn .ai-popup-loading { padding: 2px 0; }
  .ai-compare-idle {
    color: var(--popup-text-muted);
    font-size: 12.5px;
    line-height: 1.55;
    padding: 14px 4px;
    text-align: center;
  }
  .ai-compare-error {
    color: var(--popup-error-text);
    font-size: 13px;
    margin-bottom: 8px;
    overflow-wrap: break-word;
  }
  .ai-compare-actions {
    display: flex;
    gap: 6px;
    margin-top: 9px;
  }
  .ai-compare-actions button {
    flex: 1;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid var(--popup-field-border);
    background: var(--popup-field-bg);
    color: var(--popup-text);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .ai-compare-actions button:hover:not(:disabled) {
    border-color: rgba(var(--popup-accent-rgb), 0.6);
  }
  .ai-compare-actions button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  /* Slider navigation: arrows for anyone who cannot drag, dots that double as
     per-model status lights, and a plain "1 / 3" position counter. */
  .ai-compare-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 0 2px 0;
    user-select: none;
  }
  .ai-compare-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--popup-text-muted);
    cursor: pointer;
    padding: 0;
    opacity: 0.65;
    transition: opacity 120ms ease, color 120ms ease, transform 120ms ease;
  }
  .ai-compare-nav-btn svg {
    width: 13px;
    height: 13px;
  }
  .ai-compare-nav-btn:disabled { opacity: 0.15; cursor: default; }
  .ai-compare-nav-btn:not(:disabled):hover {
    opacity: 0.9;
    color: var(--popup-text);
    transform: scale(1.1);
  }
  .ai-compare-dots {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .ai-compare-dotnav {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 1px solid var(--popup-field-border);
    background: var(--popup-field-bg);
    padding: 0;
    cursor: pointer;
    transition: all 150ms ease;
  }
  .ai-compare-dotnav.done { border-color: rgba(52, 211, 153, 0.8); }
  .ai-compare-dotnav.error { border-color: var(--popup-error-text); }
  .ai-compare-dotnav.active {
    width: 16px;
    height: 6px;
    border-radius: 999px;
    background: rgba(var(--popup-accent-rgb), 0.9);
    border-color: transparent;
  }
  .ai-compare-counter {
    font-size: 11px;
    color: var(--popup-text-muted);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: center;
    line-height: 1;
    user-select: none;
  }

  /* --- Reduced motion: show elements at rest, no enter/bounce/pulse --- */
  @media (prefers-reduced-motion: reduce) {
    #ai-definition-popup,
    .ai-popup-loading-dot,
    .ai-compare-dot.streaming,
    .ai-popup-toast,
    .ai-popup-followup-mic.recording,
    .ai-feedback-banner,
    .custom-options {
      animation: none;
    }
    .ai-popup-toast.toast-hiding {
      transition: none;
    }
  }
`;

// --- Inline SVG icon set (currentColor, inherits hover/state colors) ---
const POPUP_ICON_PATHS = {
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  alertTriangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  thumbsUp: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  thumbsDown: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
  messageCircle: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'
};

function iconSvg(name, size = 16) {
  const paths = POPUP_ICON_PATHS[name];
  if (!paths) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;" aria-hidden="true">${paths}</svg>`;
}

// --- NEW: Toast feedback inside a popup instance ---
// Message text is set via textContent, so it can never inject HTML.
function showPopupToast(instance, message, type = 'success') {
  const popup = instance && instance.popup;
  if (!popup) return;

  // One toast per popup: replace any toast still on screen.
  popup.querySelector('.ai-popup-toast')?.remove();
  clearTimeout(instance.toastTimer);

  const toast = document.createElement('div');
  toast.className = 'ai-popup-toast' + (type === 'error' ? ' toast-error' : '');

  const iconWrap = document.createElement('span');
  iconWrap.style.color = type === 'error' ? '#f87171' : '#5eead4';
  iconWrap.style.display = 'inline-flex';
  iconWrap.innerHTML = iconSvg(type === 'error' ? 'xCircle' : 'checkCircle', 14);

  const text = document.createElement('span');
  text.textContent = message;

  toast.append(iconWrap, text);
  popup.appendChild(toast);

  instance.toastTimer = setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 220);
  }, 2200);
}

// --- NEW: Custom Dropdown Helpers ---
function getSortedTreeLists(lists) {
  const listMap = {};
  lists.forEach(l => {
    l.children = [];
    listMap[l.id] = l;
  });

  const roots = [];
  lists.forEach(l => {
    if (l.parentId && listMap[l.parentId]) {
      listMap[l.parentId].children.push(l);
    } else {
      roots.push(l);
    }
  });

  const sortedList = [];
  function traverse(node, depth) {
    sortedList.push({ ...node, depth });
    node.children.forEach(child => traverse(child, depth + 1));
  }
  roots.forEach(root => traverse(root, 0));
  return sortedList;
}

function createCustomDropdown(lists, currentValue, onChange, options = {}) {
  const container = document.createElement('div');
  container.className = 'custom-select-container';

  const selectBtn = document.createElement('div');
  selectBtn.className = 'custom-select';
  selectBtn.tabIndex = 0;
  
  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'custom-select-value';
  valueDisplay.textContent = 'Select a list...';

  function setSelectedLabel(name) {
    valueDisplay.textContent = name;
    // Tooltip on the whole trigger (not just the text span) so the full name
    // shows when hovering anywhere over a truncated label.
    selectBtn.title = name;
    valueDisplay.title = name;
  }

  const arrow = document.createElement('span');
  arrow.innerHTML = iconSvg('chevronDown', 12);
  
  selectBtn.append(valueDisplay, arrow);
  
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-options';
  if (options.direction === 'down') optionsContainer.classList.add('drop-down');
  if (options.disabled) selectBtn.classList.add('disabled');

  container.append(selectBtn, optionsContainer);

  let selectedId = currentValue;
  const expandedState = {}; 

  const sortedList = getSortedTreeLists(lists);

  const allItems = [];
  if (options.showAllLists) allItems.push({ id: '__all_lists__', name: 'All Lists', depth: 0 });
  if (options.showUnlisted) allItems.push({ id: '__unlisted__', name: '(Unlisted / No list)', depth: 0, color: '#aaa', italic: true });
  allItems.push(...sortedList);
  if (options.showCreateNew) allItems.push({ id: '__create_new__', name: '+ Create New List...', depth: 0, color: 'lightgreen', isCreate: true });

  function renderOptions() {
    optionsContainer.innerHTML = '';
    
    allItems.forEach(item => {
      let visible = true;
      let curr = item;
      while (curr && curr.parentId) {
        if (!expandedState[curr.parentId]) {
          visible = false;
          break;
        }
        curr = allItems.find(i => i.id === curr.parentId);
      }
      
      if (!visible) return;

      const optEl = document.createElement('div');
      optEl.className = 'custom-option';
      if (item.id === selectedId) {
        optEl.classList.add('selected');
        setSelectedLabel(item.name);
      }
      if (item.color) optEl.style.color = item.color;
      if (item.italic) optEl.style.fontStyle = 'italic';

      for (let i = 0; i < (item.depth || 0); i++) {
        const spacer = document.createElement('span');
        spacer.className = 'indent-spacer';
        optEl.appendChild(spacer);
      }

      const hasChildren = allItems.some(i => i.parentId === item.id);
      if (hasChildren) {
        const toggle = document.createElement('span');
        toggle.className = 'expand-toggle';
        toggle.innerHTML = expandedState[item.id] ? iconSvg('chevronDown', 10) : iconSvg('chevronRight', 10);
        toggle.addEventListener('click', (e) => {
          e.stopPropagation(); 
          expandedState[item.id] = !expandedState[item.id];
          renderOptions();
        });
        optEl.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'indent-spacer';
        optEl.appendChild(spacer);
      }

      const textNode = document.createElement('span');
      textNode.className = 'custom-option-label';
      textNode.textContent = item.name;
      textNode.title = item.name;
      optEl.appendChild(textNode);
      optEl.title = item.name; // row-level tooltip so padding/edges hover too

      if (item.id === selectedId) {
        const check = document.createElement('span');
        check.className = 'custom-option-check';
        check.innerHTML = iconSvg('check', 12);
        optEl.appendChild(check);
      }

      optEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedId = item.id;
        setSelectedLabel(item.name);
        optionsContainer.classList.remove('show');
        if (onChange) onChange(selectedId);
        renderOptions();
      });

      optionsContainer.appendChild(optEl);
    });
  }

  let curr = allItems.find(i => i.id === selectedId);
  while (curr && curr.parentId) {
    expandedState[curr.parentId] = true;
    curr = allItems.find(i => i.id === curr.parentId);
  }
  
  if (selectedId == null && allItems.length > 0) {
    selectedId = allItems[0].id;
    setSelectedLabel(allItems[0].name);
  }

  renderOptions();

  function closeOtherDropdowns() {
    const root = container.getRootNode();
    if (root && root.querySelectorAll) {
      root.querySelectorAll('.custom-options.show').forEach(el => {
        if (!container.contains(el)) el.classList.remove('show');
      });
    }
  }

  function toggleDropdown() {
    const willOpen = !optionsContainer.classList.contains('show');
    optionsContainer.classList.toggle('show');
    if (willOpen) closeOtherDropdowns();
  }

  selectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (options.disabled) return;
    toggleDropdown();
  });

  // The trigger is a div, so Enter/Space do not synthesize a click.
  // Escape only closes the panel; stopPropagation keeps the page-level
  // Escape handler from closing the whole popup.
  selectBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (optionsContainer.classList.contains('show')) {
        e.stopPropagation();
        optionsContainer.classList.remove('show');
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (options.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
    }
  });

  // Clicking elsewhere in the same tree closes the panel. Registered one tick
  // later because callers append the container to its host after this returns.
  setTimeout(() => {
    const root = container.getRootNode();
    if (root && root.addEventListener) {
      root.addEventListener('click', (e) => {
        if (!container.contains(e.target)) optionsContainer.classList.remove('show');
      });
    }
  }, 0);

  Object.defineProperty(container, 'value', {
    get: function() { return selectedId; },
    set: function(val) { selectedId = val; renderOptions(); }
  });

  return container;
}

// The floating "Ask AI" button appears for selections up to this many words.
// Longer selections (likely an accidental select-all) fall back to the hotkey,
// which works on any length and also opens the empty-question scratchpad.
const MAX_FLOATING_BUTTON_WORDS = 500;

// --- Implicit lookup context ---
// Captures the sentence around the selection plus the page title so the
// model can pick the right sense of ambiguous words ("bank", "java", ...).
// Best-effort by design: every failure path yields empty context, never an
// exception, and lookups behave exactly as before when nothing is captured.
// Only short selections get context — a long passage the user deliberately
// selected speaks for itself.
const IMPLICIT_CONTEXT_MAX_SELECTION_CHARS = 160;

function normalizeContextText(text) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pure helper: locates selText inside hostText and expands outward to
// sentence boundaries (. ! ? …), capped on both sides so a pathological
// host (a whole table, a script tag) can never produce a huge "sentence".
function sentenceAround(hostText, selText, radius = 240) {
  if (!hostText || !selText) return '';
  let hay = hostText;
  let idx = hay.indexOf(selText);
  if (idx === -1) {
    // Whitespace often differs between a Selection string and textContent
    // (nested tags); compare whitespace-flattened copies instead.
    hay = hay.replace(/\s+/g, ' ');
    idx = hay.indexOf(selText.replace(/\s+/g, ' '));
  }
  if (idx === -1) return '';

  const terminators = '.!?…';
  let start = idx;
  let walked = 0;
  while (start > 0 && walked < radius && !terminators.includes(hay[start - 1])) {
    start--;
    walked++;
  }
  let end = idx + selText.length;
  walked = 0;
  while (end < hay.length && walked < radius) {
    const ch = hay[end];
    end++;
    if (terminators.includes(ch)) break; // keep the terminator itself
    walked++;
  }
  return normalizeContextText(hay.slice(start, end));
}

function extractImplicitContext(selection, selectedText) {
  const context = { sentence: '', pageTitle: '' };

  try {
    const title = normalizeContextText(document.title).slice(0, 200);
    if (title) context.pageTitle = title;
  } catch (e) {
    // Pages without a title (or an exotic environment) just send no title.
  }

  const titleOnly = () => (context.pageTitle ? context : null);
  if (!selectedText || selectedText.length > IMPLICIT_CONTEXT_MAX_SELECTION_CHARS) {
    return titleOnly();
  }

  try {
    if (!selection || selection.rangeCount === 0) return titleOnly();
    const anchor = selection.getRangeAt(0).commonAncestorContainer;
    const host = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    if (!host) return titleOnly();
    const hostText = normalizeContextText(host.textContent);
    if (!hostText) return titleOnly();
    context.sentence = sentenceAround(hostText, normalizeContextText(selectedText)).slice(0, 400);
  } catch (e) {
    // Selection structures vary wildly (shadow DOM, inputs, canvases);
    // context is an enhancement, never a blocker.
  }

  return (context.sentence || context.pageTitle) ? context : null;
}

// --- Main mouseup listener ---
document.addEventListener('mouseup', (event) => {
  // 1. Check for selection inside existing popups (Nested Selection) FIRST
  let selectedText = "";
  let selectionRect = null;

  let nestedImplicitContext = null;

  // Check from top-most to bottom-most
  for (let i = activePopups.length - 1; i >= 0; i--) {
    const shadowRoot = activePopups[i].container.shadowRoot;
    const selection = shadowRoot.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text.length > 0) {
        selectedText = text;
        selectionRect = selection.getRangeAt(0).getBoundingClientRect();
        // Context is captured here, while the shadow selection still exists;
        // it is usually gone by the time the open button is clicked.
        nestedImplicitContext = extractImplicitContext(selection, text);
        break; // Found a nested selection, stop looking
      }
    }
  }

  // 2. If a nested selection was found, trigger NEW popup and ignore "click inside" blocking
  if (selectedText.length > 0) {
    const wordCount = selectedText.split(/\s+/).length;
    if (wordCount > 0 && wordCount <= MAX_FLOATING_BUTTON_WORDS) {
      // Reset flags to avoid sticking
      activePopups.forEach(p => { p.isClickInside = false; p.isInteracting = false; });
      showOpenButtonPopup(selectionRect, selectedText, nestedImplicitContext);
      return;
    }
  }

  // 3. If NO nested selection, check if we clicked inside (Interaction Blocking)
  // We want to block triggering/closing if just clicking inside a popup
  let isInteractionBlocked = false;
  for (let i = activePopups.length - 1; i >= 0; i--) {
    if (activePopups[i].isClickInside) {
      activePopups[i].isClickInside = false; // Reset for next time
      isInteractionBlocked = true;
    }
    // note: we don't strictly block on isInteracting here unless we want to lock UI during load
  }

  if (isInteractionBlocked) return;

  // 4. Check main window selection
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
  if (selectedText.length > 0) {
    selectionRect = selection.getRangeAt(0).getBoundingClientRect();
    const wordCount = selectedText.split(/\s+/).length;
    if (wordCount > 0 && wordCount <= MAX_FLOATING_BUTTON_WORDS) {

      // --- NEW: Duplicate Check ---
      // If the top-most popup was opened with the SAME text, ignore this trigger.
      // This happens when clicking UI elements inside the popup (like select dropdowns) 
      // where the 'click inside' check might fail but the original page text is still selected.
      if (activePopups.length > 0) {
        const topPopup = activePopups[activePopups.length - 1];
        if (topPopup.sourceText === selectedText) {
          // It's the same selection. Assume user is interacting with existing popup.
          return;
        }
      }

      // --- NEW: Skip automatic open button in custom PDF viewer (handled manually) ---
      if (window.location.pathname.includes('custom-viewer.html')) {
        return;
      }

      showOpenButtonPopup(selectionRect, selectedText, extractImplicitContext(selection, selectedText));
    }
  } else {
    // No text selected anywhere. logic for closing is handled in mousedown (outside click)
  }
});

// --- NEW: Custom event listener for programmatic trigger from custom viewer ---
document.addEventListener('trigger-ai-popup', (e) => {
  if (e.detail && e.detail.rect && e.detail.text) {
    // The viewer's text layer lives in this document, so the selection is
    // still readable here; if it has already been cleared, no context.
    initiatePopupSequence(e.detail.rect, e.detail.text, e.detail.prompt, extractImplicitContext(window.getSelection(), e.detail.text));
  }
});

// --- NEW: Message Listener for activation ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Live streamed answer deltas from the background for a request this popup
  // initiated (keyed by requestId). Unknown requestIds (e.g. a delta landing
  // in a different frame) are simply ignored. No response is expected.
  if (request.type === "aiDefinitionDelta" && request.requestId) {
    const record = activeStreamHandlers.get(request.requestId);
    if (record) record.handle(request);
    return;
  }

  if (request.type === "triggerPopup") {
    let shouldHandle = false;

    if (document.hasFocus()) {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
        // Focus is inside a child iframe. The child will handle it.
        shouldHandle = false;
      } else {
        // This frame is the actually focused frame.
        shouldHandle = true;
      }
    } else {
      if (window === window.top) {
        // Top frame without focus. Acts as fallback if NO frame has focus.
        shouldHandle = true;
      } else {
        shouldHandle = false;
      }
    }

    if (shouldHandle) {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      if (selectedText.length > 0) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        // For manual trigger, we skip the Open button and just show the popup.
        initiatePopupSequence(rect, selectedText, undefined, extractImplicitContext(selection, selectedText));
      } else {
        // NEW: Trigger empty popup for questioning when no text is selected
        initiateEmptyPopupSequence();
      }
    }
  }

  // --- Issue #26: reopen the stashed (accidentally dismissed) conversation ---
  if (request.type === "reopenLastConversation") {
    // Same frame-selection rules as triggerPopup: only the actually-focused
    // frame acts, with the top frame as the no-focus fallback.
    let shouldHandle = false;
    if (document.hasFocus()) {
      shouldHandle = !(document.activeElement && document.activeElement.tagName === 'IFRAME');
    } else {
      shouldHandle = (window === window.top);
    }
    if (shouldHandle) {
      const top = activePopups[activePopups.length - 1];
      if (popupHasConversation(top)) return; // already reading something — leave it be
      if (top) removePopupInstance(top); // an empty/greeting popup makes way
      reopenLastConversationPopup();
    }
  }
});

function initiateEmptyPopupSequence() {
  const popupInstance = showPopup(0, 0, "Initializing...");
  popupInstance.sourceText = ""; 
  popupInstance.sourceWord = "Custom Question";

  chrome.storage.sync.get({ 'secretsLocalOnly': false, 'models': [], 'defaultModelId': null, 'customPrompts': [], 'defaultPromptId': null }, (syncData) => {
    if (!activePopups.includes(popupInstance)) return;

    const finalize = (models, defaultModelId) => {
      const customPrompts = syncData.customPrompts || [];
      const defaultPromptId = syncData.defaultPromptId || null;

      // The greeting stays in .messages (popupHasConversation treats a
      // talking popup as occupied) but renders as a single bare bubble.
      popupInstance.messages = [
        { role: 'assistant', content: "Hi! What would you like to ask?" }
      ];
      const greetingEl = popupInstance.popup && popupInstance.popup.querySelector('#ai-popup-content');
      if (greetingEl) {
        greetingEl.innerHTML = '';
        greetingEl.insertAdjacentHTML('beforeend', `<div>${renderMarkdownHtml("Hi! What would you like to ask?")}</div>`);
      }

      if (models && models.length > 0) {
        popupInstance.models = models;
        createSelectors(popupInstance, models, customPrompts, defaultModelId, null, "Custom Question", defaultPromptId);
        // The typed question fans out through the compare slider; only the
        // follow-up box (with its mic) is needed up front.
        createFollowupInput(popupInstance, "Custom Question");

        // One-tap resume for the last dismissed conversation (Issue #26):
        // shown only when there is actually something to restore. The
        // greeting popup itself stashes nothing (no model ever answered), so
        // making way for the restore can never overwrite the saved thread.
        chrome.runtime.sendMessage({ type: 'getLastConversation' }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.payload) return;
          if (!activePopups.includes(popupInstance)) return;
          const contentEl = popupInstance.popup.querySelector('#ai-popup-content');
          if (!contentEl) return;
          const restoreBtn = document.createElement('button');
          restoreBtn.type = 'button';
          restoreBtn.className = 'ai-popup-button ai-popup-restore-btn';
          restoreBtn.innerHTML = iconSvg('refresh', 13) + '<span>Open last conversation</span>';
          restoreBtn.title = 'Reopen the conversation that was closed';
          restoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            restoreBtn.disabled = true;
            removePopupInstance(popupInstance);
            reopenLastConversationPopup();
          });
          contentEl.appendChild(restoreBtn);
        });
      } else {
        // No models: keep the greeting and the action row; a typed question
        // lands on the setup error instead of being silently swallowed.
        const defaultModelName = 'Unknown Model';
        createActionButtons(popupInstance, "Custom Question", "Conversation started from hotkey.", defaultModelName, "Default");
      }

      adjustPopupPosition(popupInstance, null);

      setTimeout(() => {
        const input = popupInstance.popup.querySelector('#ai-popup-followup-input');
        if (input) input.focus();
      }, 100);
    };

    if (syncData.secretsLocalOnly) {
      chrome.storage.local.get(['models', 'defaultModelId'], (localData) => {
        if (!activePopups.includes(popupInstance)) return;
        finalize(localData.models || [], localData.defaultModelId || null);
      });
    } else {
      finalize(syncData.models || [], syncData.defaultModelId || null);
    }
  });
}

// Source attribution for saved history entries. Inside the custom PDF
// viewer this content script runs on the extension's own page, so
// location.href/document.title describe the viewer chrome — not the
// document. Record the original PDF instead; its URL arrives as the
// ?file= query parameter.
function collectSourceMetadata() {
  let sourceUrl = window.location.href;
  let sourceTitle = document.title;
  if (window.location.pathname.includes('custom-viewer.html')) {
    const pdfUrl = new URLSearchParams(window.location.search).get('file');
    if (pdfUrl) {
      sourceUrl = pdfUrl;
      try {
        // Label the entry by the PDF's filename. Prefer a "*.pdf"
        // segment (path first, then query values) so endpoint URLs
        // like /getdoc?id=…&name=thesis.pdf still get a human label;
        // otherwise the last path segment. Falls back on odd URLs.
        // Each candidate is decoded exactly once — pathname segments
        // need explicit decoding while searchParams values arrive
        // already decoded, so a blanket second pass threw on names
        // containing a literal '%' ("Report 50% Final") and collapsed
        // the whole title to 'PDF document'.
        const url = new URL(pdfUrl, window.location.href);
        const safeDecode = (s) => {
          try { return decodeURIComponent(s); } catch { return s; }
        };
        const label = url.pathname.split('/')
          .map(safeDecode)
          .filter(seg => /\.pdf$/i.test(seg)).pop()
          || [...url.searchParams.values()].find(v => /\.pdf$/i.test(v))
          || safeDecode(url.pathname.split('/').pop());
        sourceTitle = label || 'PDF document';
      } catch {
        sourceTitle = 'PDF document';
      }
    }
  }
  return { sourceUrl, sourceTitle };
}

// --- NEW: Function to show intermediate 'Open' button ---
function showOpenButtonPopup(rect, selectedText, implicitContext) {
  ensurePopupFontsInjected();
  const popupContainer = document.createElement('div');
  popupContainer.style.all = 'initial';
  popupContainer.style.position = 'fixed';
  popupContainer.style.top = '0';
  popupContainer.style.left = '0';
  popupContainer.style.width = '0';
  popupContainer.style.height = '0';
  popupContainer.style.zIndex = (baseZIndex + activePopups.length).toString();
  popupContainer.style.pointerEvents = 'none';
  applyThemeToPopupContainer(popupContainer, currentUiTheme);

  const shadow = popupContainer.attachShadow({ mode: 'open' });

  const styleTag = document.createElement('style');
  styleTag.textContent = popupStyles;
  shadow.appendChild(styleTag);

  const buttonGroup = document.createElement('div');
  buttonGroup.id = 'ai-open-button-group';

  // Position it a bit above the selection if possible
  const topPos = rect.top >= 40 ? rect.top - 40 : rect.bottom + 10;
  buttonGroup.style.left = `${rect.left}px`;
  buttonGroup.style.top = `${topPos}px`;

  const openBtn = document.createElement('button');
  openBtn.id = 'ai-open-button-popup';
  openBtn.textContent = 'Ask AI';
  openBtn.title = 'Explain the selection with AI';

  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removePopupInstance(instance);
    initiatePopupSequence(rect, selectedText, undefined, implicitContext);
  });

  // One-click clip: save the raw selection to history without calling any
  // model. The full text is stored; the history view clamps it for display,
  // and its "Explain" action can turn it into a real definition later.
  const clipBtn = document.createElement('button');
  clipBtn.id = 'ai-clip-button-popup';
  clipBtn.title = 'Clip: save the selection to history (no AI call)';
  clipBtn.innerHTML = iconSvg('bookmark', 15);
  clipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clipBtn.disabled = true;

    const finish = (label) => {
      clipBtn.innerHTML = iconSvg(label === 'duplicate' ? 'bookmark' : 'check', 15);
      clipBtn.title = label === 'duplicate' ? 'Already clipped' : 'Clipped to history';
      setTimeout(() => removePopupInstance(instance), 900);
    };

    const { sourceUrl, sourceTitle } = collectSourceMetadata();
    chrome.runtime.sendMessage({
      type: 'saveClip',
      text: selectedText,
      sourceUrl: sourceUrl,
      sourceTitle: sourceTitle,
      context: implicitContext || null
    }, (response) => {
      if (chrome.runtime.lastError) {
        clipBtn.innerHTML = iconSvg('xCircle', 15);
        clipBtn.title = 'Clip failed — please try again';
        clipBtn.disabled = false;
        console.error('Clip save failed:', chrome.runtime.lastError.message);
        return;
      }
      finish(response && response.status === 'duplicate' ? 'duplicate' : 'saved');
    });
  });

  buttonGroup.append(openBtn, clipBtn);
  shadow.appendChild(buttonGroup);
  document.documentElement.appendChild(popupContainer);

  const instance = {
    container: popupContainer,
    popup: buttonGroup,
    shadow: shadow,
    isInteracting: false,
    isClickInside: false,
    messages: [],
    sourceText: selectedText // prevents duplicate triggers
  };

  activePopups.push(instance);
  return instance;
}

// --- NEW: Helper to start the popup logic (extracted from mouseup) ---
function initiatePopupSequence(rect, selectedText, customPrompt, implicitContext) {
  // A second selection while a request is still running used to leave another
  // loading card on the page. Keep normal stacked conversations, but replace
  // an unfinished request so the UI never accumulates stuck loaders.
  const loadingPopup = activePopups.find(instance => instance.isLoading);
  if (loadingPopup) {
    removePopupInstance(loadingPopup);
  }

  // Create a new popup instance
  // Note: we track the instance object to manage its state updates
  const initialQuote = initLoadingQuote();
  const popupInstance = showPopup(rect.left, rect.top, initialQuote);
  popupInstance.isLoading = true;
  popupInstance.quoteIndex = LOADING_QUOTES.indexOf(initialQuote);
  startLoadingQuoteRotation(popupInstance);

  // --- NEW: Store the source text to prevent duplicate triggers ---
  popupInstance.sourceText = selectedText;

  // Implicit context (surrounding sentence + page title) rides along on
  // every request this popup makes — initial lookup, redefine, follow-ups,
  // retries, and Hallucination Guard verification all reuse the instance
  // copy captured at selection time.
  popupInstance.implicitContext = implicitContext || null;

  // --- Always-on compare (Issue #27) ---
  // Every lookup answers through the horizontal compare slider: the default
  // model and the one after it respond immediately, further models join when
  // their card is slid to. Models live in sync storage, or in local storage
  // while the local-only API-key mode is on — the same split the empty
  // hotkey popup uses. With no models configured the popup renders the
  // setup error below instead of asking anyone.
  chrome.storage.sync.get({ secretsLocalOnly: false, models: [], defaultModelId: null, customPrompts: [], defaultPromptId: null }, (syncData) => {
    if (!activePopups.includes(popupInstance)) return;

    const begin = (models, prompts, defaultModelId) => {
      if (!activePopups.includes(popupInstance)) return;
      if (models.length > 0) {
        popupInstance.models = models;
        createSelectors(popupInstance, models, prompts, defaultModelId, null, selectedText, syncData.defaultPromptId || null);
        startCompareLookup(popupInstance, selectedText, null);
        adjustPopupPosition(popupInstance, rect);
      } else {
        showModelsNotConfiguredError();
      }
    };

    // Only models/defaultModelId are secret-bearing; custom prompts and
    // the default prompt id are ordinary sync data (same split the empty
    // hotkey popup uses), so they come from syncData above.
    const readCurrentModels = (cb) => {
      if (syncData.secretsLocalOnly) {
        chrome.storage.local.get(['models', 'defaultModelId'], (localData) => {
          if (!activePopups.includes(popupInstance)) return;
          cb(localData.models || [], localData.defaultModelId || null);
        });
      } else {
        cb(syncData.models || [], syncData.defaultModelId || null);
      }
    };

    // No models configured: the background would only refuse, so the popup
    // renders the setup error itself. Reload re-checks storage — models
    // configured in the meantime upgrade this popup into a compare lookup.
    function showModelsNotConfiguredError() {
      stopLoadingQuoteRotation(popupInstance);
      popupInstance.isLoading = false;

      const contentEl = popupInstance.popup && popupInstance.popup.querySelector('#ai-popup-content');
      if (!contentEl) return;

      const errorId = 'error-' + Date.now();
      const errorText = 'Error: No default AI model configured. Please set one in the options page.';
      popupInstance.messages = [{ role: 'assistant', content: errorText, isError: true }];
      contentEl.innerHTML = '';
      contentEl.insertAdjacentHTML('beforeend',
        `<div class="ai-chat-row ai-chat-row-ai"><span class="ai-chat-icon">${iconSvg('sparkles', 13)}</span>` +
        `<div class="ai-chat-text"><span class="ai-popup-error-text">${errorText}</span> ` +
        `<button id="${errorId}-retry" class="ai-popup-retry-btn ai-popup-error-reload">Reload</button></div></div>`);
      adjustPopupPosition(popupInstance, rect);

      setTimeout(() => {
        const retryBtn = popupInstance.popup && popupInstance.popup.querySelector(`#${errorId}-retry`);
        if (!retryBtn) return;
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.target.textContent = "Working...";
          e.target.style.opacity = "0.7";
          e.target.style.cursor = "wait";
          readCurrentModels((models, defaultModelId) => begin(models, syncData.customPrompts || [], defaultModelId));
        });
      }, 0);
    }

    readCurrentModels((models, defaultModelId) => begin(models, syncData.customPrompts || [], defaultModelId));
  });
}


// --- Mousedown listener ---
document.addEventListener('mousedown', (event) => {
  // Check interaction for ALL popups
  let clickedInsideAny = false;

  activePopups.forEach(instance => {
    if (instance.container && instance.container.shadowRoot) {
      const path = event.composedPath();
      // Check if click path includes the shadow root's content
      if (path.includes(instance.container)) {
        instance.isClickInside = true;
        // instance.isInteracting = true; // Dropped this as it sticks. 
        clickedInsideAny = true;
      } else {
        instance.isClickInside = false;
      }
    }
  });

  if (!clickedInsideAny) {
    // Click was outside ALL active popups
    // Close ALL popups
    removeAllPopups();
  }
});

// --- Keydown listener ---
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (activePopups.length > 0) {
      // Close the most recently added popup (top-most)
      removeLastPopup();
    }
  }
});

// Ctrl+S saves the top-most popup's conversation as a PDF — the same action
// as the popup's Save-as-PDF button. While ANY popup is open the shortcut
// belongs to the popup (even mid-answer, so the browser's Save-Page-As
// dialog never surprises); with no popup open it falls through to the
// browser. Bound on BOTH window and document in the capture phase so no
// page-level handler can swallow it first; event.code (the physical key)
// keeps it working on non-QWERTY layouts.
function handlePopupSaveShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.code !== 'KeyS') return;
  if (event.repeat) return;
  if (activePopups.length === 0) return;
  const top = activePopups[activePopups.length - 1];
  event.preventDefault();
  event.stopImmediatePropagation();
  // Compare popups keep no single conversation: export the card on screen.
  if (top.compareSlots && top.compareSlots.length > 0) {
    const slot = top.compareSlots[top.compareIndex || 0];
    const answer = slot && latestCompareAnswer(slot);
    if (!answer) {
      showPopupToast(top, 'Nothing to save yet — wait for the answer');
      return;
    }
    saveConversationAsPdf(top, slot.messages, slot.answerModelName || slot.modelName);
    return;
  }
  const hasAnswer = top.messages && top.messages.some(m => m.role === 'assistant' && !m.isThinking && !m.isError);
  if (!hasAnswer) {
    showPopupToast(top, 'Nothing to save yet — wait for the answer');
    return;
  }
  saveConversationAsPdf(top);
}
window.addEventListener('keydown', handlePopupSaveShortcut, true);
document.addEventListener('keydown', handlePopupSaveShortcut, true);

// --- Issue #26: stash conversations when the page goes away ---
// Outside clicks and Escape funnel through the removal functions above, but
// navigation and tab close bypass them. pagehide fires in all those cases
// (and on bfcache suspend); the stash write is best-effort.
window.addEventListener('pagehide', () => {
  activePopups.forEach(instance => {
    if (!instance.isPinned) stashConversationFromPopup(instance);
  });
});

// MV3 service workers are idle-killed ~30s after their last event. A popup
// that outlives its answer (reading, follow-ups, then Save) would otherwise
// pay a cold-start wake on its next message — most visibly the dead air
// between clicking Save and the print dialog appearing. While any popup is
// open, a tiny ping every 20s keeps the worker warm; with no popups the
// interval is a no-op.
setInterval(() => {
  if (activePopups.length === 0) return;
  chrome.runtime.sendMessage({ type: "keepAlivePing" }, () => { void chrome.runtime.lastError; });
}, 20000);

// --- Motivational Loading Quotes ---
const LOADING_QUOTES = [
  "We're almost there...",
  "Great things take time...",
  "Connecting the dots...",
  "Gathering insights for you...",
  "Patience brings the best results...",
  "Brewing up knowledge...",
  "Distilling wisdom...",
  "Crafting a thoughtful response...",
  "Hang tight, magic in progress...",
  "Putting the pieces together...",
  "Analyzing and synthesizing...",
  "Almost ready for you...",
  "Unlocking fresh insights...",
  "Every second brings us closer...",
  "Good things come to those who wait...",
  "Formulating the explanation...",
  "Exploring the knowledge base...",
  "Polishing the final thoughts...",
  "Consulting the digital oracle...",
  "Curating the best answer...",
  "Thinking deeply for you...",
  "Assembling the right words...",
  "Illuminating the details...",
  "Synthesizing the concepts..."
];

// Returns a random quote when initializing, or advances sequentially on each tick
function getNextLoadingQuote(instance) {
  if (!instance) {
    return LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)];
  }
  if (typeof instance.quoteIndex !== 'number') {
    instance.quoteIndex = Math.floor(Math.random() * LOADING_QUOTES.length);
  } else {
    instance.quoteIndex = (instance.quoteIndex + 1) % LOADING_QUOTES.length;
  }
  return LOADING_QUOTES[instance.quoteIndex];
}

// Resets/picks a random starting quote for a new request on this instance
function initLoadingQuote(instance) {
  const randIdx = Math.floor(Math.random() * LOADING_QUOTES.length);
  if (instance) {
    instance.quoteIndex = randIdx;
  }
  return LOADING_QUOTES[randIdx];
}

function startLoadingQuoteRotation(instance) {
  if (!instance) return;
  if (instance.loadingQuoteTimer) return;

  if (typeof instance.quoteIndex !== 'number') {
    instance.quoteIndex = Math.floor(Math.random() * LOADING_QUOTES.length);
  }

  instance.loadingQuoteTimer = setInterval(() => {
    if (!activePopups.includes(instance) || !instance.container || !instance.container.isConnected) {
      stopLoadingQuoteRotation(instance);
      return;
    }

    const shadow = instance.shadow || instance.container?.shadowRoot;
    if (!shadow) {
      stopLoadingQuoteRotation(instance);
      return;
    }

    const labelEls = shadow.querySelectorAll('.ai-popup-loading-text');
    if (!labelEls || labelEls.length === 0) {
      stopLoadingQuoteRotation(instance);
      return;
    }

    const nextQuote = getNextLoadingQuote(instance);
    labelEls.forEach(el => {
      el.textContent = nextQuote;
    });
  }, 1000);
}

function stopLoadingQuoteRotation(instance) {
  if (instance && instance.loadingQuoteTimer) {
    clearInterval(instance.loadingQuoteTimer);
    instance.loadingQuoteTimer = null;
  }
}

// --- Response watchdogs ---
// The background bounds every provider stream, but anything that leaves the
// sendMessage callback uninvoked forever (a service worker dying mid-request,
// a stuck pipeline) would spin the popup on loading quotes indefinitely.
// Every AI fetch arms one watchdog: the callback settles it, and a fired
// watchdog takes over the UI so a late real response is ignored. Deltas
// intentionally do not reset the clock — the budget is sized for a full
// fallback chain of slow-but-alive streams.
const AI_REQUEST_WATCHDOG_MS = 180000;

function createResponseWatchdog(onTimeout) {
  let settled = false;
  let timedOut = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    timedOut = true;
    try {
      onTimeout();
    } catch (e) {
      console.error('[AI Popup] watchdog handler failed:', e);
    }
  }, AI_REQUEST_WATCHDOG_MS);
  return {
    done: () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
      }
    },
    // True only when the TIMEOUT took over the UI — never merely because
    // the response arrived and settled the watchdog.
    fired: () => timedOut
  };
}

// --- Streaming answer display ---
// The background service worker streams answer deltas on a separate
// tab-targeted message channel (sendResponse is one-shot). Callers register
// the popup message slot that is currently the thinking placeholder; the
// first delta converts it in place into a live streaming message, so the
// surrounding conversation (and every existing completed-state behavior)
// is untouched. The final sendResponse still rebuilds the messages
// authoritatively, which also cleans up any half-rendered markdown.
const activeStreamHandlers = new Map();

// Optional renderFn: compare mode (Issue #27) runs several streams at once and
// repaints its own sectioned view instead of the linear conversation.
function trackAiStream(instance, locateStreamingSlot, renderFn) {
  const requestId = 'sr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  let renderScheduled = false;

  activeStreamHandlers.set(requestId, {
    instance: instance,
    handle: (msg) => {
    if (!activePopups.includes(instance)) {
      activeStreamHandlers.delete(requestId);
      return;
    }
    const target = locateStreamingSlot();
    if (!target || target.isError) return;

    if (msg.standby) {
      // The background's model fallback chain lost a model (4xx, timeout,
      // network). Swap the possibly-partial streamed answer back into the
      // animated thinking state, labeled with what happened, while the next
      // model in the chain is tried.
      target.isStreaming = false;
      target.isStatus = false;
      target.isThinking = true;
      const who = typeof msg.failedName === 'string' && msg.failedName ? msg.failedName : 'Model';
      target.content = `${who} didn't respond — trying next model…`;
    } else {

    if (msg.reset || !target.isStreaming) {
      // First visible token of a pass: retire the thinking placeholder and
      // start streaming into the same slot. `reset` handles the web-search
      // orchestrator re-asking the model — its earlier partial text (if any)
      // must not be glued onto the final answer.
      target.isThinking = false;
      target.isStatus = false;
      target.isStreaming = true;
      target.content = '';
    }
    if (typeof msg.delta === 'string') target.content += msg.delta;
    }

    // Tokens arrive far faster than repaints are worth; render at most every
    // 80ms. The final full render happens in the sendMessage callback anyway.
    if (!renderScheduled) {
      renderScheduled = true;
      setTimeout(() => {
        renderScheduled = false;
        if (activePopups.includes(instance)) {
          if (renderFn) {
            try { renderFn(instance); } catch (e) { console.error('crash in stream render', e); }
          }
        }
      }, 80);
    }
    }
  });

  return {
    requestId: requestId,
    done: () => { activeStreamHandlers.delete(requestId); }
  };
}

// Drops any in-flight stream registration for a popup being destroyed, so a
// closed popup does not linger in the handler map (and hold its DOM) until a
// stray delta or the final sendResponse happens to arrive.
function cleanupStreamHandlersFor(instance) {
  for (const [requestId, record] of activeStreamHandlers) {
    if (record.instance === instance) activeStreamHandlers.delete(requestId);
  }
}

// --- NEW: Loading indicator markup ---
// The label is message/model text, never trusted HTML, so escape it here.
function buildLoadingHtml(label) {
  const quoteText = (label && label !== 'Loading...' && label !== 'Thinking...') ? label : getNextLoadingQuote();
  const safeLabel = String(quoteText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  return `<div class="ai-popup-loading"><span class="ai-popup-loading-dots"><span class="ai-popup-loading-dot"></span><span class="ai-popup-loading-dot"></span><span class="ai-popup-loading-dot"></span></span><span class="ai-popup-loading-text">${safeLabel}</span></div>`;
}

// --- UPDATED showPopup ---
function showPopup(x, y, content) {
  ensurePopupFontsInjected();
  // Do NOT remove existing popups. Stack them.

  // Create the isolated container
  const popupContainer = document.createElement('div');
  popupContainer.style.all = 'initial'; // Reset all inherited styles
  popupContainer.style.position = 'fixed';
  popupContainer.style.top = '0';
  popupContainer.style.left = '0';
  popupContainer.style.width = '0';
  popupContainer.style.height = '0';
  // Increment z-index for stacking
  popupContainer.style.zIndex = (baseZIndex + activePopups.length).toString();
  popupContainer.style.pointerEvents = 'none'; // Click-through wrapper
  applyThemeToPopupContainer(popupContainer, currentUiTheme);

  // Attach the shadow root
  const shadow = popupContainer.attachShadow({ mode: 'open' });

  // Inject our styles
  const styleTag = document.createElement('style');
  styleTag.textContent = popupStyles;
  shadow.appendChild(styleTag);

  // Create the popup element
  const popup = document.createElement('div');
  popup.id = 'ai-definition-popup';

  const contentWrapper = document.createElement('div');
  contentWrapper.id = 'ai-popup-content';
  contentWrapper.innerHTML = buildLoadingHtml(content); // Animated loading indicator
  popup.appendChild(contentWrapper);

  // Set initial position (viewport-relative)
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;

  // Add the popup to the shadow DOM
  shadow.appendChild(popup);

  // Add our container to the main page
  document.documentElement.appendChild(popupContainer);

  const instance = {
    container: popupContainer,
    popup: popup, // The inner div
    shadow: shadow,
    isInteracting: false,
    isClickInside: false,
    messages: [],
    showUserQuestions: false, // Default to false
    // --- Multi-model compare state (Issue #27) ---
    // The horizontal card slider IS the answer view; with no models
    // configured the popup renders a setup error instead of asking.
    compareSlots: null,      // one answer card per model while comparing
    compareGen: 0,           // fan-out generation; stale responses are dropped
    compareIndex: 0,         // which model's card is on screen
    compareWord: null,       // the word the current compare cards answer
    comparePrompt: null,     // prompt content chosen when the compare started
    compareFirstMessages: null, // opening turn for custom-question compares
    models: []               // configured models (filled by createSelectors / init)
  };

  chrome.storage.sync.get({ showUserQuestions: false }, (data) => {
    instance.showUserQuestions = data.showUserQuestions;
  });

  makePopupDraggable(instance);

  activePopups.push(instance);
  return instance;
}

// --- NEW: Drag the popup by its context header ---
// The header is created later (createSelectors), so the mousedown handler
// resolves it at drag time. Positions are clamped so at least 40px of the
// card always stays reachable on screen.
function makePopupDraggable(instance) {
  const popup = instance.popup;
  if (!popup) return;

  popup.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // left button only
    const header = popup.querySelector('#ai-popup-context');
    if (!header || !header.contains(e.target)) return;
    if (e.target.closest('button')) return;

    e.preventDefault(); // keep the page's text selection out of the drag

    const rect = popup.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Switch from the right-anchored default (adjustPopupPosition) to
    // explicit coordinates pinned at the card's current spot.
    popup.style.right = 'auto';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.top}px`;

    function onMove(ev) {
      const nx = Math.min(Math.max(ev.clientX - offsetX, 40 - rect.width), window.innerWidth - 40);
      const ny = Math.min(Math.max(ev.clientY - offsetY, 0), window.innerHeight - 40);
      popup.style.left = `${nx}px`;
      popup.style.top = `${ny}px`;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      popup.style.cursor = '';
      // Once the user placed the popup, stop auto-repositioning it.
      instance.isDragged = true;
    }

    popup.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// --- Markdown rendering (shared by the popup and the PDF export) ---
// AI responses arrive as Markdown, so render them to HTML here instead of
// leaking raw `**`, backticks and bullet markers into the UI. The text is
// HTML-escaped first and the only markup produced is what this function
// itself emits, so untrusted model output can never inject elements.
function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdownHtml(raw) {
  // NUL is the code-span placeholder marker, so it cannot appear in input.
  const text = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n').replace(/\u0000/g, '');

  // Only http(s)/mailto links are emitted; everything else (javascript:,
  // data:, ...) degrades to plain text.
  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:')
        ? parsed.href
        : null;
    } catch (err) {
      return null;
    }
  }

  // Runs on already-escaped text. Backtick spans are pulled out first (as
  // \u0000<n>\u0000 placeholders) so emphasis/link rules never touch them.
  function renderInline(escaped) {
    const codeSpans = [];
    let out = escaped.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m, ticks, body) => {
      codeSpans.push('<code>' + body.replace(/^ | $/g, '') + '</code>');
      return '\u0000' + (codeSpans.length - 1) + '\u0000';
    });

    // Underscore emphasis (__bold__, _ital_) is intentionally NOT supported:
    // this popup explains code, and rendering `__init__` or `snake_case` as
    // emphasis would corrupt the very names being explained. Asterisk and
    // tilde markers cover what models actually emit.
    out = out.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(?=\S)([^*\n]*?\S)\*/g, '<em>$1</em>');
    out = out.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

    // URL part allows one level of balanced parens (wiki links) and an
    // optional "title" suffix: [text](url "title")
    const urlPart = '([^()\\s]*(?:\\([^()]*\\)[^()\\s]*)*)(?:\\s+&quot;[\\s\\S]*?&quot;)?';
    const imageRe = new RegExp('!\\[([^\\]]*)\\]\\(' + urlPart + '\\)');
    const linkRe = new RegExp('\\[([^\\]]*)\\]\\(' + urlPart + '\\)');
    out = out.replace(imageRe, (m, alt, url) => {
      const safe = safeUrl(url);
      // `safe` is a slice of already-escaped text and URL normalization only
      // percent-encodes, so it must NOT be escaped again (double-escaping
      // would corrupt query strings like ?a=1&b=2).
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${alt || safe}</a>` : (alt || m);
    });
    out = out.replace(linkRe, (m, label, url) => {
      const safe = safeUrl(url);
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label || safe}</a>` : (label || m);
    });

    return out.replace(/\u0000(\d+)\u0000/g, (m, idx) => codeSpans[+idx]);
  }

  // Builds a (possibly nested) list starting at lines[start]; returns the
  // index of the first line after the list.
  function parseList(lines, start) {
    const stack = []; // { ordered, indent, items: [html] }

    function closeTop() {
      const list = stack.pop();
      const tag = list.ordered ? 'ol' : 'ul';
      const html = '<' + tag + '>' + list.items.map(it => '<li>' + it + '</li>').join('') + '</' + tag + '>';
      if (stack.length) {
        const parentItems = stack[stack.length - 1].items;
        parentItems[parentItems.length - 1] += html;
        return null;
      }
      return html;
    }

    let result = '';
    let i = start;
    while (i < lines.length) {
      const m = lines[i].match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
      if (m) {
        const indent = m[1].replace(/\t/g, '  ').length;
        const ordered = /\d/.test(m[2]);
        while (stack.length && (indent < stack[stack.length - 1].indent ||
               (indent === stack[stack.length - 1].indent && ordered !== stack[stack.length - 1].ordered))) {
          const html = closeTop();
          if (html !== null) result += html;
        }
        const top = stack[stack.length - 1];
        if (!top || indent >= top.indent + 2) {
          stack.push({ ordered, indent, items: [] });
        }
        let itemText = m[3];
        const checkbox = itemText.match(/^\[( |x|X)\]\s+(.*)$/);
        if (checkbox) itemText = (checkbox[1].trim() ? '☑ ' : '☐ ') + checkbox[2];
        stack[stack.length - 1].items.push(renderInline(escapeHtmlText(itemText)));
        i++;
      } else if (/^\s{0,3}(#{1,6}\s|>)/.test(lines[i]) || /^\s{0,3}-{3,}\s*$/.test(lines[i])) {
        // Headings, blockquotes and horizontal rules interrupt the list
        // instead of being swallowed into the last item.
        break;
      } else if (lines[i].trim() && stack.length) {
        // Non-list line directly under a list continues the current item.
        const stripped = lines[i].replace(/^\s+/, '');
        const items = stack[stack.length - 1].items;
        if (/^(`{3,}|~{3,})/.test(stripped)) {
          // Indented fenced code under a bullet (models do this often):
          // emit a real code block attached to the item.
          const closeRe = new RegExp('^\\s{0,3}\\' + stripped[0] + '{3,}\\s*$');
          const body = [];
          i++;
          while (i < lines.length && !closeRe.test(lines[i])) {
            body.push(lines[i]);
            i++;
          }
          i++; // past the closing fence (or EOF)
          const indents = body.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
          const common = indents.length ? Math.min(...indents) : 0;
          items[items.length - 1] += '<pre><code>' + escapeHtmlText(body.map(l => l.slice(common)).join('\n')) + '</code></pre>';
        } else {
          items[items.length - 1] += '<br>' + renderInline(escapeHtmlText(stripped));
          i++;
        }
      } else {
        break;
      }
    }
    while (stack.length) {
      const html = closeTop();
      if (html !== null) result += html;
    }
    return { html: result, next: i };
  }

  const lines = text.split('\n');
  let htmlOut = '';
  let paragraphLines = [];
  let i = 0;

  function flushParagraph() {
    if (!paragraphLines.length) return;
    htmlOut += '<p>' + paragraphLines.map(l => renderInline(escapeHtmlText(l))).join('<br>') + '</p>';
    paragraphLines = [];
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      flushParagraph();
      i++;
      continue;
    }

    // Fenced code block: content is escaped verbatim, no inline parsing.
    // The info string is anything after the fence; only its first token is
    // kept as the language class.
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      flushParagraph();
      const fenceChar = fence[1][0];
      const lang = fence[2].trim().split(/\s+/)[0] || '';
      const closeRe = new RegExp('^\\s{0,3}\\' + fenceChar + '{3,}\\s*$');
      const body = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip the closing fence when present, else step past EOF
      htmlOut += '<pre><code' + (lang ? ' class="language-' + escapeHtmlText(lang) + '"' : '') + '>' + escapeHtmlText(body.join('\n')) + '</code></pre>';
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const content = heading[2].replace(/\s+#+\s*$/, '');
      htmlOut += '<h' + level + '>' + renderInline(escapeHtmlText(content)) + '</h' + level + '>';
      i++;
      continue;
    }

    // GFM table: a header row of cells followed by a |---|---| separator.
    const isTableSep = (l) => l.includes('|') && /^\s{0,3}\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(l);
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushParagraph();
      const splitRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const aligns = splitRow(lines[i + 1]).map(c => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      const headerCells = splitRow(line);
      const alignAttr = (idx) => ` style="text-align:${aligns[idx] || 'left'}"`;
      let t = '<div class="ai-md-table-wrap"><table><thead><tr>';
      headerCells.forEach((c, idx) => { t += `<th${alignAttr(idx)}>${renderInline(escapeHtmlText(c))}</th>`; });
      t += '</tr></thead><tbody>';
      let j = i + 2;
      while (j < lines.length && lines[j].trim() && lines[j].includes('|')) {
        const cells = splitRow(lines[j]);
        t += '<tr>';
        headerCells.forEach((_, idx) => { t += `<td${alignAttr(idx)}>${renderInline(escapeHtmlText(cells[idx] ?? ''))}</td>`; });
        t += '</tr>';
        j++;
      }
      t += '</tbody></table></div>';
      htmlOut += t;
      i = j;
      continue;
    }

    if (/^\s{0,3}((-\s*){3,}|(\*\s*){3,}|(_\s*){3,})$/.test(line)) {
      flushParagraph();
      htmlOut += '<hr>';
      i++;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      flushParagraph();
      const inner = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
        inner.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
        i++;
      }
      htmlOut += '<blockquote>' + renderMarkdownHtml(inner.join('\n')) + '</blockquote>';
      continue;
    }

    const listMarker = line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+/);
    if (listMarker) {
      flushParagraph();
      const parsed = parseList(lines, i);
      htmlOut += parsed.html;
      i = parsed.next;
      continue;
    }

    paragraphLines.push(line);
    i++;
  }
  flushParagraph();

  return htmlOut;
}

// Helper: calculate absolute scroll offset for an element inside a scrolling container
function getElementScrollOffset(container, el) {
  if (!container || !el) return 0;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return Math.max(0, container.scrollTop + (elRect.top - containerRect.top));
}

// Sources are external search results, so create every element through the DOM
// rather than interpolating titles or URLs into HTML.
function appendCitations(container, citations) {
  const validCitations = citations.filter(citation => {
    if (!citation || typeof citation.url !== 'string') return false;
    try {
      const url = new URL(citation.url);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  });

  if (validCitations.length === 0) return;

  const details = document.createElement('details');
  details.className = 'ai-popup-citations';

  const summary = document.createElement('summary');
  summary.textContent = `Sources used (${validCitations.length})`;
  details.appendChild(summary);

  const list = document.createElement('ol');
  list.style.margin = '7px 0 0';
  list.style.paddingLeft = '19px';

  validCitations.forEach(citation => {
    const item = document.createElement('li');
    item.style.marginTop = '4px';

    const link = document.createElement('a');
    link.href = citation.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = citation.title || citation.domain || citation.url;
    link.addEventListener('click', event => event.stopPropagation());
    item.appendChild(link);

    const domain = document.createElement('span');
    domain.textContent = ` · ${citation.domain || new URL(citation.url).hostname}`;
    domain.style.opacity = '0.72';
    item.appendChild(domain);
    list.appendChild(item);
  });

  details.appendChild(list);
  container.appendChild(details);
}

// --- Multi-model compare mode (Issue #27) ---
// One question, every configured model, all answering at once. The popup fans
// out one getAiDefinition per model (each with its own requestId so the
// existing streaming plumbing carries every stream independently) and shows
// the answers as labeled sections. Everything a user touches stays familiar:
// one obvious follow-up box, and Save/Copy inside each answer card. A
// per-instance generation counter (compareGen) invalidates late responses
// after a re-ask or a newer fan-out.
const COMPARE_MODEL_CAP = 6;

// Fans the word out to the configured models (capped) — but LAZILY: only the
// first two cards are asked up front. Each further model is asked when the
// user slides onto its card, so a popup with six models only spends tokens
// on the models actually read.
function startCompareLookup(instance, word, customPrompt) {
  const allModels = instance.models || [];
  if (allModels.length === 0) return;
  const models = allModels.slice(0, COMPARE_MODEL_CAP);
  const gen = ++instance.compareGen;

  instance.compareWord = word;
  instance.comparePrompt = customPrompt || null;
  instance.compareFirstMessages = null; // word-lookup conversations start from the prompt
  instance.compareIndex = 0; // every new question starts on the first model's card
  instance.compareSlots = models.map(m => ({
    modelId: m.id,
    modelName: m.name,
    messages: [],
    started: false,        // lazy: false until this model is actually asked
    status: 'idle',        // idle | waiting | streaming | done | error
    settled: false,
    errorText: null,
    answerModelName: null,  // who actually answered (set from the response)
    promptName: null,
    lastRequest: null,
    bodyPinned: false
  }));

  instance.isLoading = true;
  startLoadingQuoteRotation(instance);
  renderCompareView(instance);

  // The follow-up box is shared by every section and stays locked until all
  // models finish. Create it if this popup does not have one yet (compare can
  // start before any single-model answer ever arrived).
  if (!instance.popup.querySelector('#ai-popup-followup-container')) {
    createFollowupInput(instance, word);
  }
  const followupInput = instance.popup.querySelector('#ai-popup-followup-input');
  const followupSend = instance.popup.querySelector('.ai-popup-followup-send');
  if (followupInput) followupInput.disabled = true;
  if (followupSend) followupSend.disabled = true;

  if (models.length === 1) {
    // One card, nothing to swipe to — no toast, the card is just the answer.
  } else if (allModels.length > COMPARE_MODEL_CAP) {
    showPopupToast(instance, `Comparing the first ${COMPARE_MODEL_CAP} of ${allModels.length} models — swipe for more`);
  } else {
    showPopupToast(instance, `Asking 2 models — swipe to compare more`);
  }

  // Lazy fan-out: the default model and the one after it answer immediately.
  ensureCompareSlotLoaded(instance, 0);
  ensureCompareSlotLoaded(instance, 1);
}

// Asks one model on demand (first visit of its card, or a retry elsewhere).
// A model picked up late joins the conversation at the ORIGINAL question —
// follow-ups, which only already-started models receive, append from there,
// so every card stays a coherent per-model thread.
function ensureCompareSlotLoaded(instance, index) {
  const slots = instance.compareSlots;
  if (!slots || index < 0 || index >= slots.length) return;
  const slot = slots[index];
  if (slot.started) return;

  if (instance.compareFirstMessages && slot.messages.length === 0) {
    // Custom-question popup: the opening turn is a typed question, so the
    // first ask must carry it as conversation history.
    instance.compareFirstMessages.forEach(m => slot.messages.push({ ...m }));
    issueCompareRequest(instance, instance.compareGen, slot, instance.compareWord || 'Custom Question', null, true);
  } else {
    issueCompareRequest(instance, instance.compareGen, slot, instance.compareWord, instance.comparePrompt, false);
  }
}

// Zero-models fallback for a popup that already has its follow-up box (the
// empty hotkey popup): there is nobody to ask, so the typed question gets a
// persistent setup error under the greeting. Reload re-checks storage —
// models configured in the meantime upgrade the popup straight into a
// compare fan-out of the same question.
function showSetupErrorForQuestion(instance, promptToSend, displayText) {
  const contentEl = instance.popup && instance.popup.querySelector('#ai-popup-content');
  if (!contentEl) return;

  if (instance.showUserQuestions && displayText) {
    contentEl.insertAdjacentHTML('beforeend',
      `<div class="ai-chat-row ai-chat-row-user"><div class="ai-chat-bubble">${escapeHtmlText(displayText).replace(/\n/g, '<br>')}</div></div>`);
  }

  const errorId = 'error-' + Date.now();
  const errorText = 'Error: No default AI model configured. Please set one in the options page.';
  contentEl.insertAdjacentHTML('beforeend',
    `<div class="ai-chat-row ai-chat-row-ai"><span class="ai-chat-icon">${iconSvg('sparkles', 13)}</span>` +
    `<div class="ai-chat-text"><span class="ai-popup-error-text">${errorText}</span> ` +
    `<button id="${errorId}-retry" class="ai-popup-retry-btn ai-popup-error-reload">Reload</button></div></div>`);

  setTimeout(() => {
    const retryBtn = instance.popup && instance.popup.querySelector(`#${errorId}-retry`);
    if (!retryBtn) return;
    retryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      retryBtn.textContent = "Working...";
      retryBtn.style.opacity = "0.7";
      retryBtn.style.cursor = "wait";
      chrome.storage.sync.get({ secretsLocalOnly: false, models: [], defaultModelId: null, customPrompts: [], defaultPromptId: null }, (syncData) => {
        if (!activePopups.includes(instance)) return;
        const got = (models) => {
          if (!activePopups.includes(instance)) return;
          if (models.length === 0) {
            // Still unconfigured: restore the button; the error row stays.
            retryBtn.textContent = "Reload";
            retryBtn.style.opacity = "";
            retryBtn.style.cursor = "";
            return;
          }
          instance.models = models;
          createSelectors(instance, models, syncData.customPrompts || [], syncData.defaultModelId || null, null, instance.sourceWord || 'Custom Question', syncData.defaultPromptId || null);
          runCompareFollowup(instance, promptToSend, displayText);
        };
        if (syncData.secretsLocalOnly) {
          chrome.storage.local.get(['models', 'defaultModelId'], (localData) => got(localData.models || []));
        } else {
          got(syncData.models || []);
        }
      });
    });
  }, 0);
}

// Sends the same question to every model ALREADY in the conversation. Models
// the user has not slid to yet stay idle (un-billed); they join at the
// original question whenever their card is first visited.
function runCompareFollowup(instance, promptToSend, displayText) {
  if (!instance.compareSlots || instance.compareSlots.length === 0) {
    // Compare was enabled on the empty hotkey popup: build the sections now.
    // The typed question is the OPENING turn every model must see, so it is
    // kept as the join seed for late-visited cards.
    const models = (instance.models || []).slice(0, COMPARE_MODEL_CAP);
    if (models.length === 0) {
      // No models to ask — unlock the box, say so, and leave a persistent
      // setup error under the greeting; the typed question must never be
      // silently swallowed.
      updateCompareFollowupState(instance, false);
      showPopupToast(instance, 'No models configured to compare', 'error');
      showSetupErrorForQuestion(instance, promptToSend, displayText);
      return;
    }
    instance.compareWord = instance.sourceWord || 'Custom Question';
    instance.comparePrompt = null;
    instance.compareFirstMessages = [{ role: 'user', content: promptToSend, displayContent: displayText }];
    instance.compareSlots = models.map(m => ({
      modelId: m.id, modelName: m.name, messages: [], started: false, status: 'idle',
      settled: false, errorText: null, answerModelName: null, promptName: null, lastRequest: null, bodyPinned: false
    }));
    instance.isLoading = true;
    startLoadingQuoteRotation(instance);
    renderCompareView(instance);
    ensureCompareSlotLoaded(instance, 0);
    ensureCompareSlotLoaded(instance, 1);
    return;
  }

  const activeSlots = instance.compareSlots.filter(s => s.started);
  if (activeSlots.length === 0) {
    // Unreachable in practice (slot creation always starts the first two),
    // but if it ever happens the box must unlock rather than stick disabled.
    updateCompareFollowupState(instance, false);
    return;
  }

  instance.isLoading = true;
  startLoadingQuoteRotation(instance);

  const followupId = 'fu_' + Date.now();

  activeSlots.forEach(slot => {
    slot.latestFollowupId = followupId;
    slot.pendingFollowupScroll = true;
    slot.bodyPinned = false;
    slot.messages.push({ role: 'user', content: promptToSend, displayContent: displayText, followupId: followupId });
  });
  renderCompareView(instance);

  const word = instance.compareWord || instance.sourceWord || 'Custom Question';
  activeSlots.forEach(slot => issueCompareRequest(instance, instance.compareGen, slot, word, null, true));
}

// One model's share of a fan-out: thinking placeholder, stream registration,
// watchdog, and the request itself. disableFallback keeps the answer honestly
// attributable to this slot's model. Marking the slot started here (not in
// the callers) makes "has this model been billed yet" single-sourced.
function issueCompareRequest(instance, gen, slot, word, customPrompt, isFollowup) {
  slot.started = true;
  slot.stopped = false;
  slot.lastRequest = { word: word, customPrompt: customPrompt || null, isFollowup: !!isFollowup };
  slot.status = 'streaming';
  slot.settled = false;
  slot.bodyPinned = false;
  slot.messages.push({ role: 'assistant', content: initLoadingQuote(instance), isThinking: true, followupId: slot.latestFollowupId });
  renderCompareView(instance);
  // A model just joined the conversation (late-visited card or retry): the
  // follow-up box must lock while it works, exactly as during a fan-out.
  updateCompareFollowupState(instance, false);

  // Request-scoped cancellation state (Issue #24). A slot flag alone cannot
  // guard the sendMessage callback: stop → Regenerate reuses the slot, and a
  // late response from the STOPPED request would settle the new one. The
  // closure keeps its own ref, so only the request it belongs to ignores it.
  const requestState = { requestId: null, cancelled: false };
  slot.activeRequest = requestState;

  const stream = trackAiStream(instance, () => {
    if (slot.settled || requestState.cancelled) return null;
    const msgs = slot.messages;
    const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    return (last && last.role === 'assistant') ? last : null;
  }, (inst) => renderCompareView(inst));
  requestState.requestId = stream.requestId;

  const watchdog = createResponseWatchdog(() => {
    if (!activePopups.includes(instance)) return;
    if (gen !== instance.compareGen) return;
    // Already settled (user Stop, or a Regenerate replaced this request):
    // a late timeout must not rewrite the stopped card's state.
    if (slot.settled || requestState.cancelled) return;
    settleCompareSlot(instance, slot, { error: 'The request timed out with no response.' });
  });

  const payload = {
    type: 'getAiDefinition',
    word: word,
    modelId: slot.modelId,
    requestId: stream.requestId,
    disableFallback: true,
    context: instance.implicitContext || undefined
  };
  if (isFollowup) {
    payload.messages = slot.messages.filter(m => !m.isThinking && !m.isError && !m.isStreaming);
  } else if (customPrompt) {
    payload.customPrompt = customPrompt;
  }

  chrome.runtime.sendMessage(payload, (response) => {
    watchdog.done();
    stream.done();
    if (watchdog.fired()) return; // watchdog already took over this slot
    if (!activePopups.includes(instance)) return;
    if (gen !== instance.compareGen) return; // mode switched / superseded
    if (requestState.cancelled) return; // stopped by the user (Issue #24)
    if (chrome.runtime.lastError) response = { error: chrome.runtime.lastError.message };
    settleCompareSlot(instance, slot, response);
  });
}

// Final render for one model's answer (or failure), plus the shared
// busy-state bookkeeping that gates the follow-up input.
function settleCompareSlot(instance, slot, response) {
  slot.settled = true;
  slot.activeRequest = null; // its cancel path can never matter again
  slot.messages = slot.messages.filter(m => !m.isThinking && !m.isStreaming);

  if (response && !response.error && typeof response.definition === 'string') {
    slot.status = 'done';
    slot.errorText = null;
    slot.answerModelName = response.usedModelName || slot.modelName;
    slot.promptName = response.promptName || slot.promptName;
    const assistantMsg = { role: 'assistant', content: response.definition, citations: response.citations || [], followupId: slot.latestFollowupId };
    slot.messages.push(assistantMsg);

    chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
      if (!activePopups.includes(instance)) return;
      if (guardData && guardData.enableHallucinationGuard) {
        if (response.usedWebSearch) {
          assistantMsg.searchGrounded = true;
          renderCompareView(instance);
        } else {
          const userMsgs = slot.messages.filter(m => m.role === 'user');
          const originalPrompt = userMsgs.length > 0
            ? userMsgs[userMsgs.length - 1].content
            : (instance.compareWord || instance.sourceWord || 'Definition');

          triggerCompareVerification(instance, slot, assistantMsg, originalPrompt, response.definition);
        }
      }
    });
  } else {
    slot.status = 'error';
    slot.errorText = String((response && response.error) || 'The model returned an empty response.');
  }

  renderCompareView(instance);

  // The follow-up box unlocks only when every model that was actually ASKED
  // has finished — idle (never visited) models are excluded, or the box would
  // lock forever; a late-joined still-streaming model keeps it locked.
  const slots = instance.compareSlots;
  if (slots && slots.length > 0 && slots.every(s => !s.started || s.settled)) {
    instance.isLoading = false;
    stopLoadingQuoteRotation(instance);
    updateCompareFollowupState(instance, !!(slot.lastRequest && slot.lastRequest.isFollowup));
  }
}

// Locks or unlocks the shared follow-up box from live slot state. Locked
// while any asked model is still answering, so questions can never interleave
// with a pending answer inside a model's conversation.
function updateCompareFollowupState(instance, wasFollowup) {
  if (!instance.popup) return;
  const input = instance.popup.querySelector('#ai-popup-followup-input');
  const send = instance.popup.querySelector('.ai-popup-followup-send');
  if (!input || !send) return;
  const slots = instance.compareSlots || [];
  const busy = slots.some(s => s.started && !s.settled);
  input.disabled = busy;
  send.disabled = busy;
  // While any model is answering, the mic is useless (the box is locked) and
  // Stop takes its place; idle restores the mic (Issue #24).
  const mic = instance.popup.querySelector('.ai-popup-followup-mic');
  const stop = instance.popup.querySelector('.ai-popup-followup-stop');
  if (mic) mic.style.display = busy ? 'none' : '';
  if (stop) {
    stop.style.display = busy ? '' : 'none';
    if (busy) stop.disabled = false;
  }
  if (!busy && wasFollowup) input.focus();
}

// User-initiated abort (Issue #24): kill every in-flight generation of this
// popup at once — the background request via cancelAiRequest, plus the local
// watchdog/stream registrations so nothing fires afterwards. Each slot settles
// through the normal machinery, which unlocks the follow-up box and leaves the
// conversation intact for the card's Regenerate action.
function stopCompareGeneration(instance) {
  const slots = instance.compareSlots || [];
  let stoppedAny = false;
  slots.forEach(slot => {
    if (!slot.started || slot.settled) return;
    stoppedAny = true;
    slot.stopped = true;
    const requestState = slot.activeRequest;
    if (requestState) {
      requestState.cancelled = true;
      if (requestState.requestId) {
        activeStreamHandlers.delete(requestState.requestId);
        chrome.runtime.sendMessage(
          { type: 'cancelAiRequest', requestId: requestState.requestId },
          () => { void chrome.runtime.lastError; }
        );
      }
    }
    settleCompareSlot(instance, slot, { error: 'Generation stopped.' });
  });
  if (stoppedAny) renderCompareView(instance);
}

// Re-asks only this model's last question after a failure.
function retryCompareSlot(instance, slot) {
  const info = slot.lastRequest;
  if (!info) return;
  issueCompareRequest(instance, instance.compareGen, slot, info.word, info.customPrompt, info.isFollowup);
}

function latestCompareAnswer(slot) {
  for (let i = slot.messages.length - 1; i >= 0; i--) {
    const m = slot.messages[i];
    if (m.role === 'assistant' && !m.isThinking && !m.isStreaming && !m.isError) return m;
  }
  return null;
}

// The compare view: a horizontal card slider. One model's answer fills the
// popup; the row is dragged (mouse/touch), scrolled (two-finger/trackpad
// horizontal), or driven with arrows and dots, snapping to the nearest card.
// Only each model's LATEST answer shows — earlier turns stay in the
// conversation the model sees, keeping every card a clean current answer.
function renderCompareView(instance) {
  const popup = instance.popup;
  if (!popup) return;
  const contentWrapper = popup.querySelector('#ai-popup-content');
  if (!contentWrapper || !instance.compareSlots) return;
  if (instance.compareDragActive) return; // the slider owns the pixels mid-drag

  if (!contentWrapper.classList.contains('ai-compare-mode')) {
    contentWrapper.classList.add('ai-compare-mode');
  }
  // Stream renders rebuild the card bodies every ~80ms; carry each card's
  // scroll offset across the rebuild so a reader scrolled up is never yanked.
  const oldBodies = contentWrapper.querySelectorAll('.ai-compare-card .ai-compare-body');
  if (oldBodies.length && instance.compareSlots) {
    instance.compareSlots.forEach((s, i) => {
      if (oldBodies[i]) s.bodyScrollTop = oldBodies[i].scrollTop;
    });
  }
  contentWrapper.innerHTML = '';

  // The shared action toolbar is created once and lives outside the wiped
  // content area; the guard makes repeated calls free.
  ensureCompareToolbar(instance);

  try {
    const viewport = document.createElement('div');
    viewport.className = 'ai-compare-viewport';

    const track = document.createElement('div');
    track.className = 'ai-compare-track';

    instance.compareSlots.forEach(slot => {
      const card = document.createElement('div');
      card.className = 'ai-compare-card';
      buildCompareCard(instance, card, slot);
      track.appendChild(card);
    });

    viewport.appendChild(track);
    contentWrapper.appendChild(viewport);
    const nav = buildCompareNav(instance);
    if (nav) contentWrapper.appendChild(nav);

    makeCompareSlider(instance, contentWrapper);
    applyCompareScroll(instance, false);

    // Shift to new follow-up question and followed AI output upon submission
    const cardBodies = contentWrapper.querySelectorAll('.ai-compare-card .ai-compare-body');
    instance.compareSlots.forEach((slot, i) => {
      if (slot.pendingFollowupScroll && cardBodies[i]) {
        const anchorEl = cardBodies[i].querySelector('[data-followup-anchor="true"]');
        if (anchorEl) {
          const updateScroll = () => {
            if (!cardBodies[i] || !anchorEl.isConnected) return;
            const targetOffset = Math.max(0, getElementScrollOffset(cardBodies[i], anchorEl) - 8);
            cardBodies[i].scrollTop = targetOffset;
            slot.bodyScrollTop = targetOffset;
          };
          updateScroll();
          requestAnimationFrame(updateScroll);
          slot.pendingFollowupScroll = false;
        }
      }
    });
  } catch (err) {
    console.error('Compare render crashed:', err);
    contentWrapper.insertAdjacentHTML('beforeend', '<div class="ai-popup-error-text">Error rendering answers.</div>');
  }
}

// Fills one model's card: status header, answer body (live while streaming,
// preserves reading position without pinning to bottom), and Save/Copy or Retry.
// Cards of never-visited models render a quiet "not asked yet" placeholder —
// sliding onto the card asks the model and replaces it.
function buildCompareCard(instance, card, slot) {
  // --- Card header: status dot, model name, state chip ---
  const header = document.createElement('div');
  header.className = 'ai-compare-header';

  const dot = document.createElement('span');
  dot.className = 'ai-compare-dot ' + (slot.status === 'done' ? 'done' : slot.status === 'error' ? 'error' : slot.status === 'streaming' || slot.status === 'waiting' ? 'streaming' : '');
  header.appendChild(dot);

  const name = document.createElement('span');
  name.className = 'ai-compare-model';
  name.textContent = slot.answerModelName || slot.modelName;
  name.title = name.textContent;
  header.appendChild(name);

  const status = document.createElement('span');
  status.className = 'ai-compare-status';
  if (slot.status === 'done') {
    status.classList.add('is-done');
    status.innerHTML = iconSvg('checkCircle', 12) + '<span>done</span>';
  } else if (slot.status === 'error') {
    status.classList.add('is-error');
    status.innerHTML = iconSvg('xCircle', 12) + '<span>' + (slot.stopped ? 'stopped' : 'failed') + '</span>';
  } else if (slot.status === 'streaming' || slot.status === 'waiting') {
    status.classList.add('is-busy');
    status.textContent = 'answering…';
  } else {
    status.textContent = 'not asked yet';
  }
  header.appendChild(status);
  card.appendChild(header);

  if (!slot.started) {
    const idle = document.createElement('div');
    idle.className = 'ai-compare-idle';
    idle.textContent = 'This model answers as soon as you slide to this card — it is skipped until then to save tokens.';
    card.appendChild(idle);
    return;
  }

  // --- Card body: the model's whole conversation, oldest first ---
  // Follow-up answers stack BELOW earlier ones; they never replace them.
  // The answer in progress (loading or streaming) renders at the end, and
  // a failure keeps the prior turns visible above its Retry row.
  const body = document.createElement('div');
  body.className = 'ai-compare-body';
  body.addEventListener('scroll', () => {
    // Preserve manual reading position across stream re-renders
    slot.bodyScrollTop = body.scrollTop;
  });

  appendCompareConversation(instance, body, slot);

  if (slot.status === 'error') {
    const err = document.createElement('div');
    err.className = 'ai-compare-error';
    err.textContent = slot.errorText || 'Something went wrong.';
    body.appendChild(err);
  }
  if (typeof slot.bodyScrollTop === 'number') {
    body.scrollTop = slot.bodyScrollTop;
  }
  card.appendChild(body);

  if (slot.status === 'error') {
    const retryRow = document.createElement('div');
    retryRow.className = 'ai-compare-actions';
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.innerHTML = iconSvg('refresh', 12) + '<span>' + (slot.stopped ? 'Regenerate' : 'Retry') + '</span>';
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      retryBtn.disabled = true;
      retryCompareSlot(instance, slot);
    });
    retryRow.appendChild(retryBtn);
    card.appendChild(retryRow);
    return;
  }
}

// Renders one model's conversation inside its card body: completed answers as
// separated turns, the live answer streaming at the end, the user's own
// questions only when the "Show your own questions" setting is on (echoing
// the same question on every card would be noise), and per-turn citations.
function appendCompareConversation(instance, body, slot) {
  let drewAny = false;
  let markedFollowupAnchor = false;
  slot.messages.forEach(msg => {
    if (!msg || msg.isError) return;

    const isFollowupStart = slot.latestFollowupId && msg.followupId === slot.latestFollowupId && !markedFollowupAnchor;

    if (msg.role === 'user') {
      if (!instance.showUserQuestions) return;
      const row = document.createElement('div');
      row.className = 'ai-chat-row ai-chat-row-user';
      if (isFollowupStart) {
        row.setAttribute('data-followup-anchor', 'true');
        markedFollowupAnchor = true;
      }
      const bubble = document.createElement('div');
      bubble.className = 'ai-chat-bubble';
      bubble.innerHTML = escapeHtmlText(String(msg.displayContent || msg.content || '')).replace(/\n/g, '<br>');
      row.appendChild(bubble);
      body.appendChild(row);
      drewAny = true;
      return;
    }
    if (msg.role !== 'assistant') return;

    const turn = document.createElement('div');
    turn.className = 'ai-compare-turn' + (msg.isStreaming ? ' ai-compare-turn-live' : '');
    if (isFollowupStart) {
      turn.setAttribute('data-followup-anchor', 'true');
      markedFollowupAnchor = true;
    }
    if (msg.isThinking || msg.isStatus) {
      turn.innerHTML = buildLoadingHtml(msg.content);
    } else {
      turn.innerHTML = renderMarkdownHtml(String(msg.content || ''));
      if (!msg.isStreaming && Array.isArray(msg.citations) && msg.citations.length > 0) {
        appendCitations(turn, msg.citations);
      }
      if (msg.searchGrounded) {
        appendSearchGroundedBadge(turn);
      }
      if (msg.verification) {
        appendVerificationBadge(turn, msg.verification);
      }
    }
    body.appendChild(turn);
    drewAny = true;
  });
  // Empty conversation: show the thinking placeholder only while an answer is
  // actually expected — a card that failed its FIRST question has nothing in
  // flight, and animated dots above the error would read as a contradiction.
  if (!drewAny && slot.status !== 'error') {
    body.insertAdjacentHTML('beforeend', buildLoadingHtml('Thinking...'));
  }
}

// Arrows + one dot per model; the dot doubles as that model's status light.
// Everything is a real button: clickable beats draggable for anyone
// uncomfortable with swipe gestures. With a single model configured there is
// nothing to slide — null suppresses the row.
function buildCompareNav(instance) {
  if (!instance.compareSlots || instance.compareSlots.length < 2) return null;

  const nav = document.createElement('div');
  nav.className = 'ai-compare-nav';

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'ai-compare-nav-btn ai-compare-nav-prev';
  prev.innerHTML = iconSvg('chevronLeft', 14);
  prev.title = 'Previous model';
  prev.addEventListener('click', (e) => {
    e.stopPropagation();
    slideCompareTo(instance, (instance.compareIndex || 0) - 1, true);
  });

  const dots = document.createElement('span');
  dots.className = 'ai-compare-dots';
  instance.compareSlots.forEach((slot, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'ai-compare-dotnav';
    d.title = `${slot.modelName} — ${slot.status === 'done' ? 'answered' : slot.status === 'error' ? 'failed' : slot.started ? 'answering…' : 'not asked yet'}`;
    d.addEventListener('click', (e) => {
      e.stopPropagation();
      slideCompareTo(instance, i, true);
    });
    dots.appendChild(d);
  });

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'ai-compare-nav-btn ai-compare-nav-next';
  next.innerHTML = iconSvg('chevronRight', 14);
  next.title = 'Next model';
  next.addEventListener('click', (e) => {
    e.stopPropagation();
    slideCompareTo(instance, (instance.compareIndex || 0) + 1, true);
  });

  const counter = document.createElement('span');
  counter.className = 'ai-compare-counter';
  counter.setAttribute('aria-hidden', 'true');
  counter.textContent = `${(instance.compareIndex || 0) + 1} / ${instance.compareSlots.length}`;

  nav.appendChild(prev);
  nav.appendChild(dots);
  nav.appendChild(counter);
  nav.appendChild(next);
  return nav;
}

function slideCompareTo(instance, index, animate) {
  if (!instance.compareSlots || instance.compareSlots.length === 0) return;
  const n = instance.compareSlots.length;
  instance.compareIndex = Math.max(0, Math.min(index, n - 1));
  applyCompareScroll(instance, animate);
}

// Positions the track on the current card and refreshes arrows/dots/counter.
// Landing on a card is the lazy-load trigger: that model is asked now if it
// has not been asked yet — and ONLY that model. No lookahead beyond the
// opening pair: sliding must never bill a model the user has not moved to.
function applyCompareScroll(instance, animate) {
  const popup = instance.popup;
  if (!popup) return;
  const viewport = popup.querySelector('.ai-compare-viewport');
  const track = popup.querySelector('.ai-compare-track');
  if (!viewport || !track || !instance.compareSlots) return;
  const n = instance.compareSlots.length;
  instance.compareIndex = Math.max(0, Math.min(instance.compareIndex || 0, n - 1));
  const cardWidth = viewport.clientWidth || 1;
  track.classList.toggle('animating', !!animate);
  track.style.transform = `translateX(${-(instance.compareIndex || 0) * cardWidth}px)`;
  updateCompareNav(instance);
  ensureCompareSlotLoaded(instance, instance.compareIndex);
}

function updateCompareNav(instance) {
  const popup = instance.popup;
  if (!popup || !instance.compareSlots) return;
  const prev = popup.querySelector('.ai-compare-nav-prev');
  const next = popup.querySelector('.ai-compare-nav-next');
  const dots = popup.querySelectorAll('.ai-compare-dotnav');
  const counter = popup.querySelector('.ai-compare-counter');
  const idx = instance.compareIndex || 0;
  const n = instance.compareSlots.length;
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= n - 1;
  if (counter) counter.textContent = `${idx + 1} / ${n}`;
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === idx);
    const slot = instance.compareSlots[i];
    d.classList.toggle('done', !!slot && slot.status === 'done');
    d.classList.toggle('error', !!slot && slot.status === 'error');
  });
}

// Wires the slider gestures ONCE per popup (listeners live on the persistent
// #ai-popup-content wrapper, so compare re-renders never orphan them):
// pointer drag with rubber-banded edges and snap-to-card release, and
// horizontal wheel/two-finger scroll (vertical scrolling stays native).
function makeCompareSlider(instance, wrapper) {
  if (instance.compareSliderBound) return;
  instance.compareSliderBound = true;

  let drag = null; // { startX, base, cardWidth, track, moved, lastDx }

  wrapper.addEventListener('pointerdown', (e) => {
    if (!instance.compareSlots) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Drags start on the card itself, never on its buttons and links.
    if (e.target.closest('button, a, input, textarea, .ai-compare-actions')) return;
    // Mouse drags begin on the card CHROME (header, nav, idle/error areas)
    // only: the answer body must keep native text selection, because
    // selecting a word inside an answer to look it up again is a core flow.
    // Touch and pen swipes — where selection is long-press based — may start
    // anywhere on the card.
    if (e.pointerType === 'mouse' &&
        !e.target.closest('.ai-compare-header, .ai-compare-nav, .ai-compare-idle, .ai-compare-error')) {
      return;
    }
    const viewport = wrapper.querySelector('.ai-compare-viewport');
    const track = wrapper.querySelector('.ai-compare-track');
    if (!viewport || !track) return;
    const cardWidth = viewport.clientWidth || 1;
    track.classList.remove('animating');
    drag = {
      startX: e.clientX,
      base: -(instance.compareIndex || 0) * cardWidth,
      cardWidth: cardWidth,
      track: track,
      moved: false,
      lastDx: 0
    };
  });

  const onMove = (e) => {
    if (!drag) return;
    if (!activePopups.includes(instance)) { drag = null; instance.compareDragActive = false; return; }
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < 6) return; // still a click/scroll, not a drag
    drag.moved = true;
    drag.lastDx = dx;
    instance.compareDragActive = true;

    const n = instance.compareSlots.length;
    let t = drag.base + dx;
    // Rubber-band past either end so edges feel solid, not empty.
    if (t > 0) t *= 0.35;
    const min = -(n - 1) * drag.cardWidth;
    if (t < min) t = min + (t - min) * 0.35;
    drag.track.style.transform = `translateX(${t}px)`;
    if (e.cancelable) e.preventDefault();
  };
  window.addEventListener('pointermove', onMove, { passive: false });

  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    instance.compareDragActive = false;
    if (!d.moved) return;

    // Releasing a drag just above a link/button must not click through, but
    // only for a heartbeat — a lingering swallow would eat the user's NEXT
    // deliberate click (e.g. Save) seconds later.
    instance.compareSuppressClickUntil = Date.now() + 120;

    const threshold = Math.min(80, d.cardWidth * 0.25);
    let idx = instance.compareIndex || 0;
    if (d.lastDx < -threshold) idx += 1;
    else if (d.lastDx > threshold) idx -= 1;
    slideCompareTo(instance, idx, true);
    renderCompareView(instance); // catch up on any renders skipped mid-drag
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // The window-level listeners outlive the popup's DOM; drop them when the
  // popup is destroyed so closed popups cannot accumulate in memory.
  instance.compareSliderCleanup = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    drag = null;
  };

  wrapper.addEventListener('click', (e) => {
    if (Date.now() < (instance.compareSuppressClickUntil || 0)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  wrapper.addEventListener('wheel', (e) => {
    if (!instance.compareSlots) return;
    // Two-finger/trackpad sideways scroll drives the slider; vertical
    // scrolling inside the answer stays with the page/card.
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    if (Math.abs(e.deltaX) < 4) return;
    e.preventDefault();
    const now = Date.now();
    if (instance.compareWheelLockUntil && now < instance.compareWheelLockUntil) return;
    slideCompareTo(instance, (instance.compareIndex || 0) + (e.deltaX > 0 ? 1 : -1), true);
    // One gesture = one card: trackpads emit long event streams.
    instance.compareWheelLockUntil = now + 250;
  }, { passive: false });
}

// The compare view's shared action row: the same toolbar the single-answer
// view had (Listen, Save-as-PDF, Pin, list picker, Save), seated between the
// slider and the follow-up box. Every button resolves the card CURRENTLY on
// screen at click time, so one row serves all models and the cards
// themselves carry nothing but the answer.
function ensureCompareToolbar(instance) {
  const popup = instance.popup;
  if (!popup) return;
  if (popup.querySelector('.ai-popup-actions.ai-compare-actions-row')) return;
  if (instance.compareToolbarPending) return; // a build is already in flight
  instance.compareToolbarPending = true;

  chrome.runtime.sendMessage({ type: 'getWordLists' }, (response) => {
    instance.compareToolbarPending = false;
    if (!activePopups.includes(instance)) return;
    if (popup.querySelector('.ai-popup-actions.ai-compare-actions-row')) return;

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'ai-popup-actions ai-compare-actions-row';

    const mount = () => {
      // Seat the toolbar between the answer slider and the follow-up input.
      const followup = popup.querySelector('#ai-popup-followup-container');
      if (followup) popup.insertBefore(actionsContainer, followup);
      else popup.appendChild(actionsContainer);
    };

    if (!response || !response.lists || response.lists.length === 0) {
      // No lists yet: keep every other control alive, only saving is gated.
      const hint = document.createElement('span');
      hint.textContent = 'Create a list in Settings to enable Save.';
      hint.style.opacity = '0.8';
      hint.style.fontSize = '13px';
      actionsContainer.appendChild(hint);
      mount();
      return;
    }

    const lists = response.lists;
    const validListId = lists.some(l => l.id === response.lastUsedListId)
      ? response.lastUsedListId
      : lists[0].id;

    // Target resolution happens at CLICK time: the toolbar follows whatever
    // card the user slid to, without rebuilding on every render.
    const visibleSlot = () => (instance.compareSlots || [])[instance.compareIndex || 0] || null;
    const visibleAnswer = () => {
      const slot = visibleSlot();
      return slot ? latestCompareAnswer(slot) : null;
    };
    const saveWordFor = (slot) => {
      let wordToSave = instance.compareWord;
      if (!wordToSave || wordToSave === 'Custom Question') {
        const lastUser = slot.messages.filter(m => m.role === 'user').pop();
        wordToSave = (lastUser && (lastUser.displayContent || lastUser.content)) || wordToSave || 'Conversation';
      }
      return wordToSave;
    };

    // --- Listen (same button id so toggleSpeech can swap its icon) ---
    const speakButton = document.createElement('button');
    speakButton.type = 'button';
    speakButton.id = 'ai-popup-speak-btn';
    speakButton.innerHTML = iconSvg('volume', 16);
    speakButton.title = 'Listen to this answer';
    speakButton.onclick = (e) => {
      e.stopPropagation();
      const answer = visibleAnswer();
      if (!answer) { showPopupToast(instance, 'Nothing to read yet'); return; }
      toggleSpeech(instance, answer.content);
    };

    // --- Save as PDF: exports the visible model's own conversation ---
    const pdfButton = document.createElement('button');
    pdfButton.type = 'button';
    pdfButton.id = 'ai-popup-pdf-btn';
    pdfButton.innerHTML = iconSvg('fileText', 16);
    pdfButton.title = 'Save this conversation as PDF';
    pdfButton.onclick = (e) => {
      e.stopPropagation();
      const slot = visibleSlot();
      const answer = slot && latestCompareAnswer(slot);
      if (!slot || !answer) { showPopupToast(instance, 'Nothing to save yet — wait for the answer'); return; }
      saveConversationAsPdf(instance, slot.messages, slot.answerModelName || slot.modelName);
    };

    // --- List picker (same component + "create new" flow as before) ---
    let listSelector;
    function recreateDropdown(listsToUse, currentVal) {
      const previousSelector = listSelector;
      listSelector = createCustomDropdown(listsToUse, currentVal, (val) => {
        if (val === "__create_new__") {
          instance.isInteracting = true;
          const newListName = prompt("Enter a name for the new list:");
          instance.isInteracting = false;
          if (newListName && newListName.trim()) {
            chrome.runtime.sendMessage({ type: "createList", listName: newListName.trim() }, (resp) => {
              if (resp && resp.success) {
                listsToUse.push(resp.newList);
                recreateDropdown(listsToUse, resp.newList.id);
              } else {
                showPopupToast(instance, "Failed to create list", 'error');
                listSelector.value = validListId;
              }
            });
          } else {
            listSelector.value = validListId;
          }
        }
      }, { showCreateNew: true });

      // On re-creation (e.g. after "Create New List"), swap the new dropdown
      // in where the old one sat. The INITIAL append happens in the ordered
      // sequence below, so the row reads icons-left, list+Save-right.
      if (previousSelector && previousSelector.parentNode) {
        listSelector.style.marginLeft = 'auto';
        previousSelector.parentNode.replaceChild(listSelector, previousSelector);
      }
    }
    recreateDropdown(lists, validListId);

    // --- Save: the visible card's answer into the chosen list ---
    const finalSaveButton = document.createElement('button');
    finalSaveButton.textContent = 'Save';
    finalSaveButton.className = 'ai-popup-button ai-popup-button-save';
    finalSaveButton.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const slot = visibleSlot();
      const answer = slot && latestCompareAnswer(slot);
      if (!slot || !answer) { showPopupToast(instance, 'Nothing to save yet — wait for the answer'); return; }

      const { sourceUrl, sourceTitle } = collectSourceMetadata();
      chrome.runtime.sendMessage({
        type: 'saveToHistory',
        word: saveWordFor(slot),
        definition: answer.content,
        listId: listSelector.value,
        modelName: slot.answerModelName || slot.modelName,
        promptName: slot.promptName || 'System Default',
        sourceUrl: sourceUrl,
        sourceTitle: sourceTitle,
        citations: answer.citations || []
      }, (saveResponse) => {
        if (!activePopups.includes(instance)) return;
        if (chrome.runtime.lastError || (saveResponse && saveResponse.status === 'error')) {
          showPopupToast(instance, 'Failed to save', 'error');
        } else {
          // Sliding to another model must leave the button usable, so the
          // confirmation is a toast rather than a permanent "Saved" state —
          // but a short lockout still swallows accidental double-clicks
          // (the single-answer flow prevented duplicates by staying disabled).
          finalSaveButton.disabled = true;
          setTimeout(() => { if (activePopups.includes(instance)) finalSaveButton.disabled = false; }, 1200);
          showPopupToast(instance, `Saved ${slot.answerModelName || slot.modelName}'s answer`);
        }
      });
    });

    actionsContainer.appendChild(speakButton);
    actionsContainer.appendChild(pdfButton);
    listSelector.style.marginLeft = 'auto';
    actionsContainer.appendChild(listSelector);
    actionsContainer.appendChild(finalSaveButton);
    mount();
  });
}

// --- Function to create the model and prompt selectors ---
function createSelectors(instance, models, prompts, currentModelId, currentPromptContent, selectedText, defaultPromptId) {
  const popup = instance.popup;
  if (!popup) return;

  // Remove existing container if present
  const existingContainer = popup.querySelector('#ai-popup-selectors-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  const existingContext = popup.querySelector('#ai-popup-context');
  if (existingContext) {
    existingContext.remove();
  }

  const activeModel = models.find(model => model.id === currentModelId) || models[0];
  const context = document.createElement('div');
  context.id = 'ai-popup-context';

  const contextCopy = document.createElement('div');
  contextCopy.className = 'ai-popup-context-copy';
  const contextQuery = document.createElement('div');
  contextQuery.className = 'ai-popup-context-query';
  contextQuery.textContent = selectedText === 'Custom Question' ? 'Ask anything' : selectedText;
  contextQuery.title = contextQuery.textContent;
  contextCopy.append(contextQuery);

  // Top-right window Pin button (stays pinned on screen)
  // Kept in the title header row (#ai-popup-context) so it reads as part of
  // the header, not a floating control. No DOM move — alignment only.
  const pinButton = document.createElement('button');
  pinButton.type = 'button';
  pinButton.id = 'ai-popup-pin-btn';
  pinButton.innerHTML = iconSvg('pin', 15);
  pinButton.title = instance.isPinned ? 'Unpin popup' : 'Pin popup on screen';
  pinButton.setAttribute('aria-label', pinButton.title);
  pinButton.setAttribute('aria-pressed', instance.isPinned ? 'true' : 'false');
  pinButton.classList.toggle('pinned', !!instance.isPinned);
  pinButton.onclick = (e) => {
    e.stopPropagation();
    instance.isPinned = !instance.isPinned;
    pinButton.classList.toggle('pinned', instance.isPinned);
    pinButton.title = instance.isPinned ? 'Unpin popup' : 'Pin popup on screen';
    pinButton.setAttribute('aria-label', pinButton.title);
    pinButton.setAttribute('aria-pressed', instance.isPinned ? 'true' : 'false');
  };

  context.append(contextCopy, pinButton);

  const container = document.createElement('div');
  container.id = 'ai-popup-selectors-container';

  // Compare mode needs the model list at toggle time; every path that builds
  // selectors passes through here, so this is the one place to cache it.
  instance.models = models;

  // --- Model Selector ---
  // Uses the themed custom dropdown (same component as the save-list picker)
  // so the open list matches the popup's design; a native <select> panel is
  // OS-drawn and cannot be styled. Value semantics are unchanged: the id of
  // the chosen model, falling back to the first model when none matches.
  let lastModelId = activeModel ? activeModel.id : undefined;
  const modelSelector = createCustomDropdown(
    models.map(model => ({ id: model.id, name: model.name })),
    lastModelId,
    (val) => {
      // Native selects fire change only for a DIFFERENT choice; re-picking the
      // current model must not redefine (which flags follow-ups for retry).
      if (val === lastModelId) return;
      lastModelId = val;
      triggerRedefine();
    },
    { direction: 'down' }
  );

  // --- Prompt Selector ---
  // Item ids are prompt CONTENT strings ('' = System Default), matching what
  // startCompareLookup expects as customPrompt — identical to the old
  // <select>, which also used content as the option value.
  let promptSelector;
  let lastPromptValue;
  if (prompts && prompts.length > 0) {
    const promptItems = [{
      id: '',
      name: defaultPromptId === 'system' ? 'System Default (Default)' : 'System Default'
    }];
    prompts.forEach(prompt => {
      promptItems.push({
        id: prompt.content,
        name: prompt.id === defaultPromptId ? `${prompt.name} (Default)` : prompt.name
      });
    });

    // Same initial-selection rules as the old <select>: explicit '' wins,
    // then a content match, then the configured default, then System Default.
    let initialPromptValue;
    if (currentPromptContent) {
      initialPromptValue = prompts.some(p => p.content === currentPromptContent) ? currentPromptContent : '';
    } else if (currentPromptContent === '') {
      initialPromptValue = '';
    } else {
      const def = defaultPromptId === 'system' ? null : prompts.find(p => p.id === defaultPromptId);
      initialPromptValue = def ? def.content : '';
    }
    lastPromptValue = initialPromptValue;

    promptSelector = createCustomDropdown(promptItems, initialPromptValue, (val) => {
      if (val === lastPromptValue) return; // change-only-on-different-choice, like native
      lastPromptValue = val;
      triggerRedefine();
    }, { direction: 'down' });
  } else {
    lastPromptValue = '';
    promptSelector = createCustomDropdown(
      [{ id: '', name: 'No Custom Prompts' }],
      '',
      null,
      { direction: 'down', disabled: true }
    );
  }

  // Keep the historical ids: follow-up sends read the live model via
  // popup.querySelector('#ai-popup-model-selector').value, and the component
  // exposes the same .value contract on its container element.
  // Wrapping in .selector-field preserves the ids and .value — the wrapper
  // is layout-only and never queried for a value.
  modelSelector.id = 'ai-popup-model-selector';
  promptSelector.id = 'ai-popup-prompt-selector';

  // P0 hierarchy: Model = primary (accent fill + zap icon), Prompt = ghost.
  // Labels disambiguate the two pills without changing value semantics.
  modelSelector.classList.add('is-model');
  promptSelector.classList.add('is-prompt');

  const addLeadingIcon = (dropdownEl, iconName, ariaLabel) => {
    const btn = dropdownEl.querySelector('.custom-select');
    if (!btn || btn.querySelector('.custom-select-leading-icon')) return;
    const icon = document.createElement('span');
    icon.className = 'custom-select-leading-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = iconSvg(iconName, 13);
    btn.prepend(icon);
    if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  };
  addLeadingIcon(modelSelector, 'zap', 'AI model');
  addLeadingIcon(promptSelector, 'messageCircle', 'Prompt style');

  const wrapWithLabel = (dropdownEl, labelText) => {
    const field = document.createElement('div');
    field.className = 'selector-field';
    const label = document.createElement('div');
    label.className = 'selector-label';
    label.textContent = labelText;
    label.setAttribute('aria-hidden', 'true');
    field.append(label, dropdownEl);
    return field;
  };

  container.appendChild(wrapWithLabel(modelSelector, 'Model'));
  container.appendChild(wrapWithLabel(promptSelector, 'Prompt'));

  // Keep the selected text and active model visible above the controls.
  popup.prepend(container);
  popup.prepend(context);

  // Helper to trigger redefine
  function triggerRedefine() {
    const newModelId = modelSelector.value;
    const newPromptContent = promptSelector.value;

    // The empty hotkey popup has no real word; "Custom Question" is a sentinel.
    // Redefining would query that literal string and wipe the conversation, so
    // only record the choice — follow-ups read the selectors live. Confirm
    // visibly, though: next to the re-querying text popups a silent switch
    // reads as a dead control.
    // In the compare view the model dropdown chooses the FIRST card: the
    // picked model answers first and the rest keep their order behind it.
    const reorderModelsFirst = (modelId) => {
      const chosen = models.find(m => m.id === modelId);
      if (chosen) instance.models = [chosen, ...models.filter(m => m.id !== modelId)];
    };

    if (selectedText === "Custom Question") {
      // The empty hotkey popup has no question yet; record the choice so the
      // next typed question fans out with this model leading.
      instance.lastModelId = newModelId;
      instance.lastModelName = models.find(m => m.id === newModelId)?.name;
      reorderModelsFirst(newModelId);
      const promptName = newPromptContent
        ? ((prompts || []).find(p => p.content === newPromptContent)?.name || 'Custom prompt')
        : 'System Default';
      showPopupToast(instance, `Next answers start with ${instance.lastModelName || 'selected model'} · ${promptName}`);
      return;
    }

    reorderModelsFirst(newModelId);
    startCompareLookup(instance, selectedText, newPromptContent);
  }
}

// --- UPDATED to accept instance ---
function createActionButtons(instance, word, definition, modelName, promptName, citations = []) {
  if (!activePopups.includes(instance)) return;
  const popup = instance.popup;

  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'ai-popup-actions';

  // Remove existing actions container to prevent duplicates
  const existingActions = popup.querySelector('.ai-popup-actions');
  if (existingActions) {
    existingActions.remove();
  }

  // --- REVISED: Immediately show list dropdown and save button ---
  // 1. Get the lists from the background
  chrome.runtime.sendMessage({ type: "getWordLists" }, (response) => {
    if (!activePopups.includes(instance)) return;

    if (!response || !response.lists || response.lists.length === 0) {
      // --- Handle case where NO lists exist ---
      // Show only a hint where the save controls would be. The popup must
      // stay open: the answer, follow-ups, and speech all still work —
      // saving is the only thing unavailable until a list exists. It
      // closes like any other popup (outside click / Escape).
      actionsContainer.innerHTML = ''; // Clear any previous content
      const errorText = document.createElement('span');
      errorText.textContent = 'Please create a list in the options page first.';
      errorText.style.opacity = '0.8';
      errorText.style.fontSize = '13px';
      actionsContainer.appendChild(errorText);
      return; // Stop execution
    }

    const lists = response.lists;
    const lastUsedListId = response.lastUsedListId; // --- NEW ---
    // A lastUsedListId whose list no longer exists (deleted in options
    // after the last save) must not reach the dropdown: no option would
    // match, the label would read "Select a list..." while the value
    // getter still returns the dead id — and Save would file the word
    // under a list no history view can show. Resolve against the real
    // lists and fall back to the first one; the next save persists the
    // corrected id (background writes lastUsedListId on every save).
    const validListId = lists.some(l => l.id === lastUsedListId)
      ? lastUsedListId
      : (lists.length ? lists[0].id : null);

    // --- NEW: SPEECH BUTTON ---
    // Real buttons (not spans) so keyboard users can reach them; the icon
    // rule already resets padding/border/background for identical looks.
    const speakButton = document.createElement('button');
    speakButton.type = 'button';
    speakButton.id = 'ai-popup-speak-btn';
    speakButton.innerHTML = iconSvg('volume', 16);
    speakButton.title = 'Listen to explanation';
    speakButton.onclick = (e) => {
      e.stopPropagation();
      toggleSpeech(instance, definition);
    };

    // --- NEW: PDF BUTTON ---
    const pdfButton = document.createElement('button');
    pdfButton.type = 'button';
    pdfButton.id = 'ai-popup-pdf-btn';
    pdfButton.innerHTML = iconSvg('fileText', 16);
    pdfButton.title = 'Save conversation as PDF';
    pdfButton.onclick = (e) => {
      e.stopPropagation();
      saveConversationAsPdf(instance);
    };

    // 2. Create list selector using Custom Dropdown Component
    let listSelector;
    function recreateDropdown(listsToUse, currentVal) {
      const previousSelector = listSelector;
      listSelector = createCustomDropdown(listsToUse, currentVal, (val) => {
        if (val === "__create_new__") {
          instance.isInteracting = true;
          const newListName = prompt("Enter a name for the new list:");
          instance.isInteracting = false;
          if (newListName && newListName.trim()) {
            chrome.runtime.sendMessage({ type: "createList", listName: newListName.trim() }, (response) => {
              if (response && response.success) {
                listsToUse.push(response.newList);
                recreateDropdown(listsToUse, response.newList.id);
              } else {
                showPopupToast(instance, "Failed to create list", 'error');
                listSelector.value = validListId;
              }
            });
          } else {
            listSelector.value = validListId;
          }
        }
      }, { showCreateNew: true });

      // On re-creation (e.g. after "Create New List"), swap the new dropdown
      // in where the old one sat. The initial append happens below, alongside
      // the other action controls, after this function has returned.
      if (previousSelector && previousSelector.parentNode) {
        listSelector.style.marginLeft = 'auto';
        previousSelector.parentNode.replaceChild(listSelector, previousSelector);
      }

      // Clicking outside a dropdown now closes it via the component's own
      // root-node listener (registered per instance), so no popup-level
      // outside-click bookkeeping is needed here.
    }

    recreateDropdown(lists, validListId);

    // 4. Create the final "Save" button
    const finalSaveButton = document.createElement('button');
    finalSaveButton.textContent = 'Save';
    finalSaveButton.className = 'ai-popup-button ai-popup-button-save';

    finalSaveButton.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const selectedListId = listSelector.value;

      let wordToSave = word;
      let definitionToSave = definition;
      let citationsToSave = citations;

      // If this was started from an empty hotkey popup, use the actual conversation instead of dummy text
      if (word === "Custom Question") {
        let foundUserMsg = false;
        for (let i = 0; i < instance.messages.length; i++) {
          if (instance.messages[i].role === 'user') {
            wordToSave = instance.messages[i].displayContent || instance.messages[i].content;
            foundUserMsg = true;
          } else if (foundUserMsg && instance.messages[i].role === 'assistant' && !instance.messages[i].isThinking && !instance.messages[i].isError) {
            definitionToSave = instance.messages[i].content;
            citationsToSave = instance.messages[i].citations || [];
          }
        }
      }

      // Source attribution for the history entry.
      const { sourceUrl, sourceTitle } = collectSourceMetadata();

      // Send message to background to save with listId
      chrome.runtime.sendMessage({
        type: "saveToHistory",
        word: wordToSave,
        definition: definitionToSave,
        listId: selectedListId,
        modelName: modelName,
        promptName: promptName,
        sourceUrl: sourceUrl,
        sourceTitle: sourceTitle,
        citations: citationsToSave
      }, (saveResponse) => {
        if (chrome.runtime.lastError || (saveResponse && saveResponse.status === 'error')) {
          console.error('Failed to save definition:', chrome.runtime.lastError || saveResponse?.error);
          // Keep the controls so the user can retry; the toast explains what happened.
          showPopupToast(instance, 'Failed to save', 'error');
        } else {
          console.log('Definition saved to list.');
          // Feedback via toast; disable Save so one popup cannot file duplicates.
          finalSaveButton.disabled = true;
          finalSaveButton.textContent = 'Saved';
          finalSaveButton.style.opacity = '0.75';
          finalSaveButton.style.cursor = 'default';
          showPopupToast(instance, 'Saved to list');
        }
      });
    });

    // 4. Add controls directly to the container: TTS & PDF on left, list & Save on right
    actionsContainer.appendChild(speakButton); // Add speaker first
    actionsContainer.appendChild(pdfButton); // Add PDF button next
    listSelector.style.marginLeft = 'auto';
    actionsContainer.appendChild(listSelector);
    actionsContainer.appendChild(finalSaveButton);
  });

  // Add the container to the popup
  popup.appendChild(actionsContainer);
  
  // --- NEW: Add Follow-up Input ---
  createFollowupInput(instance, word);
}

// STT credentials (sttApiKey, sttCustomHeaders) are secret-bearing keys that
// live in chrome.storage.local while local-only API-key mode is on (Issue #32).
// Fetch them from whichever area currently owns them, merged with the
// non-secret STT fields that always stay in sync.
function getSttSettingsWithSecrets(callback) {
  chrome.storage.sync.get({
    sttApiUrl: 'https://api.openai.com/v1/audio/transcriptions',
    sttModel: 'whisper-1',
    sttCustomFormData: '',
    secretsLocalOnly: false
  }, (base) => {
    const secretsArea = base.secretsLocalOnly ? chrome.storage.local : chrome.storage.sync;
    secretsArea.get({ sttApiKey: '', sttCustomHeaders: '' }, (secrets) => {
      callback({
        sttApiUrl: base.sttApiUrl,
        sttModel: base.sttModel,
        sttCustomFormData: base.sttCustomFormData,
        sttApiKey: secrets.sttApiKey,
        sttCustomHeaders: secrets.sttCustomHeaders
      });
    });
  });
}

// --- NEW Function to construct the follow-up input container ---
function createFollowupInput(instance, word) {
  const popup = instance.popup;
  if (!popup) return;

  // Cleanup if already exists
  const existingContainer = popup.querySelector('#ai-popup-followup-container');
  if (existingContainer) existingContainer.remove();

  const container = document.createElement('div');
  container.id = 'ai-popup-followup-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'ai-popup-followup-input';
  input.placeholder = 'Ask a follow-up question...';

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'ai-popup-followup-send';
  sendBtn.innerHTML = iconSvg('send', 13);
  sendBtn.title = 'Send question';

  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.className = 'ai-popup-followup-mic';
  micBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  micBtn.title = 'Type by speaking';

  // Abort in-flight generations (Issue #24). Hidden while idle; visibility is
  // driven by updateCompareFollowupState, which swaps it with the mic.
  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.className = 'ai-popup-followup-stop';
  stopBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  stopBtn.title = 'Stop generating';
  stopBtn.style.display = 'none';
  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    stopBtn.disabled = true;
    stopCompareGeneration(instance);
  });

  const inputWrapper = document.createElement('div');
  inputWrapper.style.position = 'relative';
  inputWrapper.style.flexGrow = '1';
  inputWrapper.style.display = 'flex';
  inputWrapper.style.alignItems = 'center';
  inputWrapper.appendChild(input);
  inputWrapper.appendChild(micBtn);
  inputWrapper.appendChild(sendBtn);
  inputWrapper.appendChild(stopBtn);

  container.appendChild(inputWrapper);
  popup.appendChild(container);

  // Interaction handlers to avoid popup closing while typing
  input.addEventListener('focus', () => { instance.isInteracting = true; });
  input.addEventListener('blur', () => { setTimeout(() => { instance.isInteracting = false; }, 200); });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Avoid triggering window hotkeys
    if (e.key === 'Escape') {
      input.blur();
      instance.isInteracting = false;
    }
    if (e.key === 'Enter') {
      submitFollowup();
    }
  });

  // --- Speech Recognition Logic ---
  let isRecording = false;
  let activeMediaRecorder = null;
  let audioChunks = [];
  let nativeRecognition = null;

  instance.stopMic = () => {
    instance.isDestroyed = true;
    if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') activeMediaRecorder.stop();
    if (nativeRecognition) nativeRecognition.stop();
    isRecording = false;
  };
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    nativeRecognition = new SpeechRecognition();
    nativeRecognition.continuous = true;
    nativeRecognition.interimResults = true;
    
    nativeRecognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add('recording');
      instance.isInteracting = true;
    };
    
    nativeRecognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove('recording');
      setTimeout(() => { instance.isInteracting = false; }, 200);
      input.focus();
    };
    
    nativeRecognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      isRecording = false;
      micBtn.classList.remove('recording');
      // Reset like onend does — the end event is not guaranteed to follow
      // an error, and a stuck flag would block closing the popup.
      setTimeout(() => { instance.isInteracting = false; }, 200);
    };
    
    nativeRecognition.onresult = (e) => {
      let finalTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        const currentValue = input.value;
        input.value = currentValue ? currentValue + ' ' + finalTranscript : finalTranscript;
      }
    };
  }

  async function startApiRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (instance.isDestroyed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      activeMediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      activeMediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      
      activeMediaRecorder.onstart = () => {
        isRecording = true;
        micBtn.classList.add('recording');
        instance.isInteracting = true;
      };
      
      activeMediaRecorder.onstop = async () => {
        isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.style.opacity = '0.5'; // Visual feedback for processing
        
        // Label the upload with the recorder's actual container type — strict
        // transcription APIs reject or mis-decode a mislabeled extension
        // (e.g. webm bytes appended as 'audio.wav'). Strip any ";codecs=..."
        // suffix so both the blob type and filename stay plain container IDs.
        const recordedType = ((activeMediaRecorder && activeMediaRecorder.mimeType) || 'audio/webm').split(';')[0].trim();
        const recordedExt = recordedType.split('/')[1] || 'webm';
        const audioBlob = new Blob(audioChunks, { type: recordedType });
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
        
        // Fetch settings and process (secrets may live in local storage — Issue #32)
        getSttSettingsWithSecrets(async (settings) => {
          // If custom headers are provided, we don't strictly require sttApiKey 
          // because the API key might be inside the custom JSON.
          if (!settings.sttApiKey && !settings.sttCustomHeaders) {
            showPopupToast(instance, "Speech-to-Text API Key is not configured", 'error');
            micBtn.style.opacity = '1';
            return;
          }
          
          const formData = new FormData();
          formData.append('file', audioBlob, `audio.${recordedExt}`);
          formData.append('model', settings.sttModel);
          
          if (settings.sttCustomFormData) {
            try {
              const customData = JSON.parse(settings.sttCustomFormData);
              for (const [key, value] of Object.entries(customData)) {
                formData.append(key, value);
              }
            } catch(e) {
              console.error("Invalid custom form data JSON", e);
            }
          }
          
          try {
            let headers = { 'Authorization': `Bearer ${settings.sttApiKey}` };
            if (settings.sttCustomHeaders) {
              try {
                headers = JSON.parse(settings.sttCustomHeaders);
              } catch(e) {
                console.error("Invalid custom headers JSON", e);
              }
            }

            const response = await fetch(settings.sttApiUrl, {
              method: 'POST',
              headers: headers,
              body: formData
            });
            
            if (!response.ok) {
              const err = await response.text();
              throw new Error(`API Error: ${response.status} ${err}`);
            }
            
            const data = await response.json();
            // Sarvam might return text differently or in a different field. Usually it's data.transcript or data.text
            // Let's handle both
            const transcribedText = data.text || data.transcript || data.transcription || '';
            if (transcribedText) {
              const currentValue = input.value;
              input.value = currentValue ? currentValue + ' ' + transcribedText : transcribedText;
            }
          } catch (error) {
            console.error("STT API Error:", error);
            showPopupToast(instance, "Failed to transcribe audio", 'error');
          } finally {
            micBtn.style.opacity = '1';
            input.focus();
            setTimeout(() => { instance.isInteracting = false; }, 200);
          }
        });
      };
      
      activeMediaRecorder.start();
    } catch (err) {
      console.error("Microphone access denied:", err);
      showPopupToast(instance, "Microphone access denied or unavailable", 'error');
    }
  }

  micBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (isRecording) {
      if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
        activeMediaRecorder.stop();
      } else if (nativeRecognition) {
        nativeRecognition.stop();
      }
      return;
    }
    
    chrome.storage.sync.get({ sttEngine: 'native' }, (items) => {
      if (instance.isDestroyed) return;
      if (items.sttEngine === 'api') {
        startApiRecording();
      } else {
        if (nativeRecognition) {
          nativeRecognition.start();
        } else {
          showPopupToast(instance, "Native speech recognition is not supported in this browser", 'error');
        }
      }
    });
  });

  sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isRecording) {
      if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') activeMediaRecorder.stop();
      if (nativeRecognition) nativeRecognition.stop();
    }
    submitFollowup();
  });

  function submitFollowup() {
    const text = input.value.trim();
    if (!text) return;

    input.value = ''; // clear
    input.disabled = true;
    sendBtn.disabled = true;

    // Fetch custom follow-up message setting and append if exists
    chrome.storage.sync.get({ followupCustomMessage: '' }, (settings) => {
      let promptToSend = text;
      if (settings.followupCustomMessage && settings.followupCustomMessage.trim() !== '') {
         promptToSend += '\n\n' + settings.followupCustomMessage;
      }

      // The question goes to every model's own conversation, rendered as
      // fresh answer cards (or a setup error when no model is configured).
      runCompareFollowup(instance, promptToSend, text);
    });
  }

}


// --- Updated remove functions ---
// Helper: safely stop any in-flight speech without throwing on pages where the
// SpeechSynthesis API is unavailable.
function stopSpeechSafely() {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
      window.speechSynthesis.cancel();
    }
  } catch (e) {
    console.warn("speechSynthesis.cancel failed:", e);
  }
}

// --- Conversation stash & reopen (Issue #26) ---
// Closing a popup (outside click, Escape, page navigation) used to discard
// the thread unless it had been saved to history first. Every close path now
// auto-stashes the compare threads to chrome.storage.session via the
// background worker, and the "Open Last Conversation" command (plus a button
// on the empty hotkey popup) rebuilds the popup from it. Session storage dies
// with the browser, so this is a resume convenience, not persistence.
const CONVO_STASH_MAX_MESSAGES_PER_SLOT = 40;

// Snapshot of a closing popup's threads, or null when there is nothing worth
// resuming (no model ever answered). Volatile state (thinking/streaming
// placeholders) is dropped; each model keeps its last N turns only.
function buildConversationStash(instance) {
  const slots = instance.compareSlots || [];
  const stashed = [];
  slots.forEach(slot => {
    if (!slot || !slot.started) return;
    const msgs = slot.messages
      .filter(m => m && !m.isThinking && !m.isStreaming && !m.isStatus && !m.isError &&
        ((m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content))
      .slice(-CONVO_STASH_MAX_MESSAGES_PER_SLOT)
      .map(m => {
        const clean = { role: m.role, content: m.content };
        if (typeof m.displayContent === 'string') clean.displayContent = m.displayContent;
        if (Array.isArray(m.citations) && m.citations.length > 0) clean.citations = m.citations;
        return clean;
      });
    if (!msgs.some(m => m.role === 'assistant')) return; // this model never answered
    stashed.push({
      modelId: slot.modelId,
      answerModelName: slot.answerModelName || slot.modelName,
      promptName: slot.promptName || null,
      messages: msgs
    });
  });
  if (stashed.length === 0) return null;
  return {
    savedAt: Date.now(),
    word: instance.compareWord || null,
    firstMessages: Array.isArray(instance.compareFirstMessages) ? instance.compareFirstMessages : null,
    index: instance.compareIndex || 0,
    slots: stashed
  };
}

// Fire-and-forget: stashing must never slow or break closing a popup.
function stashConversationFromPopup(instance) {
  let payload;
  try {
    payload = buildConversationStash(instance);
  } catch (e) {
    return;
  }
  if (!payload) return;
  try {
    chrome.runtime.sendMessage({ type: 'stashConversation', payload: payload }, () => { void chrome.runtime.lastError; });
  } catch (e) {
    // Extension context invalidated (page unloading) — nothing to do.
  }
}

// Rebuilds a popup from a stashed conversation. Only models that still exist
// (and actually answered back then) come back; returns true when at least one
// did. Restored threads open scrolled to the top and behave like any compare
// conversation — follow-ups append, Save/PDF work per card.
function restoreConversationFromStash(instance, stash, models) {
  if (!stash || !Array.isArray(stash.slots) || !models || models.length === 0) return false;
  const byId = new Map(models.map(m => [m.id, m]));
  const slots = [];
  stash.slots.forEach(s => {
    const model = byId.get(s.modelId);
    if (!model) return; // model deleted since the stash — skip its card
    const msgs = (Array.isArray(s.messages) ? s.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content);
    if (!msgs.some(m => m.role === 'assistant')) return;
    slots.push({
      modelId: model.id,
      modelName: model.name,
      messages: msgs,
      started: true,
      status: 'done',
      settled: true,
      errorText: null,
      answerModelName: s.answerModelName || model.name,
      promptName: s.promptName || null,
      lastRequest: null,
      bodyPinned: false
    });
  });
  if (slots.length === 0) return false;

  instance.compareWord = stash.word || null;
  instance.comparePrompt = null;
  instance.compareFirstMessages = Array.isArray(stash.firstMessages) ? stash.firstMessages : null;
  instance.compareSlots = slots;
  instance.compareGen = (instance.compareGen || 0) + 1; // invalidate any stale callbacks
  instance.compareIndex = Math.max(0, Math.min(stash.index || 0, slots.length - 1));
  instance.isLoading = false;

  if (!instance.popup.querySelector('#ai-popup-followup-container')) {
    createFollowupInput(instance, instance.compareWord && instance.compareWord !== 'Custom Question' ? instance.compareWord : 'Custom Question');
  }
  renderCompareView(instance);
  updateCompareFollowupState(instance, false);
  return true;
}

// Opens the stashed conversation: dedicated keyboard command, or the restore
// button on the empty hotkey popup. Falls back to the normal empty popup when
// nothing is restorable so the shortcut is never a dead key.
function reopenLastConversationPopup() {
  const popupInstance = showPopup(0, 0, 'Restoring your last conversation…');
  popupInstance.isLoading = true;

  chrome.runtime.sendMessage({ type: 'getLastConversation' }, (resp) => {
    if (chrome.runtime.lastError) resp = null;
    const stash = resp && resp.payload;

    chrome.storage.sync.get({ secretsLocalOnly: false, models: [], defaultModelId: null, customPrompts: [], defaultPromptId: null }, (syncData) => {
      const begin = (models) => {
        if (!activePopups.includes(popupInstance)) return; // closed while loading
        createSelectors(popupInstance, models, syncData.customPrompts || [], syncData.defaultModelId || null, null, (stash && stash.word) || 'Conversation', syncData.defaultPromptId || null);
        const restored = restoreConversationFromStash(popupInstance, stash, models);
        if (restored) {
          adjustPopupPosition(popupInstance, null);
          showPopupToast(popupInstance, 'Conversation restored — keep asking below');
        } else {
          // The restoring popup holds no content, so closing it stashes
          // nothing; the familiar empty popup takes over.
          removePopupInstance(popupInstance);
          initiateEmptyPopupSequence();
        }
      };
      // Only models/default-model are secret-bearing; prompts are plain sync
      // data (same split as every other popup entry point).
      if (syncData.secretsLocalOnly) {
        chrome.storage.local.get(['models', 'defaultModelId'], (localData) => {
          if (!activePopups.includes(popupInstance)) return;
          begin(localData.models || []);
        });
      } else {
        begin(syncData.models || []);
      }
    });
  });
}

// Does the given popup hold a conversation worth protecting from replacement?
function popupHasConversation(instance) {
  if (!instance) return false;
  if (instance.compareSlots && instance.compareSlots.some(s => s.messages && s.messages.length > 0)) return true;
  return !!(instance.messages && instance.messages.some(m => m.role === 'assistant' && !m.isError && !m.isThinking));
}

function removeAllPopups() {
  // Stash exactly ONE conversation — the newest that has content. Sending a
  // stash per popup would race (async sends can land out of order) and could
  // crown an older thread as "last".
  let newestWithContent = null;
  activePopups = activePopups.filter(instance => {
    if (!instance.isPinned) {
      if (buildConversationStash(instance)) newestWithContent = instance;
      stopLoadingQuoteRotation(instance);
      if (instance.compareSliderCleanup) instance.compareSliderCleanup();
      if (instance.stopMic) instance.stopMic();
      if (instance.container) instance.container.remove();
      return false; // Remove from array
    }
    return true; // Keep in array
  });
  if (newestWithContent) stashConversationFromPopup(newestWithContent);
  if (activePopups.length === 0) {
    stopSpeechSafely();
  }
}

function removeLastPopup() {
  if (activePopups.length === 0) return;
  // Find the last non-pinned popup from the end
  for (let i = activePopups.length - 1; i >= 0; i--) {
    if (!activePopups[i].isPinned) {
      const instance = activePopups.splice(i, 1)[0];
      stashConversationFromPopup(instance);
      stopLoadingQuoteRotation(instance);
      if (instance.compareSliderCleanup) instance.compareSliderCleanup();
      if (instance.stopMic) instance.stopMic();
      if (instance.container) instance.container.remove();
      break;
    }
  }
  if (activePopups.length === 0) {
    stopSpeechSafely();
  }
}

function removePopupInstance(instance) {
  const index = activePopups.indexOf(instance);
  if (index > -1) {
    activePopups.splice(index, 1);
    stashConversationFromPopup(instance);
    stopLoadingQuoteRotation(instance);
    cleanupStreamHandlersFor(instance);
    if (instance.compareSliderCleanup) instance.compareSliderCleanup();
    if (instance.stopMic) instance.stopMic();
    if (instance.container) instance.container.remove();
  }
  if (activePopups.length === 0) {
    stopSpeechSafely();
  }
}

// --- Text-to-Speech Logic (per-instance speaking state) ---

function toggleSpeech(instance, text) {
  const popup = instance.popup;
  const btn = popup.querySelector('#ai-popup-speak-btn'); // Only controls THIS popup's button

  if (instance.isSpeaking) {
    window.speechSynthesis.cancel();
    instance.isSpeaking = false;
    if (btn) btn.innerHTML = iconSvg('volume', 16);
    // Reset all buttons just in case? Or just the active one?
    // Let's reset all check to simple state
  } else {
    // Start speaking
    chrome.storage.sync.get(['ttsSettings'], (data) => {
      const settings = data.ttsSettings || { rate: 1.0, voiceURI: null };

      // Cancel any previous speech
      window.speechSynthesis.cancel();

      // Prepare text: Remove markdown for cleaner reading
      const cleanText = text.replace(/\*\*/g, '').replace(/<br>/g, ' ').replace(/\n/g, ' ');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = settings.rate;

      if (settings.voiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onend = () => {
        instance.isSpeaking = false;
        if (btn) btn.innerHTML = iconSvg('volume', 16);
      };

      utterance.onerror = (e) => {
        console.error("Speech error", e);
        instance.isSpeaking = false;
        if (btn) btn.innerHTML = iconSvg('volume', 16);
      };

      window.speechSynthesis.speak(utterance);
      instance.isSpeaking = true;
      if (btn) btn.innerHTML = iconSvg('stop', 16); // Stop icon
    });
  }
}

// --- UPDATED adjustPopupPosition ---
function adjustPopupPosition(instance, selectionRect) {
  const popup = instance.popup;
  if (!popup) return;

  // A user-dragged popup stays where they put it.
  if (instance.isDragged) return;

  if (instance.isInteracting) return;

  // Render the popup box at a fixed top right corner
  popup.style.top = '20px';
  popup.style.right = '20px';
  popup.style.left = 'auto'; // Clear out the previously set left property
}

// --- NEW: Save Conversation as PDF ---
// messagesOverride/subtitle serve the compare view: the toolbar exports the
// currently visible model's own conversation instead of instance.messages.
function saveConversationAsPdf(instance, messagesOverride, subtitle) {
  // The print pipeline is asynchronous (worker → staged payload → new tab →
  // print dialog); acknowledge the click immediately so it never feels dead.
  showPopupToast(instance, 'Opening print view…');
  const titleLine = subtitle
    ? `AI Conversation Transcript — ${escapeHtmlText(subtitle)}`
    : 'AI Conversation Transcript';
  let html = `<!DOCTYPE html><html><head><title>Conversation Backup</title>
  <style>
    body { font-family: 'Google Sans', 'Google Sans Text', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px 24px; max-width: 820px; margin: auto; line-height: 1.68; color: #1e293b; background: #ffffff; }
    .transcript-header { margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .transcript-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .transcript-logo { font-size: 13px; font-weight: 700; color: #0d9488; letter-spacing: 0.02em; }
    .transcript-badge { font-size: 11px; font-weight: 600; background: rgba(45, 212, 191, 0.15); color: #0f766e; padding: 2px 8px; border-radius: 999px; }
    .transcript-title { margin: 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
    .message { margin-bottom: 18px; padding: 18px 20px; border-radius: 16px; box-sizing: border-box; }
    .user { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; }
    .ai { background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #2dd4bf; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03); }
    .role { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 10px; border-radius: 999px; margin-bottom: 10px; }
    .user .role { background: #e2e8f0; color: #475569; }
    .ai .role { background: rgba(45, 212, 191, 0.15); color: #0d9488; }
    .message p { margin: 8px 0; font-size: 14px; }
    .message div > p:first-child { margin-top: 0; }
    .message div > p:last-child { margin-bottom: 0; }
    .message code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px 5px; color: #0f172a; }
    .message pre { background-color: #0f172a; color: #f8fafc; border-radius: 10px; padding: 14px 16px; overflow-x: auto; margin: 12px 0; }
    .message pre code { background-color: transparent; border: none; padding: 0; color: inherit; }
    .message ul, .message ol { margin: 8px 0; padding-left: 22px; }
    .message h1, .message h2, .message h3, .message h4 { margin: 14px 0 6px; line-height: 1.3; color: #0f172a; }
    .message h1 { font-size: 1.25em; } .message h2 { font-size: 1.15em; } .message h3 { font-size: 1.05em; }
    .message blockquote { margin: 10px 0; padding: 8px 14px; border-left: 3px solid #2dd4bf; background: #f8fafc; border-radius: 0 8px 8px 0; color: #475569; }
    .message table { border-collapse: separate; border-spacing: 0; margin: 12px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; width: 100%; }
    .message th, .message td { padding: 8px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
    .message th { background-color: #f1f5f9; font-weight: 600; color: #334155; }
    .message tr:last-child td { border-bottom: none; }
    .message hr { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
    @media print {
      body { max-width: 100%; padding: 0; }
      .message { page-break-inside: avoid; box-shadow: none; }
      .message pre, .message table { page-break-inside: avoid; }
    }
  </style>
  </head><body>
  <div class="transcript-header">
    <div class="transcript-brand">
      <span class="transcript-logo">AI Popup Infopedia</span>
      <span class="transcript-badge">Transcript</span>
    </div>
    <h1 class="transcript-title">${escapeHtmlText(titleLine)}</h1>
  </div>`;

  const transcript = messagesOverride || instance.messages;
  transcript.forEach(msg => {
    if (msg.isThinking || msg.isError || msg.needsRetry) return;
    const roleName = msg.role === 'user' ? 'You' : 'AI';
    const className = msg.role === 'user' ? 'user' : 'ai';
    const content = msg.displayContent || msg.content || "";

    // Markdown is rendered by our own escape-first renderer, so untrusted
    // content cannot inject markup into the printable page.
    let formattedContent = msg.role !== 'user'
      ? renderMarkdownHtml(content)
      : escapeHtmlText(content).replace(/\n/g, '<br>');

    html += `<div class="message ${className}"><div class="role">${escapeHtmlText(roleName)}</div><div>${formattedContent}</div></div>`;
  });

  // Auto-print lives INSIDE the payload because the two transports need
  // different triggers: the legacy data:-URL fallback parses this as a
  // real document, so this script is what makes it print; the modern
  // session-storage path keeps the tag inert (print.js calls
  // window.print() itself) — do not remove either side.
  html += `<script>window.onload = function() { setTimeout(function() { window.print(); }, 500); }</script></body></html>`;

  chrome.runtime.sendMessage({ type: "openPdfTab", htmlContent: html });
}

function appendSearchGroundedBadge(container) {
  const indicator = document.createElement('div');
  indicator.className = 'ai-popup-citations';
  indicator.innerHTML = `<span style="color:var(--popup-context-label);">${iconSvg('globe', 13)}</span> <strong style="color:var(--popup-context-label);">Search Grounded</strong> <span style="opacity:0.8">· Response is based on live web results. Hallucination Guard bypassed.</span>`;
  container.appendChild(indicator);
}

// Module-level twin of the transcript's escapeHtml (which is function-
// scoped there): reasoning and corrections come back from model output
// and are inlined into innerHTML below.
function escapeVerifyText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function triggerCompareVerification(instance, slot, msg, originalPrompt, aiResponse) {
  if (!instance || !instance.popup) return;
  if (!slot || !slot.messages.includes(msg)) return;

  msg.verification = { state: 'pending' };
  renderCompareView(instance);

  chrome.runtime.sendMessage({
    type: "verifyAiResponse",
    originalPrompt: originalPrompt,
    aiResponse: aiResponse,
    context: instance.implicitContext || undefined
  }, (response) => {
    if (!activePopups.includes(instance)) return;
    if (!slot.messages.includes(msg)) return;

    if (chrome.runtime.lastError || !response || response.error) {
      msg.verification = { state: 'failed' };
    } else {
      msg.verification = {
        state: response.result && response.result.is_hallucinating ? 'hallucination' : 'verified',
        reasoning: (response.result && response.result.reasoning) || '',
        corrections: Array.isArray(response.result && response.result.corrections) ? response.result.corrections.map(String) : []
      };
    }
    renderCompareView(instance);
  });
}

function appendVerificationBadge(container, verification) {
  const ind = document.createElement('div');
  ind.className = 'ai-popup-verification';

  if (verification.state === 'pending') {
    ind.className = 'ai-popup-verification pending';
    ind.innerHTML = `<span style="color:#3b82f6;">${iconSvg('shield', 13)}</span> <span style="opacity:0.8;">Verifying response...</span>`;
    container.appendChild(ind);
    return;
  }

  if (verification.state === 'failed') {
    ind.className = 'ai-popup-verification failed';
    ind.innerHTML = `<span style="color:#94a3b8;">${iconSvg('shield', 13)}</span> <span style="opacity:0.7">Verification failed or unavailable.</span>`;
    container.appendChild(ind);
    return;
  }

  // Reasoning folds via native <details> (like citations do): no toggle
  // listener wiring is needed, and the fold state is simply rebuilt on
  // every re-render.
  const reasoningHtml = verification.reasoning
    ? `<details style="margin-top: 8px; font-size: 11px; opacity: 0.9; border-top: 1px solid rgba(128,128,128,0.3); padding-top: 6px;"><summary style="cursor:pointer; text-decoration: underline; opacity: 0.7;">View reasoning</summary><div style="margin-top: 6px;"><strong>Reasoning:</strong> ${escapeVerifyText(verification.reasoning)}</div></details>`
    : '';

  if (verification.state === 'hallucination') {
    ind.className = 'ai-popup-verification hallucination';
    let correctionsHtml = '<ul style="margin:5px 0 0 20px; padding:0;">';
    verification.corrections.forEach(c => {
      correctionsHtml += `<li style="margin-bottom:3px;">${escapeVerifyText(c)}</li>`;
    });
    correctionsHtml += '</ul>';
    ind.innerHTML = `<span style="color:#ef4444;">${iconSvg('alertTriangle', 13)}</span> <strong style="color:#ef4444;">Hallucination Detected</strong>${reasoningHtml}<div>${correctionsHtml}</div>`;
  } else {
    ind.className = 'ai-popup-verification verified';
    ind.innerHTML = `<span style="color:rgba(var(--popup-accent-rgb), 1);">${iconSvg('shield', 13)}</span> <strong style="color:rgba(var(--popup-accent-rgb), 1);">Verified</strong> <span style="opacity:0.8">- No hallucinations detected.</span>${reasoningHtml}`;
  }

  container.appendChild(ind);
}


// NOTE: pdf.js annotation-EDITOR fixes (.highlightEditor/.editToolbar CSS
// plus a deselect-on-outside-click handler) were removed as dead code —
// this extension's bundled viewer renders pages manually and never
// enables pdf.js's AnnotationEditorLayer UI, so those selectors could
// never match anything.

// --- Milestone-Based Feedback Prompt Helper Functions ---
function checkAndShowFeedbackPrompt(instance) {
  if (!instance || !instance.popup) return;

  chrome.storage.local.get([
    'successfulLookupsCount',
    'feedbackPromptDismissed',
    'feedbackPromptDismissedAt'
  ], (data) => {
    if (chrome.runtime.lastError) return;

    // Guard: popup may have been closed while storage was reading
    if (!activePopups.includes(instance) || !instance.popup) return;

    const currentCount = (data.successfulLookupsCount || 0) + 1;

    // Save incremented count
    chrome.storage.local.set({ successfulLookupsCount: currentCount });

    // Dismissal check: if dismissed within 30 days, do not show
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const isDismissedRecently = data.feedbackPromptDismissed && (Date.now() - (data.feedbackPromptDismissedAt || 0) < thirtyDaysMs);
    if (isDismissedRecently) {
      return;
    }

    // Trigger condition: at 5th lookup, then every 25 lookups thereafter
    const isEligible = (currentCount === 5) || (currentCount > 5 && currentCount % 25 === 0);
    if (!isEligible) {
      return;
    }

    // Prevent duplicate banners in the same popup
    if (instance.popup.querySelector('.ai-feedback-banner')) {
      return;
    }

    renderFeedbackBanner(instance);
  });
}

function dismissFeedbackPrompt(bannerElement) {
  chrome.storage.local.set({
    feedbackPromptDismissed: true,
    feedbackPromptDismissedAt: Date.now()
  });
  if (bannerElement) {
    bannerElement.style.opacity = '0';
    bannerElement.style.transform = 'translateY(4px)';
    bannerElement.style.transition = 'all 0.2s ease';
    setTimeout(() => bannerElement.remove(), 200);
  }
}

function renderFeedbackBanner(instance) {
  const popup = instance.popup;
  if (!popup) return;

  const banner = document.createElement('div');
  banner.className = 'ai-feedback-banner';

  const showInitialView = () => {
    banner.innerHTML = `
      <div class="ai-feedback-header">
        <span>How's Infopedia working for you?</span>
        <button class="ai-feedback-close" title="Dismiss">${iconSvg('x', 13)}</button>
      </div>
      <div class="ai-feedback-actions">
        <button class="ai-feedback-btn" data-action="good">${iconSvg('thumbsUp', 13)} Working well</button>
        <button class="ai-feedback-btn" data-action="trouble">${iconSvg('thumbsDown', 13)} Something isn't working</button>
        <button class="ai-feedback-btn" data-action="feedback">${iconSvg('messageCircle', 13)} Send feedback</button>
      </div>
    `;

    banner.querySelector('.ai-feedback-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
    });

    banner.querySelector('[data-action="good"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showGoodView();
    });

    banner.querySelector('[data-action="trouble"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showTroubleView();
    });

    banner.querySelector('[data-action="feedback"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
      window.open('https://github.com/13pathak/AI-Popup-Infopedia/issues/new', '_blank');
    });
  };

  const showGoodView = () => {
    banner.innerHTML = `
      <div class="ai-feedback-header">
        <span>Glad to hear it! Thanks for using Infopedia.</span>
        <button class="ai-feedback-close" title="Dismiss">${iconSvg('x', 13)}</button>
      </div>
      <div class="ai-feedback-actions">
        <button class="ai-feedback-btn primary" data-action="review">${iconSvg('star', 13)} Optional: Leave a review on Chrome Web Store</button>
        <button class="ai-feedback-btn" data-action="dismiss">Dismiss</button>
      </div>
    `;

    banner.querySelector('.ai-feedback-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
    });

    banner.querySelector('[data-action="dismiss"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
    });

    banner.querySelector('[data-action="review"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
      window.open('https://chromewebstore.google.com/detail/ai-popup-infopedia/jejfdgeiihgomipkhjkbplikgkcjcpab/reviews', '_blank');
    });
  };

  const showTroubleView = () => {
    banner.innerHTML = `
      <div class="ai-feedback-header">
        <span>Sorry to hear that! Let us help you get it running.</span>
        <button class="ai-feedback-close" title="Dismiss">${iconSvg('x', 13)}</button>
      </div>
      <div class="ai-feedback-actions">
        <button class="ai-feedback-btn primary" data-action="troubleshoot">${iconSvg('zap', 13)} Open Troubleshooting & Support</button>
        <button class="ai-feedback-btn" data-action="dismiss">Dismiss</button>
      </div>
    `;

    banner.querySelector('.ai-feedback-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
    });

    banner.querySelector('[data-action="dismiss"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
    });

    banner.querySelector('[data-action="troubleshoot"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFeedbackPrompt(banner);
      chrome.runtime.sendMessage({ type: "openOptionsTab", tab: "support-content" });
    });
  };

  showInitialView();
  popup.appendChild(banner);
}

