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
    --popup-text-muted: #94a3b8;
    --popup-text-header: #f8fafc;
    --popup-border: rgba(125, 211, 252, 0.22);
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
    --popup-context-label: #94a3b8; /* muted: blue is reserved for links */
    --popup-role-user: #94a3b8;
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
    --popup-border: rgba(15, 23, 42, 0.12);
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
      --popup-border: rgba(15, 23, 42, 0.12);
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

  #ai-definition-popup {
    position: fixed; /* Use fixed positioning relative to the viewport */
    background: var(--popup-bg);
    color: var(--popup-text);
    border: 1px solid var(--popup-border);
    border-radius: 12px;
    padding: 18px 14px 14px 14px;
    font-family: var(--popup-font-family);
    font-size: 14px;
    line-height: 1.5;
    width: min(350px, calc(100vw - 28px));
    max-width: 350px;
    box-sizing: border-box;
    max-height: 85vh; /* Keep the popup within screen bounds */
    display: flex;
    flex-direction: column;
    box-shadow: 0 18px 42px var(--popup-shadow-1), 0 3px 12px var(--popup-shadow-2);
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
    margin-bottom: 10px;
    cursor: grab;
    user-select: none; /* the header drags the popup; text stays copyable via its tooltip */
  }
  #ai-popup-context:active { cursor: grabbing; }
  .ai-popup-context-copy { min-width: 0; }
  .ai-popup-context-label {
    color: var(--popup-context-label);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .ai-popup-context-query {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--popup-text-header);
    font-size: 17px;
    letter-spacing: -0.01em; /* tighter tracking suits the larger display size */
    font-weight: 650;
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
      padding: 7px 10px; background-color: var(--popup-field-bg);
      border: 1px solid var(--popup-field-border); border-radius: 8px;
      cursor: pointer; user-select: none; color: var(--popup-field-text);
      font-size: 13px; font-family: inherit;
  }
  .custom-select-value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  .custom-select > span:last-child { flex-shrink: 0; margin-left: 8px; }
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
      border-radius: 8px; margin-bottom: 6px; max-height: 250px; overflow-y: auto;
      z-index: 2000; display: none; box-shadow: 0 -4px 10px var(--popup-shadow-1);
      font-size: 13px; font-family: inherit;
      padding: 5px; transform-origin: bottom center;
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
  .custom-option { padding: 7px 9px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; min-width: 0; color: var(--popup-field-text); }
  .custom-option:hover { background-color: var(--popup-dropdown-hover); }
  .custom-option.selected { background-color: rgba(var(--popup-accent-rgb), 0.18); }
  .custom-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .custom-option-check { flex-shrink: 0; display: inline-flex; color: rgba(var(--popup-accent-rgb), 1); }
  .custom-select.disabled { opacity: 0.6; cursor: not-allowed; }
  .expand-toggle { cursor: pointer; display: inline-block; width: 16px; text-align: center; color: var(--popup-text-muted); font-size: 10px;}
  .expand-toggle:hover { color: var(--popup-text-header); }
  .indent-spacer { display: inline-block; width: 16px; }

  /* --- Styles for selectors --- */
  #ai-popup-selectors-container {
    display: flex;
    gap: 7px;
    margin-bottom: 12px;
  }
  /* flex-basis 0 so both rows split 50:50 no matter how long their labels are
     (flex-grow alone would size each container by its content first) */
  #ai-popup-selectors-container .custom-select-container {
    flex: 1 1 0;
    min-width: 0;
  }

  /* Wrapper for the AI-generated text */
  #ai-popup-content {
    overflow-y: auto; /* Scroll if content overflows */
    padding: 2px 5px 2px 1px; /* Spacing for the scrollbar */
    line-height: 1.62;
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
  .ai-popup-actions {
    display: flex;
    align-items: center; /* Vertically center items */
    gap: 6px;
    margin-top: 14px;
    padding: 8px;
    background: var(--popup-card-bg);
    border: none;
    border-radius: 8px;
  }

  .ai-popup-button {
    font-family: inherit;
    font-size: 14px; 
    font-weight: bold; 
    color: var(--popup-accent-btn-text);
    cursor: pointer;
    background: var(--popup-accent-btn-bg);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 8px;
    padding: 6px 11px;
    white-space: nowrap; /* Prevent wrapping */
    flex-shrink: 0; /* Prevent button from shrinking */
  }

  .ai-popup-button:hover {
    background: var(--popup-accent-btn-hover);
    transform: translateY(-1px);
  }
  .ai-popup-button:active {
    transform: translateY(0) scale(0.98);
  }

  /* SPEECH, PDF & PIN BUTTONS */
  #ai-popup-speak-btn, #ai-popup-pdf-btn, #ai-popup-pin-btn {
    width: 30px;
    height: 30px;
    padding: 0;
    font-size: 15px;
    color: var(--popup-btn-icon-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    transition: transform 140ms ease, background-color 140ms ease;
  }
  #ai-popup-speak-btn:hover, #ai-popup-pdf-btn:hover, #ai-popup-pin-btn:hover {
    color: var(--popup-btn-icon-hover);
    background: rgba(var(--popup-accent-rgb), 0.15);
    transform: translateY(-1px);
  }
  #ai-popup-speak-btn:active, #ai-popup-pdf-btn:active, #ai-popup-pin-btn:active {
    transform: translateY(0) scale(0.98);
  }
  /* Pinned state: accent-tinted instead of hardcoded teal so it tracks the theme */
  #ai-popup-pin-btn.pinned {
    color: rgba(var(--popup-accent-rgb), 1);
    opacity: 0.5;
  }

  /* --- Follow-up Prompt --- */
  #ai-popup-followup-container {
    display: flex;
    position: relative;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--popup-border);
    gap: 8px;
    align-items: center;
  }
  
  #ai-popup-followup-input {
    flex-grow: 1;
    background-color: var(--popup-field-bg);
    color: var(--popup-field-text);
    border: 1px solid var(--popup-field-border);
    border-radius: 8px;
    padding: 6px 36px 6px 10px;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  
  #ai-popup-followup-input::placeholder {
    color: var(--popup-text-muted);
  }

  .ai-popup-followup-send {
    background: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    font-weight: bold;
    font-size: 13px;
  }

  .ai-popup-followup-send:hover {
    background: var(--popup-accent-btn-hover);
  }

  /* --- Follow-up Mic Button --- */
  .ai-popup-followup-mic {
    position: absolute;
    right: 4px;
    background: transparent;
    color: var(--popup-text-muted);
    border: none;
    padding: 6px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    border-radius: 8px;
  }

  .ai-popup-followup-mic:hover {
    color: var(--popup-field-text);
    background: rgba(var(--popup-accent-rgb), 0.15);
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
    border-radius: 8px;
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
    border-radius: 8px;
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
    border-radius: 10px;
    padding: 10px 12px;
  }
  .ai-compare-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    min-width: 0;
  }
  .ai-compare-dot {
    width: 8px;
    height: 8px;
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
    font-weight: 700;
    font-size: 13px;
    color: var(--popup-text-header);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ai-compare-status {
    margin-left: auto;
    font-size: 11.5px;
    color: var(--popup-text-muted);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .ai-compare-status svg { opacity: 0.9; flex-shrink: 0; }
  .ai-compare-body {
    font-size: 13.5px;
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
  .ai-compare-body p { margin-top: 0; margin-bottom: 8px; }
  .ai-compare-body p:last-child { margin-bottom: 0; }
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
    border-radius: 7px;
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
    gap: 10px;
    padding: 9px 0 2px 0;
    user-select: none;
  }
  .ai-compare-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid var(--popup-field-border);
    background: var(--popup-field-bg);
    color: var(--popup-text);
    cursor: pointer;
    padding: 0;
  }
  .ai-compare-nav-btn:disabled { opacity: 0.35; cursor: default; }
  .ai-compare-nav-btn:not(:disabled):hover {
    border-color: rgba(var(--popup-accent-rgb), 0.6);
  }
  .ai-compare-dots {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .ai-compare-dotnav {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1px solid var(--popup-field-border);
    background: var(--popup-field-bg);
    padding: 0;
    cursor: pointer;
  }
  .ai-compare-dotnav.done { border-color: rgba(52, 211, 153, 0.8); }
  .ai-compare-dotnav.error { border-color: var(--popup-error-text); }
  .ai-compare-dotnav.active {
    width: 22px;
    border-radius: 5px;
    background: rgba(var(--popup-accent-rgb), 0.9);
    border-color: transparent;
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
  columns: '<rect x="3" y="4" width="7.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="7.5" height="16" rx="1.5"/>'
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

// When the background's model fallback chain rescued an answer, tell the
// user which models failed and who actually responded. Informational only —
// the completed-state paths already switched to the responding model's
// metadata, this just prevents the success from looking unconditional.
function notifyModelFallback(instance, response) {
  if (!response || !Array.isArray(response.fallbackFailedModels) || response.fallbackFailedModels.length === 0) return;
  const failed = response.fallbackFailedModels.join(', ');
  const answered = response.usedModelName || 'another model';
  showPopupToast(instance, `${failed} failed — answered by ${answered}`);
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
        // For manual trigger, we can skip the Open button and just show the popup.
        initiatePopupSequence(rect, selectedText, undefined, extractImplicitContext(selection, selectedText));
      } else {
        // NEW: Trigger empty popup for questioning when no text is selected
        initiateEmptyPopupSequence();
      }
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

      popupInstance.messages = [
        { role: 'assistant', content: "Hi! What would you like to ask?" }
      ];
      renderMessages(popupInstance);

      if (models && models.length > 0) {
        popupInstance.models = models;
        createSelectors(popupInstance, models, customPrompts, defaultModelId, null, "Custom Question", defaultPromptId);
        // The typed question fans out through the compare slider; only the
        // follow-up box (with its mic) is needed up front.
        createFollowupInput(popupInstance, "Custom Question");
      } else {
        // No models: fall back to the legacy single flow, which surfaces the
        // configuration error and keeps the full action row available.
        popupInstance.compareEnabled = false;
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

  function performInitialFetch() {
    const currentQuote = (typeof popupInstance.quoteIndex === 'number') 
      ? LOADING_QUOTES[popupInstance.quoteIndex] 
      : initLoadingQuote(popupInstance);
    updatePopupContent(popupInstance, currentQuote);
    startLoadingQuoteRotation(popupInstance);
    
    // Remove old action buttons if retrying
    if (popupInstance.popup) {
      const actions = popupInstance.popup.querySelector('.ai-popup-actions');
      if (actions) actions.remove();
    }

    const stream = trackAiStream(popupInstance, () => {
      const msgs = popupInstance.messages;
      return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    });

    const watchdog = createResponseWatchdog(() => {
      if (!activePopups.includes(popupInstance)) return;
      showRequestTimeoutError(popupInstance, () => performInitialFetch());
    });

    const payload = { type: "getAiDefinition", word: selectedText, requestId: stream.requestId, context: popupInstance.implicitContext || undefined };
    if (customPrompt) payload.customPrompt = customPrompt;

    chrome.runtime.sendMessage(payload, (response) => {
      watchdog.done();
      stream.done();
      if (watchdog.fired()) return; // watchdog already took over the UI
      // Verify instance still exists (user might have closed it)
      if (!activePopups.includes(popupInstance)) {
        stopLoadingQuoteRotation(popupInstance);
        return;
      }
      popupInstance.isLoading = false;
      stopLoadingQuoteRotation(popupInstance);

      if (chrome.runtime.lastError) {
        response = { error: chrome.runtime.lastError.message };
      }

      const popupEl = popupInstance.popup;

      if (response && response.models && response.models.length > 0) {
        createSelectors(popupInstance, response.models, response.customPrompts, response.defaultModelId, null, selectedText, response.defaultPromptId);
      }

      if (response && response.error) {
        const errorId = 'error-' + Date.now();
        const errorHtml = `<span class="ai-popup-error-text">Error: ${String(response.error).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span> <button id="${errorId}-retry" class="ai-popup-retry-btn ai-popup-error-reload">Reload</button>`;
        
        // Temporarily put error in messages to render it
        popupInstance.messages = [
           { role: 'assistant', content: errorHtml, isError: true }
        ];
        renderMessages(popupInstance);
        
        // Wait a tick for innerHTML to parse
        setTimeout(() => {
          if (popupInstance.popup) {
            const retryBtn = popupInstance.popup.querySelector(`#${errorId}-retry`);
            if (retryBtn) {
              retryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.target.textContent = "Working...";
                e.target.style.opacity = "0.7";
                e.target.style.cursor = "wait";
                setTimeout(() => performInitialFetch(), 150);
              });
            }
          }
        }, 0);
      } else {
        const definitionText = response ? response.definition : "Error resolving definition";

        // --- NEW: Initialize conversation history ---
        if (response && response.usedPrompt) {
           popupInstance.messages = [
             { role: 'user', content: response.usedPrompt },
              { role: 'assistant', content: response.definition, citations: response.citations || [] }
           ];
        } else {
           popupInstance.messages = [
              { role: 'assistant', content: definitionText, citations: response?.citations || [] }
           ];
        }

        renderMessages(popupInstance);

        const modelName = (response && response.usedModelName)
          || (response && response.models ? (response.models.find(m => m.id === response.defaultModelId)?.name || 'Unknown Model') : 'Unknown Model');
        createActionButtons(popupInstance, selectedText, definitionText, modelName, response.promptName, response?.citations || []);
        notifyModelFallback(popupInstance, response);
        
        // --- NEW: Trigger Hallucination Verification (with Smart Bypass) ---
        chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
          if (guardData.enableHallucinationGuard) {
            if (response && response.usedWebSearch) {
              showSearchGroundedIndicator(popupInstance);
            } else {
              triggerVerification(popupInstance, selectedText, definitionText, {
                modelId: null,
                word: selectedText,
                refreshActions: true,
                searchGroundingAvailable: !!(response && response.searchGroundingAvailable)
              });
            }
          }
        });

        // --- Milestone-Based Feedback Prompt Check (5th successful lookup) ---
        checkAndShowFeedbackPrompt(popupInstance);
      }
      adjustPopupPosition(popupInstance, rect);
    });
  }

  // --- Always-on compare (Issue #27) ---
  // Every lookup answers through the horizontal compare slider: the default
  // model and the one after it respond immediately, further models join when
  // their card is slid to. Models live in sync storage, or in local storage
  // while the local-only API-key mode is on — the same split the empty
  // hotkey popup uses. With no models configured the legacy single-answer
  // flow runs, because it renders the helpful configuration error.
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
        popupInstance.compareEnabled = false;
        performInitialFetch();
      }
    };
    if (syncData.secretsLocalOnly) {
      chrome.storage.local.get(['models', 'defaultModelId', 'customPrompts'], (localData) => {
        if (!activePopups.includes(popupInstance)) return;
        begin(localData.models || [], localData.customPrompts || [], localData.defaultModelId || null);
      });
    } else {
      begin(syncData.models || [], syncData.customPrompts || [], syncData.defaultModelId || null);
    }
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

