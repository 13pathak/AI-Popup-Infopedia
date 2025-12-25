// --- TAB SWITCHING LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Activate clicked
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');

      // Reload history every time you open the History tab
      if (tab.dataset.tab === "history-content") {
        loadLists(); // This will in turn load history for the selected list
      }

      // --- NEW: Load Anki data when tab is clicked ---
      if (tab.dataset.tab === "anki-content") {
        loadAnkiDecksAndModels();
      }

      // --- NEW: Load Flashcard lists when tab is clicked ---
      if (tab.dataset.tab === "flashcards-content") {
        loadFlashcardLists();
      }

      // --- NEW: Load Reminder settings when tab is clicked ---
      if (tab.dataset.tab === "reminder-content") {
        loadReminderSettings();
      }

      // --- NEW: Load Prompts when tab is clicked ---
      if (tab.dataset.tab === "prompts-content") {
        loadPrompts();
      }

      // --- NEW: Load TTS Settings when tab is clicked ---
      if (tab.dataset.tab === "tts-content") {
        loadTTSSettings();
      }
    });
  });

  loadModels();
  loadLists(); // Load lists on initial page load

  loadDefaultPromptSelect(); // Load default prompt selector
  loadAnkiSettings(); // Load saved Anki settings on page load
  loadReminderSettings(); // Load saved Reminder settings on page load

  // Helper helper to safely add listeners
  function safeAddListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(event, handler);
    } else {
      console.warn(`Element with ID '${id}' not found for event '${event}'`);
    }
  }

  // --- REVISED: Safe Event Listener Attachments ---
  safeAddListener('add-model-btn', 'click', () => showModelForm(false));
  safeAddListener('edit-model-btn', 'click', editSelectedModel);
  safeAddListener('delete-model-btn', 'click', deleteSelectedModel);
  safeAddListener('model-select', 'change', (e) => setDefaultModel(e.target.value));
  safeAddListener('save-model-btn', 'click', saveModel);
  safeAddListener('default-prompt-select', 'change', (e) => saveDefaultPromptId(e.target.value));
  safeAddListener('cancel-model-btn', 'click', hideModelForm);

  safeAddListener('export-history', 'click', exportHistory);
  safeAddListener('import-history', 'click', () => document.getElementById('import-file-input').click());
  safeAddListener('import-file-input', 'change', importHistory);
  safeAddListener('list-select', 'change', (e) => {
    if (e.target.value === "__create_new__") {
      addList();
    } else {
      applyFilters();
    }
  });
  safeAddListener('add-list-btn', 'click', addList);
  safeAddListener('rename-list-btn', 'click', renameList);
  safeAddListener('delete-list-btn', 'click', deleteList);
  safeAddListener('move-list-up-btn', 'click', () => moveList('up'));
  safeAddListener('move-list-down-btn', 'click', () => moveList('down'));

  safeAddListener('export-all-history', 'click', exportAllHistory);
  safeAddListener('import-all-history', 'click', () => document.getElementById('import-file-input').click());

  safeAddListener('clear-history', 'click', clearAllHistory);
  safeAddListener('clear-list-history', 'click', clearListHistory);

  safeAddListener('export-all-settings-btn', 'click', exportAllSettings);
  safeAddListener('import-all-settings-btn', 'click', () => document.getElementById('import-settings-file-input').click());
  safeAddListener('import-settings-file-input', 'change', importAllSettings);

  safeAddListener('anki-save-settings-btn', 'click', saveAnkiSettings);
  safeAddListener('anki-model-select', 'change', (e) => loadAnkiFields(e.target.value));
  safeAddListener('anki-refresh-btn', 'click', loadAnkiDecksAndModels);

  safeAddListener('save-reminder-settings-btn', 'click', saveReminderSettings);
  safeAddListener('manual-backup-btn', 'click', () => {
    chrome.runtime.sendMessage({ type: "manualBackup" });
    updateReminderStatus('Manual backup initiated... check Downloads.', 'info');
  });

  safeAddListener('restore-backup-btn', 'click', () => document.getElementById('restore-backup-file').click());
  safeAddListener('restore-backup-file', 'change', restoreBackup);

  safeAddListener('save-custom-prompt-btn', 'click', savePrompt);
  safeAddListener('cancel-custom-prompt-btn', 'click', cancelPromptEdit);

  // --- TTS Event Listeners ---
  safeAddListener('tts-test-btn', 'click', testTTSVoice);
  safeAddListener('tts-save-btn', 'click', saveTTSSettings);
  safeAddListener('tts-rate-range', 'input', (e) => {
    const valSpan = document.getElementById('tts-rate-value');
    if (valSpan) valSpan.textContent = e.target.value;
  });

  safeAddListener('history-search', 'input', debounce(applyFilters, 300));
  safeAddListener('date-filter', 'change', applyFilters);
  safeAddListener('favorites-only', 'change', applyFilters);

  safeAddListener('toggle-bulk-mode', 'click', toggleBulkMode);
  safeAddListener('select-all-checkbox', 'change', toggleSelectAll);
  document.getElementById('bulk-delete-btn').addEventListener('click', bulkDelete);
  document.getElementById('bulk-move-btn').addEventListener('click', bulkMove);
  document.getElementById('bulk-anki-btn').addEventListener('click', bulkExportToAnki);

  // --- NEW: Flashcard Event Listeners ---
  document.getElementById('start-review-btn').addEventListener('click', startFlashcardReview);
  document.getElementById('show-answer-btn').addEventListener('click', showFlashcardAnswer);
  document.getElementById('review-again-btn').addEventListener('click', startFlashcardReview);
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', (e) => rateFlashcard(parseInt(e.target.dataset.rating)));
  });
  // --- NEW: Storage Listener for Real-time Backup Status ---
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.lastBackupTime || changes.lastBackupError || changes.lastBackupType) {
        // Reload status
        loadReminderSettings();
      }
    }
  });
});


// --- NEW: MODEL MANAGEMENT ---

function showModelForm(isEdit = false, model = {}) {
  document.getElementById('form-title').textContent = isEdit ? 'Edit Model' : 'Add New Model';
  document.getElementById('model-id').value = model.id || '';
  document.getElementById('configName').value = model.name || '';
  document.getElementById('endpoint').value = model.endpointUrl || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  document.getElementById('modelName').value = model.modelName || 'gemini-1.5-flash-latest';
  document.getElementById('apiKey').value = model.apiKey || '';

  document.getElementById('model-form-container').style.display = 'block';
  document.getElementById('model-selection-container').style.display = 'none';
  document.getElementById('default-prompt-container').style.display = 'none';
}

function hideModelForm() {
  document.getElementById('model-form-container').style.display = 'none';
  document.getElementById('model-selection-container').style.display = 'flex';
  document.getElementById('default-prompt-container').style.display = 'block';
  // Clear form fields
  document.getElementById('model-id').value = '';
  document.getElementById('configName').value = '';
  document.getElementById('endpoint').value = '';
  document.getElementById('modelName').value = '';
  document.getElementById('apiKey').value = '';
}

