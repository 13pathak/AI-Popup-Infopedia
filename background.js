// --- NEW: Open options page when toolbar icon is clicked ---
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// --- UPDATED: This listener now handles TWO types of messages ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // --- Case 1: Get a definition ---
  if (request.type === "getAiDefinition") {
    
    // Get all our saved settings, including the new customPrompt
    chrome.storage.sync.get(['endpointUrl', 'modelName', 'apiKey', 'customPrompt'], async (items) => {
      
      const defaultPrompt = "Explain the following word or concept in a concise paragraph: {word}";
      const promptTemplate = items.customPrompt || defaultPrompt;
      const apiKey = items.apiKey;
      const url = items.endpointUrl;
      const modelName = items.modelName;

      if (!url || !modelName || !apiKey) {
        sendResponse({ error: "API settings are incomplete. Please check options." });
        return;
      }

      const prompt = promptTemplate.replace('{word}', request.word);

      // Create the OpenAI-style payload
      const payload = {
        "model": modelName,
        "messages": [
          {
            "role": "user",
            "content": prompt 
          }
        ]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("API Error Details:", errorData);
          throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const aiText = data.choices[0].message.content;
        
        sendResponse({ definition: aiText });

      } catch (error) {
        console.error("AI API call failed:", error);
        sendResponse({ error: `Failed to fetch definition: ${error.message}` });
      }
    });

    // Return true to indicate that we will send a response asynchronously
    return true;
  }

  // --- Case 2: Save an item to history ---
  if (request.type === "saveToHistory") {
    // We pass sendResponse as a callback to run *after* saving
    saveToHistory(request.word, request.definition, () => {
      sendResponse({ status: "saved" });
    });
    // --- THIS IS THE FIX ---
    // Return true to tell Chrome this is an async operation
    return true; 
  }

});

// --- UPDATED to accept a callback ---
function saveToHistory(word, definition, callback) {
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];
    
    // Create new history item
    const newItem = {
      word: word,
      definition: definition,
      timestamp: new Date().toISOString() // Store timestamp
    };

    // Add new item to the beginning of the array
    history.unshift(newItem);

    // Keep history limited to 100 items
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    // Save back to storage and *then* run the callback
    chrome.storage.local.set({ history: history }, () => {
      if (callback) {
        callback();
      }
    });
  });
}