// Timeout twin of the flows' error branches: stop every loading affordance,
// drop placeholder and stale error messages, and show an error line with a
// retry button wired to retryFn.
function showRequestTimeoutError(instance, retryFn) {
  stopLoadingQuoteRotation(instance);
  instance.isLoading = false;
  if (instance.popup) {
    const followupInput = instance.popup.querySelector('#ai-popup-followup-input');
    const followupSend = instance.popup.querySelector('.ai-popup-followup-send');
    if (followupInput) followupInput.disabled = false;
    if (followupSend) followupSend.disabled = false;
  }
  const errorId = 'error-' + Date.now();
  const errorHtml = `<span class="ai-popup-error-text">Error: The AI request timed out with no response — the provider or search pipeline may be stuck.</span> <button id="${errorId}-retry" class="ai-popup-retry-btn ai-popup-error-reload">Reload</button>`;
  instance.messages = instance.messages.filter(m => !m.isThinking && !m.isStreaming && !m.isError);
  instance.messages.push({ role: 'assistant', content: errorHtml, isError: true, errorId: errorId });
  renderMessages(instance);
  setTimeout(() => {
    if (instance.popup) {
      const retryBtn = instance.popup.querySelector(`#${errorId}-retry`);
      if (retryBtn) {
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.target.textContent = "Working...";
          e.target.style.opacity = "0.7";
          e.target.style.cursor = "wait";
          setTimeout(() => retryFn(), 150);
        });
      }
    }
  }, 0);
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
          try { (renderFn || renderMessages)(instance); } catch (e) { console.error('crash in stream render', e); }
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
    // Compare is the popup's normal answering mode — the horizontal card
    // slider IS the answer view. compareEnabled only flips false when no
    // models are configured, so the legacy single-answer flow can surface
    // the configuration error.
    compareEnabled: true,
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