function saveModel() {
  const modelId = document.getElementById('model-id').value;
  const newModelConfig = {
    id: modelId || `model_${new Date().getTime()}`,
    name: document.getElementById('configName').value.trim(),
    endpointUrl: document.getElementById('endpoint').value.trim(),
    modelName: document.getElementById('modelName').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim()
  };

  if (!newModelConfig.name || !newModelConfig.endpointUrl || !newModelConfig.modelName) {
    updateStatus('Configuration Name, Endpoint URL, and Model Name are required.', 'error');
    return;
  }

  chrome.storage.sync.get(['models', 'defaultModelId'], (data) => {
    let models = data.models || [];
    if (modelId) { // Editing existing
      models = models.map(m => m.id === modelId ? newModelConfig : m);
    } else { // Adding new
      models.push(newModelConfig);
    }

    // If this is the very first model, make it the default
    let defaultModelId = data.defaultModelId;
    if (!defaultModelId && models.length > 0) {
      defaultModelId = models[0].id;
    }

    chrome.storage.sync.set({ models, defaultModelId }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving model:", chrome.runtime.lastError);
        updateStatus(`Error saving model: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      updateStatus('Model saved successfully!', 'success');
      hideModelForm();
      loadModels();
    });
  });
}

function loadModels() {
  chrome.storage.sync.get(['models', 'defaultModelId'], (data) => {
    const models = data.models || [];
    const defaultModelId = data.defaultModelId;
    const selectEl = document.getElementById('model-select');
    const noModelsMsg = document.getElementById('no-models-message');
    const editModelBtn = document.getElementById('edit-model-btn');
    const deleteModelBtn = document.getElementById('delete-model-btn');
    selectEl.innerHTML = '';

    if (models.length === 0) {
      noModelsMsg.style.display = 'block';
      selectEl.style.display = 'none'; // Hide the select dropdown
      editModelBtn.style.display = 'none'; // Hide edit button
      deleteModelBtn.style.display = 'none'; // Hide delete button
    } else {
      noModelsMsg.style.display = 'none';
      selectEl.style.display = 'block'; // Show the select dropdown
      editModelBtn.style.display = 'inline-block'; // Show edit button
      deleteModelBtn.style.display = 'inline-block'; // Show delete button

      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.id === defaultModelId) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });
    }
  });
}

function editSelectedModel() {
  const selectedId = document.getElementById('model-select').value;
  if (!selectedId) {
    alert("No model selected to edit.");
    return;
  }
  chrome.storage.sync.get(['models'], (data) => {
    const modelToEdit = (data.models || []).find(m => m.id === selectedId);
    if (modelToEdit) {
      showModelForm(true, modelToEdit);
    }
  });
}

function deleteSelectedModel() {
  const modelIdToDelete = document.getElementById('model-select').value;
  if (!modelIdToDelete) {
    alert("No model selected to delete.");
    return;
  }

  if (!confirm('Are you sure you want to delete the selected model configuration?')) return;

  chrome.storage.sync.get(['models', 'defaultModelId'], (data) => {
    let models = data.models || [];
    let defaultModelId = data.defaultModelId;

    models = models.filter(m => m.id !== modelIdToDelete);

    // If the deleted model was the default, pick a new default
    if (defaultModelId === modelIdToDelete) {
      defaultModelId = models.length > 0 ? models[0].id : null;
    }

    chrome.storage.sync.set({ models, defaultModelId }, () => {
      updateStatus('Model deleted.', 'success');
      loadModels();
    });
  });
}

function setDefaultModel(modelId) {
  chrome.storage.sync.set({ defaultModelId: modelId }, () => {
    updateStatus('Default model updated.', 'success');
    loadModels();
  });
}

function saveDefaultPromptId(promptId) {
  chrome.storage.sync.set({ defaultPromptId: promptId }, () => {
    updateStatus('Default prompt updated.', 'success');
  });
}

function loadDefaultPromptSelect() {
  chrome.storage.sync.get(['customPrompts', 'defaultPromptId'], (data) => {
    const prompts = data.customPrompts || [];
    const defaultPromptId = data.defaultPromptId;
    const select = document.getElementById('default-prompt-select');

    select.innerHTML = '';

    if (prompts.length === 0) {
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "-- No custom prompts created --";
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      return;
    }

    let isAnySelected = false;

    prompts.forEach(prompt => {
      const option = document.createElement('option');
      option.value = prompt.id;
      option.textContent = prompt.name;
      if (prompt.id === defaultPromptId) {
        option.selected = true;
        isAnySelected = true;
      }
      select.appendChild(option);
    });

    if (!isAnySelected && prompts.length > 0) {
      select.value = prompts[0].id;
    }
  });
}


function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');
  setTimeout(() => {
    statusEl.textContent = '';
  }, 3000);
}

// ---
// --- NEW: GLOBAL SETTINGS IMPORT/EXPORT
// ---

async function exportAllSettings() {
  try {
    // 1. Get all data from sync storage (models, prompts)
    const syncData = await new Promise(resolve => chrome.storage.sync.get(null, resolve));

    // --- NEW: Exclude Anki settings from this export ---
    delete syncData.ankiSettings;

    // 2. Create the settings object
    const allSettings = {
      syncData: syncData,
      exportFormatVersion: "1.0",
      exportedAt: new Date().toISOString()
    };

    // 3. Create and download the JSON file
    const jsonString = JSON.stringify(allSettings, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `ai_infopedia_models_prompts_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    updateGlobalIOStatus('All settings exported successfully!', 'success');
  } catch (error) {
    console.error("Error exporting models & prompts:", error);
    updateGlobalIOStatus(`Error exporting settings: ${error.message}`, 'error');
  }
}

function importAllSettings(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const settings = JSON.parse(e.target.result);

      // Basic validation
      if (!settings.syncData) {
        throw new Error("Invalid settings file. Missing required 'syncData'.");
      }

      // Confirmation from the user
      if (!confirm("Are you sure you want to import settings? This will overwrite all current models and prompts.")) {
        updateGlobalIOStatus('Import cancelled.', 'info');
        return;
      }

      // --- NEW: Get Anki settings to preserve them ---
      const ankiSettings = await new Promise(resolve => chrome.storage.sync.get('ankiSettings', resolve));

      // Clear existing sync storage before importing
      await new Promise(resolve => chrome.storage.sync.clear(resolve));

      // Import new data into sync storage
      await new Promise(resolve => chrome.storage.sync.set(settings.syncData, resolve));

      // --- NEW: Restore Anki settings ---
      if (ankiSettings.ankiSettings) {
        await new Promise(resolve => chrome.storage.sync.set(ankiSettings, resolve));
      }

      updateGlobalIOStatus('Settings imported successfully! Reloading...', 'success');

      // Reload only the relevant data on the page
      setTimeout(() => {
        loadModels();
        loadDefaultPromptSelect();
      }, 1000);

    } catch (error) {
      console.error("Error importing settings:", error);
      updateGlobalIOStatus(`Error importing settings: ${error.message}`, 'error');
    } finally {
      // Reset file input so the same file can be imported again
      event.target.value = null;
    }
  };

  reader.onerror = () => {
    updateGlobalIOStatus("Error reading file.", "error");
  };

  reader.readAsText(file);
}

function updateGlobalIOStatus(message, type = 'info') {
  const statusEl = document.getElementById('global-io-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');

  setTimeout(() => {
    statusEl.textContent = '';
  }, 5000);
}


// ---
// --- LIST MANAGEMENT FUNCTIONS
// ---

function loadLists() {
  chrome.storage.local.get({ wordLists: [] }, (data) => {
    let lists = data.wordLists;
    const listSelect = document.getElementById('list-select');
    const renameBtn = document.getElementById('rename-list-btn');
    const deleteBtn = document.getElementById('delete-list-btn');
    const moveUpBtn = document.getElementById('move-list-up-btn');
    const moveDownBtn = document.getElementById('move-list-down-btn');
    const clearListBtn = document.getElementById('clear-list-history');
    const currentVal = listSelect.value;
    listSelect.innerHTML = '';

    if (lists.length === 0) {
      // --- NEW: Handle empty state ---
      renameBtn.disabled = true;
      deleteBtn.disabled = true;
      moveUpBtn.disabled = true;
      moveDownBtn.disabled = true;
      clearListBtn.style.display = 'none'; // Hide button
      loadHistory(null); // Load history with no list ID
    } else {
      renameBtn.disabled = false;
      deleteBtn.disabled = false;

      // --- NEW: Show and update clear list button ---
      const selectedListName = listSelect.options[listSelect.selectedIndex]?.text || lists[0].name;
      clearListBtn.textContent = `Clear Selected List`;
      clearListBtn.style.display = 'inline-block';
      // Buttons will be enabled/disabled later based on selection
    }

    lists.forEach(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.name;
      listSelect.appendChild(option);
    });

    // --- NEW: Add "Create New List" option ---
    const createOption = document.createElement('option');
    createOption.value = "__create_new__";
    createOption.textContent = "+ Create New List...";
    createOption.style.color = "#88ff88"; // Green tint
    listSelect.appendChild(createOption);

    // Try to re-select the previously selected list
    if (currentVal && listSelect.querySelector(`option[value="${currentVal}"]`)) {
      listSelect.value = currentVal;
    }

    // --- NEW: Handle "Create New List" selection logic here ---
    // But since this is inside loadLists, we should attach the listener OUTSIDE/ONCE.
    // However, options.js attaches 'change' listener to applyFilters().
    // We need to intercept that specific value in the change listener or wrap it.
    // Let's modify the change listener in DOMContentLoaded!
    // Wait, modifying DOMContentLoaded is separate. Here we ensure the option exists.

    // --- NEW: Disable/Enable move buttons based on selection ---
    const selectedIndex = listSelect.selectedIndex;
    // ... (rest of logic)
    const listCount = lists.length;
    moveUpBtn.disabled = selectedIndex <= 0;
    moveDownBtn.disabled = selectedIndex >= listCount - 1 || listCount <= 1;

    // --- NEW: Update clear list button text on change ---
    if (lists.length > 0) {
      clearListBtn.textContent = `Clear Selected List`;
    }

    // Load history for the currently selected list with filters
    applyFilters();
  });
}

function addList() {
  const listName = prompt("Enter the name for the new list:");
  if (listName && listName.trim()) {
    chrome.storage.local.get({ wordLists: [] }, (data) => {
      const lists = data.wordLists;
      const newList = { id: `list_${new Date().getTime()}`, name: listName.trim() };
      lists.push(newList);
      chrome.storage.local.set({ wordLists: lists }, () => {
        updateStatus('List created!', 'success');
        loadLists();
      });
    });
  }
}

function renameList() {
  const listSelect = document.getElementById('list-select');
  const listId = listSelect.value;
  if (!listId) return;

  const currentName = listSelect.options[listSelect.selectedIndex].text;
  const newName = prompt("Enter the new name for the list:", currentName);

  if (newName && newName.trim() && newName.trim() !== currentName) {
    chrome.storage.local.get({ wordLists: [] }, (data) => {
      const lists = data.wordLists.map(list =>
        list.id === listId ? { ...list, name: newName.trim() } : list
      );
      chrome.storage.local.set({ wordLists: lists }, () => {
        updateStatus('List renamed!', 'success');
        loadLists();
      });
    });
  }
}

function deleteList() {
  const listSelect = document.getElementById('list-select');
  const listId = listSelect.value;
  if (!listId) {
    alert("No list selected.");
    return;
  }

  // Check actual wordLists array length, not options count (which includes "+ Create New List...")
  chrome.storage.local.get({ wordLists: [] }, (data) => {
    if (data.wordLists.length <= 1) {
      alert("You cannot delete the last remaining list.");
      return;
    }

    if (confirm("Are you sure you want to delete this list? Words in it will NOT be deleted but will become unlisted.")) {
      const lists = data.wordLists.filter(list => list.id !== listId);
      chrome.storage.local.set({ wordLists: lists }, () => {
        updateStatus('List deleted.', 'success');
        loadLists();
      });
    }
  });
}

// --- NEW: Function to move a list up or down ---
function moveList(direction) {
  const listSelect = document.getElementById('list-select');
  const selectedId = listSelect.value;
  if (!selectedId) return;

  chrome.storage.local.get({ wordLists: [] }, (data) => {
    let lists = data.wordLists;
    const index = lists.findIndex(list => list.id === selectedId);

    if (direction === 'up' && index > 0) {
      // Swap with the element before it
      [lists[index - 1], lists[index]] = [lists[index], lists[index - 1]];
    } else if (direction === 'down' && index < lists.length - 1) {
      // Swap with the element after it
      [lists[index + 1], lists[index]] = [lists[index], lists[index + 1]];
    } else {
      return; // Can't move further
    }

    // Save the reordered list and reload the UI
    chrome.storage.local.set({ wordLists: lists }, () => {
      // We don't need to show a status message for this, the change is visual
      // The `loadLists` function will preserve the selection and update the UI
      loadLists();
    });
  });
}


