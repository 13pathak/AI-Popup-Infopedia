// --- NEW: Open options page when toolbar icon is clicked ---
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// --- NEW: Listen for keyboard shortcuts (commands) ---
chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-popup") {
    // Send message to the active tab to trigger the popup
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "triggerPopup" });
      }
    });
  }
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
    saveToHistory(request.word, request.definition, request.listId, request.modelName, request.promptName, request.sourceUrl, request.sourceTitle, () => {
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

  // --- NEW: Case 4: Create a new list ---
  if (request.type === "createList") {
    const listName = request.listName;
    if (listName && listName.trim()) {
      chrome.storage.local.get({ wordLists: [] }, (data) => {
        const lists = data.wordLists;
        // Check for duplicates (optional but good)
        if (lists.some(l => l.name === listName.trim())) {
          sendResponse({ error: "List already exists" });
          return;
        }

        const newList = { id: `list_${new Date().getTime()}`, name: listName.trim() };
        lists.push(newList);

        chrome.storage.local.set({ wordLists: lists }, () => {
          sendResponse({ success: true, newList: newList });
        });
      });
    } else {
      sendResponse({ error: "Invalid list name" });
    }
    return true; // Async response
  }

  // --- NEW: Case 5: Check Backup manually (from Options) ---
  if (request.type === "checkBackupReminder") {
    performAutoBackupCheck();
    return true;
  }

  // --- NEW: Case 6: Force Manual Backup ---
  if (request.type === "manualBackup" || request.type === "testBackup") {
    // Force a backup regardless of time
    triggerBackup("Manual");
    return true;
  }

});

// --- UPDATED to accept source URL and title ---
function saveToHistory(word, definition, listId, modelName, promptName, sourceUrl, sourceTitle, callback) {
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    // Create new history item
    const newItem = {
      word: word,
      definition: definition,
      timestamp: new Date().toISOString(),
      listId: listId,
      modelName: modelName,
      promptName: promptName,
      sourceUrl: sourceUrl || '',
      sourceTitle: sourceTitle || ''
    };

    // Add new item to the beginning of the array
    history.unshift(newItem);

    // --- NEW: Save back history AND the lastUsedListId ---
    chrome.storage.local.set({ history: history, lastUsedListId: listId }, () => {
      if (callback) {
        callback();
      }
    });
  });
}

// --- NEW: Auto-Backup Logic ---

// Check every 60 minutes
chrome.alarms.create("checkBackupReminder", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkBackupReminder") {
    performAutoBackupCheck();
  }
});

// Also check on startup
chrome.runtime.onStartup.addListener(() => {
  performAutoBackupCheck();
});

// And on installed
chrome.runtime.onInstalled.addListener(() => {
  performAutoBackupCheck();
});

// Listen for changes in settings to update immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.backupReminderFrequency) {
    performAutoBackupCheck();
  }
});

function performAutoBackupCheck() {
  chrome.storage.sync.get({ backupReminderFrequency: 0 }, (syncData) => {
    const frequencyDays = syncData.backupReminderFrequency;

    // specific check: if 0 (disabled), ensure no badge/action
    if (frequencyDays === 0) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    chrome.storage.local.get({ lastBackupTime: 0 }, (localData) => {
      const lastBackup = localData.lastBackupTime;
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceBackup = (now - lastBackup) / msPerDay;

      // If time has passed, Trigger the Backup!
      if (daysSinceBackup >= frequencyDays) {
        triggerBackup("Auto");
      }
    });
  });
}

// --- NEW: Better Download Tracking ---
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    // Check if this download ID matches a pending backup
    chrome.storage.local.get(['pendingBackupId', 'pendingBackupType'], (data) => {
      if (data.pendingBackupId === delta.id) {
        console.log("Backup download completed successfully.");
        chrome.storage.local.set({
          lastBackupTime: Date.now(),
          lastBackupType: data.pendingBackupType,
          pendingBackupId: null // clear pending
        });
      }
    });
  } else if (delta.error) {
    console.error("Backup download failed:", delta.error.current);
    // Optionally save the error to display to user
    chrome.storage.local.get(['pendingBackupId'], (data) => {
      if (data.pendingBackupId === delta.id) {
        chrome.storage.local.set({
          lastBackupError: delta.error.current,
          pendingBackupId: null
        });
      }
    });
  }
});

function triggerBackup(type = "Auto") {
  // 1. Fetch all data to backup
  chrome.storage.local.get(['history', 'wordLists'], (localData) => {
    chrome.storage.sync.get(['models', 'customPrompts', 'defaultModelId', 'defaultPromptId', 'ankiSettings', 'ttsSettings', 'backupReminderFrequency', 'backupSubfolder'], (syncData) => {

      const backupData = {
        history: localData.history || [],
        wordLists: localData.wordLists || [],
        models: syncData.models || [],
        customPrompts: syncData.customPrompts || [],
        defaultModelId: syncData.defaultModelId,
        defaultPromptId: syncData.defaultPromptId,
        ankiSettings: syncData.ankiSettings,
        ttsSettings: syncData.ttsSettings,
        backupReminderFrequency: syncData.backupReminderFrequency,
        backupSubfolder: syncData.backupSubfolder,
        exportedAt: new Date().toISOString(),
        backupType: type,
        version: "1.1"
      };

      // 2. Create Data URI (Base64) - Service Worker safe
      const jsonString = JSON.stringify(backupData, null, 2);
      // Encode properly to handle Unicode characters if any
      const base64Content = btoa(unescape(encodeURIComponent(jsonString)));
      const url = `data:application/json;base64,${base64Content}`;

      // 3. Determine Filename
      const dateStr = new Date().toISOString().slice(0, 10);
      const timestamp = new Date().getTime(); // ensure uniqueness
      const defaultFilename = `infopedia_backup_${dateStr}_${timestamp}.json`;

      // 4. Check Subfolder setting
      chrome.storage.sync.get({ backupSubfolder: '' }, (settings) => {
        let finalPath = defaultFilename;
        if (settings.backupSubfolder && settings.backupSubfolder.trim()) {
          // Allow simple subfolder organization
          const folder = settings.backupSubfolder.trim().replace(/[<>:"/\\|?*]/g, ''); // sanitize info
          if (folder) {
            finalPath = `${folder}/${defaultFilename}`;
          }
        }

        try {
          if (!chrome.downloads || !chrome.downloads.download) {
            throw new Error("chrome.downloads API is not available. Check permissions.");
          }

          // 5. Download
          chrome.downloads.download({
            url: url,
            filename: finalPath,
            saveAs: false, // Attempt to save automatically without prompt
            conflictAction: 'uniquify'
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("Auto-Backup Start Failed:", chrome.runtime.lastError);
              chrome.storage.local.set({ lastBackupError: chrome.runtime.lastError.message });
            } else {
              console.log("Auto-Backup Started. ID:", downloadId);
              // --- CHANGED: Don't set success yet. Set "Pending". ---
              chrome.storage.local.set({
                pendingBackupId: downloadId,
                pendingBackupType: type,
                lastBackupError: null // clear previous errors
              });
            }
          });
        } catch (err) {
          console.error("Backup Exception:", err);
          chrome.storage.local.set({ lastBackupError: err.message });
        }
      });
    });
  });
}
