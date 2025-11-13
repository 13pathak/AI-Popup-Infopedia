let popupContainer = null;
let popup = null;
let isInteractingWithPopup = false; // --- NEW: The definitive flag to solve the race condition ---
let isClickInsidePopup = false; // --- Our flag to prevent the bug ---

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
  #ai-popup-model-selector {
    width: 100%;
    background-color: #444;
    color: #eee;
    border: 1px solid #666;
    border-radius: 4px;
    padding: 5px;
    margin-bottom: 10px;
    font-family: sans-serif;
    font-size: 13px;
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
  // --- THE DEFINITIVE FIX ---
  // If the click started inside our popup OR we are in the middle of an interaction (like changing a model),
  // do absolutely nothing. This prevents this listener from re-triggering a new popup.
  if (isClickInsidePopup || isInteractingWithPopup) {
    isClickInsidePopup = false; // Reset flag
    return;
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // If nothing is selected (or just whitespace), remove the popup and exit
  if (selectedText.length === 0) {
    removePopup();
    return;
  }

  // Count the words. We split by one or more whitespace characters.
  const wordCount = selectedText.split(/\s+/).length;

  // --- THIS IS THE CHANGE ---
  // Only proceed if 1 to 6 words are selected
  if (wordCount > 0 && wordCount <= 6) {
  // --- END OF CHANGE ---
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect(); // This is already viewport-relative!

    // Create and show the popup
    // We pass the viewport-relative coordinates
    showPopup(rect.left, rect.top, "Loading...");

    // Send the selected word to the background script
    // --- REVISED: Removed context from message ---
    chrome.runtime.sendMessage({ type: "getAiDefinition", word: selectedText }, (response) => {
        if (!popup) return; // Popup might have been closed while loading
        
        // --- NEW: Create model selector if models are available ---
        if (response.models && response.models.length > 1) {
          createModelSelector(response.models, response.defaultModelId, selectedText, response.defaultModelId);
        }

        const definitionText = response.error ? response.error : response.definition;
        
        updatePopup(definitionText); // Show the definition
        
        if (!response.error) {
          createActionButtons(selectedText, definitionText);
        }
        adjustPopupPosition();
        
        setTimeout(() => {
          if (popupContainer && document.documentElement.contains(popupContainer)) {
            popupContainer.remove();
            document.documentElement.appendChild(popupContainer);
          }
        }, 150); // 150ms delay
      }
    );
  } else {
    // If more than 6 words are selected, ensure the popup is closed
    removePopup();
  }
});


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
function createModelSelector(models, defaultModelId, selectedText, currentModelId) {
  if (!popup) return;

  // Remove existing selector if present
  const existingSelector = popup.querySelector('#ai-popup-model-selector');
  if (existingSelector) {
    existingSelector.remove();
  }

  const selector = document.createElement('select');
  selector.id = 'ai-popup-model-selector';

  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    if (model.id === currentModelId) {
      option.selected = true;
    }
    selector.appendChild(option);
  });

  selector.addEventListener('change', (event) => {
    const newModelId = event.target.value;
    redefineWithModel(selectedText, newModelId);
  });

  // Prepend the selector to the popup so it appears at the top
  popup.prepend(selector);
}

// --- NEW: Function to get a new definition with a specific model ---
function redefineWithModel(word, modelId) {
  if (!popup) return;

  // --- NEW: Set the interaction flag ---
  isInteractingWithPopup = true;

  // Update UI to show loading state
  updatePopup("Loading...");
  // Remove old action buttons
  const actions = popup.querySelector('.ai-popup-actions');
  if (actions) actions.remove();

  // Send message to background with the specific model ID
  chrome.runtime.sendMessage(
    { type: "getAiDefinition", word: word, modelId: modelId },
    (response) => {
      if (!popup) return;

      // --- REVISED LOGIC ---
      // 1. Re-create the model selector, ensuring the correct model is selected
      if (response.models && response.models.length > 1) {
        createModelSelector(response.models, response.defaultModelId, word, modelId);
      }

      // Update the definition
      const definitionText = response.error ? response.error : response.definition;
      updatePopup(definitionText);

      // --- NEW: Re-create the save button after model change ---
      if (!response.error) {
        createActionButtons(word, definitionText);
      }

      adjustPopupPosition();

      // --- NEW: Reset the flag AFTER the entire operation is complete ---
      setTimeout(() => { isInteractingWithPopup = false; }, 100);
    }
  );
}

// --- UPDATED function to only add Save button ---
function createActionButtons(word, definition) {
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
        listId: selectedListId
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
