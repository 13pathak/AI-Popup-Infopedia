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

  // --- This is the new logic ---
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
        if (response.error) {
          updatePopup(response.error);
        } else {
          updatePopup(response.definition);
          // After content is loaded, adjust position if it goes off screen
          adjustPopupPosition();
        }
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
  
  // Temporarily add to get its dimensions before final positioning
  document.body.appendChild(popup);

  // Position it initially below/near the selection, we'll adjust in adjustPopupPosition
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`; // This is the top of the selected word
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

function adjustPopupPosition() {
    if (!popup) return;

    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newLeft = popupRect.left;
    let newTop = popupRect.top; // Current position is top of selected word

    // Calculate position to be *above* the selected word
    newTop = newTop - popupRect.height - 10; // 10px padding above selected word

    // --- Horizontal adjustment ---
    // If it goes off the right side
    if (newLeft + popupRect.width > viewportWidth - 10) { // 10px margin from right edge
        newLeft = viewportWidth - popupRect.width - 10;
    }
    // If it goes off the left side
    if (newLeft < 10) { // 10px margin from left edge
        newLeft = 10;
    }

    // --- Vertical adjustment ---
    // If it goes off the top (because we moved it above)
    if (newTop < 10) { // 10px margin from top edge
        // If it can't fit above, try to place it below the selected word instead
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        newTop = rect.bottom + window.scrollY + 10; // 10px padding below selected word
    }


    // Apply final positions (relative to the document, accounting for scroll)
    popup.style.left = `${newLeft + window.scrollX}px`;
    popup.style.top = `${newTop + window.scrollY}px`;
}