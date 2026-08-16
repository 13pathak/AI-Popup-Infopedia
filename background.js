// --- NEW: Open options page when toolbar icon is clicked ---
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// Prevent a provider or search request from leaving a popup on "Loading..."
// forever when the remote service stops responding.
async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- NEW: Listen for keyboard shortcuts (commands) ---
chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-popup") {
    // Send message to the active tab to trigger the popup
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Use a callback so we can detect failures (e.g. on chrome:// pages,
        // the Web Store, the extension's own options page, or PDF viewer
        // pages where the content script is not injected).
        chrome.tabs.sendMessage(tabs[0].id, { type: "triggerPopup" }, () => {
          if (chrome.runtime.lastError) {
            // Content script not reachable on this tab.
            console.warn("triggerPopup could not be delivered:", chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});


// --- This listener now handles multiple message types ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // --- Case 1: Get a definition ---
  if (request.type === "getAiDefinition") {

    // Get all saved models and the ID of the default one
    chrome.storage.sync.get(['models', 'defaultModelId', 'customPrompts', 'defaultPromptId', 'tavilyApiKey'], async (data) => {
      const { models, defaultModelId, customPrompts, defaultPromptId, tavilyApiKey } = data;

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
      } else if (request.customPrompt !== '' && defaultPromptId && customPrompts) {
        // 2. Use user-configured default prompt — but only when the popup
        //    didn't explicitly pick "System Default", which the selector
        //    sends as ''. An absent customPrompt (initial lookup, retries,
        //    follow-ups) still inherits the configured default here.
        const defaultPrompt = customPrompts.find(p => p.id === defaultPromptId);
        if (defaultPrompt) {
          promptTemplate = defaultPrompt.content;
          promptName = defaultPrompt.name;
        }
      }

      let prompt = promptTemplate.replaceAll('{word}', word);
      if (!promptTemplate.includes('{word}')) {
        prompt += `\n\nWord/Concept: ${word}`;
      }

      // Sanitize the messages array for strict API compatibility
      let safeMessagesText = [];
      if (request.messages && Array.isArray(request.messages)) {
         safeMessagesText = request.messages.map(m => ({ role: m.role, content: m.content }));
      } else {
         safeMessagesText = [{ role: "user", content: prompt }];
      }

      // Create the OpenAI-style payload
      const payload = {
        "model": modelName,
        "messages": safeMessagesText,
        "stream": false
      };

      if (modelToUse.enableSearchGrounding) {
        payload.tools = [{
          "type": "function",
          "function": {
            "name": "web_search",
            "description": "Searches the web for recent events, news, or factual information that might not be in your training data.",
            "parameters": {
              "type": "object",
              "properties": {
                "query": { "type": "string", "description": "The search query to look up on the web" }
              },
              "required": ["query"]
            }
          }
        }];
      }

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

        const response = await fetchWithTimeout(endpointUrl, {
          method: 'POST',
          headers: headers, // Use the new headers object
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          // --- NEW: ROBUST ERROR HANDLING ---
          // Handle errors that might be plain text OR json
          let errorMsg = response.statusText || `HTTP error ${response.status}`;
          const contentType = response.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            console.error("API Error Details (JSON):", errorData);
            errorMsg = (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message) || errorData.message || errorData.detail || (Object.keys(errorData).length > 0 ? JSON.stringify(errorData) : null) || errorMsg;
          } else {
            const errorText = await response.text();
            console.error("API Error Details (Text):", errorText);
            errorMsg = errorText || errorMsg;
          }
          throw new Error(`${errorMsg}`);
          // --- END ROBUST ERROR HANDLING ---
        }

        let data = await response.json();
        let aiText = "";
        let loopCount = 0;
        let usedWebSearch = false;
        const maxLoops = 3;
        const citations = [];
        const citationsByUrl = new Map();
        const maxCitations = 5;

        // Keep source metadata separate from the text given to the model so the
        // popup can render safe, clickable links after a grounded response.
        const addCitation = (result, query) => {
          if (!result || typeof result.url !== 'string') return null;

          let parsedUrl;
          try {
            parsedUrl = new URL(result.url);
          } catch (error) {
            return null;
          }

          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;

          const normalizedUrl = parsedUrl.href;
          if (citationsByUrl.has(normalizedUrl)) return citationsByUrl.get(normalizedUrl);
          if (citations.length >= maxCitations) return null;

          const citation = {
            id: `S${citations.length + 1}`,
            title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : parsedUrl.hostname,
            url: normalizedUrl,
            domain: parsedUrl.hostname,
            query: query
          };
          citations.push(citation);
          citationsByUrl.set(normalizedUrl, citation);
          return citation;
        };

        // The Orchestrator Loop
        while (loopCount < maxLoops) {
          const choice = data.choices && data.choices.length > 0 ? data.choices[0] : null;
          const message = choice ? choice.message : null;

          if (!message) {
            aiText = "The AI returned an empty response or the response was filtered.";
            break;
          }

          // Check if AI wants to use a tool
          if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            
            if (toolCall.function.name === "web_search" && tavilyApiKey) {
              // 1. Extract the query
              const args = JSON.parse(toolCall.function.arguments);
              const query = args.query;
              
              // 2. Make the request to Tavily
              const tavilyResponse = await fetchWithTimeout("https://api.tavily.com/search", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: tavilyApiKey, query: query, max_results: 3 })
              });
              if (!tavilyResponse.ok) {
                throw new Error(`Search request failed: ${tavilyResponse.status} ${tavilyResponse.statusText}`);
              }
              const tavilyData = await tavilyResponse.json();
              
              // Format the search results
              let searchResultsText = "Search Results:\n";
              if (tavilyData.results && tavilyData.results.length > 0) {
                tavilyData.results.forEach(result => {
                  const citation = addCitation(result, query);
                  const title = typeof result.title === 'string' ? result.title : 'Untitled source';
                  const content = typeof result.content === 'string' ? result.content : '';
                  const sourceLabel = citation ? `[${citation.id}] ${citation.title} (${citation.url})` : title;
                  searchResultsText += `- ${sourceLabel}: ${content}\n`;
                });
              } else {
                searchResultsText += "No results found. Server returned: " + JSON.stringify(tavilyData);
              }

              // 3. Append to history and make next API call
              safeMessagesText.push({
                role: "assistant",
                content: message.content || "",
                tool_calls: message.tool_calls
              }); // Safely add the AI's tool request
              safeMessagesText.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: "web_search",
                content: searchResultsText
              });

              payload.messages = safeMessagesText;
              
              // If we are about to hit max loops, force the AI to answer by removing tools
              if (loopCount === maxLoops - 1) {
                delete payload.tools;
              }
              
              // Re-fetch with the updated payload
              const nextResponse = await fetchWithTimeout(endpointUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
              });
              
               if (!nextResponse.ok) {
                   let errDetails = "";
                   try {
                     const errJson = await nextResponse.json();
                     errDetails = (errJson.error && errJson.error.message) ? errJson.error.message : JSON.stringify(errJson);
                   } catch (e) {
                     errDetails = "Could not parse error details.";
                   }

                   // Some OpenAI-compatible providers (notably some Groq models) can
                   // fail to parse a *subsequent* model-generated tool call. The search
                   // result is already in the conversation, so retry once with tools
                   // disabled and require the model to produce its final text answer.
                   if (nextResponse.status === 400 && errDetails.includes("failed_generation")) {
                     delete payload.tools;
                     payload.tool_choice = "none";

                     const fallbackResponse = await fetchWithTimeout(endpointUrl, {
                       method: 'POST',
                       headers: headers,
                       body: JSON.stringify(payload)
                     });

                     if (!fallbackResponse.ok) {
                       let fallbackError = fallbackResponse.statusText || `HTTP error ${fallbackResponse.status}`;
                       try {
                         const fallbackJson = await fallbackResponse.json();
                         fallbackError = (typeof fallbackJson.error === 'string' ? fallbackJson.error : fallbackJson.error?.message) || fallbackJson.message || JSON.stringify(fallbackJson);
                       } catch (e) {
                         // Keep the HTTP status text when the provider returns non-JSON.
                       }
                       throw new Error(`HTTP error on search fallback: ${fallbackResponse.status} - ${fallbackError}`);
                     }

                     data = await fallbackResponse.json();
                   } else {
                     throw new Error(`HTTP error on search pass: ${nextResponse.status} - ${errDetails}`);
                   }
               } else {
                 data = await nextResponse.json();
               }
               loopCount++;
               usedWebSearch = true;
            } else if (toolCall.function.name === "web_search" && !tavilyApiKey) {
              throw new Error("AI tried to search the web, but no Tavily API Key is configured in settings.");
            } else {
               aiText = "Error: AI attempted to call an unknown tool: " + toolCall.function.name;
               break;
            }
          } else {
            // Standard text response received!
            aiText = message.content || "The AI returned an empty response.";
            break;
          }
        }
        
        // Fallback if it looped too many times or content was null
        if (!aiText) {
          const fallbackContent = data?.choices?.[0]?.message?.content;
          aiText = fallbackContent || "The AI reached maximum search depth or returned an empty response.";
        }

        sendResponse({ definition: aiText, usedWebSearch: usedWebSearch, citations: citations, usedPrompt: prompt, models: models, defaultModelId: defaultModelId, customPrompts: customPrompts || [], defaultPromptId: defaultPromptId, promptName: promptName });

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
    saveToHistory(request.word, request.definition, request.listId, request.modelName, request.promptName, request.sourceUrl, request.sourceTitle, request.citations, (err) => {
      if (err) {
        sendResponse({ status: "error", error: err.message });
      } else {
        sendResponse({ status: "saved" });
      }
    });
    // Return true to tell Chrome this is an async operation
    return true;
  }

  // --- Case 2.5: Open PDF Tab ---
  if (request.type === "openPdfTab") {
    chrome.tabs.create({ url: "data:text/html;charset=utf-8," + encodeURIComponent(request.htmlContent) });
  }

  // --- Case 2.8: Test AI Connection & Setup ---
  if (request.type === "testConnection") {
    handleTestConnection(request, sendResponse);
    return true; // async
  }

  // --- Case 2.9: Open Options Page Tab (e.g. support-content) ---
  if (request.type === "openOptionsTab") {
    const targetTab = request.tab || 'support-content';
    chrome.storage.local.set({ activeOptionsTab: targetTab }, () => {
      chrome.runtime.openOptionsPage();
    });
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
        if (request.parentId) {
          newList.parentId = request.parentId;
        }
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
  }

  // --- NEW: Case 6: Force Manual Backup ---
  if (request.type === "manualBackup" || request.type === "testBackup") {
    // Force a backup regardless of time
    triggerBackup("Manual");
  }

  // --- Case 7: Verify AI Response ---
  if (request.type === "verifyAiResponse") {
    chrome.storage.sync.get(['models', 'verificationModelId'], async (data) => {
      const { models, verificationModelId } = data;
      if (!models || !verificationModelId) {
        sendResponse({ error: "Verification model not configured." });
        return;
      }
      
      const modelToUse = models.find(m => m.id === verificationModelId);
      if (!modelToUse) {
        sendResponse({ error: "Verification model not found." });
        return;
      }
      
      const { endpointUrl, modelName, apiKey } = modelToUse;
      const { originalPrompt, aiResponse } = request;
      
      const verificationPrompt = `You are a strict factual verification system. Review the following original prompt and AI response. Identify any hallucinations, fabricated facts, or logical errors. Output your response as a raw JSON object with this exact structure: {"is_hallucinating": boolean, "reasoning": "brief explanation", "corrections": ["string"]}. Do not include markdown formatting or any other text.\n\nOriginal Prompt: ${originalPrompt}\n\nAI Response: ${aiResponse}`;

      const payload = {
        "model": modelName,
        "messages": [{ role: "user", content: verificationPrompt }],
        "stream": false
      };
      
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      
      try {
        const response = await fetchWithTimeout(endpointUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        let content = '';
        
        if (result.choices && result.choices.length > 0 && result.choices[0].message) {
           content = result.choices[0].message.content;
        } else if (result.message && result.message.content) {
           content = result.message.content;
        } else if (result.response) {
           content = result.response;
        } else {
           throw new Error("Unexpected API response structure.");
        }
        
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        let verificationResult;
        try {
          verificationResult = JSON.parse(content);
        } catch(e) {
          console.error("Failed to parse verification JSON:", content);
          sendResponse({ error: "Failed to parse verification result." });
          return;
        }
        
        sendResponse({ success: true, result: verificationResult });
        
      } catch (error) {
        console.error("Verification API Error:", error);
        sendResponse({ error: error.message });
      }
    });
    return true; // async
  }

});

