let popup;

// Listen for text selection (e.g., mouse up after selecting)
document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // If nothing is selected (or just whitespace), remove the popup and exit
  if (selectedText.length === 0) {
    removePopup();
    return;
  }

  // Count the words. We split by one or more whitespace characters.
  const wordCount = selectedText.split(/\s+/).length;

  // Only proceed if 1 to 4 words are selected
  if (wordCount > 0 && wordCount <= 4) {
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect(); // Get the bounding box of the selection

    // Calculate position based on the selected text's bounding rectangle
    const popupX = rect.left + window.scrollX;
    const popupY = rect.top + window.scrollY; // Position relative to the top of the selected text

    // Create and show the popup
    showPopup(popupX, popupY, "Loading...");

    // Send the selected word to the background script
    chrome.runtime.sendMessage(
      { type: "getAiDefinition", word: selectedText },
      (response) => {
        if (!popup) return; // Popup might have been closed while loading
        
        if (response.error) {
          updatePopup(response.error);
        } else {
          updatePopup(response.definition);
        }
        // After content is loaded, adjust position
        adjustPopupPosition();
      }
    );
  } else {
    // If more than 4 words are selected, ensure the popup is closed
    removePopup();
  }
});


// Close the popup if clicking outside of it, or pressing escape
document.addEventListener('mousedown', (event) => {
  // Check if the click is outside the popup
  if (popup && !popup.contains(event.target)) {
    // We also need to check if the click is *on* the selected text.
    // If it is, the 'mouseup' listener will handle it.
    // If it's not, we should close the popup.
    const selection = window.getSelection();
    if (selection.isCollapsed || !selection.getRangeAt(0).getBoundingClientRect()) {
        removePopup();
    }
  }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && popup) {
        removePopup();
    }
});


function showPopup(x, y, content) {
  // Remove existing popup if any
  removePopup();

  popup = document.createElement('div');
  popup.id = 'ai-definition-popup';
  popup.innerHTML = content;
  
  // Set initial position at the top-left of the selection
  // This is temporary until adjustPopupPosition() runs
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`; 

  document.body.appendChild(popup);
}

function updatePopup(content) {
  if (popup) {
    // Basic formatting for newlines from AI
    popup.innerHTML = content.replace(/\n/g, '<br>');
  }
}

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}

// --- THIS IS THE UPDATED FUNCTION ---
function adjustPopupPosition() {
    if (!popup) return;

    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
        removePopup(); // Close popup if selection is lost
        return;
    }
    
    const range = selection.getRangeAt(0);
    const selectionRect = range.getBoundingClientRect(); // Viewport-relative rect of *selection*
    
    // We need the popup's dimensions *after* content is loaded
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newLeft = selectionRect.left; // Start by aligning with the left of selection
    let newTop; // This will be our final viewport-relative top

    // --- NEW DYNAMIC VERTICAL PLACEMENT ---
    // Check if there's enough space *above* the selection
    // (space above selection > popup height + 10px margin)
    if (selectionRect.top > popupRect.height + 10) {
        // Yes, place it ABOVE
        newTop = selectionRect.top - popupRect.height - 10; // 10px padding
    } else {
        // No, place it BELOW
        newTop = selectionRect.bottom + 10; // 10px padding
    }
    // --- END NEW LOGIC ---

    // --- Horizontal Adjustment ---
    // If it goes off the right side
    if (newLeft + popupRect.width > viewportWidth - 10) {
        newLeft = viewportWidth - popupRect.width - 10; // 10px margin from right
    }
    // If it goes off the left side
    if (newLeft < 10) {
        newLeft = 10; // 10px margin from left
    }
    
    // Apply final positions (we add scrollY/scrollX to convert viewport-relative to document-relative)
    popup.style.left = `${newLeft + window.scrollX}px`;
    popup.style.top = `${newTop + window.scrollY}px`;
}