// --- loadHistory ---
function loadHistory(listId) {
  const historyList = document.getElementById('history-list');
  const noHistoryMessage = document.getElementById('no-history-message');
  historyList.innerHTML = '';

  chrome.storage.local.get(['history'], (result) => {
    // If no listId is provided (e.g., no lists exist), show no items.
    // Otherwise, filter for the selected list.
    const history = listId
      ? (result.history || []).filter(item => item.listId === listId)
      : [];

    if (history.length === 0) {
      noHistoryMessage.style.display = 'block';
      historyList.style.display = 'none';
    } else {
      noHistoryMessage.style.display = 'none';
      historyList.style.display = 'block';

      history.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'history-item';
        itemElement.dataset.timestamp = item.timestamp;
        itemElement.dataset.listId = item.listId; // Add listId to the element

        let formattedDefinition = item.definition
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');

        const displayView = document.createElement('div');
        displayView.className = 'display-view';

        // Build source link HTML if available
        let sourceHtml = '';
        if (item.sourceUrl) {
          const displayTitle = item.sourceTitle || (item.sourceUrl.length > 40 ? item.sourceUrl.substring(0, 40) + '...' : item.sourceUrl);
          sourceHtml = ` | <a href="${escapeHTML(item.sourceUrl)}" target="_blank" style="color: #61afef; text-decoration: none;" title="${escapeHTML(item.sourceUrl)}">Source: ${escapeHTML(displayTitle)}</a>`;
        }

        displayView.innerHTML = `
          <div class="history-word">${escapeHTML(item.word)}</div>
          <div class="history-definition">${formattedDefinition}</div>
          <div class="history-model" style="font-size: 0.8em; color: #888; margin-top: 4px;">
            Model: ${escapeHTML(item.modelName || 'Unknown')} | 
            Prompt: ${escapeHTML(item.promptName || 'Unknown')} | 
            Date: ${new Date(item.timestamp).toLocaleDateString()}${sourceHtml}
          </div>
        `;
        itemElement.appendChild(displayView);

        // --- NEW: Add Anki Button ---
        const ankiButton = document.createElement('button');
        ankiButton.className = 'anki-item-btn';
        ankiButton.innerHTML = '<strong>A</strong>'; // 'A' for Anki
        ankiButton.title = 'Send to Anki';
        ankiButton.dataset.timestamp = item.timestamp;
        ankiButton.addEventListener('click', handleSendToAnkiClick);
        itemElement.appendChild(ankiButton);
        // --- END NEW ---

        // --- NEW: Add Star/Favorite Button ---
        const starButton = document.createElement('button');
        starButton.className = 'star-item-btn' + (item.favorite ? ' favorited' : '');
        starButton.innerHTML = item.favorite ? '★' : '☆';
        starButton.title = item.favorite ? 'Remove from favorites' : 'Add to favorites';
        starButton.dataset.timestamp = item.timestamp;
        starButton.addEventListener('click', handleToggleFavoriteClick);
        itemElement.appendChild(starButton);

        // --- NEW: Add Bulk Selection Checkbox ---
        const bulkCheckbox = document.createElement('input');
        bulkCheckbox.type = 'checkbox';
        bulkCheckbox.className = 'bulk-checkbox';
        bulkCheckbox.dataset.timestamp = item.timestamp;
        bulkCheckbox.addEventListener('change', updateSelectedCount);
        itemElement.appendChild(bulkCheckbox);

        const editButton = document.createElement('button');
        editButton.className = 'edit-item-btn';
        editButton.innerHTML = '&#9998;';
        editButton.title = 'Edit this item';
        editButton.dataset.timestamp = item.timestamp;
        editButton.addEventListener('click', handleEditClick);
        itemElement.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-item-btn';
        deleteButton.innerHTML = '&#128465;';
        deleteButton.title = 'Delete this item';
        deleteButton.dataset.timestamp = item.timestamp;
        deleteButton.addEventListener('click', handleDeleteClick);

        itemElement.appendChild(deleteButton);
        historyList.appendChild(itemElement);
      });
    }
  });
}

// --- handleEditClick ---
function handleEditClick(event) {
  const btn = event.currentTarget;
  const itemElement = btn.closest('.history-item');
  const currentListId = itemElement.dataset.listId;

  if (itemElement.classList.contains('history-item-editing')) {
    return;
  }
  itemElement.classList.add('history-item-editing');

  const wordDiv = itemElement.querySelector('.history-word');
  const definitionDiv = itemElement.querySelector('.history-definition');

  const currentWord = wordDiv.textContent;
  const currentDefinitionText = definitionDiv.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**');

  itemElement.querySelector('.display-view').style.display = 'none';
  itemElement.querySelector('.anki-item-btn').style.display = 'none';
  itemElement.querySelector('.star-item-btn').style.display = 'none'; // Hide star button during edit
  itemElement.querySelector('.edit-item-btn').style.display = 'none';
  itemElement.querySelector('.delete-item-btn').style.display = 'none';

  const editWordInput = document.createElement('input');
  editWordInput.type = 'text';
  editWordInput.className = 'edit-word-input';
  editWordInput.value = currentWord;

  // --- NEW: Create and populate list selector ---
  const listSelector = document.createElement('select');
  listSelector.className = 'edit-list-selector';

  // This container will hold the inputs and selector
  const editControlsContainer = document.createElement('div');
  editControlsContainer.className = 'edit-controls'; // For potential future styling

  chrome.storage.local.get({ wordLists: [] }, (data) => {
    data.wordLists.forEach(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.name;
      if (list.id === currentListId) {
        option.selected = true;
      }
      listSelector.appendChild(option);
    });

    // --- NEW: Add Create List option ---
    const createOption = document.createElement('option');
    createOption.value = "__create_new__";
    createOption.textContent = "+ Create New List...";
    createOption.style.color = "lightgreen";
    listSelector.appendChild(createOption);

    // Add change listener for creation
    listSelector.addEventListener('change', (e) => {
      if (e.target.value === "__create_new__") {
        const newListName = prompt("Enter the name for the new list:");
        if (newListName && newListName.trim()) {
          // We need to manually add to storage here or reuse addList logic?
          // Since we are in options.js, we can access storage directly.
          chrome.storage.local.get({ wordLists: [] }, (data) => {
            const lists = data.wordLists;
            const newList = { id: `list_${new Date().getTime()}`, name: newListName.trim() };
            lists.push(newList);
            chrome.storage.local.set({ wordLists: lists }, () => {
              updateStatus('List created!', 'success');
              // Re-populate this specific selector!
              // We need to clear and re-add options.
              listSelector.innerHTML = '';
              lists.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.name;
                if (l.id === newList.id) opt.selected = true;
                listSelector.appendChild(opt);
              });
              // Add create option again
              listSelector.appendChild(createOption);
              listSelector.value = newList.id; // Select new one

              // Also refresh the main list in background? 
              // loadLists() would refresh the MAIN UI but might disrupt the editing flow?
              // Yes, loadLists clears history list. We should NOT call loadLists here.
              // But we should probably update the main dropdown silently?
              // For now, let's just make sure the editing works. 
              // The main dropdown will be outdated until page refresh or manual interaction.
              // That's acceptable for this localized context.
            });
          });
        } else {
          // Revert to currentListId (original one) or try to find what was selected?
          // Simplest is to set value back to currentListId
          listSelector.value = currentListId;
        }
      }
    });

    editControlsContainer.appendChild(listSelector); // Add selector to container
  });

  const editDefinitionTextarea = document.createElement('textarea');
  editDefinitionTextarea.className = 'edit-definition-textarea';
  editDefinitionTextarea.value = currentDefinitionText;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'save-edit-btn';
  saveBtn.addEventListener('click', handleSaveClick);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-edit-btn';
  cancelBtn.addEventListener('click', handleCancelClick);

  actionsDiv.append(saveBtn, cancelBtn);

  // Add the controls to the item element
  editControlsContainer.prepend(editWordInput); // Word input at the top
  itemElement.append(editControlsContainer, editDefinitionTextarea, actionsDiv);
}

// --- handleSaveClick ---
function handleSaveClick(event) {
  const btn = event.currentTarget;
  const itemElement = btn.closest('.history-item');
  const timestamp = itemElement.dataset.timestamp;

  const newWord = itemElement.querySelector('.edit-word-input').value;
  const newListId = itemElement.querySelector('.edit-list-selector').value;
  const newDefinition = itemElement.querySelector('.edit-definition-textarea').value;

  updateHistoryItem(timestamp, newWord, newDefinition, newListId);
}

// --- handleCancelClick ---
function handleCancelClick(event) {
  // Simply reload the current list's history to discard changes
  loadHistory(document.getElementById('list-select').value);
}

// --- updateHistoryItem ---
function updateHistoryItem(timestamp, newWord, newDefinition, newListId) {
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    const newHistory = history.map(item => {
      if (item.timestamp === timestamp) {
        return {
          ...item,
          word: newWord,
          definition: newDefinition,
          listId: newListId // Update the listId
        };
      }
      return item;
    });

    chrome.storage.local.set({ history: newHistory }, () => {
      loadHistory(document.getElementById('list-select').value);
    });
  });
}


// --- handleDeleteClick ---
function handleDeleteClick(event) {
  const btn = event.currentTarget;
  const timestamp = btn.dataset.timestamp;

  if (timestamp) {
    deleteHistoryItem(timestamp);
  }
}