// --- NEW: renderMessages maps state to UI ---
function renderMessages(instance) {
  const popup = instance.popup;
  if (!popup) return;

  const contentWrapper = popup.querySelector('#ai-popup-content');
  if (!contentWrapper) return;

  const hasPendingLoading = instance.isLoading || instance.messages.some(m => m.isThinking || m.isStatus);
  if (!hasPendingLoading) {
    stopLoadingQuoteRotation(instance);
  }

  // Save current scroll position
  const isNearBottom = contentWrapper.scrollHeight - contentWrapper.scrollTop - contentWrapper.clientHeight < 30;
  const previousScrollTop = contentWrapper.scrollTop;

  // Clear existing content
  contentWrapper.innerHTML = '';

  try {
    instance.messages.forEach((msg, index) => {
      let formattedContent = msg.displayContent || msg.content || "";
      
      // Defensively stringify to avoid replace() crashes on unexpected types
      formattedContent = String(formattedContent);
      
      // Only format markdown if it's not an already HTML styled error/thinking message
      if (!msg.isError && !msg.isThinking && !msg.needsRetry && !msg.isStatus) {
        if (msg.role === 'user') {
          // The user's own input is shown verbatim (escaped), not parsed as Markdown.
          formattedContent = escapeHtmlText(formattedContent).replace(/\n/g, '<br>');
        } else {
          formattedContent = renderMarkdownHtml(formattedContent);
        }
      }

      // Loading placeholders (isThinking/isStatus) render as an animated
      // indicator; their content is a plain label, not markup to display.
      if (msg.isThinking || msg.isStatus) {
        const textToDisplay = (msg.content && msg.content !== 'Loading...' && msg.content !== 'Thinking...')
          ? msg.content
          : (typeof instance.quoteIndex === 'number' ? LOADING_QUOTES[instance.quoteIndex % LOADING_QUOTES.length] : initLoadingQuote(instance));
        contentWrapper.insertAdjacentHTML('beforeend', buildLoadingHtml(textToDisplay));
        // Static labels (e.g. "Hallucination detected — searching…") keep
        // their text; ordinary thinking slots rotate quotes instead.
        if (!msg.isStaticLabel) startLoadingQuoteRotation(instance);
        return;
      }

      if (msg.role === 'user' && !instance.showUserQuestions) return; // Hide user prompts unless setting is true

      const isMainDefinition = (index === 0 || index === 1) && instance.messages.length <= 2;

      if (isMainDefinition && !msg.isError) {
        // If it's the very first main definition, don't prefix with AI:
        contentWrapper.insertAdjacentHTML('beforeend', `<div>${formattedContent}</div>`);
      } else {
        // Conversational flow UI for follow-ups: the user's question sits in a
        // right-aligned tinted bubble, the AI's answer in a plain row marked
        // by a small icon (no more "You:"/"AI:" text labels).
        const retryBtnId = `retry-msg-${index}`;
        const bodyHtml = msg.needsRetry
          ? `<div class="ai-chat-retry"><button id="${retryBtnId}" class="ai-popup-retry-btn">${iconSvg('refresh', 12)} Retry with ${instance.lastModelName || 'New Model'}</button></div>`
          : formattedContent;

        if (msg.role === 'user') {
          contentWrapper.insertAdjacentHTML('beforeend', `<div class="ai-chat-row ai-chat-row-user"><div class="ai-chat-bubble">${bodyHtml}</div></div>`);
        } else {
          contentWrapper.insertAdjacentHTML('beforeend', `<div class="ai-chat-row ai-chat-row-ai"><span class="ai-chat-icon">${iconSvg('sparkles', 13)}</span><div class="ai-chat-text">${bodyHtml}</div></div>`);
        }

        if (msg.needsRetry) {
          // Attach listener
          setTimeout(() => {
             const btn = contentWrapper.querySelector(`#${retryBtnId}`);
             if (btn) {
                btn.addEventListener('click', () => {
                   retryMessage(instance, index);
                });
             }
          }, 0);
        }
      }

      if (msg.role === 'assistant' && !msg.isError && !msg.isThinking && !msg.needsRetry && Array.isArray(msg.citations) && msg.citations.length > 0) {
        appendCitations(contentWrapper, msg.citations);
      }

      // Verification and search-grounded badges live on the message so
      // they survive this function's innerHTML rebuild; the old imperative
      // appends were wiped by the next follow-up/retry, silently dropping
      // in-flight verification results.
      if (msg.role === 'assistant' && !msg.isError && !msg.isThinking && !msg.needsRetry) {
        if (msg.searchGrounded) {
          appendSearchGroundedBadge(contentWrapper);
        }
        if (msg.verification) {
          appendVerificationBadge(contentWrapper, msg.verification);
        }
      }
    });

    // Auto-scroll logic
    const lastMsg = instance.messages[instance.messages.length - 1];
    const isNewMessage = lastMsg && (lastMsg.role === 'user' || lastMsg.isThinking);
    
    if (isNewMessage || isNearBottom) {
       // Scroll to bottom if it's a new follow-up OR if the user was already at the bottom
       contentWrapper.scrollTop = contentWrapper.scrollHeight;
    } else {
       // Otherwise, restore the user's previous scroll position
       contentWrapper.scrollTop = previousScrollTop;
    }
  } catch (err) {
    console.error("Popup render loop crashed:", err);
    contentWrapper.insertAdjacentHTML('beforeend', `<div class="ai-popup-error-text">Error rendering messages: ${err.message}</div>`);
  }
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

// Temporary compatibility function
function updatePopupContent(instance, content) {
  instance.messages = [{ role: 'assistant', content: content, isStatus: true }];
  renderMessages(instance);
}

// --- NEW logic to handle Retrying a message ---
function retryMessage(instance, messageIndex) {
  if (!activePopups.includes(instance)) return;

  // The conversation context we send should be everything UP TO the user's prompt (which is messageIndex - 1)
  // because we are rewriting the assistant's previous answer at `messageIndex`.
  // Error placeholders are raw display HTML, never real assistant replies, so drop them.
  const messagesContext = instance.messages.slice(0, messageIndex).filter(m => !m.isError);
  
  // Set the message state to loading. isThinking routes it through the
  // animated loading indicator (and keeps it out of the request context).
  const initialQuote = initLoadingQuote(instance);
  instance.messages[messageIndex] = { role: 'assistant', content: initialQuote, isThinking: true, isError: false, needsRetry: false };
  renderMessages(instance);

  const modelId = instance.lastModelId || null;

  const stream = trackAiStream(instance, () => instance.messages[messageIndex]);

  // On timeout, rewrite the slot in place (the shared error helper would
  // push at the end and shift messageIndex).
  const watchdog = createResponseWatchdog(() => {
    if (!activePopups.includes(instance)) return;
    stopLoadingQuoteRotation(instance);
    instance.messages[messageIndex] = { role: 'assistant', content: '<span class="ai-popup-error-text">Error: The retry request timed out with no response.</span>', isError: true };
    renderMessages(instance);
  });

  chrome.runtime.sendMessage(
    { type: "getAiDefinition", word: instance.sourceWord, modelId: modelId, messages: messagesContext, requestId: stream.requestId, context: instance.implicitContext || undefined },
    (response) => {
      watchdog.done();
      stream.done();
      if (watchdog.fired()) return; // watchdog already took over the UI
      if (!activePopups.includes(instance)) {
        stopLoadingQuoteRotation(instance);
        return;
      }

      if (chrome.runtime.lastError) {
        response = { error: chrome.runtime.lastError.message };
      }

      if (response && !response.error) {
        instance.messages[messageIndex] = { role: 'assistant', content: response.definition, citations: response.citations || [], isError: false, needsRetry: false };
        notifyModelFallback(instance, response);
      } else {
        instance.messages[messageIndex] = { 
           role: 'assistant', 
           content: `<span class="ai-popup-error-text">Error retrying message: ${String(response?.error || 'Unknown error').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span>`,
           isError: true 
        };
      }
      renderMessages(instance);
    }
  );
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
    bodyPinned: true
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

  if (allModels.length > COMPARE_MODEL_CAP) {
    showPopupToast(instance, `Comparing the first ${COMPARE_MODEL_CAP} of ${allModels.length} models`);
  } else {
    showPopupToast(instance, `Asking ${Math.min(2, models.length)} models — swipe for more`);
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
      // No models to ask — unlock the box and say so; it must never stick
      // disabled with the user's typed question swallowed.
      updateCompareFollowupState(instance, false);
      showPopupToast(instance, 'No models configured to compare', 'error');
      return;
    }
    instance.compareWord = instance.sourceWord || 'Custom Question';
    instance.comparePrompt = null;
    instance.compareFirstMessages = [{ role: 'user', content: promptToSend, displayContent: displayText }];
    instance.compareSlots = models.map(m => ({
      modelId: m.id, modelName: m.name, messages: [], started: false, status: 'idle',
      settled: false, errorText: null, answerModelName: null, promptName: null, lastRequest: null, bodyPinned: true
    }));
    instance.isLoading = true;
    startLoadingQuoteRotation(instance);
    renderCompareView(instance);
    ensureCompareSlotLoaded(instance, 0);
    ensureCompareSlotLoaded(instance, 1);
    return;
  }

  const activeSlots = instance.compareSlots.filter(s => s.started);
  if (activeSlots.length === 0) return;

  instance.isLoading = true;
  startLoadingQuoteRotation(instance);

  activeSlots.forEach(slot => {
    slot.messages.push({ role: 'user', content: promptToSend, displayContent: displayText });
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
  slot.lastRequest = { word: word, customPrompt: customPrompt || null, isFollowup: !!isFollowup };
  slot.status = 'streaming';
  slot.settled = false;
  slot.messages.push({ role: 'assistant', content: initLoadingQuote(instance), isThinking: true });
  renderCompareView(instance);
  // A model just joined the conversation (late-visited card or retry): the
  // follow-up box must lock while it works, exactly as during a fan-out.
  updateCompareFollowupState(instance, false);

  const stream = trackAiStream(instance, () => {
    const msgs = slot.messages;
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  }, (inst) => renderCompareView(inst));

  const watchdog = createResponseWatchdog(() => {
    if (!activePopups.includes(instance)) return;
    if (gen !== instance.compareGen) return;
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
    if (chrome.runtime.lastError) response = { error: chrome.runtime.lastError.message };
    settleCompareSlot(instance, slot, response);
  });
}

// Final render for one model's answer (or failure), plus the shared
// busy-state bookkeeping that gates the follow-up input.
function settleCompareSlot(instance, slot, response) {
  slot.settled = true;
  slot.messages = slot.messages.filter(m => !m.isThinking && !m.isStreaming);

  if (response && !response.error && typeof response.definition === 'string') {
    slot.status = 'done';
    slot.errorText = null;
    slot.answerModelName = response.usedModelName || slot.modelName;
    slot.promptName = response.promptName || slot.promptName;
    slot.messages.push({ role: 'assistant', content: response.definition, citations: response.citations || [] });
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
  if (!busy && wasFollowup) input.focus();
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
  } catch (err) {
    console.error('Compare render crashed:', err);
    contentWrapper.insertAdjacentHTML('beforeend', '<div class="ai-popup-error-text">Error rendering answers.</div>');
  }
}

// Fills one model's card: status header, answer body (live while streaming,
// scrolled to bottom unless the reader scrolled up), and Save/Copy or Retry.
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
    status.innerHTML = iconSvg('checkCircle', 12) + '<span>done</span>';
  } else if (slot.status === 'error') {
    status.innerHTML = iconSvg('xCircle', 12) + '<span>failed</span>';
  } else if (slot.status === 'streaming' || slot.status === 'waiting') {
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

  const lastMsg = slot.messages.length ? slot.messages[slot.messages.length - 1] : null;

  if (slot.status === 'error') {
    const err = document.createElement('div');
    err.className = 'ai-compare-error';
    err.textContent = slot.errorText || 'Something went wrong.';
    card.appendChild(err);

    const retryRow = document.createElement('div');
    retryRow.className = 'ai-compare-actions';
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.innerHTML = iconSvg('refresh', 12) + '<span>Retry</span>';
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      retryBtn.disabled = true;
      retryCompareSlot(instance, slot);
    });
    retryRow.appendChild(retryBtn);
    card.appendChild(retryRow);
    return;
  }

  // --- Card body: the answer, scrollable inside the card ---
  const body = document.createElement('div');
  body.className = 'ai-compare-body';
  body.addEventListener('scroll', () => {
    // Stop auto-following new tokens once the reader deliberately scrolled up.
    slot.bodyPinned = body.scrollHeight - body.scrollTop - body.clientHeight < 24;
  });

  if (lastMsg && (lastMsg.isThinking || lastMsg.isStatus)) {
    body.insertAdjacentHTML('beforeend', buildLoadingHtml(lastMsg.content));
  } else if (lastMsg && lastMsg.isStreaming) {
    body.innerHTML = renderMarkdownHtml(String(lastMsg.content || ''));
  } else {
    const answer = latestCompareAnswer(slot);
    if (answer) {
      body.innerHTML = renderMarkdownHtml(String(answer.content || ''));
    } else {
      body.insertAdjacentHTML('beforeend', buildLoadingHtml('Thinking...'));
    }
  }
  if (slot.bodyPinned !== false) body.scrollTop = body.scrollHeight;
  card.appendChild(body);

  const answer = latestCompareAnswer(slot);
  if (answer && Array.isArray(answer.citations) && answer.citations.length > 0) {
    appendCitations(card, answer.citations);
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

  nav.appendChild(prev);
  nav.appendChild(dots);
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
  const idx = instance.compareIndex || 0;
  const n = instance.compareSlots.length;
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= n - 1;
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

  window.addEventListener('pointermove', (e) => {
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
  }, { passive: false });

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

    // --- Pin (identical to the single-answer toolbar) ---
    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.id = 'ai-popup-pin-btn';
    pinButton.innerHTML = iconSvg('pin', 16);
    pinButton.title = 'Pin conversation';
    pinButton.classList.toggle('pinned', !!instance.isPinned);
    pinButton.onclick = (e) => {
      e.stopPropagation();
      instance.isPinned = !instance.isPinned;
      pinButton.classList.toggle('pinned', instance.isPinned);
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
        previousSelector.parentNode.replaceChild(listSelector, previousSelector);
      }
    }
    recreateDropdown(lists, validListId);

    // --- Save: the visible card's answer into the chosen list ---
    const finalSaveButton = document.createElement('button');
    finalSaveButton.textContent = 'Save';
    finalSaveButton.className = 'ai-popup-button';
    // Same seating as the original toolbar: icons left, list picker + Save
    // pushed to the right edge together.
    finalSaveButton.style.marginLeft = 'auto';
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
          // confirmation is a toast rather than a permanent "Saved" state.
          showPopupToast(instance, `Saved ${slot.answerModelName || slot.modelName}'s answer`);
        }
      });
    });

    actionsContainer.appendChild(speakButton);
    actionsContainer.appendChild(pdfButton);
    actionsContainer.appendChild(pinButton);
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
  const contextLabel = document.createElement('div');
  contextLabel.className = 'ai-popup-context-label';
  contextLabel.textContent = selectedText === 'Custom Question' ? 'Conversation' : 'Selected text';
  const contextQuery = document.createElement('div');
  contextQuery.className = 'ai-popup-context-query';
  contextQuery.textContent = selectedText === 'Custom Question' ? 'Ask anything' : selectedText;
  contextQuery.title = contextQuery.textContent;
  contextCopy.append(contextLabel, contextQuery);

  context.append(contextCopy);

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
  // redefineWithModelAndPrompt expects as customPrompt — identical to the old
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
  modelSelector.id = 'ai-popup-model-selector';
  promptSelector.id = 'ai-popup-prompt-selector';

  container.appendChild(modelSelector);
  container.appendChild(promptSelector);

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

    if (instance.compareEnabled) {
      reorderModelsFirst(newModelId);
      startCompareLookup(instance, selectedText, newPromptContent);
      return;
    }

    redefineWithModelAndPrompt(instance, selectedText, newModelId, newPromptContent);
  }
}

