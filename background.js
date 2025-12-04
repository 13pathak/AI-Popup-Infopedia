// --- NEW: Open options page when toolbar icon is clicked ---
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// --- This listener now handles multiple message types ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // --- Case 1: Get a definition ---
  if (request.type === "getAiDefinition") {

    // Get all saved models and the ID of the default one
    chrome.storage.sync.get(['models', 'defaultModelId', 'customPrompts', 'defaultPromptId'], async (data) => {
      const { models, defaultModelId, customPrompts, defaultPromptId } = data;

      if (!models || models.length === 0 || !defaultModelId) {
        sendResponse({ error: "No default AI model configured. Please set one in the options page.", models: [], defaultModelId: null });
        return;
      }

      const modelToUse = request.modelId ? models.find(m => m.id === request.modelId) : models.find(m => m.id === defaultModelId);

      if (!modelToUse) {
        sendResponse({ error: "Model not found. Please check your settings.", models: models, defaultModelId: defaultModelId });
        return;
      }

      const { endpointUrl, modelName, apiKey } = modelToUse;

      // --- REVISED: Simplified prompt logic ---
      const { word } = request;

      // Determine the prompt template to use
      let promptTemplate = "Explain the following word or concept in a concise paragraph: {word}"; // System default
      let promptName = "System Default"; // Default name

      if (request.customPrompt) {
        // 1. Use specific prompt requested by popup
        promptTemplate = request.customPrompt;
        // Find the name if possible, or use "Custom Prompt"
        const foundPrompt = customPrompts ? customPrompts.find(p => p.content === request.customPrompt) : null;
        promptName = foundPrompt ? foundPrompt.name : "Custom Prompt";
      } else if (defaultPromptId && customPrompts) {
        // 2. Use user-configured default prompt
        const defaultPrompt = customPrompts.find(p => p.id === defaultPromptId);
        if (defaultPrompt) {
          promptTemplate = defaultPrompt.content;
          promptName = defaultPrompt.name;
        }
      }

      const prompt = promptTemplate.replace('{word}', word);

      // Create the OpenAI-style payload
      const payload = {
        "model": modelName,
        "messages": [
          {
            "role": "user",
            "content": prompt
          }
        ],
        "stream": false
      };

      try {
        // --- THIS IS THE OPTIONAL FIX (HEADERS) ---
        // Create headers object
        const headers = {
          'Content-Type': 'application/json'
        };

        // Only add Authorization header if an API key is provided
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        // --- END OPTIONAL FIX ---

        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: headers, // Use the new headers object
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          // --- NEW: ROBUST ERROR HANDLING ---
          // Handle errors that might be plain text OR json
          let errorMsg = response.statusText;
          const contentType = response.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            console.error("API Error Details (JSON):", errorData);
            errorMsg = errorData.error || errorMsg;
          } else {
            const errorText = await response.text();
            console.error("API Error Details (Text):", errorText);
            errorMsg = errorText || errorMsg;
          }
          throw new Error(`${errorMsg}`);
          // --- END ROBUST ERROR HANDLING ---
        }

        const data = await response.json();
        const aiText = data.choices[0].message.content;

        sendResponse({ definition: aiText, models: models, defaultModelId: defaultModelId, customPrompts: customPrompts || [], defaultPromptId: defaultPromptId, promptName: promptName });

      } catch (error) {
        console.error("AI API call failed:", error);
        // The error message is now cleaner
        sendResponse({ error: `Failed to fetch definition: ${error.message}`, models: models, defaultModelId: defaultModelId, customPrompts: customPrompts || [], defaultPromptId: defaultPromptId });
      }
    });

    // Return true to indicate that we will send a response asynchronously
    return true;
  }

  // --- Case 2: Save an item to history ---
  if (request.type === "saveToHistory") {
    // We pass sendResponse as a callback to run *after* saving
    saveToHistory(request.word, request.definition, request.listId, request.modelName, request.promptName, () => {
      sendResponse({ status: "saved" });
    });
    // Return true to tell Chrome this is an async operation
    return true;
  }

  // --- Case 3: Get all word lists ---
  if (request.type === "getWordLists") {
    // --- UPDATED: Now also get the lastUsedListId ---
    chrome.storage.local.get({ wordLists: [], lastUsedListId: null }, (data) => {
      // Send back both the lists and the last used ID
      sendResponse({ lists: data.wordLists, lastUsedListId: data.lastUsedListId });
    });
    return true; // Async response
  }

});

// --- UPDATED to accept a callback and save last listId ---
function saveToHistory(word, definition, listId, modelName, promptName, callback) {
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    // Create new history item
    const newItem = {
      word: word,
      definition: definition,
      timestamp: new Date().toISOString(), // Store timestamp
      listId: listId, // --- NEW: Store the list ID ---
      modelName: modelName, // --- NEW: Store the model name ---
      promptName: promptName // --- NEW: Store the prompt name ---
    };

    // Add new item to the beginning of the array
    history.unshift(newItem);

    // Keep history limited to 100 items
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    // --- NEW: Save back history AND the lastUsedListId ---
    chrome.storage.local.set({ history: history, lastUsedListId: listId }, () => {
      if (callback) {
        callback();
      }
    });
  });
}

// --- NEW: Backup Reminder Logic ---

// Check every 60 minutes
chrome.alarms.create("checkBackupReminder", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkBackupReminder") {
    checkBackupReminder();
  }
});

// Also check on startup
chrome.runtime.onStartup.addListener(() => {
  checkBackupReminder();
});

// And on installed
chrome.runtime.onInstalled.addListener(() => {
  checkBackupReminder();
});

// Listen for changes in settings to update immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.backupReminderFrequency) {
    checkBackupReminder();
  }
  if (namespace === 'local' && changes.lastBackupTime) {
    checkBackupReminder();
  }
});

function checkBackupReminder() {
  chrome.storage.sync.get({ backupReminderFrequency: 0 }, (syncData) => {
    const frequencyDays = syncData.backupReminderFrequency;

    if (frequencyDays === 0) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    chrome.storage.local.get({ lastBackupTime: 0 }, (localData) => {
      const lastBackup = localData.lastBackupTime;
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceBackup = (now - lastBackup) / msPerDay;

      if (daysSinceBackup >= frequencyDays) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    });
  });
}