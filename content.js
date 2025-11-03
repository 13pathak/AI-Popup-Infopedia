let popupContainer = null;
let popup = null;
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
  // If the click started inside our popup, do nothing.
  if (isClickInsidePopup) {
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
    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: selectedText },
      (response) => {
        if (!popup) return; // Popup might have been closed while loading
        
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
  // Reset the flag on every single click
  isClickInsidePopup = false; 
  
  if (popupContainer && popupContainer.shadowRoot) {
    const path = event.composedPath();
    const isClickInside = popupContainer.shadowRoot.contains(path[0]);

    if (isClickInside) {
      // If click starts inside, set the flag so the mouseup listener will ignore it
      isClickInsidePopup = true;
    } else {
      // Click was outside, so check if we should close
      const selection = window.getSelection();
      if (selection.isCollapsed) {
          removePopup();
      }
    }
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

// --- UPDATED function to only add Save button ---
function createActionButtons(word, definition) {
  if (!popup) return;

  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'ai-popup-actions';

  const saveButton = document.createElement('button');
  saveButton.className = 'ai-popup-button';
  saveButton.textContent = 'Save';

  // --- Add Listener ---
  saveButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Stop click from propagating to mousedown listener
    
    // Deselect the text to prevent the main mouseup listener from firing again
    window.getSelection().removeAllRanges(); 

    // Send message to background to save
    chrome.runtime.sendMessage({
      type: "saveToHistory",
      word: word,
      definition: definition // Send the raw definition
    }, (response) => {
      // Optional: Check if save was successful
      if (response && response.status === 'saved') {
        console.log('Definition saved.');
      }
    });
    
    // --- NEW: Change text to "Saved!" ---
    saveButton.textContent = 'Saved!';
    saveButton.disabled = true; // Disable button after clicking
    saveButton.style.cursor = 'default';
    saveButton.style.opacity = '0.6';

    // Optional: close popup after a short delay
    setTimeout(() => {
        removePopup();
    }, 800);
  });

  actionsContainer.appendChild(saveButton);
  
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
