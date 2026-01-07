// --- Global State for Stacked Popups ---
let activePopups = []; // Array of { container, popup, isInteracting, isClickInside }
let baseZIndex = 2100000000;

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
    align-items: center; /* Vertically center items */
    gap: 10px; /* Space between items */
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid #555;
  }

  .ai-popup-button {
    font-family: sans-serif;
    font-size: 14px; 
    font-weight: bold; 
    color: #ff6b6b; 
    cursor: pointer;
    background: none;
    border: none;
    padding: 5px 10px; /* Add horizontal padding */
    white-space: nowrap; /* Prevent wrapping */
    flex-shrink: 0; /* Prevent button from shrinking */
  }

  .ai-popup-button:hover {
    opacity: 0.8;
  }

  /* SPEECH BUTTON */
  #ai-popup-speak-btn {
    font-size: 18px; /* Slightly larger icon */
    color: #4db6ac;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  #ai-popup-speak-btn:hover {
    color: #80cbc4;
  }
`;

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
      initiatePopupSequence(selectionRect, selectedText);
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

      initiatePopupSequence(selectionRect, selectedText);
    }
  } else {
    // No text selected anywhere. logic for closing is handled in mousedown (outside click)
  }
});

// --- NEW: Message Listener for activation ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "triggerPopup") {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      initiatePopupSequence(rect, selectedText);
    }
  }
});


// --- NEW: Helper to start the popup logic (extracted from mouseup) ---
function initiatePopupSequence(rect, selectedText) {
  // Create a new popup instance
  // Note: we track the instance object to manage its state updates
  const popupInstance = showPopup(rect.left, rect.top, "Loading...");

  // --- NEW: Store the source text to prevent duplicate triggers ---
  popupInstance.sourceText = selectedText;

  chrome.runtime.sendMessage({ type: "getAiDefinition", word: selectedText }, (response) => {
    // Verify instance still exists (user might have closed it)
    if (!activePopups.includes(popupInstance)) return;

    const popupEl = popupInstance.popup;

    if (response && response.models && response.models.length > 0) {
      createSelectors(popupInstance, response.models, response.customPrompts, response.defaultModelId, null, selectedText, response.defaultPromptId);
    }

    const definitionText = (response && response.error) ? response.error : (response ? response.definition : "Error resolving definition");

    updatePopupContent(popupInstance, definitionText);

    if (response && !response.error) {
      const modelName = response.models.find(m => m.id === response.defaultModelId)?.name || 'Unknown Model';
      createActionButtons(popupInstance, selectedText, definitionText, modelName, response.promptName);
    }
    adjustPopupPosition(popupInstance, rect);
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
    isClickInside: false
  };

  activePopups.push(instance);
  return instance;
}

// --- UPDATED updatePopupContent ---
function updatePopupContent(instance, content) {
  const popup = instance.popup;
  if (!popup) return;

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

// --- Function to create the model and prompt selectors ---
function createSelectors(instance, models, prompts, currentModelId, currentPromptContent, selectedText, defaultPromptId) {
  const popup = instance.popup;
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

  if (prompts && prompts.length > 0) {
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

  // Prepend the container to the popup
  popup.prepend(container);

  // Helper to trigger redefine
  function triggerRedefine() {
    const newModelId = modelSelector.value;
    const newPromptContent = promptSelector.value;
    redefineWithModelAndPrompt(instance, selectedText, newModelId, newPromptContent);
  }
}

// --- Function to get a new definition with a specific model and prompt ---
function redefineWithModelAndPrompt(instance, word, modelId, promptContent) {
  if (!activePopups.includes(instance)) return;
  const popup = instance.popup;

  // Set the interaction flag
  instance.isInteracting = true;

  // Update UI to show loading state
  updatePopupContent(instance, "Loading...");
  // Remove old action buttons
  const actions = popup.querySelector('.ai-popup-actions');
  if (actions) actions.remove();

  // Send message to background
  chrome.runtime.sendMessage(
    { type: "getAiDefinition", word: word, modelId: modelId, customPrompt: promptContent },
    (response) => {
      if (!activePopups.includes(instance)) return;

      // 1. Re-create selectors
      if (response.models && response.models.length > 0) {
        createSelectors(instance, response.models, response.customPrompts, modelId, promptContent, word, response.defaultPromptId);
      }

      // Update the definition
      const definitionText = response.error ? response.error : response.definition;
      updatePopupContent(instance, definitionText);

      // Re-create the save button after model change
      if (!response.error) {
        const modelName = response.models.find(m => m.id === modelId)?.name || 'Unknown Model';
        createActionButtons(instance, word, definitionText, modelName, response.promptName);
      }

      // We don't automatically adjust position on redefine to prevent jumping, 
      // but if size changes significantly we might need to. 
      // For now, let's keep it in place or just ensure it stays within bounds.
      // adjustPopupPosition(instance, ...); 

      // Reset the flag
      setTimeout(() => { instance.isInteracting = false; }, 100);
    }
  );
}

// --- UPDATED to accept instance ---
function createActionButtons(instance, word, definition, modelName, promptName) {
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
    // --- UPDATED: Handle new response format ---
    // Fix: check if instance still valid after async
    if (!activePopups.includes(instance)) return;

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
        instance.isInteracting = false; // Allow closure again
        removePopupInstance(instance);
      }, 2500);
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

    // Helper to populate options
    function populateListOptions() {
      listSelector.innerHTML = '';
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

      // --- NEW: Add "Create New List" option ---
      const createOption = document.createElement('option');
      createOption.value = "__create_new__";
      createOption.textContent = "+ Create New List...";
      createOption.style.fontWeight = "bold";
      createOption.style.color = "#88ff88"; // Light green to stand out
      listSelector.appendChild(createOption);
    }

    populateListOptions();

    // Handle change event for creating new list
    listSelector.addEventListener('change', (e) => {
      if (e.target.value === "__create_new__") {
        instance.isInteracting = true; // Prevent close while prompting
        const newListName = prompt("Enter a name for the new list:");
        instance.isInteracting = false;

        if (newListName && newListName.trim()) {
          // Send message to create list
          chrome.runtime.sendMessage({ type: "createList", listName: newListName.trim() }, (response) => {
            if (response && response.success) {
              // Add to local lists array
              lists.push(response.newList);
              // Update lastUsedListId to the new list
              // actually we can't update the variable 'lastUsedListId' effectively for the next run without re-fetching, 
              // but for this UI instance we just select it.

              // Refresh options
              populateListOptions();
              // Select the new list
              listSelector.value = response.newList.id;
            } else {
              alert("Failed to create list: " + (response.error || "Unknown error"));
              // Revert selection?
              // Simple revert to first or previous is hard without state tracking,
              // simpler to just re-populate which resets to default/lastUsed logic if possible,
              // or just let it stay on "Create New List" (harmless).
              populateListOptions();
            }
          });
        } else {
          // User cancelled or entered empty
          populateListOptions(); // Reset
        }
      }
    });

    // 4. Create the final "Save" button
    const finalSaveButton = document.createElement('button');
    finalSaveButton.textContent = 'Save';
    finalSaveButton.className = 'ai-popup-button';
    // Removed manual margin-left, relying on flex gap


    finalSaveButton.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const selectedListId = listSelector.value;

      // --- REMOVED: Deselect text ---
      // window.getSelection().removeAllRanges();

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

      // --- REMOVED: Auto-close logic ---
      // We keep the popup open so the user can continue interacting.
      // window.getSelection().removeAllRanges();
      // setTimeout(() => removePopup(), 800);
    });

    // 4. Add the new controls directly to the container
    // 4. Add the new controls directly to the container
    actionsContainer.appendChild(speakButton); // Add speaker first
    actionsContainer.appendChild(listSelector);
    actionsContainer.appendChild(finalSaveButton);
  });

  // Add the container to the popup
  popup.appendChild(actionsContainer);
}


// --- Updated remove functions ---
function removeAllPopups() {
  activePopups.forEach(instance => {
    if (instance.container) instance.container.remove();
  });
  activePopups = [];
  window.speechSynthesis.cancel();
}

function removeLastPopup() {
  if (activePopups.length === 0) return;
  const lastInstance = activePopups.pop();
  if (lastInstance.container) lastInstance.container.remove();
  if (activePopups.length === 0) {
    window.speechSynthesis.cancel();
  }
}

function removePopupInstance(instance) {
  const index = activePopups.indexOf(instance);
  if (index > -1) {
    activePopups.splice(index, 1);
    if (instance.container) instance.container.remove();
  }
  if (activePopups.length === 0) {
    window.speechSynthesis.cancel();
  }
}

// --- Text-to-Speech Logic (Scope: Global but controlled per button) ---
let isSpeaking = false;

function toggleSpeech(instance, text) {
  const popup = instance.popup;
  const btn = popup.querySelector('#ai-popup-speak-btn'); // Only controls THIS popup's button

  if (isSpeaking) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
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
        isSpeaking = false;
        if (btn) btn.innerHTML = '🔊';
      };

      utterance.onerror = (e) => {
        console.error("Speech error", e);
        isSpeaking = false;
        if (btn) btn.innerHTML = '🔊';
      };

      window.speechSynthesis.speak(utterance);
      isSpeaking = true;
      if (btn) btn.innerHTML = '⏹'; // Stop icon
    });
  }
}

// --- UPDATED adjustPopupPosition ---
function adjustPopupPosition(instance, selectionRect) {
  const popup = instance.popup;
  if (!popup) return;

  if (instance.isInteracting) return;

  // We rely on the initial selectionRect passed to init, 
  // or we could possibly re-measure if we tracked the range.
  // The passed `selectionRect` is static (snapshot at mouseup).
  // Ideally, if the user scrolls, the popup is 'fixed', so it stays on screen, but it might drift from text.
  // The original implementation used 'fixed' and 'mousedown' closing logic, effectively behaving like a modal tooltip.

  const popupRect = popup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  // const viewportHeight = window.innerHeight; // unused

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
