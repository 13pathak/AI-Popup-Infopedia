// --- Global State for Stacked Popups ---
let activePopups = []; // Array of { container, popup, isInteracting, isClickInside }
let baseZIndex = 2100000000;

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
    --popup-context-label: #7dd3fc;
    --popup-role-user: #90caf9;
    --popup-role-ai: #a5d6a7;
    --popup-link-color: #a5d6ff;
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
    --popup-context-label: #0284c7;
    --popup-role-user: #0284c7;
    --popup-role-ai: #059669;
    --popup-link-color: #0284c7;
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
      --popup-context-label: #0284c7;
      --popup-role-user: #0284c7;
      --popup-role-ai: #059669;
      --popup-link-color: #0284c7;
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
    font-size: 15px;
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
  }
  .custom-options.show { display: block; }
  .custom-option { padding: 6px 10px; cursor: pointer; display: flex; align-items: center; min-width: 0; color: var(--popup-field-text); }
  .custom-option:hover { background-color: var(--popup-dropdown-hover); }
  .custom-option.selected { background-color: rgba(var(--popup-accent-rgb), 0.2); }
  .custom-option > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expand-toggle { cursor: pointer; display: inline-block; width: 16px; text-align: center; color: var(--popup-text-muted); font-size: 10px;}
  .expand-toggle:hover { color: var(--popup-text-header); }
  .indent-spacer { display: inline-block; width: 16px; }

  /* --- Styles for selectors --- */
  #ai-popup-selectors-container {
    display: flex;
    gap: 7px;
    margin-bottom: 12px;
  }

  #ai-popup-model-selector,
  #ai-popup-prompt-selector {
    width: 50%; /* 50:50 split */
    background-color: var(--popup-field-bg);
    color: var(--popup-field-text);
    border: 1px solid var(--popup-field-border);
    border-radius: 10px;
    padding: 7px;
    font-family: inherit;
    font-size: 13px;
    box-sizing: border-box;
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

  /* --- STYLES FOR BUTTONS --- */
  .ai-popup-actions {
    display: flex;
    align-items: center; /* Vertically center items */
    gap: 6px;
    margin-top: 14px;
    padding: 8px;
    background: var(--popup-card-bg);
    border: none;
    border-radius: 10px;
  }

  .ai-popup-button {
    font-family: inherit;
    font-size: 14px; 
    font-weight: bold; 
    color: var(--popup-accent-btn-text);
    cursor: pointer;
    background: var(--popup-accent-btn-bg);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 10px;
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
    border-radius: 10px;
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
    border-radius: 10px;
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
    border-radius: 10px;
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
    border-radius: 6px;
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
  #ai-open-button-popup {
    position: fixed;
    background-color: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 6px;
    padding: 6px 12px;
    font-family: var(--popup-font-family);
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 6px var(--popup-shadow-1);
    pointer-events: auto;
    z-index: 1;
  }
  #ai-open-button-popup:hover {
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
    border-radius: 4px;
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
    border-radius: 6px;
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

  .ai-popup-retry-btn {
    background: var(--popup-accent-btn-bg);
    color: var(--popup-accent-btn-text);
    border: 1px solid var(--popup-accent-btn-border);
    border-radius: 4px;
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
    border-radius: 6px;
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
    border-radius: 6px;
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

  /* --- Reduced motion: show elements at rest, no enter/bounce/pulse --- */
  @media (prefers-reduced-motion: reduce) {
    #ai-definition-popup,
    .ai-popup-loading-dot,
    .ai-popup-toast,
    .ai-popup-followup-mic.recording,
    .ai-feedback-banner {
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
  chevronRight: '<polyline points="9 18 15 12 9 6"/>'
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
    valueDisplay.title = name;
  }

  const arrow = document.createElement('span');
  arrow.innerHTML = iconSvg('chevronDown', 12);
  
  selectBtn.append(valueDisplay, arrow);
  
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-options';

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
      textNode.textContent = item.name;
      textNode.title = item.name;
      optEl.appendChild(textNode);

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
  
  if (!selectedId && allItems.length > 0) {
    selectedId = allItems[0].id;
    setSelectedLabel(allItems[0].name);
  }

  renderOptions();

  selectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsContainer.classList.toggle('show');
  });

  // The trigger is a div, so Enter/Space do not synthesize a click.
  selectBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      optionsContainer.classList.toggle('show');
    }
  });

  // Adding document listener here won't work perfectly inside shadow root if we just listen on document,
  // but we can listen on the shadow root document or window, we will fix this in populateListOptions.

  Object.defineProperty(container, 'value', {
    get: function() { return selectedId; },
    set: function(val) { selectedId = val; renderOptions(); }
  });

  return container;
}