// --- deleteHistoryItem ---
function deleteHistoryItem(timestamp) {
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];
    const newHistory = history.filter(item => item.timestamp !== timestamp);
    chrome.storage.local.set({ history: newHistory }, () => {
      loadHistory(document.getElementById('list-select').value);
    });
  });
}


// --- clearHistory ---
function clearAllHistory() {
  if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
    chrome.storage.local.set({ history: [] }, () => {
      loadLists();
      console.log("History cleared.");
    });
  }
}

// --- NEW: Function to clear history for a specific list ---
function clearListHistory() {
  const listSelect = document.getElementById('list-select');
  const listId = listSelect.value;
  const listName = listSelect.options[listSelect.selectedIndex]?.text;

  if (!listId) return;

  if (confirm(`Are you sure you want to clear all words from the "${listName}" list? This cannot be undone.`)) {
    chrome.storage.local.get(['history'], (result) => {
      let history = result.history || [];
      // Keep all items that DO NOT belong to the selected list
      const newHistory = history.filter(item => item.listId !== listId);

      chrome.storage.local.set({ history: newHistory }, () => {
        updateIOStatus(`History for "${listName}" cleared.`, 'success');
        loadHistory(listId); // Reload the view for the current list
      });
    });
  }
}

// --- escapeHTML ---
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}


// ---
// --- IMPORT/EXPORT FUNCTIONS
// ---

// --- Helper to show status messages ---
function updateIOStatus(message, type = 'info') {
  const statusEl1 = document.getElementById('io-status');
  const statusEl2 = document.getElementById('io-status-all');

  [statusEl1, statusEl2].forEach(el => {
    el.textContent = message;
    el.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');
  });

  // Clear message after 5 seconds
  setTimeout(() => {
    statusEl1.textContent = '';
    statusEl2.textContent = '';
  }, 5000);
}

