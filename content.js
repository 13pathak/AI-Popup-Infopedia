let popupContainer = null;
let popup = null;
let isInteractingWithPopup = false;
let isClickInsidePopup = false;

// --- Styles (unchanged) ---
const popupStyles = `
  #ai-definition-popup {
    position: fixed; /* Use fixed positioning relative to the viewport */
    background-color: #333;
    color: #eee;
    border: 1px solid #555;
    border-radius: 8px;
    padding: 12px;
    font-family: sans-serif;
    font-size: 14px;
    line-height: 1.5;
    max-width: 350px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    pointer-events: auto; /* Re-enable pointer events for the popup itself */
    z-index: 1; /* z-index is now relative to its container */
  }

  /* --- NEW: Styles for the model selector --- */
  /* --- NEW: Container for selectors --- */
  #ai-popup-selectors-container {
    display: flex;
    gap: 5px;
    margin-bottom: 10px;
  }

  #ai-popup-model-selector,
  #ai-popup-prompt-selector {
    width: 50%; /* 50:50 split */
    background-color: #444;
    color: #eee;
    border: 1px solid #666;
    border-radius: 4px;
    padding: 5px;
    font-family: sans-serif;
    font-size: 13px;
    box-sizing: border-box;
  }

  /* Wrapper for the AI-generated text */
  #ai-popup-content {
    /* no styles needed, but useful for structure */
  }

  /* --- STYLES FOR BUTTONS --- */
  .ai-popup-actions {
    display: flex;
    justify-content: flex-start; /* Aligns the single button to the LEFT */
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid #555;
  }

  .ai-popup-button {
    font-family: sans-serif;
    font-size: 14px; /* Matches popup text */
    font-weight: bold; /* Make it stand out */
    color: #ff6b6b; /* Make it red */
    cursor: pointer;
    background: none;
    border: none;
    padding: 5px 0; /* Padding only top/bottom */
  }

  .ai-popup-button:hover {
    opacity: 0.8;
  }
`;

// --- Main mouseup listener ---
document.addEventListener('mouseup', (event) => {
  if (isClickInsidePopup || isInteractingWithPopup) {
    isClickInsidePopup = false;
    return;
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length === 0) {
    removePopup();
    return;
  }

  // Count the words. We split by one or more whitespace characters.
  const wordCount = selectedText.split(/\s+/).length;

  if (wordCount > 0 && wordCount <= 6) {
    // Normal behavior for short text
    initiatePopupSequence(selection, selectedText);
  } else {
    // If more than 6 words are selected, ensure the popup is closed
    // (User can trigger it manually via shortcut)
    removePopup();
  }
});

// --- NEW: Message Listener for activation ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "triggerPopup") {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      initiatePopupSequence(selection, selectedText);
    }
  }
});



// --- NEW: Helper to start the popup logic (extracted from mouseup) ---
function initiatePopupSequence(selection, selectedText) {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  showPopup(rect.left, rect.top, "Loading...");

  chrome.runtime.sendMessage({ type: "getAiDefinition", word: selectedText }, (response) => {
    if (!popup) return;

    if (response && response.models && response.models.length > 0) {
      createSelectors(response.models, response.customPrompts, response.defaultModelId, null, selectedText, response.defaultPromptId);
    }

    const definitionText = (response && response.error) ? response.error : (response ? response.definition : "Error resolving definition");

    updatePopup(definitionText);

    if (response && !response.error) {
      const modelName = response.models.find(m => m.id === response.defaultModelId)?.name || 'Unknown Model';
      createActionButtons(selectedText, definitionText, modelName, response.promptName);
    }
    adjustPopupPosition();

    setTimeout(() => {
      if (popupContainer && document.documentElement.contains(popupContainer)) {
        popupContainer.remove();
        document.documentElement.appendChild(popupContainer);
      }
    }, 150);
  });
}


// --- Mousedown listener ---
document.addEventListener('mousedown', (event) => {
  if (popupContainer && popupContainer.shadowRoot) {
    const path = event.composedPath();
    const isClickInside = popupContainer.shadowRoot.contains(path[0]);

    if (isClickInside) {
      // If click starts inside, set the flag so the mouseup listener will ignore it
      isClickInsidePopup = true;
      isInteractingWithPopup = true; // Also set the interaction flag
    } else {
      // --- REVISED LOGIC ---
      // If the click is outside, reset the flag and check for closure.
      isClickInsidePopup = false;
      // Click was outside, so check if we should close
      const selection = window.getSelection();
      if (selection.isCollapsed) {
        removePopup();
      }
      isInteractingWithPopup = false; // Reset on outside click
    }
  }
  else {
    isInteractingWithPopup = false;
    isClickInsidePopup = false;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && popup) {
    removePopup();
  }
});