// --- Main mouseup listener ---
document.addEventListener('mouseup', (event) => {
  // 1. Check for selection inside existing popups (Nested Selection) FIRST
  let selectedText = "";
  let selectionRect = null;

  // Check from top-most to bottom-most
  for (let i = activePopups.length - 1; i >= 0; i--) {
    const shadowRoot = activePopups[i].container.shadowRoot;
    const selection = shadowRoot.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text.length > 0) {
        selectedText = text;
        selectionRect = selection.getRangeAt(0).getBoundingClientRect();
        break; // Found a nested selection, stop looking
      }
    }
  }

  // 2. If a nested selection was found, trigger NEW popup and ignore "click inside" blocking
  if (selectedText.length > 0) {
    const wordCount = selectedText.split(/\s+/).length;
    if (wordCount > 0 && wordCount <= 6) {
      // Reset flags to avoid sticking
      activePopups.forEach(p => { p.isClickInside = false; p.isInteracting = false; });
      showOpenButtonPopup(selectionRect, selectedText);
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
    if (wordCount > 0 && wordCount <= 6) {

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

      showOpenButtonPopup(selectionRect, selectedText);
    }
  } else {
    // No text selected anywhere. logic for closing is handled in mousedown (outside click)
  }
});

// --- NEW: Custom event listener for programmatic trigger from custom viewer ---
document.addEventListener('trigger-ai-popup', (e) => {
  if (e.detail && e.detail.rect && e.detail.text) {
    initiatePopupSequence(e.detail.rect, e.detail.text, e.detail.prompt);
  }
});

// --- NEW: Message Listener for activation ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        initiatePopupSequence(rect, selectedText);
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

  chrome.storage.sync.get(['models', 'defaultModelId', 'customPrompts', 'defaultPromptId'], (data) => {
    if (!activePopups.includes(popupInstance)) return;
    
    popupInstance.messages = [
      { role: 'assistant', content: "Hi! What would you like to ask?" }
    ];
    renderMessages(popupInstance);
    
    if (data.models && data.models.length > 0) {
      createSelectors(popupInstance, data.models, data.customPrompts, data.defaultModelId, null, "Custom Question", data.defaultPromptId);
    }
    
    const defaultModelName = data.models ? (data.models.find(m => m.id === data.defaultModelId)?.name || 'Unknown Model') : 'Unknown Model';
    createActionButtons(popupInstance, "Custom Question", "Conversation started from hotkey.", defaultModelName, "Default");
    
    adjustPopupPosition(popupInstance, null);
    
    setTimeout(() => {
      const input = popupInstance.popup.querySelector('#ai-popup-followup-input');
      if (input) input.focus();
    }, 100);
  });
}