// --- Function to get a new definition with a specific model and prompt ---
function redefineWithModelAndPrompt(instance, word, modelId, promptContent) {
  if (!activePopups.includes(instance)) {
    // Unreachable while the popup is visible; if it ever fires, the popup DOM
    // outlived its registration and every control inside would be dead. Say
    // so instead of silently dropping the user's model/prompt switch.
    console.error('[AI Popup] model/prompt switch ignored: popup instance is no longer active');
    return;
  }
  const popup = instance.popup;

  // Set the interaction flag
  instance.isInteracting = true;

  function performRedefineFetch() {
    // Update UI to show loading state by adding a thinking indicator
    const initialQuote = initLoadingQuote(instance);
    instance.messages.push({ role: 'assistant', content: initialQuote, isThinking: true });
    try { renderMessages(instance); } catch (e) { console.error('crash in pre redfr', e); }
    
    // Remove old action buttons
    const actions = popup.querySelector('.ai-popup-actions');
    if (actions) actions.remove();

    // Send message to background
    const stream = trackAiStream(instance, () => {
      const msgs = instance.messages;
      return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    });

    const watchdog = createResponseWatchdog(() => {
      if (!activePopups.includes(instance)) return;
      showRequestTimeoutError(instance, () => performRedefineFetch());
    });

    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: word, modelId: modelId, customPrompt: promptContent, requestId: stream.requestId, context: instance.implicitContext || undefined },
      (response) => {
        watchdog.done();
        stream.done();
        if (watchdog.fired()) return; // watchdog already took over the UI
        if (!activePopups.includes(instance)) {
          stopLoadingQuoteRotation(instance);
          return;
        }

        // Remove the temporary thinking indicator or streamed partial answer
        instance.messages = instance.messages.filter(m => !m.isThinking && !m.isStreaming);

        if (chrome.runtime.lastError) {
          response = { error: chrome.runtime.lastError.message };
        }

        // 1. Re-create selectors
        if (response && response.models && response.models.length > 0) {
          createSelectors(instance, response.models, response.customPrompts, modelId, promptContent, word, response.defaultPromptId);
        }

        if (response && response.error) {
          const errorId = 'error-' + Date.now();
          const errorHtml = `<span class="ai-popup-error-text">Error: ${String(response.error).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span> <button id="${errorId}-retry" class="ai-popup-retry-btn ai-popup-error-reload">Reload</button>`;
          
          // Temporarily put error in messages to render it
          instance.messages = [
             { role: 'assistant', content: errorHtml, isError: true }
          ];
          renderMessages(instance);
          
          setTimeout(() => {
            if (popup) {
              const retryBtn = popup.querySelector(`#${errorId}-retry`);
              if (retryBtn) {
                retryBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.target.textContent = "Working...";
                  e.target.style.opacity = "0.7";
                  e.target.style.cursor = "wait";
                  setTimeout(() => performRedefineFetch(), 150);
                });
              }
            }
          }, 0);
        } else {
          // Update the definition
          const definitionText = response ? response.definition : "Error resolving definition";
          const modelName = (response && response.usedModelName)
            || (response && response.models ? (response.models.find(m => m.id === modelId)?.name || 'Unknown Model') : 'Unknown Model');

          if (response && response.usedPrompt) {
             // Instead of wiping the array, rebuild/modify the existing messages.
             // If we already have follow-ups, preserve them.
             if (instance.messages && instance.messages.length > 2) {
                instance.messages[0] = { role: 'user', content: response.usedPrompt };
                instance.messages[1] = { role: 'assistant', content: response.definition, citations: response.citations || [] };

                // Flag subsequent AI messages as needing retry. Credit the
                // model that actually answered when the fallback chain fired.
                instance.lastModelId = (response.usedModelId || modelId);
                instance.lastModelName = modelName;
                instance.lastPromptContent = promptContent;
                instance.sourceWord = word;
                
                for (let i = 2; i < instance.messages.length; i++) {
                   if (instance.messages[i].role === 'assistant') {
                      instance.messages[i].needsRetry = true;
                   }
                }
             } else {
                instance.messages = [
                  { role: 'user', content: response.usedPrompt },
                  { role: 'assistant', content: response.definition, citations: response.citations || [] }
                ];
             }
          } else {
             instance.messages = [
                { role: 'assistant', content: definitionText, citations: response?.citations || [] }
             ];
          }

          renderMessages(instance);

          // Re-create the save button after model change
          createActionButtons(instance, word, definitionText, modelName, response.promptName, response?.citations || []);
          notifyModelFallback(instance, response);

          // --- NEW: Trigger Hallucination Verification for Redefined Fetch (with Smart Bypass) ---
          chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
            if (guardData.enableHallucinationGuard) {
              if (response && response.usedWebSearch) {
                showSearchGroundedIndicator(instance);
              } else {
                triggerVerification(instance, word, definitionText, {
                  modelId: modelId,
                  word: word,
                  refreshActions: true,
                  searchGroundingAvailable: !!(response && response.searchGroundingAvailable)
                });
              }
            }
          });
        }

        // Reset the flag
        setTimeout(() => { instance.isInteracting = false; }, 100);
      }
    );
  }

  performRedefineFetch();
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

    // --- NEW: PIN BUTTON ---
    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.id = 'ai-popup-pin-btn';
    pinButton.innerHTML = iconSvg('pin', 16);
    pinButton.title = 'Pin conversation';
    pinButton.classList.toggle('pinned', !!instance.isPinned);
    pinButton.onclick = (e) => {
      e.stopPropagation();
      instance.isPinned = !instance.isPinned;
      pinButton.classList.toggle('pinned', instance.isPinned);
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
    finalSaveButton.className = 'ai-popup-button';
    finalSaveButton.style.marginLeft = 'auto';
    // Removed manual margin-left, relying on flex gap


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

      // --- REMOVED: Auto-close logic ---
      // We keep the popup open so the user can continue interacting.
      // window.getSelection().removeAllRanges();
      // setTimeout(() => removePopup(), 800);
    });

    // 4. Add the new controls directly to the container
    actionsContainer.appendChild(speakButton); // Add speaker first
    actionsContainer.appendChild(pdfButton); // Add PDF button next
    actionsContainer.appendChild(pinButton); // Add Pin button next
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
  sendBtn.className = 'ai-popup-followup-send';
  sendBtn.textContent = 'Send';

  const micBtn = document.createElement('button');
  micBtn.className = 'ai-popup-followup-mic';
  micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  micBtn.title = 'Type by speaking';
  const inputWrapper = document.createElement('div');
  inputWrapper.style.position = 'relative';
  inputWrapper.style.flexGrow = '1';
  inputWrapper.style.display = 'flex';
  inputWrapper.style.alignItems = 'center';
  inputWrapper.appendChild(input);
  inputWrapper.appendChild(micBtn);

  container.appendChild(inputWrapper);
  container.appendChild(sendBtn);
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

      // Compare mode: the question goes to every model's own conversation,
      // rendered as fresh answer cards. The single-model history is not used.
      if (instance.compareEnabled) {
        runCompareFollowup(instance, promptToSend, text);
        return;
      }

      // Add to history (use displayContent to hide the hidden prompt rule from the popup UI)
      instance.messages.push({ role: 'user', content: promptToSend, displayContent: text });

      performFetch();
    });
  }

  function performFetch() {
    input.disabled = true;
    sendBtn.disabled = true;

    try {
      // Push thinking indicator and render to UI immediately
      const initialQuote = initLoadingQuote(instance);
      instance.messages.push({ role: 'assistant', content: initialQuote, isThinking: true });
      renderMessages(instance);
    } catch (e) {
      console.error("render crashed on pre-fetch", e);
    }

    const selectedModelOpt = popup.querySelector('#ai-popup-model-selector');
    const modelId = selectedModelOpt ? selectedModelOpt.value : null;

    const stream = trackAiStream(instance, () => {
      const msgs = instance.messages;
      return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    });

    const watchdog = createResponseWatchdog(() => {
      if (!activePopups.includes(instance)) return;
      showRequestTimeoutError(instance, () => performFetch());
    });

    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: word, modelId: modelId, messages: instance.messages.filter(m => !m.isThinking && !m.isError && !m.isStreaming), requestId: stream.requestId, context: instance.implicitContext || undefined },
      (response) => {
        watchdog.done();
        stream.done();
        if (watchdog.fired()) return; // watchdog already took over the UI
        if (!activePopups.includes(instance)) {
          stopLoadingQuoteRotation(instance);
          return;
        }

        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();

        // Remove the loading indicator or streamed partial answer
        instance.messages = instance.messages.filter(m => !m.isThinking && !m.isStreaming);

        if (response && !response.error) {
          instance.messages.push({ role: 'assistant', content: response.definition, citations: response.citations || [] });
          notifyModelFallback(instance, response);

          // --- NEW: Trigger Hallucination Verification (with Smart Bypass) ---
          chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
            if (guardData.enableHallucinationGuard) {
              if (response && response.usedWebSearch) {
                showSearchGroundedIndicator(instance);
              } else {
                const userMsgs = instance.messages.filter(m => m.role === 'user');
                const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : word;
                triggerVerification(instance, lastUserMsg, response.definition, {
                  modelId: modelId,
                  word: word,
                  refreshActions: false,
                  searchGroundingAvailable: !!(response && response.searchGroundingAvailable)
                });
              }
            }
          });
        } else {
          // Add error message with retry button to history
          const errorId = 'error-' + Date.now();
          const errorHtml = `<span class="ai-popup-error-text">Error: ${String(response?.error || 'Unknown error').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span> <button id="${errorId}-retry" class="ai-popup-retry-btn ai-popup-error-reload">Reload</button>`;
          instance.messages.push({ role: 'assistant', content: errorHtml, isError: true, errorId: errorId });

          // Setup the error retry button (errorId is unique to this error)
          setTimeout(() => {
            const retryBtn = popup.querySelector(`#${errorId}-retry`);
            if (retryBtn) {
              retryBtn.addEventListener('click', (e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 e.target.textContent = "Working...";
                 e.target.style.opacity = "0.7";
                 e.target.style.cursor = "wait";
                 setTimeout(() => {
                   // Remove only this error message — anything appended after it
                   // (a newer follow-up, indicators) must survive.
                   const idx = instance.messages.findIndex(m => m.errorId === errorId);
                   if (idx !== -1) instance.messages.splice(idx, 1);
                   performFetch();
                 }, 150);
              });
            }
          }, 0);
        }

        try {
          renderMessages(instance);
        } catch(e) { console.error("render crashed on post-fetch", e); }
      }
    );
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