// --- UPDATED showPopup ---
function showPopup(x, y, content) {
  // Remove existing popup if any
  removePopup();

  // Create the isolated container
  popupContainer = document.createElement('div');
  popupContainer.style.all = 'initial'; // Reset all inherited styles
  popupContainer.style.position = 'fixed';
  popupContainer.style.top = '0';
  popupContainer.style.left = '0';
  popupContainer.style.width = '0';
  popupContainer.style.height = '0';
  popupContainer.style.zIndex = '2147483647'; // This wins the z-index war
  popupContainer.style.pointerEvents = 'none'; // Click-through

  // Attach the shadow root
  const shadow = popupContainer.attachShadow({ mode: 'open' });

  // Inject our styles
  const styleTag = document.createElement('style');
  styleTag.textContent = popupStyles;
  shadow.appendChild(styleTag);

  // Create the popup element
  popup = document.createElement('div');
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
}

// --- UPDATED updatePopup ---
function updatePopup(content) {
  if (popup) {
    const contentWrapper = popup.querySelector('#ai-popup-content');
    if (contentWrapper) {
      // Convert Markdown bold (**) to HTML <strong>
      let formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Convert newlines to <br>
      formattedContent = formattedContent.replace(/\n/g, '<br>');

      // Set the formatted HTML
      contentWrapper.innerHTML = formattedContent;
    }
  }
}

// --- NEW: Function to create the model selector dropdown ---
// --- NEW: Function to create the model and prompt selectors ---
function createSelectors(models, prompts, currentModelId, currentPromptContent, selectedText, defaultPromptId) {
  if (!popup) return;

  // Remove existing container if present
  const existingContainer = popup.querySelector('#ai-popup-selectors-container');
  if (existingContainer) {
    existingContainer.remove();
  }

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

  // Default option REMOVED

  if (prompts && prompts.length > 0) {
    prompts.forEach(prompt => {
      const option = document.createElement('option');
      option.value = prompt.content; // Use content as value for simplicity

      let displayName = prompt.name;
      if (prompt.id === defaultPromptId) {
        displayName += " (Default)";
      }
      option.textContent = displayName;

      // Select if it matches current content OR if it's the default and no current content is specified
      if (prompt.content === currentPromptContent) {
        option.selected = true;
      } else if (!currentPromptContent && prompt.id === defaultPromptId) {
        option.selected = true;
      }

      promptSelector.appendChild(option);
    });
  } else {
    // Handle case with no prompts
    const option = document.createElement('option');
    option.textContent = "No Custom Prompts";
    option.disabled = true;
    promptSelector.appendChild(option);
  }

  promptSelector.addEventListener('change', () => {
    triggerRedefine();
  });

  container.appendChild(modelSelector);
  container.appendChild(promptSelector);

  // Prepend the container to the popup
  popup.prepend(container);

  // Helper to trigger redefine
  function triggerRedefine() {
    const newModelId = modelSelector.value;
    const newPromptContent = promptSelector.value;
    redefineWithModelAndPrompt(selectedText, newModelId, newPromptContent);
  }
}

// --- NEW: Function to get a new definition with a specific model ---
// --- NEW: Function to get a new definition with a specific model and prompt ---
function redefineWithModelAndPrompt(word, modelId, promptContent) {
  if (!popup) return;

  // --- NEW: Set the interaction flag ---
  isInteractingWithPopup = true;

  // Update UI to show loading state
  updatePopup("Loading...");
  // Remove old action buttons
  const actions = popup.querySelector('.ai-popup-actions');
  if (actions) actions.remove();

  // Send message to background
  chrome.runtime.sendMessage(
    { type: "getAiDefinition", word: word, modelId: modelId, customPrompt: promptContent },
    (response) => {
      if (!popup) return;

      // 1. Re-create selectors
      if (response.models && response.models.length > 0) {
        createSelectors(response.models, response.customPrompts, modelId, promptContent, word, response.defaultPromptId);
      }

      // Update the definition
      const definitionText = response.error ? response.error : response.definition;
      updatePopup(definitionText);

      // --- NEW: Re-create the save button after model change ---
      if (!response.error) {
        const modelName = response.models.find(m => m.id === modelId)?.name || 'Unknown Model';
        createActionButtons(word, definitionText, modelName, response.promptName);
      }

      adjustPopupPosition();

      // --- NEW: Reset the flag AFTER the entire operation is complete ---
      setTimeout(() => { isInteractingWithPopup = false; }, 100);
    }
  );
}