// --- NEW: Function to show intermediate 'Open' button ---
function showOpenButtonPopup(rect, selectedText) {
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

  const openBtn = document.createElement('button');
  openBtn.id = 'ai-open-button-popup';
  openBtn.textContent = 'Ask AI';

  // Position it a bit above the selection if possible
  const topPos = rect.top >= 40 ? rect.top - 40 : rect.bottom + 10;
  openBtn.style.left = `${rect.left}px`;
  openBtn.style.top = `${topPos}px`;

  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removePopupInstance(instance);
    initiatePopupSequence(rect, selectedText);
  });

  shadow.appendChild(openBtn);
  document.documentElement.appendChild(popupContainer);

  const instance = {
    container: popupContainer,
    popup: openBtn,
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
function initiatePopupSequence(rect, selectedText, customPrompt) {
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

    const payload = { type: "getAiDefinition", word: selectedText };
    if (customPrompt) payload.customPrompt = customPrompt;

    chrome.runtime.sendMessage(payload, (response) => {
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
        const errorHtml = `<span style="color:red;">Error: ${String(response.error).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span> <button id="${errorId}-retry" class="ai-popup-retry-btn" style="background:#4db6ac; color:white; border:none; border-radius:3px; cursor:pointer; padding:2px 6px; font-size:11px; margin-left:5px;">Reload</button>`;
        
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

        const modelName = response && response.models ? (response.models.find(m => m.id === response.defaultModelId)?.name || 'Unknown Model') : 'Unknown Model';
        createActionButtons(popupInstance, selectedText, definitionText, modelName, response.promptName, response?.citations || []);
        
        // --- NEW: Trigger Hallucination Verification (with Smart Bypass) ---
        chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
          if (guardData.enableHallucinationGuard) {
            if (response && response.usedWebSearch) {
              showSearchGroundedIndicator(popupInstance);
            } else {
              triggerVerification(popupInstance, selectedText, definitionText);
            }
          }
        });

        // --- Milestone-Based Feedback Prompt Check (5th successful lookup) ---
        checkAndShowFeedbackPrompt(popupInstance);
      }
      adjustPopupPosition(popupInstance, rect);
    });
  }

  performInitialFetch();
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
    showUserQuestions: false // Default to false
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
        // Escape HTML characters to prevent XSS
        formattedContent = formattedContent.replace(/&/g, '&amp;')
                                           .replace(/</g, '&lt;')
                                           .replace(/>/g, '&gt;')
                                           .replace(/"/g, '&quot;')
                                           .replace(/'/g, '&#039;');
        formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedContent = formattedContent.replace(/\n/g, '<br>');
      }

      // Loading placeholders (isThinking/isStatus) render as an animated
      // indicator; their content is a plain label, not markup to display.
      if (msg.isThinking || msg.isStatus) {
        const textToDisplay = (msg.content && msg.content !== 'Loading...' && msg.content !== 'Thinking...')
          ? msg.content
          : (typeof instance.quoteIndex === 'number' ? LOADING_QUOTES[instance.quoteIndex % LOADING_QUOTES.length] : initLoadingQuote(instance));
        contentWrapper.insertAdjacentHTML('beforeend', buildLoadingHtml(textToDisplay));
        startLoadingQuoteRotation(instance);
        return;
      }

      if (msg.role === 'user' && !instance.showUserQuestions) return; // Hide user prompts unless setting is true

      const isMainDefinition = (index === 0 || index === 1) && instance.messages.length <= 2;

      if (isMainDefinition && !msg.isError) {
        // If it's the very first main definition, don't prefix with AI:
        contentWrapper.insertAdjacentHTML('beforeend', `<div>${formattedContent}</div>`);
      } else {
        // Conversational flow UI for follow-ups
        const roleName = msg.role === 'user' ? 'You' : 'AI';
        const color = msg.role === 'user' ? 'var(--popup-role-user)' : 'var(--popup-role-ai)';
        
        let html = '';
        if (msg.needsRetry) {
          // Output a retry button instead of the message content
          const retryBtnId = `retry-msg-${index}`;
          const targetModelName = instance.lastModelName || 'New Model';
          html = `<div style="margin-top: 12px; font-style: italic; color: var(--popup-text-muted);">
                    <strong style="color: ${color};">${roleName}:</strong>
                    <div style="margin-top: 5px;">
                       <button id="${retryBtnId}" class="ai-popup-retry-btn">
                         ${iconSvg('refresh', 12)} Retry with ${targetModelName}
                       </button>
                    </div>
                  </div>`;
                  
          contentWrapper.insertAdjacentHTML('beforeend', html);
          
          // Attach listener
          setTimeout(() => {
             const btn = contentWrapper.querySelector(`#${retryBtnId}`);
             if (btn) {
                btn.addEventListener('click', () => {
                   retryMessage(instance, index);
                });
             }
          }, 0);
        } else {
          html = `<div style="margin-top: 12px;"><strong style="color: ${color};">${roleName}:</strong> ${formattedContent}</div>`;
          contentWrapper.insertAdjacentHTML('beforeend', html);
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
    contentWrapper.insertAdjacentHTML('beforeend', `<div style="color: red;">Error rendering messages: ${err.message}</div>`);
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

  chrome.runtime.sendMessage(
    { type: "getAiDefinition", word: instance.sourceWord, modelId: modelId, messages: messagesContext },
    (response) => {
      if (!activePopups.includes(instance)) {
        stopLoadingQuoteRotation(instance);
        return;
      }

      if (chrome.runtime.lastError) {
        response = { error: chrome.runtime.lastError.message };
      }

      if (response && !response.error) {
        instance.messages[messageIndex] = { role: 'assistant', content: response.definition, citations: response.citations || [], isError: false, needsRetry: false };
      } else {
        instance.messages[messageIndex] = { 
           role: 'assistant', 
           content: `<span style="color:red;">Error retrying message: ${String(response?.error || 'Unknown error').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span>`, 
           isError: true 
        };
      }
      renderMessages(instance);
    }
  );
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

  // --- Model Selector ---
  const modelSelector = document.createElement('select');
  modelSelector.id = 'ai-popup-model-selector';

  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    if (model.id === currentModelId) {
      option.selected = true;
    }
    modelSelector.appendChild(option);
  });

  modelSelector.addEventListener('change', () => {
    triggerRedefine();
  });

  // --- Prompt Selector ---
  const promptSelector = document.createElement('select');
  promptSelector.id = 'ai-popup-prompt-selector';

  if (prompts && prompts.length > 0) {
    // Add System Default option
    const systemOption = document.createElement('option');
    systemOption.value = ''; // Empty string represents system default
    systemOption.textContent = defaultPromptId === 'system' ? 'System Default (Default)' : 'System Default';
    
    // Select the system option if it's explicitly the current one (empty string), or if no current one is set and it's the default.
    if (currentPromptContent === '') {
      systemOption.selected = true;
    } else if (!currentPromptContent && defaultPromptId === 'system') {
      systemOption.selected = true;
    }
    
    promptSelector.appendChild(systemOption);

    prompts.forEach(prompt => {
      const option = document.createElement('option');
      option.value = prompt.content; // Use content as value for simplicity

      let displayName = prompt.name;
      if (prompt.id === defaultPromptId) {
        displayName += " (Default)";
      }
      option.textContent = displayName;

      if (prompt.content === currentPromptContent) {
        option.selected = true;
      } else if (!currentPromptContent && prompt.id === defaultPromptId) {
        option.selected = true;
      }

      promptSelector.appendChild(option);
    });
  } else {
    // Handle case with no prompts - use empty value and disable selector
    const option = document.createElement('option');
    option.value = ''; // Empty value so redefine uses default system prompt
    option.textContent = "No Custom Prompts";
    option.disabled = true;
    option.selected = true;
    promptSelector.appendChild(option);
    promptSelector.disabled = true; // Disable the entire selector
  }

  promptSelector.addEventListener('change', () => {
    triggerRedefine();
  });

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
    // only record the choice — follow-ups read the selectors live.
    if (selectedText === "Custom Question") {
      instance.lastModelId = newModelId;
      instance.lastModelName = models.find(m => m.id === newModelId)?.name;
      return;
    }

    redefineWithModelAndPrompt(instance, selectedText, newModelId, newPromptContent);
  }
}

