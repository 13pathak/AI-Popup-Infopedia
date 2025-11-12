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
        loadHistory();
      }
    });
  });

  restoreSettings();
  loadHistory(); // Load history once on initial page load
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('clear-history').addEventListener('click', clearHistory);

  // --- Event Listeners for Import/Export ---
  document.getElementById('export-history').addEventListener('click', exportHistory);
  document.getElementById('import-history').addEventListener('click', () => {
    // Trigger the hidden file input
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', importHistory);
});


// --- saveSettings ---
function saveSettings() {
  const endpoint = document.getElementById('endpoint').value;
  const modelName = document.getElementById('modelName').value;
  const apiKey = document.getElementById('apiKey').value;
  const customPrompt = document.getElementById('customPrompt').value; 

  chrome.storage.sync.set({
    endpointUrl: endpoint,
    modelName: modelName,
    apiKey: apiKey,
    customPrompt: customPrompt
  }, function() {
    // Update status to let user know options were saved.
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 1000);
  });
}

// --- restoreSettings ---
function restoreSettings() {
  const defaultPrompt = "Explain the following word or concept in a concise paragraph: {word}";

  chrome.storage.sync.get({
    endpointUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelName: 'gemini-2.0-flash',
    apiKey: '',
    customPrompt: defaultPrompt
  }, function(items) {
    document.getElementById('endpoint').value = items.endpointUrl;
    document.getElementById('modelName').value = items.modelName;
    document.getElementById('apiKey').value = items.apiKey;
    document.getElementById('customPrompt').value = items.customPrompt;
  });
}

// --- loadHistory ---
function loadHistory() {
  const historyList = document.getElementById('history-list');
  const noHistoryMessage = document.getElementById('no-history-message');
  const oldScrollTop = historyList.scrollTop;
  historyList.innerHTML = ''; 

  chrome.storage.local.get(['history'], (result) => {
    const history = result.history || [];

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

        let formattedDefinition = item.definition
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');

        const displayView = document.createElement('div');
        displayView.className = 'display-view';
        displayView.innerHTML = `
          <div class="history-word">${escapeHTML(item.word)}</div>
          <div class="history-definition">${formattedDefinition}</div>
        `;
        itemElement.appendChild(displayView);
        
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
    historyList.scrollTop = oldScrollTop;
  });
}

// --- handleEditClick ---
function handleEditClick(event) {
  const btn = event.currentTarget;
  const itemElement = btn.closest('.history-item');

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
  itemElement.querySelector('.edit-item-btn').style.display = 'none';
  itemElement.querySelector('.delete-item-btn').style.display = 'none';

  const editWordInput = document.createElement('input');
  editWordInput.type = 'text';
  editWordInput.className = 'edit-word-input';
  editWordInput.value = currentWord;

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
  itemElement.append(editWordInput, editDefinitionTextarea, actionsDiv);
}

// --- handleSaveClick ---
function handleSaveClick(event) {
  const btn = event.currentTarget;
  const itemElement = btn.closest('.history-item');
  const timestamp = itemElement.dataset.timestamp;

  const newWord = itemElement.querySelector('.edit-word-input').value;
  const newDefinition = itemElement.querySelector('.edit-definition-textarea').value;

  updateHistoryItem(timestamp, newWord, newDefinition);
}

// --- handleCancelClick ---
function handleCancelClick(event) {
  loadHistory();
}

// --- updateHistoryItem ---
function updateHistoryItem(timestamp, newWord, newDefinition) {
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];
    
    const newHistory = history.map(item => {
      if (item.timestamp === timestamp) {
        return {
          ...item,
          word: newWord,
          definition: newDefinition
        };
      }
      return item;
    });

    chrome.storage.local.set({ history: newHistory }, () => {
      loadHistory(); 
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
      loadHistory(); 
    });
  });
}


// --- clearHistory ---
function clearHistory() {
  if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
    chrome.storage.local.set({ history: [] }, () => {
      loadHistory();
      console.log("History cleared.");
    });
  }
}

// --- escapeHTML ---
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function(m) {
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
  const statusEl = document.getElementById('io-status');
  statusEl.textContent = message;
  statusEl.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');
  
  // Clear message after 5 seconds
  setTimeout(() => {
    statusEl.textContent = '';
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
  chrome.storage.local.get(['history'], (result) => {
    const history = result.history || [];
    
    if (history.length === 0) {
      updateIOStatus("History is empty. Nothing to export.", "error");
      return;
    }

    const headers = ['timestamp', 'word', 'definition'];
    const csvRows = [
      headers.join(','), 
      ...history.map(item => [
        escapeCSV(item.timestamp),
        escapeCSV(item.word),
        escapeCSV(item.definition)
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai_infopedia_history.csv';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url); 
    updateIOStatus("History exported successfully!", "success");
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
    // 'windows-1252' is the most common encoding for CSVs created by Excel on Windows.
    const decoder = new TextDecoder('windows-1252'); 
    const text = decoder.decode(arrayBuffer);
    // --- END NEW ---

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

    if (tsIndex === -1 || wordIndex === -1 || defIndex === -1) {
        updateIOStatus("File is missing required headers: timestamp, word, or definition.", "error");
        return;
    }

    for (let i = 1; i < rows.length; i++) {
      const fields = rows[i];
      if (fields.length === 1 && fields[0] === '') {
        continue;
      }

      if (fields.length === headers.length) {
        newItems.push({
          timestamp: fields[tsIndex],
          word: fields[wordIndex],
          definition: fields[defIndex]
        });
      } else {
        console.warn(`Skipping malformed CSV line (line ${i+1}): Expected ${headers.length} fields, found ${fields.length}`);
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
  chrome.storage.local.get(['history'], (result) => {
    const oldHistory = result.history || [];
    
    const historyMap = new Map();
    oldHistory.forEach(item => historyMap.set(item.timestamp, item));
    
    let added = 0;
    let duplicates = 0;

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

      if (isNew || !historyMap.has(timestamp)) {
        historyMap.set(timestamp, item);
        added++;
      } else {
        duplicates++;
      }
    });

    const mergedHistory = Array.from(historyMap.values());
    mergedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    chrome.storage.local.set({ history: mergedHistory }, () => {
      loadHistory(); // Refresh the UI
      updateIOStatus(
        `Import complete: ${added} new items added, ${duplicates} duplicates skipped, ${parseErrors} invalid rows.`,
        "success"
      );
    });
  });
}