let historySavePromise = Promise.resolve();

// Unique identity for history items. A millisecond ISO timestamp is NOT
// unique (bulk saves, stacked popups), and identity operations elsewhere
// (edit/delete/favorite/merge) must not conflate two items saved in the
// same millisecond.
function generateHistoryItemId() {
  return 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// --- UPDATED to accept source URL and title ---
function saveToHistory(word, definition, listId, modelName, promptName, sourceUrl, sourceTitle, citations, callback) {
  historySavePromise = historySavePromise.then(() => {
    return new Promise((resolve) => {
      chrome.storage.local.get(['history'], (result) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to read history from storage:", chrome.runtime.lastError);
          if (callback) {
            callback(chrome.runtime.lastError);
          }
          resolve();
          return;
        }

        let history = result.history || [];

        // Create new history item
        const newItem = {
          id: generateHistoryItemId(),
          word: word,
          definition: definition,
          timestamp: new Date().toISOString(),
          listId: listId,
          modelName: modelName,
          promptName: promptName,
          sourceUrl: sourceUrl || '',
          sourceTitle: sourceTitle || '',
          citations: Array.isArray(citations) ? citations.slice(0, 5) : []
        };

        // Add new item to the beginning of the array
        history.unshift(newItem);

        // --- NEW: Save back history AND the lastUsedListId ---
        chrome.storage.local.set({ history: history, lastUsedListId: listId }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to save history to storage:", chrome.runtime.lastError);
            if (callback) {
              callback(chrome.runtime.lastError);
            }
          } else {
            if (callback) {
              callback(null);
            }
          }
          resolve();
        });
      });
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

// --- NEW: Unicode-safe Base64 encoder (replaces deprecated unescape/encodeURIComponent combo) ---
// Works in service workers where `unescape` is being phased out.
function base64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000; // Avoid call-stack overflow on large strings
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function triggerBackup(type = "Auto") {
  // 1. Fetch all data to backup.
  // get(null), not a fixed key list: PDF data lives in per-URL keys
  // (pdf_highlights_*, pdf_bookmarks_*, pdf_lastpage_*) written by the
  // viewer, plus the pdf_author_name preference set on the options page;
  // all are picked out into pdfAnnotations below.
  chrome.storage.local.get(null, (localData) => {
    chrome.storage.sync.get(['models', 'customPrompts', 'defaultModelId', 'defaultPromptId', 'ankiSettings', 'ttsSettings', 'backupReminderFrequency', 'backupSubfolder', 'followupCustomMessage', 'showUserQuestions', 'sttEngine', 'sttApiKey', 'sttApiUrl', 'sttModel', 'sttCustomHeaders', 'sttCustomFormData'], (syncData) => {

      // SECURITY NOTE: this backup intentionally includes secrets (each
      // model's apiKey, sttApiKey, sttCustomHeaders) so that restores are
      // self-contained. The file is written unencrypted to the user's
      // Downloads folder — backups must be treated as credentials.
      const pdfAnnotations = {};
      for (const key of Object.keys(localData)) {
        if (key === 'pdf_author_name' || key.startsWith('pdf_highlights_') || key.startsWith('pdf_bookmarks_') || key.startsWith('pdf_lastpage_')) {
          pdfAnnotations[key] = localData[key];
        }
      }

      const backupData = {
        history: localData.history || [],
        wordLists: localData.wordLists || [],
        pdfAnnotations,
        models: syncData.models || [],
        customPrompts: syncData.customPrompts || [],
        defaultModelId: syncData.defaultModelId,
        defaultPromptId: syncData.defaultPromptId,
        ankiSettings: syncData.ankiSettings,
        ttsSettings: syncData.ttsSettings,
        sttEngine: syncData.sttEngine,
        sttApiKey: syncData.sttApiKey,
        sttApiUrl: syncData.sttApiUrl,
        sttModel: syncData.sttModel,
        sttCustomHeaders: syncData.sttCustomHeaders,
        sttCustomFormData: syncData.sttCustomFormData,
        backupReminderFrequency: syncData.backupReminderFrequency,
        backupSubfolder: syncData.backupSubfolder,
        followupCustomMessage: syncData.followupCustomMessage,
        showUserQuestions: syncData.showUserQuestions,
        exportedAt: new Date().toISOString(),
        backupType: type,
        version: "1.2"
      };

      // 2. Create Data URI (Base64) - Service Worker safe
      const jsonString = JSON.stringify(backupData, null, 2);
      // Encode properly to handle Unicode characters without the deprecated `unescape`.
      const base64Content = base64EncodeUtf8(jsonString);
      const url = `data:application/json;base64,${base64Content}`;

      // 3. Determine Filename
      const dateStr = new Date().toISOString().slice(0, 10);
      const timestamp = new Date().getTime(); // ensure uniqueness
      const defaultFilename = `infopedia_backup_${dateStr}_${timestamp}.json`;

      // 4. Check Subfolder setting (already fetched above in syncData)
      let finalPath = defaultFilename;
      if (syncData.backupSubfolder && syncData.backupSubfolder.trim()) {
        // Allow simple subfolder organization
        const folder = syncData.backupSubfolder.trim().replace(/[<>:"/\\|?*]/g, ''); // sanitize
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
}

// --- NEW: Intercept PDF URLs and redirect to custom PDF.js viewer ---
// Track tabs that we have already redirected for the current navigation so the
// webNavigation and webRequest listeners don't double-redirect the same URL.
// MV3 service workers are killed within seconds of idle, which silently wipes
// in-memory state and its cleanup timers. The dedupe state therefore lives in
// chrome.storage.session (persists across SW restarts, cleared when the
// browser closes), mirrored into a synchronous in-memory Map as the fast
// path. Entries expire lazily by timestamp — no setTimeout to lose.
const REDIRECT_TTL_MS = 10000; // forget the entry after 10s as a safety net
const redirectedTabs = new Map(); // tabId -> { url, ts }

const sessionStore = (chrome.storage && chrome.storage.session) || null;

// Warm the in-memory copy whenever the SW (re)starts, dropping expired entries.
const redirectedTabsLoaded = (async () => {
  if (!sessionStore) return;
  try {
    const data = await sessionStore.get('redirectedTabs');
    const stored = data && data.redirectedTabs;
    if (!stored) return;
    const now = Date.now();
    for (const key of Object.keys(stored)) {
      const entry = stored[key];
      if (entry && typeof entry.url === 'string' && now - entry.ts < REDIRECT_TTL_MS) {
        redirectedTabs.set(Number(key), { url: entry.url, ts: entry.ts });
      }
    }
  } catch (e) {}
})();

function persistRedirectedTabs() {
  if (!sessionStore) return;
  const obj = {};
  for (const [tabId, entry] of redirectedTabs) {
    obj[String(tabId)] = entry;
  }
  try {
    const p = sessionStore.set({ redirectedTabs: obj });
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function isAlreadyRedirected(tabId, url) {
  const entry = redirectedTabs.get(tabId);
  if (!entry) return false;
  if (Date.now() - entry.ts >= REDIRECT_TTL_MS) {
    redirectedTabs.delete(tabId); // lazy expiry replaces the lost timer
    return false;
  }
  return entry.url === url;
}

function markRedirected(tabId, originalUrl) {
  const now = Date.now();
  // Sweep expired entries while we're here so neither the Map nor
  // storage.session accumulates dead tabs between navigations.
  for (const [id, entry] of redirectedTabs) {
    if (now - entry.ts >= REDIRECT_TTL_MS) redirectedTabs.delete(id);
  }
  redirectedTabs.set(tabId, { url: originalUrl, ts: now });
  persistRedirectedTabs();
}

// Closed tabs release their entries immediately instead of lingering to TTL.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (redirectedTabs.delete(tabId)) {
    persistRedirectedTabs();
  }
});

// Common helper that performs the actual redirect once. It awaits the
// session warm-up so a freshly restarted cold SW still sees marks made by its
// predecessor; the check-then-mark sequence after the await is synchronous,
// so near-simultaneous events cannot interleave between check and mark.
async function redirectToPdfViewer(tabId, originalUrl) {
  await redirectedTabsLoaded;
  if (isAlreadyRedirected(tabId, originalUrl)) return; // dedupe across listeners
  markRedirected(tabId, originalUrl);
  const viewerUrl = chrome.runtime.getURL('pdf/web/custom-viewer.html?file=' + encodeURIComponent(originalUrl));
  chrome.tabs.update(tabId, { url: viewerUrl });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (url.includes(chrome.runtime.id) && url.includes('/pdf/web/custom-viewer.html')) return;
  try {
    const urlObj = new URL(url);
    const isPdfExt = urlObj.pathname.toLowerCase().endsWith('.pdf');
    // Match arxiv.org and its subdomains (e.g. www.arxiv.org, export.arxiv.org).
    const isArxivPdf = (urlObj.hostname === 'arxiv.org' || urlObj.hostname.endsWith('.arxiv.org')) &&
                       (urlObj.pathname === '/pdf/' || urlObj.pathname.startsWith('/pdf/'));

    if (isPdfExt || isArxivPdf) {
      redirectToPdfViewer(details.tabId, url);
    }
  } catch (e) {}
});

// --- NEW: Intercept any URL that returns a PDF Content-Type ---
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    // ONLY intercept main frame navigations. Ignore xmlhttprequest/fetch from pdf.js
    if (details.type !== 'main_frame') return;

    const url = details.url;
    if (url.includes(chrome.runtime.id) && url.includes('/pdf/web/custom-viewer.html')) return;
    if (isAlreadyRedirected(details.tabId, url)) return; // dedupe with webNavigation listener

    const contentTypeHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
    if (contentTypeHeader && contentTypeHeader.value.toLowerCase().includes('application/pdf')) {
      redirectToPdfViewer(details.tabId, url);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// --- Diagnostic Test Connection Handler ---
async function handleTestConnection(request, sendResponse) {
  try {
    const data = await new Promise(resolve => {
      chrome.storage.sync.get(['models', 'defaultModelId', 'tavilyApiKey'], resolve);
    });

    const { models = [], defaultModelId, tavilyApiKey } = data;
    let modelToTest = null;

    if (request.modelConfig) {
      // Direct config passed from model form (testing before saving)
      modelToTest = request.modelConfig;
    } else if (request.modelId) {
      modelToTest = models.find(m => m.id === request.modelId);
    } else if (defaultModelId) {
      modelToTest = models.find(m => m.id === defaultModelId);
    } else if (models.length > 0) {
      modelToTest = models[0];
    }

    const steps = [];

    const failEarly = (configMsg, summaryMsg) => {
      steps.push({
        id: "config",
        status: "fail",
        title: "1. Storage & Configuration Check",
        message: configMsg
      });
      steps.push({
        id: "reachability",
        status: "pending",
        title: "2. Endpoint Reachability Check",
        message: "Skipped (configuration check failed)."
      });
      steps.push({
        id: "auth",
        status: "pending",
        title: "3. Authentication & Model Response Check",
        message: "Skipped."
      });
      steps.push({
        id: "search",
        status: "pending",
        title: "4. Web Search Integration Check",
        message: "Skipped."
      });
      sendResponse({
        success: false,
        steps: steps,
        summary: summaryMsg || `Setup test failed: ${configMsg}`
      });
    };

    // Step 1: Storage & Configuration Check
    if (!modelToTest) {
      failEarly(
        "No AI model is configured or selected.",
        "Setup test failed: No AI model configured."
      );
      return;
    }

    const { endpointUrl, modelName, apiKey, name: configName, enableSearchGrounding } = modelToTest;

    if (!endpointUrl || typeof endpointUrl !== 'string' || !endpointUrl.trim()) {
      failEarly(
        "Endpoint URL is missing. Please provide a valid API endpoint.",
        "Setup test failed: Endpoint URL is missing."
      );
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(endpointUrl.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error("Invalid protocol");
      }
    } catch (e) {
      failEarly(
        `Endpoint URL is malformed: "${endpointUrl}". Must start with http:// or https://.`,
        "Setup test failed: Endpoint URL is malformed."
      );
      return;
    }

    if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
      failEarly(
        "Model Name is missing. Please enter the model ID (e.g. gemini-1.5-flash, llama3, gpt-4o-mini).",
        "Setup test failed: Model Name is missing."
      );
      return;
    }

    const isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    let configDetail = `Config: "${configName || modelName}" | Host: ${parsedUrl.hostname} | Model: ${modelName.trim()}`;
    if (!apiKey && !isLocal) {
      configDetail += " (Notice: No API key set — make sure this provider allows unauthenticated requests)";
    }
    steps.push({
      id: "config",
      status: "pass",
      title: "1. Storage & Configuration Check",
      message: configDetail
    });

    // Step 2 & 3: Reachability & Auth/Model Verification
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const testPayload = {
      model: modelName.trim(),
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
      stream: false
    };

    const startTime = Date.now();
    let response;
    try {
      response = await fetchWithTimeout(endpointUrl.trim(), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(testPayload)
      }, 15000);
    } catch (networkError) {
      const isTimeout = networkError.message && networkError.message.includes("timed out");
      let reachabilityMsg = "";
      if (isTimeout) {
        reachabilityMsg = `Connection timed out after 15s when trying to reach ${parsedUrl.hostname}. Check if the server is responding.`;
      } else if (isLocal) {
        reachabilityMsg = `Could not connect to local server at ${parsedUrl.origin}. Is Ollama or your local LLM running? If using Ollama, make sure CORS is enabled (e.g., OLLAMA_ORIGINS="*").`;
      } else {
        reachabilityMsg = `Network connection failed when reaching ${parsedUrl.hostname}: ${networkError.message}. Check your internet connection or URL spelling.`;
      }

      steps.push({
        id: "reachability",
        status: "fail",
        title: "2. Endpoint Reachability Check",
        message: reachabilityMsg
      });
      steps.push({
        id: "auth",
        status: "pending",
        title: "3. Authentication & Model Response Check",
        message: "Skipped due to reachability failure."
      });
      steps.push({
        id: "search",
        status: "pending",
        title: "4. Web Search Integration Check",
        message: "Skipped."
      });

      sendResponse({
        success: false,
        steps: steps,
        summary: `Setup test failed: ${reachabilityMsg}`
      });
      return;
    }

    const latencyMs = Date.now() - startTime;

    // Passed reachability!
    steps.push({
      id: "reachability",
      status: "pass",
      title: "2. Endpoint Reachability Check",
      message: `Successfully reached ${parsedUrl.hostname} (${latencyMs}ms roundtrip).`
    });

    // Step 3: Check response status & body
    if (response.ok) {
      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (e) {
        // Non-JSON response
      }

      steps.push({
        id: "auth",
        status: "pass",
        title: "3. Authentication & Model Response Check",
        message: `API Key & Model Verified! Model "${modelName}" responded successfully in ${latencyMs}ms.`
      });
    } else {
      let errorDetail = "";
      try {
        const errorJson = await response.json();
        errorDetail = (typeof errorJson.error === 'string' ? errorJson.error : errorJson.error?.message) || errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      } catch (e) {
        try {
          errorDetail = await response.text();
        } catch (e2) {
          errorDetail = response.statusText || `HTTP ${response.status}`;
        }
      }

      let authMsg = "";
      if (response.status === 401 || response.status === 403) {
        authMsg = `Authentication Failed (HTTP ${response.status}): Your API key is invalid, expired, or missing permissions for this model. (Provider response: ${errorDetail})`;
      } else if (response.status === 404) {
        authMsg = `Model or Endpoint Not Found (HTTP 404): The endpoint URL path or the model name "${modelName}" is not recognized by the provider. (Provider response: ${errorDetail})`;
      } else if (response.status === 429) {
        authMsg = `Rate Limit or Quota Exceeded (HTTP 429): You have run out of API credits or exceeded the request rate limit. (Provider response: ${errorDetail})`;
      } else if (response.status === 400 || response.status === 422) {
        authMsg = `Bad Request (HTTP ${response.status}): Provider rejected the test request. Model name "${modelName}" may be invalid or deprecated. (Provider response: ${errorDetail})`;
      } else {
        authMsg = `Provider returned HTTP error ${response.status}: ${errorDetail}`;
      }

      steps.push({
        id: "auth",
        status: "fail",
        title: "3. Authentication & Model Response Check",
        message: authMsg
      });

      steps.push({
        id: "search",
        status: "pending",
        title: "4. Web Search Integration Check",
        message: "Skipped due to authentication failure."
      });

      sendResponse({
        success: false,
        steps: steps,
        summary: `Setup test failed: ${authMsg}`
      });
      return;
    }

    // Step 4: Web Search Check
    if (enableSearchGrounding) {
      if (!tavilyApiKey || !tavilyApiKey.trim()) {
        steps.push({
          id: "search",
          status: "warn",
          title: "4. Web Search Integration Check",
          message: "Web search is enabled for this model, but no Tavily API Key is configured in settings. Web grounding will not work until you add a Tavily key in Search API Settings."
        });
      } else {
        try {
          const tavilyRes = await fetchWithTimeout("https://api.tavily.com/search", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: tavilyApiKey.trim(), query: "test", max_results: 1 })
          }, 10000);

          if (tavilyRes.ok) {
            steps.push({
              id: "search",
              status: "pass",
              title: "4. Web Search Integration Check",
              message: "Tavily Web Search API is verified and operational."
            });
          } else {
            steps.push({
              id: "search",
              status: "fail",
              title: "4. Web Search Integration Check",
              message: `Tavily Search check failed with HTTP ${tavilyRes.status}. Please check your Tavily API Key in Search API Settings.`
            });
          }
        } catch (tavilyErr) {
          steps.push({
            id: "search",
            status: "fail",
            title: "4. Web Search Integration Check",
            message: `Could not reach Tavily Search API: ${tavilyErr.message}`
          });
        }
      }
    } else {
      steps.push({
        id: "search",
        status: "skipped",
        title: "4. Web Search Integration Check",
        message: "Web search is disabled for this model (Optional)."
      });
    }

    const hasFailure = steps.some(s => s.status === "fail");
    const hasWarning = steps.some(s => s.status === "warn");

    let summaryText = "All checks passed! Infopedia is configured properly and ready to use.";
    if (hasWarning) {
      summaryText = "Core AI setup passed! Notice: Web search has a warning (check Tavily settings).";
    }

    sendResponse({
      success: !hasFailure,
      steps: steps,
      summary: summaryText
    });

  } catch (unexpectedError) {
    sendResponse({
      success: false,
      steps: [
        {
          id: "general",
          status: "fail",
          title: "Diagnostic Execution Error",
          message: unexpectedError.message || String(unexpectedError)
        }
      ],
      summary: `Diagnostic test failed: ${unexpectedError.message}`
    });
  }
}