function removeAllPopups() {
  activePopups = activePopups.filter(instance => {
    if (!instance.isPinned) {
      stopLoadingQuoteRotation(instance);
      if (instance.stopMic) instance.stopMic();
      if (instance.container) instance.container.remove();
      return false; // Remove from array
    }
    return true; // Keep in array
  });
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
      stopLoadingQuoteRotation(instance);
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
    stopLoadingQuoteRotation(instance);
    cleanupStreamHandlersFor(instance);
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
    body { font-family: 'Google Sans', 'Google Sans Text', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px; margin: auto; line-height: 1.6; }
    .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
    .user { background-color: #e3f2fd; border-left: 4px solid #1976d2; }
    .ai { background-color: #f5f5f5; border-left: 4px solid #4caf50; }
    .role { font-weight: bold; margin-bottom: 8px; font-size: 1.1em; }
    .message p { margin: 8px 0; }
    .message div > p:first-child { margin-top: 0; }
    .message div > p:last-child { margin-bottom: 0; }
    .title { text-align: center; color: #333; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
    .message code { font-family: Consolas, Menlo, 'Liberation Mono', monospace; font-size: 0.9em; background-color: #eceff1; border-radius: 3px; padding: 1px 4px; }
    .message pre { background-color: #eceff1; border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; overflow-x: auto; }
    .message pre code { background-color: transparent; padding: 0; border-radius: 0; }
    .message ul, .message ol { margin: 8px 0; padding-left: 22px; }
    .message h1, .message h2, .message h3, .message h4 { margin: 12px 0 6px; line-height: 1.3; }
    .message h1 { font-size: 1.25em; } .message h2 { font-size: 1.15em; } .message h3 { font-size: 1.05em; }
    .message blockquote { margin: 8px 0; padding: 2px 0 2px 12px; border-left: 3px solid #4caf50; color: #555; }
    .message table { border-collapse: collapse; margin: 8px 0; }
    .message th, .message td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: top; }
    .message th { background-color: #e8e8e8; }
    .message hr { border: none; border-top: 1px solid #ccc; margin: 12px 0; }
    @media print {
      body { max-width: 100%; padding: 0; }
      .message { page-break-inside: avoid; }
      .message pre, .message table { page-break-inside: avoid; }
    }
  </style>
  </head><body>
  <h2 class="title">${titleLine}</h2>`;

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

// --- NEW: Search Grounded Indicator (Smart Bypass) ---
// The badge is message state (like citations), painted by renderMessages.
// The previous imperative append was destroyed by the next renderMessages
// call (any follow-up, retry or model switch), so it only ever showed
// until the user's next interaction.
function showSearchGroundedIndicator(popupInstance) {
  if (!popupInstance || !popupInstance.popup) return;
  const msg = lastAssistantMessage(popupInstance);
  if (!msg) return;
  msg.searchGrounded = true;
  renderMessages(popupInstance);
}

function appendSearchGroundedBadge(container) {
  const indicator = document.createElement('div');
  indicator.className = 'ai-popup-citations';
  indicator.innerHTML = `<span style="color:var(--popup-context-label);">${iconSvg('globe', 13)}</span> <strong style="color:var(--popup-context-label);">Search Grounded</strong> <span style="opacity:0.8">· Response is based on live web results. Hallucination Guard bypassed.</span>`;
  container.appendChild(indicator);
}

// --- NEW: Hallucination Verification UI Logic ---
// Same state-driven approach: triggerVerification marks the verified
// message pending and updates it when the background check resolves, so
// the badge survives any number of re-renders in between.
function lastAssistantMessage(popupInstance) {
  const candidates = popupInstance.messages.filter(m =>
    m.role === 'assistant' && !m.isError && !m.isThinking && !m.needsRetry
  );
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
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

function triggerVerification(popupInstance, originalPrompt, aiResponse, retryInfo) {
  if (!popupInstance || !popupInstance.popup) return;
  const msg = lastAssistantMessage(popupInstance);
  if (!msg) return;

  msg.verification = { state: 'pending' };
  renderMessages(popupInstance);

  chrome.runtime.sendMessage({
    type: "verifyAiResponse",
    originalPrompt: originalPrompt,
    aiResponse: aiResponse,
    // The verifier needs the same context the answering model saw, or it
    // flags context-derived facts as claims the model couldn't know.
    context: popupInstance.implicitContext || undefined
  }, (response) => {
    if (!activePopups.includes(popupInstance)) return;
    // The message may have been replaced since (e.g. a redefine rebuilt
    // instance.messages); painting the stale result on a different
    // response would be wrong, so only update if it is still live.
    if (!popupInstance.messages.includes(msg)) return;

    if (chrome.runtime.lastError || !response || response.error) {
      msg.verification = { state: 'failed' };
    } else {
      msg.verification = {
        state: response.result && response.result.is_hallucinating ? 'hallucination' : 'verified',
        reasoning: (response.result && response.result.reasoning) || '',
        corrections: Array.isArray(response.result && response.result.corrections) ? response.result.corrections.map(String) : []
      };
      // Auto-recovery: the guard just proved the term sits outside the
      // model's knowledge — exactly the case where a grounded search is
      // needed but the model didn't feel uncertain enough to make one.
      // When regenerate declines (stale message, no user turn), fall
      // through and paint the badge as before.
      if (msg.verification.state === 'hallucination' && retryInfo && retryInfo.searchGroundingAvailable
          && regenerateWithGroundedSearch(popupInstance, msg, retryInfo)) {
        return;
      }
    }
    renderMessages(popupInstance);
  });
}

// Re-asks a guard-flagged answer with the web_search tool forced. The
// popup's conversation (minus the flagged reply) is replayed verbatim, so
// initial lookups, redefines, and follow-ups all regenerate correctly —
// the first user message already carries the templated/custom prompt. The
// replacement answer is either search-grounded (badge) or verified again
// with no retryInfo, so a second hallucination cannot loop. Returns true
// when it took over the popup (caller skips its own re-render).
function regenerateWithGroundedSearch(popupInstance, flaggedMsg, retryInfo) {
  // Only regenerate when the flagged answer is still the live last message;
  // a follow-up typed during verification makes it stale.
  const msgs = popupInstance.messages;
  if (!msgs.length || msgs[msgs.length - 1] !== flaggedMsg) return false;
  const convo = msgs.filter(m => !m.isThinking && !m.isError && !m.isStreaming && m !== flaggedMsg);
  if (!convo.some(m => m.role === 'user')) return false;

  const setFollowupDisabled = (disabled) => {
    if (!popupInstance.popup) return;
    const followupInput = popupInstance.popup.querySelector('#ai-popup-followup-input');
    const followupSend = popupInstance.popup.querySelector('.ai-popup-followup-send');
    if (followupInput) followupInput.disabled = disabled;
    if (followupSend) followupSend.disabled = disabled;
  };

  popupInstance.isLoading = true;
  setFollowupDisabled(true);

  // Retire the save actions bound to the hallucinated text, then swap the
  // flagged answer for a thinking slot the retry streams into.
  if (popupInstance.popup) {
    const actions = popupInstance.popup.querySelector('.ai-popup-actions');
    if (actions) actions.remove();
  }
  msgs.splice(msgs.indexOf(flaggedMsg), 1, { role: 'assistant', content: 'Hallucination detected — searching the web for a grounded answer...', isThinking: true, isStaticLabel: true });
  renderMessages(popupInstance);

  const stream = trackAiStream(popupInstance, () => {
    const current = popupInstance.messages;
    return current.length > 0 ? current[current.length - 1] : null;
  });

  // A forced-search pass runs several sequential provider calls (tool round,
  // Tavily, answer round); if the whole thing never comes back, restore the
  // flagged answer and offer a retry instead of spinning forever.
  const watchdog = createResponseWatchdog(() => {
    if (!activePopups.includes(popupInstance)) return;
    popupInstance.messages = popupInstance.messages.filter(m => !m.isThinking && !m.isStreaming);
    popupInstance.messages.push(flaggedMsg);
    showRequestTimeoutError(popupInstance, () => {
      popupInstance.messages = popupInstance.messages.filter(m => !m.isError);
      regenerateWithGroundedSearch(popupInstance, flaggedMsg, retryInfo);
    });
  });

  const payload = {
    type: "getAiDefinition",
    word: retryInfo.word,
    requestId: stream.requestId,
    context: popupInstance.implicitContext || undefined,
    messages: convo,
    forceSearch: true
  };
  if (retryInfo.modelId) payload.modelId = retryInfo.modelId;

  chrome.runtime.sendMessage(payload, (response) => {
    watchdog.done();
    stream.done();
    if (watchdog.fired()) return; // watchdog already took over the UI
    if (!activePopups.includes(popupInstance)) {
      stopLoadingQuoteRotation(popupInstance);
      return;
    }
    popupInstance.isLoading = false;
    setFollowupDisabled(false);

    // Remove the thinking placeholder or streamed partial answer
    popupInstance.messages = popupInstance.messages.filter(m => !m.isThinking && !m.isStreaming);

    if (chrome.runtime.lastError) {
      response = { error: chrome.runtime.lastError.message };
    }

    if (!response || response.error) {
      // Put the flagged answer (with its badge) back rather than leaving
      // the popup empty.
      popupInstance.messages.push(flaggedMsg);
      renderMessages(popupInstance);
      return;
    }

    const definitionText = response.definition;
    popupInstance.messages.push({ role: 'assistant', content: definitionText, citations: response.citations || [] });
    renderMessages(popupInstance);
    notifyModelFallback(popupInstance, response);

    if (retryInfo.refreshActions) {
      const modelName = (response && response.usedModelName) || 'Unknown Model';
      createActionButtons(popupInstance, retryInfo.word, definitionText, modelName, response.promptName, response.citations || []);
    }

    chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
      if (!guardData.enableHallucinationGuard) return;
      if (response.usedWebSearch) {
        showSearchGroundedIndicator(popupInstance);
      } else {
        // A fallback model answered without searching; verify normally.
        // No retryInfo here — at most one auto-regeneration per answer.
        const userMsgs = popupInstance.messages.filter(m => m.role === 'user');
        const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : retryInfo.word;
        triggerVerification(popupInstance, lastUserMsg, definitionText, null);
      }
    });
  });

  // Handed over to the caller: the popup UI is ours now (it skipped its own
  // re-render), and the request above is already in flight.
  return true;
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
  // every renderMessages call.
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

