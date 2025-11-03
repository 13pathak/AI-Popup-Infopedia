// --- TAB SWITCHING LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // --- THIS IS YOUR NEW, CORRECTED LOGIC ---
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
  // --- END OF YOUR NEW LOGIC ---

  // --- ADD ORIGINAL AND NEW LISTENERS ---
  restoreSettings();
  loadHistory(); // Load history once on initial page load
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('clear-history').addEventListener('click', clearHistory);
});


// --- RENAMED save_options TO saveSettings ---
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

// --- RENAMED restore_options TO restoreSettings ---
function restoreSettings() {
  // Set a default prompt
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

// --- NEW FUNCTION TO LOAD HISTORY ---
function loadHistory() {
  const historyList = document.getElementById('history-list');
  const noHistoryMessage = document.getElementById('no-history-message');
  historyList.innerHTML = ''; // Clear old list

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

        // Format the definition just like in content.js
        let formattedDefinition = item.definition
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');

        itemElement.innerHTML = `
          <div class="history-word">${escapeHTML(item.word)}</div>
          <div class="history-definition">${formattedDefinition}</div>
        `;
        historyList.appendChild(itemElement);
      });
    }
  });
}

// --- NEW FUNCTION TO CLEAR HISTORY ---
function clearHistory() {
  // Confirmation dialog
  if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
    chrome.storage.local.set({ history: [] }, () => {
      // Reload the history list (which will now be empty)
      loadHistory();
      console.log("History cleared.");
    });
  }
}

// --- NEW HELPER TO PREVENT XSS ---
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
