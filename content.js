// --- Global State for Stacked Popups ---
let activePopups = []; // Array of { container, popup, isInteracting, isClickInside }
let baseZIndex = 2100000000;

// --- Styles (unchanged) ---
const popupStyles = `
  #ai-definition-popup {
    position: fixed; /* Use fixed positioning relative to the viewport */
    background: linear-gradient(145deg, #252a35 0%, #171b24 100%);
    color: #eef3f8;
    border: 1px solid rgba(125, 211, 252, 0.22);
    border-radius: 12px;
    padding: 18px 14px 14px 14px;
    font-family: sans-serif;
    font-size: 14px;
    line-height: 1.5;
    width: min(350px, calc(100vw - 28px));
    max-width: 350px;
    box-sizing: border-box;
    max-height: 85vh; /* Keep the popup within screen bounds */
    display: flex;
    flex-direction: column;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42), 0 3px 12px rgba(0, 0, 0, 0.28);
    pointer-events: auto; /* Re-enable pointer events for the popup itself */
    z-index: 1; /* z-index is now relative to its container */
    animation: ai-popup-enter 180ms ease-out;
  }

  @keyframes ai-popup-enter {
    from { opacity: 0; transform: translateY(6px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  #ai-popup-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .ai-popup-context-copy { min-width: 0; }
  .ai-popup-context-label {
    color: #7dd3fc;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .ai-popup-context-query {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #f8fafc;
    font-size: 15px;
    font-weight: 650;
  }
  .ai-popup-context-model {
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 3px 7px;
    color: #b7f7eb;
    background: rgba(45, 212, 191, 0.12);
    border: 1px solid rgba(45, 212, 191, 0.22);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 650;
  }

  /* --- NEW: Styles for custom dropdown --- */
  .custom-select-container { position: relative; flex-grow: 1; min-width: 110px; }
  .custom-select {
      display: flex; align-items: center; justify-content: space-between;
       padding: 7px 10px; background-color: #101827;
       border: 1px solid #475569; border-radius: 8px;
      cursor: pointer; user-select: none; color: #eee;
      font-size: 13px; font-family: sans-serif;
  }
  .custom-select-value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  .custom-select > span:last-child { flex-shrink: 0; margin-left: 8px; }
  .custom-select:focus { outline: none; border-color: #888; }
  .custom-options {
      position: absolute; bottom: 100%; left: 0; right: 0;
       background-color: #0f172a; border: 1px solid #475569;
       border-radius: 8px; margin-bottom: 6px; max-height: 250px; overflow-y: auto;
      z-index: 2000; display: none; box-shadow: 0 -4px 10px rgba(0,0,0,0.4);
      font-size: 13px; font-family: sans-serif;
  }
  .custom-options.show { display: block; }
  .custom-option { padding: 6px 10px; cursor: pointer; display: flex; align-items: center; min-width: 0; }
  .custom-option:hover { background-color: #555; }
  .custom-option.selected { background-color: rgba(150, 150, 255, 0.2); }
  .custom-option > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expand-toggle { cursor: pointer; display: inline-block; width: 16px; text-align: center; color: #aaa; font-size: 10px;}
  .expand-toggle:hover { color: #eee; }
  .indent-spacer { display: inline-block; width: 16px; }

  /* --- NEW: Styles for the model selector --- */
  /* --- NEW: Container for selectors --- */
  #ai-popup-selectors-container {
    display: flex;
     gap: 7px;
     margin-bottom: 12px;
  }

  #ai-popup-model-selector,
  #ai-popup-prompt-selector {
    width: 50%; /* 50:50 split */
     background-color: #101827;
    color: #eee;
     border: 1px solid #475569;
     border-radius: 10px;
     padding: 7px;
    font-family: sans-serif;
     font-size: 13px;
     box-sizing: border-box;
     color-scheme: dark;
  }

  /* Wrapper for the AI-generated text */
  #ai-popup-content {
    overflow-y: auto; /* Scroll if content overflows */
    padding: 2px 5px 2px 1px; /* Spacing for the scrollbar */
    line-height: 1.62;
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
    background: #111c2c;
    border: none;
    border-radius: 10px;
  }

  .ai-popup-button {
    font-family: sans-serif;
    font-size: 14px; 
    font-weight: bold; 
    color: #072b2b;
    cursor: pointer;
    background: #5eead4;
    border: 1px solid #99f6e4;
    border-radius: 10px;
    padding: 6px 11px;
    white-space: nowrap; /* Prevent wrapping */
    flex-shrink: 0; /* Prevent button from shrinking */
  }

  .ai-popup-button:hover {
    background: #99f6e4;
    transform: translateY(-1px);
  }

  /* SPEECH, PDF & PIN BUTTONS */
  #ai-popup-speak-btn, #ai-popup-pdf-btn, #ai-popup-pin-btn {
    width: 30px;
    height: 30px;
    font-size: 15px;
    color: #b9f6ed;
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
    color: #e6fffb;
    background: rgba(45, 212, 191, 0.15);
    transform: translateY(-1px);
  }

  /* --- NEW: Follow-up Prompt --- */
  #ai-popup-followup-container {
    display: flex;
    position: relative;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    gap: 8px;
    align-items: center;
  }
  
  #ai-popup-followup-input {
    flex-grow: 1;
    background-color: #101827;
    color: #eee;
    border: 1px solid #475569;
    border-radius: 10px;
    padding: 6px 36px 6px 10px;
    font-family: sans-serif;
    font-size: 13px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  
  #ai-popup-followup-input::placeholder {
    color: #aaa;
  }

  .ai-popup-followup-send {
    background: #2dd4bf;
    color: #062c2c;
    border: none;
    border-radius: 10px;
    padding: 6px 12px;
    cursor: pointer;
    font-weight: bold;
    font-size: 13px;
  }

  .ai-popup-followup-send:hover {
    background: #99f6e4;
  }

  /* --- NEW: Follow-up Mic Button --- */
  .ai-popup-followup-mic {
    position: absolute;
    right: 4px;
    background: transparent;
    color: #aaa;
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
    color: #eee;
    background: rgba(255,255,255,0.1);
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

  /* --- NEW: Open Button Popup --- */
  #ai-open-button-popup {
    position: fixed;
    background-color: #4db6ac;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-family: sans-serif;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    z-index: 1;
  }
  #ai-open-button-popup:hover {
    background-color: #62c3b8;
  }

  /* --- Feedback Prompt Banner Styles --- */
  .ai-feedback-banner {
    margin-top: 10px;
    padding: 10px 12px;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(125, 211, 252, 0.28);
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
    color: #e2e8f0;
    font-size: 12px;
  }
  .ai-feedback-close {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    line-height: 1;
    border-radius: 4px;
  }
  .ai-feedback-close:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
  .ai-feedback-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .ai-feedback-btn {
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 6px;
    color: #f1f5f9;
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
    background: #334155;
    border-color: #64748b;
    color: #fff;
  }
  .ai-feedback-btn.primary {
    background: #0284c7;
    border-color: #38bdf8;
    color: #fff;
  }
  .ai-feedback-btn.primary:hover {
    background: #0369a1;
  }
`;

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
  arrow.textContent = '▼';
  
  selectBtn.append(valueDisplay, arrow);
  
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-options';

  container.append(selectBtn, optionsContainer);

  let selectedId = currentValue;
  const expandedState = {}; 

  const sortedList = getSortedTreeLists(lists);

  const allItems = [];
  if (options.showAllLists) allItems.push({ id: '__all_lists__', name: '🗂 All Lists', depth: 0 });
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
        toggle.textContent = expandedState[item.id] ? '▼' : '▶';
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
  const popupInstance = showPopup(rect.left, rect.top, "Loading...");
  popupInstance.isLoading = true;

  // --- NEW: Store the source text to prevent duplicate triggers ---
  popupInstance.sourceText = selectedText;

  function performInitialFetch() {
    updatePopupContent(popupInstance, "Loading...");
    
    // Remove old action buttons if retrying
    if (popupInstance.popup) {
      const actions = popupInstance.popup.querySelector('.ai-popup-actions');
      if (actions) actions.remove();
    }

    const payload = { type: "getAiDefinition", word: selectedText };
    if (customPrompt) payload.customPrompt = customPrompt;

    chrome.runtime.sendMessage(payload, (response) => {
      // Verify instance still exists (user might have closed it)
      if (!activePopups.includes(popupInstance)) return;
      popupInstance.isLoading = false;

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
  contentWrapper.innerHTML = content; // "Loading..."
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

  activePopups.push(instance);
  return instance;
}

// --- NEW: renderMessages maps state to UI ---
function renderMessages(instance) {
  const popup = instance.popup;
  if (!popup) return;

  const contentWrapper = popup.querySelector('#ai-popup-content');
  if (!contentWrapper) return;

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

      if (msg.role === 'user' && !instance.showUserQuestions) return; // Hide user prompts unless setting is true

      const isMainDefinition = (index === 0 || index === 1) && instance.messages.length <= 2;

      if (isMainDefinition && !msg.isError) {
        // If it's the very first main definition, don't prefix with AI:
        contentWrapper.insertAdjacentHTML('beforeend', `<div>${formattedContent}</div>`);
      } else {
        // Conversational flow UI for follow-ups
        const roleName = msg.role === 'user' ? 'You' : 'AI';
        const color = msg.role === 'user' ? '#90caf9' : '#a5d6a7';
        
        let html = '';
        if (msg.needsRetry) {
          // Output a retry button instead of the message content
          const retryBtnId = `retry-msg-${index}`;
          const targetModelName = instance.lastModelName || 'New Model';
          html = `<div style="margin-top: 12px; font-style: italic; color: #888;">
                    <strong style="color: ${color};">${roleName}:</strong>
                    <div style="margin-top: 5px;">
                       <button id="${retryBtnId}" class="ai-popup-retry-btn" style="background:#4db6ac; color:white; border:none; border-radius:3px; cursor:pointer; padding:4px 8px; font-size:12px;">
                         🔄 Retry with ${targetModelName}
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
  details.style.marginTop = '8px';
  details.style.padding = '7px 9px';
  details.style.borderRadius = '6px';
  details.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
  details.style.borderLeft = '3px solid #3b82f6';
  details.style.fontSize = '12px';

  const summary = document.createElement('summary');
  summary.textContent = `Sources used (${validCitations.length})`;
  summary.style.cursor = 'pointer';
  summary.style.color = '#7dd3fc';
  summary.style.fontWeight = '600';
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
    link.style.color = '#a5d6ff';
    link.style.textDecoration = 'underline';
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
  
  // Set the message state to loading
  instance.messages[messageIndex] = { role: 'assistant', content: '<i>Thinking...</i>', isError: false, needsRetry: false };
  renderMessages(instance);

  const modelId = instance.lastModelId || null;

  chrome.runtime.sendMessage(
    { type: "getAiDefinition", word: instance.sourceWord, modelId: modelId, messages: messagesContext },
    (response) => {
      if (!activePopups.includes(instance)) return;

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
    instance.messages.push({ role: 'assistant', content: '<i style="color: #aaa;">Reloading model definition...</i>', isThinking: true });
    try { renderMessages(instance); } catch (e) { console.error('crash in pre redfr', e); }
    
    // Remove old action buttons
    const actions = popup.querySelector('.ai-popup-actions');
    if (actions) actions.remove();

    // Send message to background
    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: word, modelId: modelId, customPrompt: promptContent },
      (response) => {
        if (!activePopups.includes(instance)) return;
        
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

    // --- NEW: SPEECH BUTTON ---
    const speakButton = document.createElement('span'); // Use span for icon
    speakButton.id = 'ai-popup-speak-btn';
    speakButton.innerHTML = '🔊'; // Speaker icon
    speakButton.title = 'Listen to explanation';
    speakButton.onclick = (e) => {
      e.stopPropagation();
      toggleSpeech(instance, definition);
    };

    // --- NEW: PDF BUTTON ---
    const pdfButton = document.createElement('span');
    pdfButton.id = 'ai-popup-pdf-btn';
    pdfButton.innerHTML = '📄'; // PDF icon
    pdfButton.title = 'Save conversation as PDF';
    pdfButton.onclick = (e) => {
      e.stopPropagation();
      saveConversationAsPdf(instance);
    };

    // --- NEW: PIN BUTTON ---
    const pinButton = document.createElement('span');
    pinButton.id = 'ai-popup-pin-btn';
    pinButton.innerHTML = '📌'; // Pin icon
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
                alert("Failed to create list: " + (response.error || "Unknown error"));
                listSelector.value = (lastUsedListId || (listsToUse.length ? listsToUse[0].id : null));
              }
            });
          } else {
            listSelector.value = (lastUsedListId || (listsToUse.length ? listsToUse[0].id : null));
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

    recreateDropdown(lists, lastUsedListId || (lists.length ? lists[0].id : null));

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
        actionsContainer.innerHTML = ''; // Clear the controls
        const savedText = document.createElement('span');
        if (chrome.runtime.lastError || (saveResponse && saveResponse.status === 'error')) {
          console.error('Failed to save definition:', chrome.runtime.lastError || saveResponse?.error);
          savedText.textContent = '✕ Failed to save';
          savedText.style.color = '#ff8585';
        } else {
          console.log('Definition saved to list.');
          savedText.textContent = '✓ Saved to list';
          savedText.style.color = '#b7f7eb';
        }
        savedText.style.opacity = '0.8';
        savedText.style.fontWeight = '600';
        actionsContainer.appendChild(savedText);
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
            alert("Speech-to-Text API Key is not configured.");
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
            alert("Failed to transcribe audio.");
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
      alert("Microphone access denied or unavailable.");
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
          alert("Native speech recognition is not supported in this browser.");
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
      instance.messages.push({ role: 'assistant', content: '<i style="color: #aaa;">Thinking...</i>', isThinking: true });
      renderMessages(instance);
    } catch (e) {
      console.error("render crashed on pre-fetch", e);
    }

    const selectedModelOpt = popup.querySelector('#ai-popup-model-selector');
    const modelId = selectedModelOpt ? selectedModelOpt.value : null;

    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: word, modelId: modelId, messages: instance.messages.filter(m => !m.isThinking && !m.isError) },
      (response) => {
        if (!activePopups.includes(instance)) return;

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
    if (btn) btn.innerHTML = '🔊';
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
        if (btn) btn.innerHTML = '🔊';
      };

      utterance.onerror = (e) => {
        console.error("Speech error", e);
        instance.isSpeaking = false;
        if (btn) btn.innerHTML = '🔊';
      };

      window.speechSynthesis.speak(utterance);
      instance.isSpeaking = true;
      if (btn) btn.innerHTML = '⏹'; // Stop icon
    });
  }
}

// --- UPDATED adjustPopupPosition ---
function adjustPopupPosition(instance, selectionRect) {
  const popup = instance.popup;
  if (!popup) return;

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
    body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: auto; line-height: 1.6; }
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
function showSearchGroundedIndicator(popupInstance) {
  if (!popupInstance || !popupInstance.popup) return;
  const contentWrapper = popupInstance.popup.querySelector('#ai-popup-content');
  if (!contentWrapper) return;

  const indicator = document.createElement('div');
  indicator.className = 'ai-popup-search-grounded';
  indicator.style.marginTop = '12px';
  indicator.style.padding = '8px';
  indicator.style.borderRadius = '6px';
  indicator.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
  indicator.style.borderLeft = '3px solid #3b82f6';
  indicator.style.fontSize = '12px';
  indicator.style.color = 'inherit';
  indicator.innerHTML = `🌐 <strong style="color:#7dd3fc;">Search Grounded</strong> <span style="opacity:0.8">· Response is based on live web results. Hallucination Guard bypassed.</span>`;
  contentWrapper.appendChild(indicator);

  // if (contentWrapper.scrollHeight > contentWrapper.clientHeight) {
  //   contentWrapper.scrollTop = contentWrapper.scrollHeight;
  // }
}

// --- NEW: Hallucination Verification UI Logic ---
function triggerVerification(popupInstance, originalPrompt, aiResponse) {
  if (!popupInstance || !popupInstance.popup) return;
  const contentWrapper = popupInstance.popup.querySelector('#ai-popup-content');
  if (!contentWrapper) return;
  
  const verifyId = 'verify-' + Date.now();
  const indicator = document.createElement('div');
  indicator.id = verifyId;
  indicator.style.marginTop = '12px';
  indicator.style.padding = '8px';
  indicator.style.borderRadius = '6px';
  indicator.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
  indicator.style.borderLeft = '3px solid #3b82f6';
  indicator.style.fontSize = '12px';
  indicator.style.color = 'inherit';
  indicator.innerHTML = `🛡️ <span style="opacity:0.8;">Verifying response...</span>`;
  
  contentWrapper.appendChild(indicator);
  
  // if (contentWrapper.scrollHeight > contentWrapper.clientHeight) {
  //    contentWrapper.scrollTop = contentWrapper.scrollHeight;
  // }

  chrome.runtime.sendMessage({ 
    type: "verifyAiResponse", 
    originalPrompt: originalPrompt, 
    aiResponse: aiResponse 
  }, (response) => {
    if (!activePopups.includes(popupInstance)) return;
    
    const indEl = popupInstance.popup.querySelector(`#${verifyId}`);
    if (!indEl) return;
    
    if (chrome.runtime.lastError || !response || response.error) {
      indEl.style.backgroundColor = 'rgba(100, 116, 139, 0.1)';
      indEl.style.borderLeftColor = '#64748b';
      indEl.innerHTML = `🛡️ <span style="opacity:0.7">Verification failed or unavailable.</span>`;
      return;
    }
    
    let detailsHtml = '';
    if (response.result && response.result.reasoning) {
       detailsHtml = `<a href="#" id="${verifyId}-toggle" style="margin-left: 10px; font-size: 11px; text-decoration: underline; color: inherit; opacity: 0.7;">View reasoning</a>
       <div style="margin-top: 8px; font-size: 11px; color: inherit; opacity: 0.9; border-top: 1px solid rgba(128,128,128,0.3); padding-top: 6px; display: none;" id="${verifyId}-details"><strong>Reasoning:</strong> ${String(response.result.reasoning).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</div>`;
    }

    if (response.result && response.result.is_hallucinating) {
      indEl.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      indEl.style.borderLeftColor = '#ef4444';
      
      let correctionsHtml = '<ul style="margin:5px 0 0 20px; padding:0;">';
      if (Array.isArray(response.result.corrections)) {
         response.result.corrections.forEach(c => { correctionsHtml += `<li style="margin-bottom:3px;">${String(c).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')}</li>`; });
      }
      correctionsHtml += '</ul>';
      
      indEl.innerHTML = `⚠️ <strong style="color:#ef4444;">Hallucination Detected</strong>${detailsHtml}<div>${correctionsHtml}</div>`;
    } else {
      indEl.style.backgroundColor = 'rgba(94, 234, 212, 0.1)';
      indEl.style.borderLeftColor = '#5eead4';
      indEl.innerHTML = `🛡️ <strong style="color:#5eead4;">Verified</strong> <span style="opacity:0.8">- No hallucinations detected.</span>${detailsHtml}`;
    }
    
    // Attach event listener for toggle
    const toggleBtn = popupInstance.popup.querySelector(`#${verifyId}-toggle`);
    const detailsDiv = popupInstance.popup.querySelector(`#${verifyId}-details`);
    if (toggleBtn && detailsDiv) {
      toggleBtn.addEventListener('click', (e) => {
         e.preventDefault();
         if (detailsDiv.style.display === 'none') {
            detailsDiv.style.display = 'block';
            toggleBtn.textContent = 'Hide reasoning';
         } else {
            detailsDiv.style.display = 'none';
            toggleBtn.textContent = 'View reasoning';
         }
         // if (contentWrapper.scrollHeight > contentWrapper.clientHeight) {
         //    contentWrapper.scrollTop = contentWrapper.scrollHeight;
         // }
      });
    }
    
    // if (contentWrapper.scrollHeight > contentWrapper.clientHeight) {
    //    contentWrapper.scrollTop = contentWrapper.scrollHeight;
    // }
  });
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
        <button class="ai-feedback-close" title="Dismiss">✕</button>
      </div>
      <div class="ai-feedback-actions">
        <button class="ai-feedback-btn" data-action="good">👍 Working well</button>
        <button class="ai-feedback-btn" data-action="trouble">👎 Something isn't working</button>
        <button class="ai-feedback-btn" data-action="feedback">💬 Send feedback</button>
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
        <button class="ai-feedback-close" title="Dismiss">✕</button>
      </div>
      <div class="ai-feedback-actions">
        <button class="ai-feedback-btn primary" data-action="review">⭐ Optional: Leave a review on Chrome Web Store</button>
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
        <button class="ai-feedback-close" title="Dismiss">✕</button>
      </div>
      <div class="ai-feedback-actions">
        <button class="ai-feedback-btn primary" data-action="troubleshoot">⚡ Open Troubleshooting & Support</button>
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

