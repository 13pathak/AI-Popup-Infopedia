// Saves options to chrome.storage
function save_options() {
  const endpoint = document.getElementById('endpoint').value;
  const modelName = document.getElementById('modelName').value;
  const apiKey = document.getElementById('apiKey').value;
  const customPrompt = document.getElementById('customPrompt').value; // Get new value

  chrome.storage.sync.set({
    endpointUrl: endpoint,
    modelName: modelName,
    apiKey: apiKey,
    customPrompt: customPrompt // Save new value
  }, function() {
    // Update status to let user know options were saved.
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 1000);
  });
}

// Restores settings from chrome.storage
function restore_options() {
  // Set a default prompt
  const defaultPrompt = "Explain the following word or concept in a concise paragraph: {word}";

  chrome.storage.sync.get({
    endpointUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelName: 'gemini-2.0-flash',
    apiKey: '',
    customPrompt: defaultPrompt // Load new value (or default)
  }, function(items) {
    document.getElementById('endpoint').value = items.endpointUrl;
    document.getElementById('modelName').value = items.modelName;
    document.getElementById('apiKey').value = items.apiKey;
    document.getElementById('customPrompt').value = items.customPrompt; // Restore new value
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);