// --- UPDATED function to only add Save button ---
function createActionButtons(word, definition, modelName, promptName) {
  if (!popup) return;

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
    // --- UPDATED: Handle new response format ---
    if (!response || !response.lists || response.lists.length === 0) {
      // --- Handle case where NO lists exist ---
      actionsContainer.innerHTML = ''; // Clear any previous content
      const errorText = document.createElement('span');
      errorText.textContent = 'Please create a list in the options page first.';
      errorText.style.opacity = '0.8';
      errorText.style.fontSize = '13px';
      actionsContainer.appendChild(errorText);

      // Keep the popup open for a bit longer so the user can read the message
      setTimeout(() => {
        isInteractingWithPopup = false; // Allow closure again
        removePopup();
      }, 2500);
      return; // Stop execution
    }

    const lists = response.lists;
    const lastUsedListId = response.lastUsedListId; // --- NEW ---

    // 2. Create list selector
    const listSelector = document.createElement('select');
    listSelector.style.cssText = `
        flex-grow: 1;
        background-color: #444;
        color: #eee;
        border: 1px solid #666;
        border-radius: 4px;
        padding: 5px;
        font-family: sans-serif;
        font-size: 13px;
      `;
    lists.forEach(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.name;

      // --- NEW: Check if this list was the last one used ---
      if (list.id === lastUsedListId) {
        option.selected = true;
      }
      // --- END NEW ---

      listSelector.appendChild(option);
    });

    // 3. Create the final "Save" button
    const finalSaveButton = document.createElement('button');
    finalSaveButton.textContent = 'Save'; // Changed from 'Confirm Save'
    finalSaveButton.className = 'ai-popup-button';
    finalSaveButton.style.marginLeft = '10px';

    finalSaveButton.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const selectedListId = listSelector.value;

      // Deselect text
      window.getSelection().removeAllRanges();

      // Send message to background to save with listId
      chrome.runtime.sendMessage({
        type: "saveToHistory",
        word: word,
        definition: definition,
        listId: selectedListId,
        modelName: modelName,
        promptName: promptName,
        sourceUrl: window.location.href,
        sourceTitle: document.title
      }, (saveResponse) => {
        if (saveResponse && saveResponse.status === 'saved') {
          console.log('Definition saved to list.');
        }
      });

      // Update UI to show "Saved!"
      actionsContainer.innerHTML = ''; // Clear the controls
      const savedText = document.createElement('span');
      savedText.textContent = 'Saved!';
      savedText.style.opacity = '0.8';
      actionsContainer.appendChild(savedText);

      // Close popup after a delay
      setTimeout(() => removePopup(), 800);
    });

    // 4. Add the new controls directly to the container
    actionsContainer.appendChild(listSelector);
    actionsContainer.appendChild(finalSaveButton);
  });

  // Add the container to the popup
  popup.appendChild(actionsContainer);
}


// --- UPDATED removePopup ---
function removePopup() {
  if (popupContainer) {
    popupContainer.remove();
    popupContainer = null;
  }
  popup = null; // Clear the reference
}

// --- UPDATED adjustPopupPosition ---
function adjustPopupPosition() {
  if (!popup) return;

  // --- THE DEFINITIVE FIX ---
  // If we are interacting with the popup (e.g., changing a model), do NOT close it, even if text is deselected.
  if (isInteractingWithPopup) {
    return;
  }
  const selection = window.getSelection();
  // We check rangeCount *and* if the selection is collapsed (no text)
  if (selection.rangeCount === 0 || selection.isCollapsed) {
    // Don't remove popup if it's in the 'Saved!' state
    if (popup.querySelector('.ai-popup-button:disabled')) {
      return;
    }
    removePopup();
    return;
  }

  const selectionRect = selection.getRangeAt(0).getBoundingClientRect(); // Viewport-relative
  const popupRect = popup.getBoundingClientRect(); // Viewport-relative
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let newLeft = selectionRect.left; // Start with selection's left
  let newTop;

  // --- DYNAMIC VERTICAL PLACEMENT (VIEWPORT-RELATIVE) ---
  // Check if there's enough space *above* the selection
  if (selectionRect.top > popupRect.height + 10) {
    // Yes, place it ABOVE
    newTop = selectionRect.top - popupRect.height - 10; // 10px padding
  } else {
    // No, place it BELOW
    newTop = selectionRect.bottom + 10; // 10px padding
  }

  // --- Horizontal Adjustment ---
  if (newLeft + popupRect.width > viewportWidth - 10) {
    newLeft = viewportWidth - popupRect.width - 10;
  }
  if (newLeft < 10) {
    newLeft = 10;
  }

  // Apply final positions (NO scrollX/scrollY needed!)
  popup.style.left = `${newLeft}px`;
  popup.style.top = `${newTop}px`;
}