// --- Helper to escape a field for CSV ---
function escapeCSV(str) {
  let result = String(str || '').replace(/"/g, '""');
  if (result.search(/("|,|\n|\r)/g) >= 0) {
    result = `"${result}"`;
  }
  return result;
}

// --- Export Function ---
function exportHistory() {
  const listSelect = document.getElementById('list-select');
  const selectedListId = listSelect.value;
  const selectedListName = listSelect.options[listSelect.selectedIndex]?.text;

  if (!selectedListId) {
    updateIOStatus("No list selected to export.", "error");
    return;
  }

  // Fetch both history and wordLists to map listId to listName
  chrome.storage.local.get(['history', 'wordLists'], (result) => {
    const allHistory = result.history || [];
    const wordLists = result.wordLists || [];

    // Create a map for quick lookup of list names by ID
    const listIdToNameMap = {};
    wordLists.forEach(list => {
      listIdToNameMap[list.id] = list.name;
    });

    // --- REVISED: Filter history for the selected list ---
    const historyToExport = allHistory.filter(item => item.listId === selectedListId);

    if (historyToExport.length === 0) {
      updateIOStatus(`The list "${selectedListName}" is empty. Nothing to export.`, "error");
      return;
    }

    // --- REVISED HEADERS: Include all fields including flashcard progress ---
    const headers = ['timestamp', 'word', 'definition', 'listName', 'modelName', 'sourceUrl', 'sourceTitle', 'favorite', 'nextReview', 'interval', 'lastReviewed'];
    const csvRows = [
      headers.join(','),
      ...historyToExport.map(item => [
        escapeCSV(item.timestamp),
        escapeCSV(item.word),
        escapeCSV(item.definition),
        escapeCSV(listIdToNameMap[item.listId] || 'Unlisted'),
        escapeCSV(item.modelName || ''),
        escapeCSV(item.sourceUrl || ''),
        escapeCSV(item.sourceTitle || ''),
        escapeCSV(item.favorite ? 'true' : 'false'),
        escapeCSV(item.nextReview || ''),
        escapeCSV(item.interval || ''),
        escapeCSV(item.lastReviewed || '')
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    // --- FIX: Add UTF-8 BOM for Excel compatibility ---
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeFilename = selectedListName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_infopedia_${safeFilename}.csv`; // --- REVISED: Dynamic filename ---
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    updateIOStatus(`List "${selectedListName}" exported successfully!`, "success");

    // --- NEW: Reset backup reminder ---
    resetBackupReminder();
  });
}

// --- NEW: Export All History Function ---
function exportAllHistory() {
  // Fetch both history and wordLists to map listId to listName
  chrome.storage.local.get(['history', 'wordLists'], (result) => {
    const allHistory = result.history || [];
    const wordLists = result.wordLists || [];

    if (allHistory.length === 0) {
      updateIOStatus("History is empty. Nothing to export.", "error");
      return;
    }

    // Create a map for quick lookup of list names by ID
    const listIdToNameMap = {};
    wordLists.forEach(list => {
      listIdToNameMap[list.id] = list.name;
    });

    const headers = ['timestamp', 'word', 'definition', 'listName', 'modelName', 'sourceUrl', 'sourceTitle', 'favorite', 'nextReview', 'interval', 'lastReviewed'];
    const csvRows = [
      headers.join(','),
      ...allHistory.map(item => [
        escapeCSV(item.timestamp),
        escapeCSV(item.word),
        escapeCSV(item.definition),
        escapeCSV(listIdToNameMap[item.listId] || 'Unlisted'),
        escapeCSV(item.modelName || ''),
        escapeCSV(item.sourceUrl || ''),
        escapeCSV(item.sourceTitle || ''),
        escapeCSV(item.favorite ? 'true' : 'false'),
        escapeCSV(item.nextReview || ''),
        escapeCSV(item.interval || ''),
        escapeCSV(item.lastReviewed || '')
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    // --- FIX: Add UTF-8 BOM for Excel compatibility ---
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_infopedia_all_history.csv`; // Static filename for global export
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    updateIOStatus(`All history exported successfully!`, "success");

    // --- NEW: Reset backup reminder ---
    resetBackupReminder();
  });
}


// --- Robust CSV Parser ---
function parseCSV(text) {
  const rows = [];
  let fields = [];
  let currentField = '';
  let inQuotes = false;

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const csvText = cleanText.endsWith('\n') ? cleanText : cleanText + '\n';

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(currentField);
        currentField = '';
      } else if (char === '\n') {
        fields.push(currentField);
        rows.push(fields);
        fields = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  return rows.filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''));
}


// --- UPDATED: Import Function (to handle encoding) ---
function importHistory(event) {
  const file = event.target.files[0];
  if (!file || (!file.type.match('text/csv') && !file.name.endsWith('.csv'))) {
    updateIOStatus("Please select a valid .csv file.", "error");
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    // --- NEW: Handle character encoding ---
    const arrayBuffer = e.target.result;

    // Use TextDecoder to specify the encoding. 
    // --- FIX: Use UTF-8 which matches the export format. The 'fatal: false' allows it to handle other encodings gracefully. ---
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(arrayBuffer);

    const rows = parseCSV(text);

    if (rows.length < 2) {
      updateIOStatus("File is empty or has no header.", "error");
      return;
    }

    const newItems = [];
    let parseErrors = 0;

    const headers = rows[0].map(h => h.trim());
    const tsIndex = headers.indexOf('timestamp');
    const wordIndex = headers.indexOf('word');
    const defIndex = headers.indexOf('definition');
    const listNameIndex = headers.indexOf('listName');
    const modelNameIndex = headers.indexOf('modelName');
    const sourceUrlIndex = headers.indexOf('sourceUrl');
    const sourceTitleIndex = headers.indexOf('sourceTitle');
    const favoriteIndex = headers.indexOf('favorite');
    const nextReviewIndex = headers.indexOf('nextReview');
    const intervalIndex = headers.indexOf('interval');
    const lastReviewedIndex = headers.indexOf('lastReviewed');

    if (tsIndex === -1 || wordIndex === -1 || defIndex === -1) {
      updateIOStatus("File is missing required headers: timestamp, word, or definition.", "error");
      return;
    }

    for (let i = 1; i < rows.length; i++) {
      const fields = rows[i];
      if (fields.length === 1 && fields[0] === '') {
        continue;
      }

      // Relaxed check - only require the first 3 required fields
      if (fields.length >= 3) {
        const newItem = {
          timestamp: fields[tsIndex],
          word: fields[wordIndex],
          definition: fields[defIndex]
        };

        // Add optional fields if present
        if (listNameIndex !== -1 && fields[listNameIndex]) {
          newItem.listName = fields[listNameIndex];
        }
        if (modelNameIndex !== -1 && fields[modelNameIndex]) {
          newItem.modelName = fields[modelNameIndex];
        }
        if (sourceUrlIndex !== -1 && fields[sourceUrlIndex]) {
          newItem.sourceUrl = fields[sourceUrlIndex];
        }
        if (sourceTitleIndex !== -1 && fields[sourceTitleIndex]) {
          newItem.sourceTitle = fields[sourceTitleIndex];
        }
        if (favoriteIndex !== -1 && fields[favoriteIndex]) {
          newItem.favorite = fields[favoriteIndex].toLowerCase() === 'true';
        }
        // Flashcard progress fields
        if (nextReviewIndex !== -1 && fields[nextReviewIndex]) {
          newItem.nextReview = parseInt(fields[nextReviewIndex]) || 0;
        }
        if (intervalIndex !== -1 && fields[intervalIndex]) {
          newItem.interval = parseInt(fields[intervalIndex]) || 0;
        }
        if (lastReviewedIndex !== -1 && fields[lastReviewedIndex]) {
          newItem.lastReviewed = parseInt(fields[lastReviewedIndex]) || 0;
        }

        newItems.push(newItem);
      } else {
        console.warn(`Skipping malformed CSV line (line ${i + 1}): Expected at least 3 fields, found ${fields.length}`);
        parseErrors++;
      }
    }

    mergeHistory(newItems, parseErrors);
  };

  reader.onerror = () => {
    updateIOStatus("Error reading file.", "error");
  };

  // --- CHANGED: Read as ArrayBuffer instead of Text ---
  reader.readAsArrayBuffer(file);

  event.target.value = null;
}
// --- END UPDATED FUNCTION ---


// --- Helper to merge imported items ---
function mergeHistory(newItems, parseErrors) {
  // Get the currently selected list ID for items without a listName in CSV
  const listSelect = document.getElementById('list-select');
  const currentSelectedListId = listSelect.value;

  chrome.storage.local.get(['history', 'wordLists'], (result) => {
    const oldHistory = result.history || [];

    const historyMap = new Map();
    oldHistory.forEach(item => historyMap.set(item.timestamp, item));

    let added = 0;
    let duplicates = 0;

    // --- NEW: Handle wordLists for import ---
    let wordLists = result.wordLists || [];

    // Create a map for quick lookup of list IDs by name
    const listNameToIdMap = {};
    wordLists.forEach(list => {
      listNameToIdMap[list.name] = list.id;
    });

    // Track if wordLists were modified to save them later
    let wordListsModified = false;
    // --- END NEW ---

    newItems.forEach(item => {
      if (!item.word || !item.definition) {
        console.warn("Skipping item with missing data (word or definition):", item);
        parseErrors++;
        return;
      }

      let timestamp = item.timestamp;
      let isNew = false;

      if (!timestamp) {
        timestamp = new Date().toISOString() + '_' + Math.random().toString(36).substring(2, 9);
        item.timestamp = timestamp;
        isNew = true;
      }

      // --- NEW: Determine listId for the imported item ---
      let targetListId;
      if (item.listName && item.listName !== 'Unlisted') {
        // If listName is provided in CSV and is NOT 'Unlisted'
        if (listNameToIdMap[item.listName]) {
          // List already exists, use its ID
          targetListId = listNameToIdMap[item.listName];
        } else {
          // List does not exist, create a new one
          const newListId = `list_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
          const newList = { id: newListId, name: item.listName };
          wordLists.push(newList);
          listNameToIdMap[item.listName] = newListId; // Update map
          targetListId = newListId;
          wordListsModified = true; // Mark for saving
        }
      } else {
        // If listName is NOT provided or is 'Unlisted', assign to currently selected list (if user wants) or leave null?
        // Actually, the previous logic fell through to 'targetListId = currentSelectedListId' below?
        // Wait, the original code had:
        // } else { targetListId = currentSelectedListId; }
        // We should replicate that structure properly.

        // Let's rely on the outer-scope handling.
        // If we fall through here, targetListId remains undefined.
      }

      // If we didn't determine a targetListId from the listName (because it was missing or 'Unlisted')
      if (!targetListId) {
        // assign to currently selected list? 
        // Original code logic:
        // } else {
        //   targetListId = currentSelectedListId;
        // }
        // But that was only if item.listName was falsy. 
        // If item.listName was 'Unlisted', we want it to be NULL (Unlisted), NOT currentSelectedListId (which might be "Biology").
        // If we import "Unlisted" items, they should stay unlisted.

        if (item.listName === 'Unlisted') {
          targetListId = null;
        } else {
          // Basic fallback for old CSVs without listName col
          targetListId = currentSelectedListId;
        }
      }
      item.listId = targetListId;

      // If there are no lists at all, the item will be unassigned, which is fine.
      if (!targetListId) {
        item.listId = null;
      }

      if (isNew || !historyMap.has(timestamp)) {
        historyMap.set(timestamp, item);
        added++;
      } else {
        duplicates++;
      }
    });

    const mergedHistory = Array.from(historyMap.values());
    mergedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Prepare storage update
    const storageUpdates = { history: mergedHistory };
    if (wordListsModified) {
      storageUpdates.wordLists = wordLists;
    }
    chrome.storage.local.set(storageUpdates, () => {
      loadLists(); // Refresh the UI, which will also reload history
      updateIOStatus(
        `Import complete: ${added} new items added, ${duplicates} duplicates skipped, ${parseErrors} invalid rows.`,
        "success"
      );
    });
  });
}

// ---
// --- NEW: ANKI CONNECT FUNCTIONS
// ---

/**
 * Sends a request to the Anki Connect API.
 * @param {string} action - The AnKi Connect action (e.g., 'deckNames', 'addNote').
 * @param {object} params - The parameters for the action.
 * @param {number} version - The Anki Connect API version.
 * @returns {Promise<any>} - The 'result' field from the Anki Connect response.
 * @throws {Error} - If the Anki Connect call returns an error.
 */
async function ankiConnectRequest(action, params = {}, version = 6) {
  try {
    const response = await fetch('http://localhost:8765', {
      method: 'POST',
      body: JSON.stringify({ action, version, params })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.result;

  } catch (e) {
    console.error("Anki Connect request failed:", action, e);
    // Re-throw the error so it can be caught by the calling function
    throw e;
  }
}

/**
 * Updates the status message on the Anki settings tab.
 * @param {string} message - The message to display.
 * @param {'info' | 'success' | 'error'} type - The type of message.
 */
function updateAnkiStatus(message, type = 'info') {
  const statusEl = document.getElementById('anki-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');

  // Do not auto-clear error messages
  if (type !== 'error') {
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = '';
      }
    }, 4000);
  }
}

/**
 * Fetches deck names and model names from Anki Connect and populates the dropdowns.
 */
async function loadAnkiDecksAndModels() {
  updateAnkiStatus('Connecting to Anki...', 'info');

  try {
    // Fetch decks and models in parallel
    const [deckNames, modelNames] = await Promise.all([
      ankiConnectRequest('deckNames'),
      ankiConnectRequest('modelNames')
    ]);

    // Populate Decks
    const deckSelect = document.getElementById('anki-deck-select');
    deckSelect.innerHTML = '<option value="">-- Select Deck --</option>'; // Clear old options
    deckNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      deckSelect.appendChild(option);
    });

    // Populate Models
    const modelSelect = document.getElementById('anki-model-select');
    modelSelect.innerHTML = '<option value="">-- Select Note Type --</option>'; // Clear old options
    modelNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      modelSelect.appendChild(option);
    });

    updateAnkiStatus('Connected! Please configure your settings.', 'success');

    // After loading, re-apply any saved settings
    await loadAnkiSettings();

  } catch (e) {
    updateAnkiStatus(`Error: ${e.message}. Is Anki running with Anki Connect?`, 'error');
  }
}

/**
 * Fetches the field names for a selected Anki model and populates the field mapping dropdowns.
 * @param {string} modelName - The name of the Anki model to get fields for.
 */
async function loadAnkiFields(modelName) {
  const fieldsContainer = document.getElementById('anki-fields-mapping');
  const wordFieldSelect = document.getElementById('anki-word-field-select');
  const defFieldSelect = document.getElementById('anki-definition-field-select');

  // Clear old fields
  wordFieldSelect.innerHTML = '<option value="">-- Select Field --</option>';
  defFieldSelect.innerHTML = '<option value="">-- Select Field --</option>';

  if (!modelName) {
    fieldsContainer.style.display = 'none';
    return;
  }

  fieldsContainer.style.display = 'block';
  updateAnkiStatus('Fetching fields...', 'info');

  try {
    const fieldNames = await ankiConnectRequest('modelFieldNames', { modelName: modelName });

    fieldNames.forEach(name => {
      const option1 = document.createElement('option');
      option1.value = name;
      option1.textContent = name;
      wordFieldSelect.appendChild(option1);

      const option2 = document.createElement('option');
      option2.value = name;
      option2.textContent = name;
      defFieldSelect.appendChild(option2);
    });

    updateAnkiStatus('Fields loaded.', 'success');

    // Re-apply saved settings for fields
    await loadAnkiSettings();

  } catch (e) {
    updateAnkiStatus(`Error fetching fields: ${e.message}`, 'error');
  }
}

/**
 * Saves the selected Anki configuration to chrome.storage.sync.
 */
function saveAnkiSettings() {
  const settings = {
    deckName: document.getElementById('anki-deck-select').value,
    modelName: document.getElementById('anki-model-select').value,
    wordField: document.getElementById('anki-word-field-select').value,
    definitionField: document.getElementById('anki-definition-field-select').value
  };

  if (!settings.deckName || !settings.modelName || !settings.wordField || !settings.definitionField) {
    updateAnkiStatus("Please select all options before saving.", "error");
    return;
  }

  chrome.storage.sync.set({ ankiSettings: settings }, () => {
    updateAnkiStatus('Anki settings saved!', 'success');
  });
}

/**
 * Loads saved Anki settings from chrome.storage.sync and applies them to the dropdowns.
 */
async function loadAnkiSettings() {
  const data = await new Promise(resolve => chrome.storage.sync.get('ankiSettings', resolve));

  if (data.ankiSettings) {
    const { deckName, modelName, wordField, definitionField } = data.ankiSettings;

    document.getElementById('anki-deck-select').value = deckName || "";

    // Set model and trigger field loading if needed
    const modelSelect = document.getElementById('anki-model-select');
    if (modelSelect.value !== modelName) {
      modelSelect.value = modelName || "";
      if (modelName) {
        // This will load fields, and *then* we need to set the field values
        await loadAnkiFields(modelName);
      }
    }

    // Set field values
    document.getElementById('anki-word-field-select').value = wordField || "";
    document.getElementById('anki-definition-field-select').value = definitionField || "";
  }
}

/**
 * Handles the click event for the 'Send to Anki' button on a history item.
 * @param {Event} event - The click event.
 */
async function handleSendToAnkiClick(event) {
  const btn = event.currentTarget;
  const timestamp = btn.dataset.timestamp;

  btn.disabled = true;
  btn.innerHTML = '<strong>...</strong>'; // <-- UPDATED

  try {
    // 1. Get Anki Settings
    const settingsData = await new Promise(resolve => chrome.storage.sync.get('ankiSettings', resolve));
    const settings = settingsData.ankiSettings;

    if (!settings || !settings.deckName || !settings.modelName || !settings.wordField || !settings.definitionField) {
      throw new Error('Anki settings are not complete. Please configure them in the Anki tab.');
    }

    // 2. Get History Item
    const historyData = await new Promise(resolve => chrome.storage.local.get('history', resolve));
    const item = (historyData.history || []).find(i => i.timestamp === timestamp);

    if (!item) {
      throw new Error('History item not found.');
    }

    // 3. Prepare Note
    const fields = {};
    fields[settings.wordField] = item.word;
    // Format definition: replace <br> with newlines for Anki
    const ankiDefinition = item.definition
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Keep bold
      .replace(/\n/g, '<br>'); // Convert markdown newlines to HTML <br>

    fields[settings.definitionField] = ankiDefinition;

    const note = {
      deckName: settings.deckName,
      modelName: settings.modelName,
      fields: fields,
      options: {
        "allowDuplicate": false
      }
    };

    // 4. Send to Anki
    const result = await ankiConnectRequest('addNote', { note: note });

    if (result === null) {
      // This often means a duplicate was found and not added
      throw new Error('Note was not added. It might be a duplicate.');
    }

    // Success!
    btn.innerHTML = '<strong>✔</strong>'; // <-- UPDATED
    // Keep it disabled to show success

  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<strong>A</strong>'; // <-- UPDATED
    alert(`Anki Error: ${e.message}`); // alert() is fine in the options page
  }
}

// ---
// --- NEW: REMINDER SETTINGS FUNCTIONS
// ---

function saveReminderSettings() {
  const frequency = document.getElementById('reminder-frequency-select').value;
  const subfolder = document.getElementById('backup-subfolder').value.trim();

  chrome.storage.sync.set({
    backupReminderFrequency: parseInt(frequency, 10),
    backupSubfolder: subfolder
  }, () => {
    updateReminderStatus('Backup settings saved!', 'success');

    // Also check if we need to update the badge immediately
    // If user turned it off (0), we should clear the badge
    if (parseInt(frequency, 10) === 0) {
      chrome.action.setBadgeText({ text: '' });
    }

    // Trigger a check immediately to schedule/unschedule
    chrome.runtime.sendMessage({ type: "checkBackupReminder" });
  });
}

function loadReminderSettings() {
  // Load settings from sync
  chrome.storage.sync.get({ backupReminderFrequency: 0, backupSubfolder: '' }, (syncData) => {
    document.getElementById('reminder-frequency-select').value = syncData.backupReminderFrequency;
    document.getElementById('backup-subfolder').value = syncData.backupSubfolder;
  });

  // Load status from local
  chrome.storage.local.get({ lastBackupTime: 0, lastBackupType: '', lastBackupError: null }, (localData) => {
    const statusEl = document.getElementById('backup-status');

    if (localData.lastBackupError) {
      statusEl.textContent = `Last Backup Error: ${localData.lastBackupError}`;
      statusEl.style.color = '#d9534f'; // Red color
    } else if (localData.lastBackupTime > 0) {
      const date = new Date(localData.lastBackupTime);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const timeStr = date.toLocaleTimeString();
      const typeStr = localData.lastBackupType ? ` (${localData.lastBackupType})` : '';

      statusEl.textContent = `Last Backup: ${day}/${month}/${year}, ${timeStr}${typeStr}`;
      statusEl.style.color = '#61afef'; // Original blue color (or rely on CSS class)
    } else {
      statusEl.textContent = 'Last Backup: Never';
      statusEl.style.color = 'var(--primary-color)';
    }
  });
}

function updateReminderStatus(message, type = 'info') {
  const statusEl = document.getElementById('reminder-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');

  setTimeout(() => {
    statusEl.textContent = '';
  }, 3000);
}

function resetBackupReminder() {
  // Update the last backup time to now
  chrome.storage.local.set({ lastBackupTime: Date.now() }, () => {
    console.log("Backup time updated.");
    // Clear the badge
    chrome.action.setBadgeText({ text: '' });
  });
}

// --- NEW: Restore Backup Logic ---
function restoreBackup() {
  const fileInput = document.getElementById('restore-backup-file');
  const file = fileInput.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const backupData = JSON.parse(e.target.result);

      // We expect a structure like: { history: [...], date: ... } or just raw history?
      // Based on export, it likely has history info. 
      // Actually, exportAllHistory usually just dumps the history array or object wrapper.
      // Let's assume the backup format from previous conversations: { history: [], models: [], ... } if it's a full backup.
      // But looking at "Backup Now", it triggers a download. 
      // Let's implement a generic restore that merges/overwrites keys found in the JSON.

      // Update: The requirement is to restore history, lists, settings.
      // Let's iterate over keys and save them to storage.

      const keysToRestore = ['history', 'lists', 'settings', 'models', 'customPrompts', 'ttsSettings', 'ankiSettings'];
      const dataToSave = {};
      let restoredCount = 0;

      for (const key in backupData) {
        if (keysToRestore.includes(key) || key === 'history' || key === 'lists') {
          dataToSave[key] = backupData[key];
          restoredCount++;
        }
      }

      // Special handling if the backup is just an array (old history export)
      if (Array.isArray(backupData)) {
        dataToSave['history'] = backupData;
        restoredCount = 1;
      }

      if (restoredCount > 0) {
        chrome.storage.local.set(dataToSave, () => {
          // Also check for sync settings if any
          const syncKeys = ['models', 'customPrompts', 'ttsSettings', 'ankiSettings'];
          const syncData = {};
          let syncCount = 0;
          for (const key of syncKeys) {
            if (backupData[key]) {
              syncData[key] = backupData[key];
              syncCount++;
            }
          }

          if (syncCount > 0) {
            chrome.storage.sync.set(syncData, () => {
              updateRestoreStatus('Backup restored successfully! Reloading...', 'success');
              setTimeout(() => location.reload(), 1500);
            });
          } else {
            updateRestoreStatus('Backup restored successfully! Reloading...', 'success');
            setTimeout(() => location.reload(), 1500);
          }
        });
      } else {
        updateRestoreStatus('Invalid backup file format.', 'error');
      }

    } catch (err) {
      console.error("Restore failed:", err);
      updateRestoreStatus('Error parsing backup file.', 'error');
    }
  };

  reader.readAsText(file);
}

function updateRestoreStatus(message, type) {
  const statusEl = document.getElementById('restore-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? 'red' : 'green';
    setTimeout(() => statusEl.textContent = '', 5000);
  }
}


function loadPrompts() {
  chrome.storage.sync.get({ customPrompts: [] }, (data) => {
    const prompts = data.customPrompts;
    const listContainer = document.getElementById('prompts-list');
    const noPromptsMsg = document.getElementById('no-prompts-message');

    // Clear current list (except the "no prompts" message)
    listContainer.innerHTML = '';
    listContainer.appendChild(noPromptsMsg);

    if (prompts.length === 0) {
      noPromptsMsg.style.display = 'block';
    } else {
      noPromptsMsg.style.display = 'none';

      prompts.forEach((prompt, index) => {
        const promptEl = document.createElement('div');
        promptEl.style.borderBottom = '1px solid var(--border-color)';
        promptEl.style.padding = '10px 0';
        promptEl.style.display = 'flex';
        promptEl.style.justifyContent = 'space-between';
        promptEl.style.alignItems = 'center';
        promptEl.style.backgroundColor = 'var(--bg-color)'; // Ensure bg for opacity effects
        promptEl.style.transition = 'background-color 0.2s, transform 0.2s';

        // --- NEW: Drag and Drop Logic ---
        promptEl.draggable = true;
        promptEl.dataset.index = index;

        promptEl.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', index);
          promptEl.style.opacity = '0.4';
          promptEl.classList.add('dragging');
        });

        promptEl.addEventListener('dragend', () => {
          promptEl.style.opacity = '1';
          promptEl.classList.remove('dragging');
          document.querySelectorAll('#prompts-list > div').forEach(el => {
            el.style.borderTop = '';
            el.style.borderBottom = '1px solid var(--border-color)';
          });
        });

        const infoWrapper = document.createElement('div');
        infoWrapper.style.display = 'flex';
        infoWrapper.style.alignItems = 'center';
        infoWrapper.style.gap = '10px';

        // Drag Handle
        const dragHandle = document.createElement('span');
        dragHandle.innerHTML = '&#9776;'; // Hamburger icon
        dragHandle.style.cursor = 'grab';
        dragHandle.style.color = '#888';
        dragHandle.style.fontSize = '1.2em';
        dragHandle.title = 'Drag to reorder';

        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `<strong>${escapeHTML(prompt.name)}</strong><br><small style="color: #888;">${escapeHTML(prompt.content.substring(0, 50))}${prompt.content.length > 50 ? '...' : ''}</small>`;

        infoWrapper.appendChild(dragHandle);
        infoWrapper.appendChild(infoDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.alignItems = 'center';

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '&#9998;';
        editBtn.title = 'Edit';
        editBtn.style.marginRight = '5px';
        editBtn.style.backgroundColor = 'var(--primary-color)';
        editBtn.onclick = () => editPrompt(prompt.id);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&#128465;';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = () => deletePrompt(prompt.id);

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        promptEl.appendChild(infoWrapper);
        promptEl.appendChild(actionsDiv);

        // Add Drop listeners
        promptEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          return false;
        });

        promptEl.addEventListener('dragenter', (e) => {
          e.preventDefault();
          promptEl.style.border = '2px dashed var(--primary-color)';
        });

        promptEl.addEventListener('dragleave', (e) => {
          promptEl.style.border = '';
          promptEl.style.borderBottom = '1px solid var(--border-color)';
        });

        promptEl.addEventListener('drop', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
          const toIndex = index;
          if (fromIndex !== toIndex) {
            const movedPrompt = prompts[fromIndex];
            prompts.splice(fromIndex, 1);
            prompts.splice(toIndex, 0, movedPrompt);
            chrome.storage.sync.set({ customPrompts: prompts }, () => {
              loadPrompts();
              loadDefaultPromptSelect();
            });
          }
          return false;
        });

        listContainer.appendChild(promptEl);
      });
    }
  });
}

// ---
// --- NEW: TTS SETTINGS FUNCTIONS
// ---

function loadTTSSettings() {
  // 1. Load saved settings first
  chrome.storage.sync.get(['ttsSettings'], (data) => {
    const settings = data.ttsSettings || { rate: 1.0, voiceURI: null };

    // Update Rate Slider
    document.getElementById('tts-rate-range').value = settings.rate;
    document.getElementById('tts-rate-value').textContent = settings.rate;

    // 2. Load Voices
    populateVoiceList(settings.voiceURI);
  });
}

function populateVoiceList(savedVoiceURI) {
  const voiceSelect = document.getElementById('tts-voice-select');

  function updateList() {
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';

    if (voices.length === 0) {
      const option = document.createElement('option');
      option.textContent = "No voices found (or loading...)";
      voiceSelect.appendChild(option);
      return;
    }

    // Add Default/Auto option
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Default (Browser Decision)";
    voiceSelect.appendChild(defaultOption);

    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})`;

      if (voice.voiceURI === savedVoiceURI) {
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    });
  }

  updateList();
  // Chrome loads voices asynchronously, so we must listen for changes
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateList;
  }
}

function saveTTSSettings() {
  const voiceSelect = document.getElementById('tts-voice-select');
  const rateRange = document.getElementById('tts-rate-range');

  const settings = {
    voiceURI: voiceSelect.value || null, // Empty string means null (default)
    rate: parseFloat(rateRange.value)
  };

  chrome.storage.sync.set({ ttsSettings: settings }, () => {
    updateTTSStatus("Settings saved successfully!", "success");
  });
}

function testTTSVoice() {
  const voiceSelect = document.getElementById('tts-voice-select');
  const rateRange = document.getElementById('tts-rate-range');
  const selectedURI = voiceSelect.value;
  const rate = parseFloat(rateRange.value);

  // Cancel current speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance("Hello! This is a test of your selected voice.");
  utterance.rate = rate;

  if (selectedURI) {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.voiceURI === selectedURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  window.speechSynthesis.speak(utterance);
}

function updateTTSStatus(message, type = 'info') {
  const statusEl = document.getElementById('tts-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');
    setTimeout(() => statusEl.textContent = '', 3000);
  }
}

function savePrompt() {
  const id = document.getElementById('prompt-id').value;
  const name = document.getElementById('prompt-name').value.trim();
  const content = document.getElementById('prompt-content').value.trim();

  if (!name || !content) {
    alert("Please provide both a name and content for the prompt.");
    return;
  }

  chrome.storage.sync.get({ customPrompts: [] }, (data) => {
    let prompts = data.customPrompts;

    if (id) {
      // Edit existing
      prompts = prompts.map(p => p.id === id ? { ...p, name, content } : p);
    } else {
      // Add new
      const newPrompt = {
        id: `prompt_${Date.now()}`,
        name,
        content
      };
      prompts.push(newPrompt);
    }

    chrome.storage.sync.set({ customPrompts: prompts }, () => {
      // Reset form
      cancelPromptEdit();
      loadPrompts();
      loadDefaultPromptSelect();
    });
  });
}

function cancelPromptEdit() {
  document.getElementById('prompt-id').value = '';
  document.getElementById('prompt-name').value = '';
  document.getElementById('prompt-content').value = '';

  document.getElementById('save-custom-prompt-btn').textContent = 'Save Prompt';
  document.getElementById('cancel-custom-prompt-btn').style.display = 'none';
}

function editPrompt(id) {
  chrome.storage.sync.get({ customPrompts: [] }, (data) => {
    const prompt = data.customPrompts.find(p => p.id === id);
    if (prompt) {
      document.getElementById('prompt-id').value = prompt.id;
      document.getElementById('prompt-name').value = prompt.name;
      document.getElementById('prompt-content').value = prompt.content;

      document.getElementById('save-custom-prompt-btn').textContent = 'Update Prompt';
      document.getElementById('cancel-custom-prompt-btn').style.display = 'inline-block';

      // Scroll to top of form
      document.getElementById('prompt-form-container').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

function deletePrompt(id) {
  if (confirm("Are you sure you want to delete this prompt?")) {
    chrome.storage.sync.get({ customPrompts: [] }, (data) => {
      const prompts = data.customPrompts.filter(p => p.id !== id);
      chrome.storage.sync.set({ customPrompts: prompts }, () => {
        loadPrompts();
        loadDefaultPromptSelect();
      });
    });
  }
}



// ---
// --- NEW: UTILITY FUNCTIONS
// ---

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ---
// --- NEW: SEARCH, FILTER, AND FAVORITES FUNCTIONS
// ---

function applyFilters() {
  const searchQuery = document.getElementById('history-search').value.toLowerCase().trim();
  const dateFilter = document.getElementById('date-filter').value;
  const favoritesOnly = document.getElementById('favorites-only').checked;
  const listId = document.getElementById('list-select').value;

  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    // Filter by list first
    if (listId) {
      history = history.filter(item => item.listId === listId);
    }

    // Filter by search query
    if (searchQuery) {
      history = history.filter(item =>
        item.word.toLowerCase().includes(searchQuery) ||
        item.definition.toLowerCase().includes(searchQuery)
      );
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      history = history.filter(item => {
        const itemDate = new Date(item.timestamp);
        if (dateFilter === 'today') {
          return itemDate >= startOfDay;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(startOfDay);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(startOfDay);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return itemDate >= monthAgo;
        }
        return true;
      });
    }

    // Filter by favorites
    if (favoritesOnly) {
      history = history.filter(item => item.favorite === true);
    }

    // Render filtered history
    renderFilteredHistory(history);
  });
}

function renderFilteredHistory(history) {
  const historyList = document.getElementById('history-list');
  const noHistoryMessage = document.getElementById('no-history-message');
  historyList.innerHTML = '';

  if (history.length === 0) {
    noHistoryMessage.style.display = 'block';
    noHistoryMessage.textContent = 'No matching items found.';
    historyList.style.display = 'none';
  } else {
    noHistoryMessage.style.display = 'none';
    historyList.style.display = 'block';

    history.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'history-item';
      itemElement.dataset.timestamp = item.timestamp;
      itemElement.dataset.listId = item.listId;

      let formattedDefinition = item.definition
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

      const displayView = document.createElement('div');
      displayView.className = 'display-view';

      let sourceHtml = '';
      if (item.sourceUrl) {
        const displayTitle = item.sourceTitle || (item.sourceUrl.length > 40 ? item.sourceUrl.substring(0, 40) + '...' : item.sourceUrl);
        sourceHtml = ` | <a href="${escapeHTML(item.sourceUrl)}" target="_blank" style="color: #61afef; text-decoration: none;" title="${escapeHTML(item.sourceUrl)}">Source: ${escapeHTML(displayTitle)}</a>`;
      }

      displayView.innerHTML = `
        <div class="history-word">${escapeHTML(item.word)}</div>
        <div class="history-definition">${formattedDefinition}</div>
        <div class="history-model" style="font-size: 0.8em; color: #888; margin-top: 4px;">
          Model: ${escapeHTML(item.modelName || 'Unknown')} | 
          Prompt: ${escapeHTML(item.promptName || 'Unknown')} | 
          Date: ${new Date(item.timestamp).toLocaleDateString()}${sourceHtml}
        </div>
      `;
      itemElement.appendChild(displayView);

      // Add buttons (same as in loadHistory)
      const ankiButton = document.createElement('button');
      ankiButton.className = 'anki-item-btn';
      ankiButton.innerHTML = '<strong>A</strong>';
      ankiButton.title = 'Send to Anki';
      ankiButton.dataset.timestamp = item.timestamp;
      ankiButton.addEventListener('click', handleSendToAnkiClick);
      itemElement.appendChild(ankiButton);

      const starButton = document.createElement('button');
      starButton.className = 'star-item-btn' + (item.favorite ? ' favorited' : '');
      starButton.innerHTML = item.favorite ? '★' : '☆';
      starButton.title = item.favorite ? 'Remove from favorites' : 'Add to favorites';
      starButton.dataset.timestamp = item.timestamp;
      starButton.addEventListener('click', handleToggleFavoriteClick);
      itemElement.appendChild(starButton);

      const bulkCheckbox = document.createElement('input');
      bulkCheckbox.type = 'checkbox';
      bulkCheckbox.className = 'bulk-checkbox';
      bulkCheckbox.dataset.timestamp = item.timestamp;
      bulkCheckbox.addEventListener('change', updateSelectedCount);
      itemElement.appendChild(bulkCheckbox);

      const editButton = document.createElement('button');
      editButton.className = 'edit-item-btn';
      editButton.innerHTML = '&#9998;';
      editButton.title = 'Edit this item';
      editButton.dataset.timestamp = item.timestamp;
      editButton.addEventListener('click', handleEditClick);
      itemElement.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-item-btn';
      deleteButton.innerHTML = '&#128465;';
      deleteButton.title = 'Delete this item';
      deleteButton.dataset.timestamp = item.timestamp;
      deleteButton.addEventListener('click', handleDeleteClick);
      itemElement.appendChild(deleteButton);

      historyList.appendChild(itemElement);
    });
  }
}

function handleToggleFavoriteClick(event) {
  const btn = event.currentTarget;
  const timestamp = btn.dataset.timestamp;

  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    history = history.map(item => {
      if (item.timestamp === timestamp) {
        return { ...item, favorite: !item.favorite };
      }
      return item;
    });

    chrome.storage.local.set({ history: history }, () => {
      // Update button visually
      const item = history.find(i => i.timestamp === timestamp);
      if (item) {
        btn.innerHTML = item.favorite ? '★' : '☆';
        btn.className = 'star-item-btn' + (item.favorite ? ' favorited' : '');
        btn.title = item.favorite ? 'Remove from favorites' : 'Add to favorites';
      }
    });
  });
}

// ---
// --- NEW: BULK ACTIONS FUNCTIONS
// ---

let bulkModeActive = false;

function toggleBulkMode() {
  bulkModeActive = !bulkModeActive;
  const historyList = document.getElementById('history-list');
  const bulkBar = document.getElementById('bulk-actions-bar');
  const toggleBtn = document.getElementById('toggle-bulk-mode');

  if (bulkModeActive) {
    historyList.classList.add('bulk-mode');
    bulkBar.style.display = 'block';
    toggleBtn.textContent = 'Exit Bulk Mode';
    toggleBtn.style.backgroundColor = 'var(--danger-color)';
  } else {
    historyList.classList.remove('bulk-mode');
    bulkBar.style.display = 'none';
    toggleBtn.textContent = 'Bulk Select Mode';
    toggleBtn.style.backgroundColor = 'var(--button-bg)';
    // Uncheck all checkboxes
    document.querySelectorAll('.bulk-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('select-all-checkbox').checked = false;
    updateSelectedCount();
  }
}

function toggleSelectAll(event) {
  const isChecked = event.target.checked;
  document.querySelectorAll('.bulk-checkbox').forEach(cb => {
    cb.checked = isChecked;
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const selected = document.querySelectorAll('.bulk-checkbox:checked').length;
  document.getElementById('selected-count').textContent = `${selected} selected`;
}

function getSelectedTimestamps() {
  return Array.from(document.querySelectorAll('.bulk-checkbox:checked'))
    .map(cb => cb.dataset.timestamp);
}

function bulkDelete() {
  const timestamps = getSelectedTimestamps();
  if (timestamps.length === 0) {
    alert('No items selected.');
    return;
  }

  if (!confirm(`Are you sure you want to delete ${timestamps.length} item(s)?`)) return;

  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];
    history = history.filter(item => !timestamps.includes(item.timestamp));

    chrome.storage.local.set({ history: history }, () => {
      updateIOStatus(`${timestamps.length} item(s) deleted.`, 'success');
      applyFilters(); // Reload with current filters
    });
  });
}

function bulkMove() {
  const timestamps = getSelectedTimestamps();
  if (timestamps.length === 0) {
    alert('No items selected.');
    return;
  }

  // Get list of available lists
  chrome.storage.local.get({ wordLists: [] }, (data) => {
    const lists = data.wordLists;
    if (lists.length === 0) {
      alert('No lists available.');
      return;
    }

    // Create a simple prompt with list names
    const listNames = lists.map((l, i) => `${i + 1}. ${l.name}`).join('\n');
    const choice = prompt(`Move ${timestamps.length} item(s) to which list?\n\n${listNames}\n\nEnter number:`);

    if (!choice) return;

    const index = parseInt(choice) - 1;
    if (isNaN(index) || index < 0 || index >= lists.length) {
      alert('Invalid choice.');
      return;
    }

    const targetListId = lists[index].id;

    chrome.storage.local.get(['history'], (result) => {
      let history = result.history || [];

      history = history.map(item => {
        if (timestamps.includes(item.timestamp)) {
          return { ...item, listId: targetListId };
        }
        return item;
      });

      chrome.storage.local.set({ history: history }, () => {
        updateIOStatus(`${timestamps.length} item(s) moved to "${lists[index].name}".`, 'success');
        applyFilters();
      });
    });
  });
}

async function bulkExportToAnki() {
  const timestamps = getSelectedTimestamps();
  if (timestamps.length === 0) {
    alert('No items selected.');
    return;
  }

  // Get Anki settings
  const settingsData = await new Promise(resolve => chrome.storage.sync.get('ankiSettings', resolve));
  const settings = settingsData.ankiSettings;

  if (!settings || !settings.deckName || !settings.modelName || !settings.wordField || !settings.definitionField) {
    alert('Anki settings are not complete. Please configure them in the Anki tab.');
    return;
  }

  // Get history items
  const historyData = await new Promise(resolve => chrome.storage.local.get('history', resolve));
  const history = historyData.history || [];
  const itemsToExport = history.filter(item => timestamps.includes(item.timestamp));

  let successCount = 0;

  for (const item of itemsToExport) {
    try {
      const fields = {};
      fields[settings.wordField] = item.word;
      const ankiDefinition = item.definition
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      fields[settings.definitionField] = ankiDefinition;

      const note = {
        deckName: settings.deckName,
        modelName: settings.modelName,
        fields: fields,
        options: { allowDuplicate: false }
      };

      const result = await ankiConnectRequest('addNote', { note: note });
      if (result !== null) {
        successCount++;
      } else {
        // Stop on first error as requested
        throw new Error(`Failed to add "${item.word}" - might be a duplicate.`);
      }
    } catch (e) {
      alert(`Anki Error: ${e.message}\n\nExported ${successCount} of ${itemsToExport.length} items before error.`);
      return;
    }
  }

  updateIOStatus(`Successfully exported ${successCount} item(s) to Anki!`, 'success');
}

// ---
// --- NEW: FLASHCARD FUNCTIONS
// ---

let flashcardQueue = [];
let currentCardIndex = 0;
let cardsReviewedCount = 0;

function loadFlashcardLists() {
  chrome.storage.local.get({ wordLists: [] }, (data) => {
    const select = document.getElementById('flashcard-list-select');
    select.innerHTML = '<option value="all">All Lists</option>';
    data.wordLists.forEach(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.name;
      select.appendChild(option);
    });
  });
}

function startFlashcardReview() {
  const selectedList = document.getElementById('flashcard-list-select').value;

  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    // Filter by list if specified
    if (selectedList !== 'all') {
      history = history.filter(item => item.listId === selectedList);
    }

    // Filter for cards due for review
    const now = Date.now();
    flashcardQueue = history.filter(item => {
      const nextReview = item.nextReview || 0;
      return nextReview <= now;
    });

    // Shuffle the queue
    flashcardQueue = flashcardQueue.sort(() => Math.random() - 0.5);

    currentCardIndex = 0;
    cardsReviewedCount = 0;

    document.getElementById('cards-due').textContent = `Cards due: ${flashcardQueue.length}`;
    document.getElementById('cards-reviewed').textContent = `Reviewed: 0`;

    if (flashcardQueue.length === 0) {
      document.getElementById('flashcard-container').style.display = 'none';
      document.getElementById('review-complete').style.display = 'none';
      document.getElementById('no-cards-message').style.display = 'block';
    } else {
      document.getElementById('flashcard-container').style.display = 'block';
      document.getElementById('review-complete').style.display = 'none';
      document.getElementById('no-cards-message').style.display = 'none';
      showCurrentCard();
    }
  });
}

function showCurrentCard() {
  if (currentCardIndex >= flashcardQueue.length) {
    // Review complete
    document.getElementById('flashcard-container').style.display = 'none';
    document.getElementById('review-complete').style.display = 'block';
    return;
  }

  const card = flashcardQueue[currentCardIndex];

  document.getElementById('current-card-num').textContent = currentCardIndex + 1;
  document.getElementById('total-cards-num').textContent = flashcardQueue.length;

  document.getElementById('flashcard-word').textContent = card.word;
  document.getElementById('flashcard-source').textContent = card.sourceTitle ? `From: ${card.sourceTitle}` : '';

  // Reset card state
  document.getElementById('flashcard-back').style.display = 'none';
  document.getElementById('show-answer-btn').style.display = 'inline-block';
  document.getElementById('rating-buttons').style.display = 'none';
}

function showFlashcardAnswer() {
  const card = flashcardQueue[currentCardIndex];

  let formattedDef = card.definition
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  document.getElementById('flashcard-definition').innerHTML = formattedDef;
  document.getElementById('flashcard-back').style.display = 'block';
  document.getElementById('show-answer-btn').style.display = 'none';
  document.getElementById('rating-buttons').style.display = 'block';
}

function rateFlashcard(rating) {
  const card = flashcardQueue[currentCardIndex];

  // Simple spaced repetition: calculate next review time
  // Rating: 1=Again (1min), 2=Hard (1day), 3=Good (3days), 4=Easy (7days)
  const intervals = {
    1: 1 * 60 * 1000,          // 1 minute
    2: 1 * 24 * 60 * 60 * 1000, // 1 day
    3: 3 * 24 * 60 * 60 * 1000, // 3 days
    4: 7 * 24 * 60 * 60 * 1000  // 7 days
  };

  // Multiply by existing interval if card has been reviewed before
  const currentInterval = card.interval || intervals[3];
  let newInterval;

  if (rating === 1) {
    newInterval = intervals[1]; // Reset to 1 minute
  } else if (rating === 2) {
    newInterval = currentInterval * 0.8; // Decrease interval
  } else if (rating === 3) {
    newInterval = currentInterval * 1.5; // Increase by 50%
  } else {
    newInterval = currentInterval * 2.5; // More than double
  }

  const nextReview = Date.now() + newInterval;

  // Update the card in storage
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    history = history.map(item => {
      if (item.timestamp === card.timestamp) {
        return {
          ...item,
          nextReview: nextReview,
          interval: newInterval,
          lastReviewed: Date.now()
        };
      }
      return item;
    });

    chrome.storage.local.set({ history: history }, () => {
      cardsReviewedCount++;
      document.getElementById('cards-reviewed').textContent = `Reviewed: ${cardsReviewedCount}`;

      currentCardIndex++;
      showCurrentCard();
    });
  });
}

// Load flashcard lists when tab is clicked (handled by tab switching)