// --- Function to get a new definition with a specific model and prompt ---
function redefineWithModelAndPrompt(instance, word, modelId, promptContent) {
  if (!activePopups.includes(instance)) return;
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
    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: word, modelId: modelId, customPrompt: promptContent },
      (response) => {
        if (!activePopups.includes(instance)) {
          stopLoadingQuoteRotation(instance);
          return;
        }
        
        // Remove the temporary thinking indicator
        instance.messages = instance.messages.filter(m => !m.isThinking);

        if (chrome.runtime.lastError) {
          response = { error: chrome.runtime.lastError.message };
        }

        // 1. Re-create selectors
        if (response && response.models && response.models.length > 0) {
          createSelectors(instance, response.models, response.customPrompts, modelId, promptContent, word, response.defaultPromptId);
        }

        if (response && response.error) {
          const errorId = 'error-' + Date.now();
          const errorHtml = `<span style="color:red;">Error: ${String(response.error).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span> <button id="${errorId}-retry" class="ai-popup-retry-btn" style="background:#4db6ac; color:white; border:none; border-radius:3px; cursor:pointer; padding:2px 6px; font-size:11px; margin-left:5px;">Reload</button>`;
          
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
          const modelName = response && response.models ? (response.models.find(m => m.id === modelId)?.name || 'Unknown Model') : 'Unknown Model';
          
          if (response && response.usedPrompt) {
             // Instead of wiping the array, rebuild/modify the existing messages.
             // If we already have follow-ups, preserve them.
             if (instance.messages && instance.messages.length > 2) {
                instance.messages[0] = { role: 'user', content: response.usedPrompt };
                instance.messages[1] = { role: 'assistant', content: response.definition, citations: response.citations || [] };
                
                // Flag subsequent AI messages as needing retry
                instance.lastModelId = modelId;
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

          // --- NEW: Trigger Hallucination Verification for Redefined Fetch (with Smart Bypass) ---
          chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
            if (guardData.enableHallucinationGuard) {
              if (response && response.usedWebSearch) {
                showSearchGroundedIndicator(instance);
              } else {
                triggerVerification(instance, word, definitionText);
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
    if (instance.isPinned) {
      pinButton.style.opacity = '0.5';
      pinButton.style.color = '#80cbc4';
    }
    pinButton.onclick = (e) => {
      e.stopPropagation();
      instance.isPinned = !instance.isPinned;
      pinButton.style.opacity = instance.isPinned ? '0.5' : '1';
      pinButton.style.color = instance.isPinned ? '#80cbc4' : '#4db6ac';
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

      // It is appended with the other action controls once they have all been
      // created. `selectorsContainer` is scoped to createSelectors(), so using
      // it here previously threw a ReferenceError and stopped this callback.

      // Handle clicking outside custom dropdown (inside shadow root).
      // Registered once per popup instance; the handler resolves the live
      // dropdown at click time, so recreateDropdown() never stacks listeners
      // or keeps detached dropdowns alive via stale closures.
      if (!instance.listDropdownOutsideClickBound) {
        instance.listDropdownOutsideClickBound = true;
        instance.container.shadowRoot.addEventListener('click', (e) => {
          const dropdown = instance.container.shadowRoot.querySelector('.custom-select-container');
          if (dropdown && !dropdown.contains(e.target)) {
            const optionsContainer = dropdown.querySelector('.custom-options');
            if (optionsContainer) optionsContainer.classList.remove('show');
          }
        });
      }
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

      // Send message to background to save with listId
      chrome.runtime.sendMessage({
        type: "saveToHistory",
        word: wordToSave,
        definition: definitionToSave,
        listId: selectedListId,
        modelName: modelName,
        promptName: promptName,
        sourceUrl: window.location.href,
        sourceTitle: document.title,
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
        
        // Fetch settings and process
        chrome.storage.sync.get({
          sttApiKey: '',
          sttApiUrl: 'https://api.openai.com/v1/audio/transcriptions',
          sttModel: 'whisper-1',
          sttCustomHeaders: '',
          sttCustomFormData: ''
        }, async (settings) => {
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

    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: word, modelId: modelId, messages: instance.messages.filter(m => !m.isThinking && !m.isError) },
      (response) => {
        if (!activePopups.includes(instance)) {
          stopLoadingQuoteRotation(instance);
          return;
        }

        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();

        // Remove the loading indicator
        instance.messages = instance.messages.filter(m => !m.isThinking);

        if (response && !response.error) {
          instance.messages.push({ role: 'assistant', content: response.definition, citations: response.citations || [] });
          
          // --- NEW: Trigger Hallucination Verification (with Smart Bypass) ---
          chrome.storage.sync.get(['enableHallucinationGuard'], (guardData) => {
            if (guardData.enableHallucinationGuard) {
              if (response && response.usedWebSearch) {
                showSearchGroundedIndicator(instance);
              } else {
                const userMsgs = instance.messages.filter(m => m.role === 'user');
                const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : word;
                triggerVerification(instance, lastUserMsg, response.definition);
              }
            }
          });
        } else {
          // Add error message with retry button to history
          const errorId = 'error-' + Date.now();
          const errorHtml = `<span style="color:red;">Error: ${String(response?.error || 'Unknown error').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</span> <button id="${errorId}-retry" class="ai-popup-retry-btn" style="background:#4db6ac; color:white; border:none; border-radius:3px; cursor:pointer; padding:2px 6px; font-size:11px; margin-left:5px;">Reload</button>`;
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
function saveConversationAsPdf(instance) {
  // Escape user/AI text before it is placed into the printable HTML so that
  // untrusted content cannot inject markup or script into the PDF page.
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let html = `<!DOCTYPE html><html><head><title>Conversation Backup</title>
  <style>
    body { font-family: 'Google Sans', 'Google Sans Text', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px; margin: auto; line-height: 1.6; }
    .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
    .user { background-color: #e3f2fd; border-left: 4px solid #1976d2; }
    .ai { background-color: #f5f5f5; border-left: 4px solid #4caf50; }
    .role { font-weight: bold; margin-bottom: 8px; font-size: 1.1em; }
    .title { text-align: center; color: #333; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
    @media print {
      body { max-width: 100%; padding: 0; }
      .message { page-break-inside: avoid; }
    }
  </style>
  </head><body>
  <h2 class="title">AI Conversation Transcript</h2>`;

  instance.messages.forEach(msg => {
    if (msg.isThinking || msg.isError || msg.needsRetry) return;
    const roleName = msg.role === 'user' ? 'You' : 'AI';
    const className = msg.role === 'user' ? 'user' : 'ai';
    const content = msg.displayContent || msg.content || "";

    // ALWAYS escape first, then apply our own (safe) markdown transformations.
    let formattedContent = escapeHtml(content);

    if (msg.role !== 'user') {
      formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formattedContent = formattedContent.replace(/\n/g, '<br>');
    }

    html += `<div class="message ${className}"><div class="role">${escapeHtml(roleName)}</div><div>${formattedContent}</div></div>`;
  });

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

function triggerVerification(popupInstance, originalPrompt, aiResponse) {
  if (!popupInstance || !popupInstance.popup) return;
  const msg = lastAssistantMessage(popupInstance);
  if (!msg) return;

  msg.verification = { state: 'pending' };
  renderMessages(popupInstance);

  chrome.runtime.sendMessage({
    type: "verifyAiResponse",
    originalPrompt: originalPrompt,
    aiResponse: aiResponse
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
    }
    renderMessages(popupInstance);
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


// NEW: Unselect PDF.js editors when clicking outside in NONE mode.
// These editor fixes only apply inside the extension's bundled PDF viewer
// (pdf/web/custom-viewer.html); on ordinary pages the selectors can never
// match, so skip the listeners and CSS injection entirely.
if (window.location.pathname.includes('custom-viewer.html')) {
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.highlightEditor') && !e.target.closest('.editToolbar')) {
      document.querySelectorAll('.highlightEditor.selectedEditor').forEach(el => {
        el.classList.remove('selectedEditor');
        const toolbar = el.querySelector('.editToolbar');
        if (toolbar) toolbar.classList.add('hidden');
      });
    }
  }, true);

  // INJECT CSS VIA JS TO AVOID CACHING ISSUES
  const style = document.createElement('style');
  style.textContent = `
/* FIX FOR PDF.JS COLOR PICKER BUG (INJECTED) */
.annotationEditorLayer .highlightEditor .editToolbar { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; z-index: 99999 !important; }
.annotationEditorLayer .highlightEditor .editToolbar > .dropdown { position:absolute !important; display:flex !important; justify-content:center !important; align-items:center !important; flex-direction:column !important; gap:11px !important; padding-block:8px !important; border-radius:6px !important; background-color:var(--editor-toolbar-bg-color, #f0f0f4) !important; border:1px solid var(--editor-toolbar-border-color, #ccc) !important; box-shadow:var(--editor-toolbar-shadow, 0 2px 6px rgba(0,0,0,0.2)) !important; inset-block-start:calc(100% + 4px) !important; width:calc(100% + 2 * var(--editor-toolbar-padding, 4px)) !important; z-index: 100000 !important; pointer-events: auto !important; }
.annotationEditorLayer .highlightEditor .editToolbar > .dropdown.hidden { display: none !important; }
.annotationEditorLayer .highlightEditor .editToolbar > .dropdown button { width:100% !important; height:auto !important; border:none !important; cursor:pointer !important; display:flex !important; justify-content:center !important; align-items:center !important; background:none !important; }
.annotationEditorLayer .highlightEditor .editToolbar > .dropdown button:is(:active, :focus-visible) { outline:none !important; }
.annotationEditorLayer .highlightEditor .editToolbar > .dropdown button > .swatch { outline-offset:2px !important; }
.annotationEditorLayer .highlightEditor .editToolbar > .dropdown button[aria-selected='true'] > .swatch { outline:2px solid var(--selected-outline-color, #000) !important; }
.annotationEditorLayer .highlightEditor .editToolbar > .dropdown button:is(:hover, :active, :focus-visible) > .swatch { outline:2px solid var(--hover-outline-color, #666) !important; }
`;
  // about:blank frames (match_about_blank) may lack <head>; never let this throw.
  (document.head || document.documentElement).appendChild(style);
}

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

