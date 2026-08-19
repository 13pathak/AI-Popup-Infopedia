// --- Inline SVG icon set (currentColor; matches the .oi CSS in options.html) ---
const OPT_ICON_PATHS = {
  starFilled: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  alertTriangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
};

function optIcon(name, size = 1, extraClass = '') {
  const paths = OPT_ICON_PATHS[name];
  if (!paths) return '';
  const sizeStyle = size === 1 ? '' : ` style="width: ${size}em; height: ${size}em;"`;
  return `<svg class="oi${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${sizeStyle} aria-hidden="true">${paths}</svg>`;
}

// --- TAB SWITCHING LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const tabIndicator = document.querySelector('.tab-indicator');

  // Moves the shared vertical bar to the active tab. animate=false jumps instantly
  // (initial placement, resize, font swap) instead of gliding.
  function positionTabIndicator(animate = true) {
    const activeTab = document.querySelector('.tab-button.active');
    if (!tabIndicator || !activeTab) return;
    if (!animate) tabIndicator.classList.add('no-transition');
    tabIndicator.style.height = `${activeTab.offsetHeight}px`;
    tabIndicator.style.transform = `translateY(${activeTab.offsetTop}px)`;
    if (!animate) {
      void tabIndicator.offsetWidth; // force reflow before re-enabling transitions
      tabIndicator.classList.remove('no-transition');
    }
    tabIndicator.classList.add('positioned');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Activate clicked
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');

      positionTabIndicator();

      // Keep the onboarding checklist fresh when returning to Settings or Get Started
      if (tab.dataset.tab === "settings-content" || tab.dataset.tab === "get-started-content") refreshOnboarding();

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
        loadStats(); // Load stats dashboard
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
      
      // --- NEW: Load STT Settings when tab is clicked ---
      if (tab.dataset.tab === "stt-content") {
        loadSTTSettings();
      }

      // --- NEW: Load Support & Diagnostic info when tab is clicked ---
      if (tab.dataset.tab === "support-content") {
        loadSupportDiagnosticInfo();
      }
    });
  });

  // Place the indicator under the default tab without animating on load
  positionTabIndicator(false);

  // Keep the indicator aligned when the tab bar re-wraps or the web font loads
  window.addEventListener('resize', () => positionTabIndicator(false), { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => positionTabIndicator(false));
  }

  loadModels();
  initShortcutCard(); // Show the user's actual popup shortcut (may be remapped)
  loadLists(); // Load lists on initial page load

  loadThemeSetting(); // Load visual theme setting
  loadDefaultPromptSelect(); // Load default prompt selector
  loadAnkiSettings(); // Load saved Anki settings on page load
  loadReminderSettings(); // Load saved Reminder settings on page load
  loadFollowupSettings(); // Load follow-up custom message
  loadHallucinationGuardSettings(); // Load Hallucination Guard settings
  loadSearchApiSettings(); // Load Search API settings
  loadPdfAuthorName(); // Load Custom Author Name
  loadPdfViewerToggle(); // Load PDF interception toggle

  // Check if a specific tab was requested (e.g. from popup troubleshooting action)
  function activateRequestedTab(tabName) {
    const targetBtn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    if (targetBtn) {
      targetBtn.click();
      targetBtn.scrollIntoView({ behavior: 'smooth' });
    }
    chrome.storage.local.remove('activeOptionsTab');
  }

  chrome.storage.local.get(['activeOptionsTab', 'onboardingDismissed'], (data) => {
    if (data.activeOptionsTab) {
      activateRequestedTab(data.activeOptionsTab);
    } else if (!data.onboardingDismissed) {
      // First-time users land on Get Started until onboarding is done or dismissed
      const gsBtn = document.querySelector('.tab-button[data-tab="get-started-content"]');
      if (gsBtn) gsBtn.click();
    }
  });

  // Also listen for changes so deep-linking and theme syncing work when options page is already open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.uiTheme) {
      loadThemeSetting();
    }
    if (area === 'local' && changes.activeOptionsTab && changes.activeOptionsTab.newValue) {
      activateRequestedTab(changes.activeOptionsTab.newValue);
    }
  });

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
  safeAddListener('ui-theme-select', 'change', saveThemeSetting);
  safeAddListener('add-model-btn', 'click', () => showModelForm(false));
  safeAddListener('edit-model-btn', 'click', editSelectedModel);
  safeAddListener('delete-model-btn', 'click', deleteSelectedModel);
  safeAddListener('model-select', 'change', (e) => setDefaultModel(e.target.value));
  safeAddListener('save-model-btn', 'click', saveModel);
  safeAddListener('provider-preset-select', 'change', applyProviderPreset);
  safeAddListener('detect-ollama-btn', 'click', detectOllamaModels);
  safeAddListener('ollama-model-select', 'change', (e) => {
    document.getElementById('modelName').value = e.target.value;
  });
  safeAddListener('onboarding-dismiss-btn', 'click', () => {
    chrome.storage.local.set({ onboardingDismissed: true });
    const card = document.getElementById('onboarding-card');
    if (card) card.style.display = 'none';
  });
  safeAddListener('open-shortcuts-btn', 'click', () => {
    const url = 'chrome://extensions/shortcuts';
    if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
    else window.open(url, '_blank');
  });
  safeAddListener('default-prompt-select', 'change', (e) => saveDefaultPromptId(e.target.value));
  safeAddListener('cancel-model-btn', 'click', hideModelForm);
  safeAddListener('save-pdf-author-btn', 'click', savePdfAuthorName);
  safeAddListener('pdf-viewer-enabled-checkbox', 'change', savePdfViewerToggle);
  safeAddListener('save-followup-settings-btn', 'click', saveFollowupSettings);
  safeAddListener('enable-hallucination-guard', 'change', saveHallucinationGuardSettings);
  safeAddListener('verification-model-select', 'change', saveHallucinationGuardSettings);
  safeAddListener('save-tavily-btn', 'click', saveSearchApiSettings);
  safeAddListener('run-test-setup-btn', 'click', () => runDiagnosticTest());
  safeAddListener('test-form-model-btn', 'click', () => runFormDiagnosticTest());
  safeAddListener('copy-diag-btn', 'click', copyDiagnosticInfo);
  safeAddListener('support-run-test-btn', 'click', () => {
    const settingsTab = document.querySelector('.tab-button[data-tab="settings-content"]');
    if (settingsTab) settingsTab.click();
    runDiagnosticTest();
    document.getElementById('test-setup-container')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Init FAQ Accordion handlers
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (item) {
        item.classList.toggle('active');
      }
    });
  });

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
  safeAddListener('add-sub-list-btn', 'click', addSubList);
  safeAddListener('rename-list-btn', 'click', renameList);
  safeAddListener('delete-list-btn', 'click', deleteList);
  safeAddListener('reorder-lists-btn', 'click', openReorderModal);

  safeAddListener('export-all-history', 'click', exportAllHistory);
  safeAddListener('import-all-history', 'click', () => document.getElementById('import-file-input').click());

  safeAddListener('clear-history', 'click', clearAllHistory);
  safeAddListener('reset-all-settings-btn', 'click', resetAllSettings);

  safeAddListener('export-all-settings-btn', 'click', exportAllSettings);
  safeAddListener('import-all-settings-btn', 'click', () => document.getElementById('import-settings-file-input').click());
  safeAddListener('import-settings-file-input', 'change', importAllSettings);

  safeAddListener('anki-save-settings-btn', 'click', saveAnkiSettings);
  safeAddListener('anki-model-select', 'change', (e) => loadAnkiFields(e.target.value));
  safeAddListener('anki-refresh-btn', 'click', loadAnkiDecksAndModels);

  safeAddListener('save-reminder-settings-btn', 'click', saveReminderSettings);
  safeAddListener('manual-backup-btn', 'click', () => {
    const backupInclude = getBackupIncludeFromUI();
    const hasAnySelected = Object.values(backupInclude).some(Boolean);
    if (!hasAnySelected) {
      updateReminderStatus('Please select at least one item to back up.', 'error');
      return;
    }
    chrome.storage.sync.set({ backupInclude: backupInclude });
    chrome.runtime.sendMessage({ type: "manualBackup", backupInclude });
    updateReminderStatus('Manual backup initiated... check Downloads.', 'info');
  });
  safeAddListener('backup-select-all-btn', 'click', () => {
    for (const elementId of Object.values(BACKUP_INCLUDE_KEYS)) {
      const el = document.getElementById(elementId);
      if (el) el.checked = true;
    }
  });
  safeAddListener('backup-deselect-all-btn', 'click', () => {
    for (const elementId of Object.values(BACKUP_INCLUDE_KEYS)) {
      const el = document.getElementById(elementId);
      if (el) el.checked = false;
    }
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

  // --- STT Event Listeners ---
  safeAddListener('stt-save-btn', 'click', saveSTTSettings);
  safeAddListener('stt-engine-select', 'change', (e) => {
    const apiSettings = document.getElementById('stt-api-settings');
    if (apiSettings) {
      apiSettings.style.display = e.target.value === 'api' ? 'block' : 'none';
    }
  });

  safeAddListener('history-search', 'input', debounce(applyFilters, 300));
  safeAddListener('date-filter', 'change', applyFilters);
  safeAddListener('favorites-only', 'change', applyFilters);

  safeAddListener('toggle-bulk-mode', 'click', toggleBulkMode);
  safeAddListener('select-all-checkbox', 'change', toggleSelectAll);
  safeAddListener('bulk-delete-btn', 'click', bulkDelete);
  safeAddListener('bulk-move-btn', 'click', bulkMove);
  safeAddListener('bulk-anki-btn', 'click', bulkExportToAnki);

  // --- NEW: Flashcard Event Listeners ---
  safeAddListener('start-review-btn', 'click', startFlashcardReview);
  safeAddListener('show-answer-btn', 'click', showFlashcardAnswer);
  safeAddListener('review-again-btn', 'click', startFlashcardReview);
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', (e) => rateFlashcard(parseInt(e.target.dataset.rating)));
  });

  // --- NEW: PDF File Access Check ---
  // MV3 removed chrome.extension (and with it isAllowedFileSchemeAccess);
  // the granted-state check goes through the generic chrome.permissions
  // API instead. The file:///* origin counts as granted only while the
  // per-extension "Allow access to file URLs" toggle is enabled.
  if (chrome.permissions && chrome.permissions.contains) {
    chrome.permissions.contains({ origins: ['file:///*'] }, (isAllowed) => {
      if (isAllowed) {
        document.getElementById('file-access-success').style.display = 'block';
        document.getElementById('file-access-warning').style.display = 'none';
      } else {
        document.getElementById('file-access-success').style.display = 'none';
        document.getElementById('file-access-warning').style.display = 'block';
      }
    });
  }
  safeAddListener('open-extensions-page-btn', 'click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  });

  // --- NEW: Storage Listener for Real-time Backup Status ---
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.lastBackupTime || changes.lastBackupError || changes.lastBackupType) {
        // Reload status display only (avoid resetting active UI inputs)
        loadBackupStatus();
      }
    }
  });
});


// --- NEW: MODEL MANAGEMENT ---

// --- PROVIDER PRESETS (form helper only; never persisted with the model) ---
const PROVIDER_PRESETS = {
  gemini:     { name: 'Gemini Flash',     endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash' },
  groq:       { name: 'Groq Llama',       endpoint: 'https://api.groq.com/openai/v1/chat/completions',                        model: 'llama-3.3-70b-versatile' },
  openrouter: { name: 'OpenRouter Model', endpoint: 'https://openrouter.ai/api/v1/chat/completions',                          model: 'meta-llama/llama-3.3-70b-instruct:free' },
  openai:     { name: 'OpenAI Mini',      endpoint: 'https://api.openai.com/v1/chat/completions',                             model: 'gpt-4o-mini' },
  ollama:     { name: 'Local Ollama',     endpoint: 'http://localhost:11434/v1/chat/completions',                             model: 'llama3.2' }
};

function resetOllamaHelpers() {
  const row = document.getElementById('ollama-detect-row');
  const select = document.getElementById('ollama-model-select');
  const status = document.getElementById('ollama-detect-status');
  if (row) row.style.display = 'none';
  if (select) { select.style.display = 'none'; select.innerHTML = ''; }
  if (status) status.textContent = '';
}

function applyProviderPreset() {
  const key = document.getElementById('provider-preset-select').value;
  const preset = PROVIDER_PRESETS[key];
  resetOllamaHelpers();
  // "custom" leaves every field untouched
  if (!preset) return;
  document.getElementById('endpoint').value = preset.endpoint;
  document.getElementById('modelName').value = preset.model;
  // Only fill the name if empty or still an untouched preset default, so we
  // never stomp a name the user typed themselves.
  const nameInput = document.getElementById('configName');
  const currentName = nameInput.value.trim();
  const isPresetName = !currentName || Object.values(PROVIDER_PRESETS).some(p => p.name === currentName);
  if (isPresetName) nameInput.value = preset.name;
  if (key === 'ollama') {
    document.getElementById('ollama-detect-row').style.display = 'block';
    document.getElementById('ollama-detect-status').textContent =
      'Tip: Ollama only accepts browser requests when started with OLLAMA_ORIGINS="*" (see FAQ → Local LLMs Setup).';
  }
}

async function detectOllamaModels() {
  const status = document.getElementById('ollama-detect-status');
  const select = document.getElementById('ollama-model-select');
  const btn = document.getElementById('detect-ollama-btn');
  if (!status || !select || !btn) return;
  btn.disabled = true;
  status.textContent = 'Looking for Ollama on localhost:11434…';
  select.style.display = 'none';
  select.innerHTML = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = (data.models || []).map(m => m.name).filter(Boolean);
    if (models.length === 0) {
      status.textContent = 'Ollama is running but has no models installed. Run "ollama pull llama3.2" first, then detect again.';
      return;
    }
    models.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    document.getElementById('modelName').value = models[0];
    select.style.display = 'block';
    status.textContent = `${models.length} model${models.length > 1 ? 's' : ''} found — the first was filled in; pick another below if you prefer.`;
  } catch (err) {
    status.textContent = 'Could not reach Ollama. Make sure it is running on localhost:11434 and was started with OLLAMA_ORIGINS="*" (see FAQ → Local LLMs Setup).';
  } finally {
    btn.disabled = false;
  }
}

function showModelForm(isEdit = false, model = {}) {
  document.getElementById('form-title').textContent = isEdit ? 'Edit Model' : 'Add New Model';
  document.getElementById('model-id').value = model.id || '';
  document.getElementById('configName').value = model.name || '';
  document.getElementById('endpoint').value = model.endpointUrl || '';
  document.getElementById('modelName').value = model.modelName || '';
  document.getElementById('apiKey').value = model.apiKey || '';
  document.getElementById('enableSearchGrounding').checked = model.enableSearchGrounding || false;

  // Display the matching provider when editing. Setting .value programmatically
  // fires no "change" event, so the user's stored fields are never overwritten.
  const presetEntry = Object.entries(PROVIDER_PRESETS).find(([, p]) => p.endpoint === (model.endpointUrl || '').trim());
  document.getElementById('provider-preset-select').value = presetEntry ? presetEntry[0] : 'custom';
  resetOllamaHelpers();
  if (presetEntry && presetEntry[0] === 'ollama') {
    document.getElementById('ollama-detect-row').style.display = 'block';
  }

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
  document.getElementById('enableSearchGrounding').checked = false;
  document.getElementById('provider-preset-select').value = 'custom';
  resetOllamaHelpers();
}

function saveModel() {
  const modelId = document.getElementById('model-id').value;
  const newModelConfig = {
    id: modelId || `model_${new Date().getTime()}`,
    name: document.getElementById('configName').value.trim(),
    endpointUrl: document.getElementById('endpoint').value.trim(),
    modelName: document.getElementById('modelName').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim(),
    enableSearchGrounding: document.getElementById('enableSearchGrounding').checked
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
    refreshOnboarding(); // any model add/delete/import re-runs the checklist
  });
}

function loadHallucinationGuardSettings() {
  chrome.storage.sync.get(['enableHallucinationGuard', 'verificationModelId', 'models'], (data) => {
    const enableGuard = data.enableHallucinationGuard || false;
    const verificationModelId = data.verificationModelId;
    const models = data.models || [];
    
    document.getElementById('enable-hallucination-guard').checked = enableGuard;
    
    const verificationSelect = document.getElementById('verification-model-select');
    verificationSelect.innerHTML = '';
    
    if (models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models available';
      verificationSelect.appendChild(option);
      verificationSelect.disabled = true;
    } else {
      verificationSelect.disabled = false;
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.id === verificationModelId) {
          option.selected = true;
        }
        verificationSelect.appendChild(option);
      });
      // If no valid verification model is selected, select the first one and save
      if (!verificationModelId && models.length > 0) {
        verificationSelect.value = models[0].id;
        saveHallucinationGuardSettings();
      }
    }
  });
}

function saveHallucinationGuardSettings() {
  const enableGuard = document.getElementById('enable-hallucination-guard').checked;
  const verificationModelId = document.getElementById('verification-model-select').value;
  
  chrome.storage.sync.set({ 
    enableHallucinationGuard: enableGuard,
    verificationModelId: verificationModelId
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

  chrome.storage.sync.get(['models', 'defaultModelId', 'verificationModelId'], (data) => {
    let models = data.models || [];
    let defaultModelId = data.defaultModelId;
    let verificationModelId = data.verificationModelId;

    models = models.filter(m => m.id !== modelIdToDelete);

    // If the deleted model was the default, pick a new default
    if (defaultModelId === modelIdToDelete) {
      defaultModelId = models.length > 0 ? models[0].id : null;
    }
    // Same for the Hallucination Guard's verifier: a dangling id makes
    // every guarded answer error ("Verification model not found") while
    // the guard settings still show a healthy-looking selection.
    if (verificationModelId === modelIdToDelete) {
      verificationModelId = models.length > 0 ? models[0].id : null;
    }

    chrome.storage.sync.set({ models, defaultModelId, verificationModelId }, () => {
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

function loadPdfAuthorName() {
  chrome.storage.local.get(['pdf_author_name'], (result) => {
    if (result.pdf_author_name) {
      const input = document.getElementById('pdf-author-name');
      if (input) input.value = result.pdf_author_name;
    }
  });
}

function savePdfAuthorName() {
  const input = document.getElementById('pdf-author-name');
  if (input) {
    const name = input.value.trim();
    chrome.storage.local.set({ pdf_author_name: name }, () => {
      updateStatus('Custom Author Name saved successfully!', 'success');
    });
  }
}

function applyThemeToDocument(theme) {
  try {
    localStorage.setItem('uiTheme', theme);
  } catch (e) {}
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function loadThemeSetting() {
  chrome.storage.sync.get({ uiTheme: 'dark' }, (data) => {
    const theme = data.uiTheme || 'dark';
    const select = document.getElementById('ui-theme-select');
    if (select) select.value = theme;
    applyThemeToDocument(theme);
  });
}

function saveThemeSetting() {
  const select = document.getElementById('ui-theme-select');
  if (!select) return;
  const theme = select.value;
  applyThemeToDocument(theme);
  chrome.storage.sync.set({ uiTheme: theme }, () => {
    updateStatus('Theme preference saved.', 'success');
  });
}

// Stored in sync (unlike the author name) so it roams with the account and
// is picked up automatically by the all-settings export, which copies every
// sync key. Undefined means "enabled": the interception predates this toggle.
function loadPdfViewerToggle() {
  chrome.storage.sync.get(['pdfViewerEnabled'], (data) => {
    const checkbox = document.getElementById('pdf-viewer-enabled-checkbox');
    if (checkbox) checkbox.checked = data.pdfViewerEnabled !== false;
  });
}

function savePdfViewerToggle() {
  const checkbox = document.getElementById('pdf-viewer-enabled-checkbox');
  if (!checkbox) return;
  chrome.storage.sync.set({ pdfViewerEnabled: checkbox.checked }, () => {
    updateStatus('PDF viewer preference saved.', 'success');
  });
}

function saveDefaultPromptId(promptId) {
  chrome.storage.sync.set({ defaultPromptId: promptId }, () => {
    updateStatus('Default prompt updated.', 'success');
  });
}

function saveFollowupSettings() {
  const customMessage = document.getElementById('followup-custom-message').value;
  const showUserQuestions = document.getElementById('show-user-questions-checkbox').checked;
  chrome.storage.sync.set({ followupCustomMessage: customMessage, showUserQuestions: showUserQuestions }, () => {
    const statusEl = document.getElementById('followup-status');
    statusEl.textContent = 'Follow-up settings saved successfully!';
    statusEl.style.color = '#5cb85c';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  });
}

function loadFollowupSettings() {
  chrome.storage.sync.get(['followupCustomMessage', 'showUserQuestions'], (data) => {
    if (data.followupCustomMessage !== undefined) {
      document.getElementById('followup-custom-message').value = data.followupCustomMessage;
    }
    if (data.showUserQuestions !== undefined) {
      document.getElementById('show-user-questions-checkbox').checked = data.showUserQuestions;
    }
  });
}

function loadSearchApiSettings() {
  chrome.storage.sync.get(['tavilyApiKey'], (data) => {
    if (data.tavilyApiKey !== undefined) {
      document.getElementById('tavily-api-key').value = data.tavilyApiKey;
    }
  });
}

function saveSearchApiSettings() {
  const apiKey = document.getElementById('tavily-api-key').value.trim();
  chrome.storage.sync.set({ tavilyApiKey: apiKey }, () => {
    const statusEl = document.getElementById('tavily-status');
    statusEl.textContent = 'Search API key saved successfully!';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
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

    // The built-in system default is always a valid choice; 'system' is
    // also what deletePrompt stores when the default prompt is removed.
    const systemOption = document.createElement('option');
    systemOption.value = 'system';
    systemOption.textContent = 'System Default';
    if (defaultPromptId === 'system') {
      systemOption.selected = true;
      isAnySelected = true;
    }
    select.appendChild(systemOption);

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

    // syncData includes live secrets (each model's apiKey, tavilyApiKey,
    // sttApiKey/sttCustomHeaders) so the file is self-contained for restore.
    // Make the plaintext-secrets consequence explicit before writing the file.
    if (!confirm("The export file will contain your API keys in plain text (model keys, web-search key, and speech-to-text key).\n\nStore it securely and do not share it. Continue with the export?")) {
      updateGlobalIOStatus('Export cancelled.', 'info');
      return;
    }

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

      // storage.set callbacks fire even on failure (quota etc.) unless
      // runtime.lastError is inspected — wrap so failures actually reject.
      const storageSet = (items) => new Promise((resolve, reject) => {
        chrome.storage.sync.set(items, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });

      // Snapshot everything before the destructive clear so a failed import
      // (e.g. sync's per-item quota rejecting the new data) can be rolled back.
      const snapshot = await new Promise(resolve => chrome.storage.sync.get(null, resolve));

      try {
        // Clear existing sync storage before importing
        await new Promise((resolve, reject) => {
          chrome.storage.sync.clear(() => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
          });
        });

        // Import new data into sync storage
        await storageSet(settings.syncData);
      } catch (writeErr) {
        // Storage was already cleared (or the import was rejected) — put the
        // previous contents back before reporting the failure.
        try {
          await storageSet(snapshot);
        } catch (restoreErr) {
          console.error("Failed to restore previous sync settings after failed import:", restoreErr);
        }
        throw writeErr;
      }

      // --- NEW: Restore Anki settings ---
      if (ankiSettings.ankiSettings) {
        await storageSet(ankiSettings);
      }

      updateGlobalIOStatus('Settings imported successfully! Reloading...', 'success');

      // The import cleared and replaced sync storage wholesale, so
      // refreshing individual selects leaves every other section showing
      // the values read at startup. Reload the page (as restoreBackup
      // does) — DOMContentLoaded re-populates everything from the
      // imported data.
      setTimeout(() => location.reload(), 1000);

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

let globalIOStatusTimeout = null;

function updateGlobalIOStatus(message, type = 'info') {
  const statusEl = document.getElementById('global-io-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.style.color = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#eee');

  // Clear message after 5 seconds; cancel any pending clear so an older
  // timer can't wipe out a newer message early.
  if (globalIOStatusTimeout) clearTimeout(globalIOStatusTimeout);
  globalIOStatusTimeout = setTimeout(() => {
    statusEl.textContent = '';
    globalIOStatusTimeout = null;
  }, 5000);
}

// --- NEW: Helper to build a sorted tree array ---
// Works on shallow copies: the reorder modal's currentLists ARE the
// objects later written back to storage, and mutating them here would
// persist children arrays — duplicating every sub-list inside its parent
// on top of its top-level entry.
function getSortedTreeLists(lists) {
  const listMap = {};
  lists.forEach(l => {
    listMap[l.id] = { ...l, children: [] };
  });

  const roots = [];
  lists.forEach(l => {
    const node = listMap[l.id];
    if (l.parentId && listMap[l.parentId] && l.parentId !== l.id) {
      listMap[l.parentId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortedList = [];
  function traverse(node, depth) {
    sortedList.push({ ...node, depth });
    node.children.forEach(child => traverse(child, depth + 1));
  }
  roots.forEach(root => traverse(root, 0));
  return sortedList;
}

// --- NEW: Custom Dropdown Component ---
function createCustomDropdown(lists, currentValue, onChange, options = {}) {
  const container = document.createElement('div');
  container.className = 'custom-select-container';

  const selectBtn = document.createElement('div');
  selectBtn.className = 'custom-select';
  selectBtn.tabIndex = 0;
  
  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'custom-select-value';
  valueDisplay.textContent = 'Select a list...';

  const arrow = document.createElement('span');
  arrow.textContent = '▼';
  
  selectBtn.append(valueDisplay, arrow);
  
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-options';

  container.append(selectBtn, optionsContainer);

  let selectedId = currentValue;
  const expandedState = {}; 

  const sortedList = getSortedTreeLists(lists);

  const allItems = [];
  if (options.showAllLists) allItems.push({ id: '__all_lists__', name: 'All Lists', depth: 0 });
  if (options.showUnlisted) allItems.push({ id: '__unlisted__', name: '(Unlisted / No list)', depth: 0, color: '#aaa', italic: true });
  allItems.push(...sortedList);
  if (options.showCreateNew) allItems.push({ id: '__create_new__', name: '+ Create New List...', depth: 0, color: 'lightgreen', isCreate: true });

  function renderOptions() {
    optionsContainer.innerHTML = '';
    
    allItems.forEach(item => {
      let visible = true;
      let curr = item;
      while (curr && curr.parentId) {
        if (!expandedState[curr.parentId]) {
          visible = false;
          break;
        }
        curr = allItems.find(i => i.id === curr.parentId);
      }
      
      if (!visible) return;

      const optEl = document.createElement('div');
      optEl.className = 'custom-option';
      if (item.id === selectedId) {
        optEl.classList.add('selected');
        valueDisplay.textContent = item.name;
      }
      if (item.color) optEl.style.color = item.color;
      if (item.italic) optEl.style.fontStyle = 'italic';

      for (let i = 0; i < (item.depth || 0); i++) {
        const spacer = document.createElement('span');
        spacer.className = 'indent-spacer';
        optEl.appendChild(spacer);
      }

      const hasChildren = allItems.some(i => i.parentId === item.id);
      if (hasChildren) {
        const toggle = document.createElement('span');
        toggle.className = 'expand-toggle';
        toggle.textContent = expandedState[item.id] ? '▼' : '▶';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation(); 
          expandedState[item.id] = !expandedState[item.id];
          renderOptions();
        });
        optEl.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'indent-spacer';
        optEl.appendChild(spacer);
      }

      const textNode = document.createElement('span');
      textNode.textContent = item.name;
      optEl.appendChild(textNode);

      optEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedId = item.id;
        valueDisplay.textContent = item.name;
        optionsContainer.classList.remove('show');
        if (onChange) onChange(selectedId);
        renderOptions();
      });

      optionsContainer.appendChild(optEl);
    });
  }

  let curr = allItems.find(i => i.id === selectedId);
  while (curr && curr.parentId) {
    expandedState[curr.parentId] = true;
    curr = allItems.find(i => i.id === curr.parentId);
  }
  
  if (!selectedId && allItems.length > 0) {
    selectedId = allItems[0].id;
    valueDisplay.textContent = allItems[0].name;
  }

  renderOptions();

  selectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsContainer.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      optionsContainer.classList.remove('show');
    }
  });

  Object.defineProperty(container, 'value', {
    get: function() { return selectedId; },
    set: function(val) { selectedId = val; renderOptions(); }
  });
  
  container.getText = function() {
    return valueDisplay.textContent;
  };

  return container;
}

// ---
// --- LIST MANAGEMENT FUNCTIONS
// ---

// --- History skeleton ---
// Fills the history area with pulsing placeholder bars while loadLists()
// round-trips chrome.storage. renderFilteredHistory() clears it by rewriting
// the list contents (empty state or items), so no separate teardown is needed.
function showHistorySkeleton() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;
  const noHistoryMessage = document.getElementById('no-history-message');
  if (noHistoryMessage) noHistoryMessage.style.display = 'none';
  historyList.style.display = 'block';
  historyList.innerHTML = `
    <div class="history-skeleton" aria-hidden="true">
      <div class="history-skeleton-bar"></div>
      <div class="history-skeleton-bar"></div>
      <div class="history-skeleton-bar"></div>
    </div>`;
}

function loadLists() {
  showHistorySkeleton();
  chrome.storage.local.get({ wordLists: [] }, (data) => {
    let lists = data.wordLists;
    const container = document.getElementById('list-select-container');
    const oldListSelect = document.getElementById('list-select');
    const currentVal = oldListSelect ? oldListSelect.value : '__all_lists__';
    
    container.innerHTML = '';
    const listSelect = createCustomDropdown(lists, currentVal, (val) => {
      if (val === "__create_new__") {
        addList();
      } else {
        applyFilters();
      }
    }, { showAllLists: true, showCreateNew: true });
    
    listSelect.id = 'list-select';
    container.appendChild(listSelect);

    // Load history for the currently selected list with filters
    applyFilters();
  });
}

function addList() {
  const listName = prompt("Enter the name for the new list:");
  if (listName && listName.trim()) {
    chrome.storage.local.get({ wordLists: [] }, (data) => {
      const lists = data.wordLists;
      // Duplicate names break the name->id mapping used by CSV import;
      // the background's createList handler enforces the same rule.
      if (lists.some(l => l.name === listName.trim())) {
        updateStatus('A list with this name already exists.', 'error');
        return;
      }
      const newList = { id: `list_${new Date().getTime()}`, name: listName.trim() };
      lists.push(newList);
      chrome.storage.local.set({ wordLists: lists }, () => {
        updateStatus('List created!', 'success');
        loadLists();
      });
    });
  }
}

function addSubList() {
  const listSelect = document.getElementById('list-select');
  const parentId = listSelect.value;
  if (!parentId || parentId === "__all_lists__" || parentId === "__create_new__") {
    alert("Please select a valid parent list first.");
    return;
  }
  const listName = prompt("Enter the name for the new sub-list:");
  if (listName && listName.trim()) {
    chrome.storage.local.get({ wordLists: [] }, (data) => {
      const lists = data.wordLists;
      // Same uniqueness rule as addList — names are the import mapping key.
      if (lists.some(l => l.name === listName.trim())) {
        updateStatus('A list with this name already exists.', 'error');
        return;
      }
      const newList = { id: `list_${new Date().getTime()}`, name: listName.trim(), parentId: parentId };
      lists.push(newList);
      chrome.storage.local.set({ wordLists: lists }, () => {
        updateStatus('Sub-list created!', 'success');
        loadLists();
      });
    });
  }
}

function renameList() {
  const listSelect = document.getElementById('list-select');
  const listId = listSelect.value;
  if (!listId || listId === "__all_lists__" || listId === "__create_new__") return;

  const currentName = listSelect.getText();
  const newName = prompt("Enter the new name for the list:", currentName);

  if (newName && newName.trim() && newName.trim() !== currentName) {
    chrome.storage.local.get({ wordLists: [] }, (data) => {
      // Exclude the list being renamed from the duplicate check.
      if (data.wordLists.some(l => l.name === newName.trim() && l.id !== listId)) {
        updateStatus('A list with this name already exists.', 'error');
        return;
      }
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
  if (!listId || listId === "__all_lists__" || listId === "__create_new__") {
    alert("No list selected.");
    return;
  }

  // Check actual wordLists array length, not options count (which includes "+ Create New List...")
  chrome.storage.local.get({ wordLists: [], history: [], lastUsedListId: null }, (data) => {
    if (data.wordLists.length <= 1) {
      alert("You cannot delete the last remaining list.");
      return;
    }

    const targetList = data.wordLists.find(l => l.id === listId);
    if (!targetList) return;

    const input = prompt(`To confirm deletion of "${targetList.name}" and its sub-lists, please type its name exactly:`);
    if (input !== targetList.name) {
      alert("Name did not match. Deletion cancelled.");
      return;
    }

    const listsToDelete = new Set([listId]);
    let added = true;
    while (added) {
      added = false;
      for (const list of data.wordLists) {
        if (list.parentId && listsToDelete.has(list.parentId) && !listsToDelete.has(list.id)) {
          listsToDelete.add(list.id);
          added = true;
        }
      }
    }

    const lists = data.wordLists.filter(list => !listsToDelete.has(list.id));
    // History items keep their data but become Unlisted instead of
    // holding ids no list will ever match again — dangling ids vanish
    // from every real list view and per-list export.
    const history = data.history.map(item =>
      listsToDelete.has(item.listId) ? { ...item, listId: null } : item
    );
    // Same for the popup's preselection: a stale lastUsedListId makes the
    // dropdown show "Select a list..." while still returning the dead id,
    // so Save files new words under an unmatchable list. Fall back to the
    // first surviving list (there is always one — the last list is
    // protected above).
    const updates = { wordLists: lists, history };
    if (data.lastUsedListId && listsToDelete.has(data.lastUsedListId)) {
      updates.lastUsedListId = lists[0].id;
    }
    chrome.storage.local.set(updates, () => {
      updateStatus('List and sub-lists deleted.', 'success');
      loadLists();
    });
  });
}

// --- NEW: Drag and Drop Reordering Modal ---
let reorderCurrentLists = [];

function openReorderModal() {
  const modal = document.getElementById('reorder-modal');
  chrome.storage.local.get({ wordLists: [] }, (data) => {
    reorderCurrentLists = data.wordLists;
    renderReorderLists();
    modal.style.display = 'flex';
  });
}

function renderReorderLists() {
  const container = document.getElementById('reorder-list-container');
  container.innerHTML = '';
  
  const sortedList = getSortedTreeLists(reorderCurrentLists);
  
  sortedList.forEach((list) => {
    const item = document.createElement('div');
    item.className = 'reorder-item';
    item.draggable = true;
    item.dataset.id = list.id;
    
    const indent = list.depth > 0 ? '&nbsp;&nbsp;'.repeat(list.depth * 2) + '↳ ' : '';
    
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '&#8942;&#8942;'; // :: icon
    
    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = indent;
    nameSpan.appendChild(document.createTextNode(list.name));
    
    item.appendChild(handle);
    item.appendChild(nameSpan);
    
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
    
    container.appendChild(item);
  });
}

let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
  setTimeout(() => this.classList.add('dragging'), 0);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  this.classList.add('over');
}

function handleDragLeave(e) {
  this.classList.remove('over');
}

function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();

  if (dragSrcEl !== this) {
    const draggedId = dragSrcEl.dataset.id;
    const targetId = this.dataset.id;
    
    const draggedOrigIndex = reorderCurrentLists.findIndex(l => l.id === draggedId);
    const targetOrigIndex = reorderCurrentLists.findIndex(l => l.id === targetId);
    
    const [removed] = reorderCurrentLists.splice(draggedOrigIndex, 1);
    const newTargetIndex = reorderCurrentLists.findIndex(l => l.id === targetId);
    
    if (draggedOrigIndex < targetOrigIndex) {
      reorderCurrentLists.splice(newTargetIndex + 1, 0, removed);
    } else {
      reorderCurrentLists.splice(newTargetIndex, 0, removed);
    }
    
    renderReorderLists();
  }
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  const items = document.querySelectorAll('.reorder-item');
  items.forEach(item => item.classList.remove('over'));
}

document.getElementById('reorder-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('reorder-modal').style.display = 'none';
});

document.getElementById('reorder-save-btn')?.addEventListener('click', () => {
  chrome.storage.local.set({ wordLists: reorderCurrentLists }, () => {
    document.getElementById('reorder-modal').style.display = 'none';
    loadLists();
    updateStatus('Lists reordered successfully', 'success');
  });
});



// Rebuild the raw stored text from a rendered definition div. Text nodes
// carry already-decoded characters, so & < > and U+00A0 survive the edit
// round-trip; only the display transforms (<br>, <strong>) are reversed.
// Reading innerHTML instead would feed the edit box serialized entities
// (&amp;, &lt;, &nbsp;), and saving those would escape the stored item one
// layer deeper per edit cycle.
function definitionToEditString(node) {
  let out = '';
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.nodeValue;
    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'BR') {
      out += '\n';
    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'STRONG') {
      out += '**' + definitionToEditString(child) + '**';
    } else {
      out += definitionToEditString(child);
    }
  });
  return out;
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
  const currentDefinitionText = definitionToEditString(definitionDiv);

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
    // --- NEW: Sentinel option representing "no list" (null listId) ---
    // Without this, editing an unlisted item silently snaps it to the first
    // real list on save because <select> has no matching option.
    // Remove old manual select creation and use createCustomDropdown
    let listSelector;
    
    function recreateDropdown(listsToUse, currentVal) {
      if (listSelector && listSelector.parentNode) {
        listSelector.parentNode.removeChild(listSelector);
      }
      listSelector = createCustomDropdown(listsToUse, currentVal, (val) => {
        if (val === "__create_new__") {
          const newListName = prompt("Enter the name for the new list:");
          if (newListName && newListName.trim()) {
            chrome.storage.local.get({ wordLists: [] }, (data2) => {
              const updatedLists = data2.wordLists;
              const newList = { id: `list_${new Date().getTime()}`, name: newListName.trim() };
              updatedLists.push(newList);
              chrome.storage.local.set({ wordLists: updatedLists }, () => {
                updateStatus('List created!', 'success');
                recreateDropdown(updatedLists, newList.id);
              });
            });
          } else {
            // Revert value
            listSelector.value = currentListId || '__unlisted__';
          }
        }
      }, { showUnlisted: true, showCreateNew: true });
      listSelector.classList.add('edit-list-selector');
      editControlsContainer.appendChild(listSelector);
    }
    
    recreateDropdown(data.wordLists, currentListId || '__unlisted__');
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
  const itemKey = itemElement.dataset.timestamp;

  const newWord = itemElement.querySelector('.edit-word-input').value;
  const newListId = itemElement.querySelector('.edit-list-selector').value;
  const newDefinition = itemElement.querySelector('.edit-definition-textarea').value;

  updateHistoryItem(itemKey, newWord, newDefinition, newListId);
}

// --- handleCancelClick ---
function handleCancelClick(event) {
  // Simply reload the current list's history to discard changes
  applyFilters();
}

// --- updateHistoryItem ---
function updateHistoryItem(itemKey, newWord, newDefinition, newListId) {
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];
    // Persist legacy id migration through this write (see applyFilters).
    ensureHistoryIds(history);

    const newHistory = history.map(item => {
      if (histId(item) === itemKey) {
        return {
          ...item,
          word: newWord,
          definition: newDefinition,
          listId: newListId === "__unlisted__" ? null : newListId // Update the listId
        };
      }
      return item;
    });

    chrome.storage.local.set({ history: newHistory }, () => {
      applyFilters();
    });
  });
}


// --- handleDeleteClick ---
function handleDeleteClick(event) {
  const btn = event.currentTarget;
  const itemKey = btn.dataset.timestamp;

  if (itemKey) {
    deleteHistoryItem(itemKey);
  }
}

// --- deleteHistoryItem ---
function deleteHistoryItem(itemKey) {
  // Rebuilding the list replaces its contents and would otherwise reset this
  // scrollable element to the top.
  const historyList = document.getElementById('history-list');
  const scrollTop = historyList.scrollTop;

  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];
    // Persist legacy id migration through this write (applyFilters
    // deliberately doesn't persist its snapshot — see the race note there).
    ensureHistoryIds(history);
    const newHistory = history.filter(item => histId(item) !== itemKey);
    chrome.storage.local.set({ history: newHistory }, () => {
      applyFilters(scrollTop);
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
// (Retired along with its hidden #clear-list-history button; list-scoped
// clearing now happens implicitly when a list is deleted, which unlists
// rather than destroys items.)

// --- escapeHTML ---
function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

// --- History item identity ---
// Timestamps are millisecond ISO strings and collide under bulk saves; every
// item carries a unique id used for identity (edit/delete/favorite/bulk/merge).
// The timestamp is kept for display, sorting, and CSV round-trips, and serves
// as a legacy fallback for items created before ids existed.
function generateHistoryId() {
  return 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function histId(item) {
  return item.id || item.timestamp;
}

// Assign ids to legacy items (pre-id storage or restored old backups).
// Mutates in place; returns true when anything changed so the caller persists.
function ensureHistoryIds(history) {
  let changed = false;
  history.forEach(item => {
    if (!item.id) {
      item.id = generateHistoryId();
      changed = true;
    }
  });
  return changed;
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
  const selectedListName = listSelect.getText();

  // "All Lists" is the aggregate pseudo-view, not a real list — filtering
  // on its sentinel id always reports the list as empty. The aggregate
  // case belongs to the dedicated Export All History button instead.
  if (!selectedListId || selectedListId === "__create_new__" || selectedListId === "__all_lists__") {
    updateIOStatus("Select a specific list to export, or use Export All History.", "error");
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
    const headers = ['timestamp', 'word', 'definition', 'listName', 'modelName', 'promptName', 'sourceUrl', 'sourceTitle', 'favorite', 'nextReview', 'interval', 'lastReviewed'];
    const csvRows = [
      headers.join(','),
      ...historyToExport.map(item => [
        escapeCSV(item.timestamp),
        escapeCSV(item.word),
        escapeCSV(item.definition),
        escapeCSV(listIdToNameMap[item.listId] || 'Unlisted'),
        escapeCSV(item.modelName || ''),
        escapeCSV(item.promptName || ''),
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

    const headers = ['timestamp', 'word', 'definition', 'listName', 'modelName', 'promptName', 'sourceUrl', 'sourceTitle', 'favorite', 'nextReview', 'interval', 'lastReviewed'];
    const csvRows = [
      headers.join(','),
      ...allHistory.map(item => [
        escapeCSV(item.timestamp),
        escapeCSV(item.word),
        escapeCSV(item.definition),
        escapeCSV(listIdToNameMap[item.listId] || 'Unlisted'),
        escapeCSV(item.modelName || ''),
        escapeCSV(item.promptName || ''),
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
    const promptNameIndex = headers.indexOf('promptName');
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
        if (promptNameIndex !== -1 && fields[promptNameIndex]) {
          newItem.promptName = fields[promptNameIndex];
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

    // Legacy items may lack ids; assign before keying the map by identity.
    // (The ids persist via the merged-history write below.)
    ensureHistoryIds(oldHistory);

    const historyMap = new Map();
    oldHistory.forEach(item => historyMap.set(histId(item), item));

    // CSV rows carry no ids, and timestamps alone can't identify rows —
    // they collide under bulk saves (see "History item identity" above),
    // which made round-tripped exports silently drop distinct items.
    // Dedup on the timestamp+word+definition composite instead: identical
    // rows still match, same-millisecond items survive.
    const rowKey = (item) => [item.timestamp, item.word, item.definition].join('\u0000');
    const seenRowKeys = new Set(oldHistory.map(rowKey));

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
          // Basic fallback for old CSVs without a listName column: import
          // into the list the dropdown shows — unless it shows the All
          // Lists pseudo-view (the dropdown's default) or the create-new
          // sentinel. Those are not real lists and must never be persisted
          // as a listId: such items would vanish from every real list view
          // and per-list export. Rows then import as Unlisted instead.
          targetListId = (currentSelectedListId && currentSelectedListId !== '__all_lists__' && currentSelectedListId !== '__create_new__')
            ? currentSelectedListId
            : null;
        }
      }
      item.listId = targetListId;

      // If there are no lists at all, the item will be unassigned, which is fine.
      if (!targetListId) {
        item.listId = null;
      }

      if (isNew || !seenRowKeys.has(rowKey(item))) {
        item.id = generateHistoryId();
        seenRowKeys.add(rowKey(item));
        historyMap.set(item.id, item);
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
  const itemKey = btn.dataset.timestamp;

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
    const item = (historyData.history || []).find(i => histId(i) === itemKey);

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
    btn.innerHTML = `<strong>${optIcon('check')}</strong>`;
    // Keep it disabled to show success

  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<strong>A</strong>'; // <-- UPDATED
    alert(`Anki Error: ${e.message}`); // alert() is fine in the options page
  }
}

// ---
// --- NEW: REMINDER & BACKUP SETTINGS FUNCTIONS
// ---

const BACKUP_INCLUDE_KEYS = {
  history: 'backup-include-history',
  models: 'backup-include-models',
  prompts: 'backup-include-prompts',
  apiKeys: 'backup-include-apikeys',
  anki: 'backup-include-anki',
  voice: 'backup-include-voice',
  pdf: 'backup-include-pdf',
  general: 'backup-include-general'
};

const DEFAULT_BACKUP_INCLUDE = {
  history: true,
  models: true,
  prompts: true,
  apiKeys: true,
  anki: true,
  voice: true,
  pdf: true,
  general: true
};

function getBackupIncludeFromUI() {
  const include = {};
  for (const [key, elementId] of Object.entries(BACKUP_INCLUDE_KEYS)) {
    const el = document.getElementById(elementId);
    include[key] = el ? el.checked : true;
  }
  return include;
}

function setBackupIncludeInUI(include) {
  const merged = { ...DEFAULT_BACKUP_INCLUDE, ...(include || {}) };
  for (const [key, elementId] of Object.entries(BACKUP_INCLUDE_KEYS)) {
    const el = document.getElementById(elementId);
    if (el) el.checked = merged[key] !== false;
  }
}

function saveReminderSettings() {
  const freqEl = document.getElementById('reminder-frequency');
  const subfolderEl = document.getElementById('backup-subfolder');
  if (!freqEl || !subfolderEl) return;

  const frequency = freqEl.value;
  const subfolder = subfolderEl.value.trim();
  const backupInclude = getBackupIncludeFromUI();

  const hasAnySelected = Object.values(backupInclude).some(Boolean);
  if (!hasAnySelected) {
    updateReminderStatus('Please select at least one item to include in backups.', 'error');
    return;
  }

  chrome.storage.sync.set({
    backupReminderFrequency: parseInt(frequency, 10),
    backupSubfolder: subfolder,
    backupInclude: backupInclude
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

function loadBackupStatus() {
  chrome.storage.local.get({ lastBackupTime: 0, lastBackupType: '', lastBackupError: null }, (localData) => {
    const statusEl = document.getElementById('backup-status');
    if (!statusEl) return;

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

function loadReminderSettings() {
  // Load settings from sync
  chrome.storage.sync.get({ backupReminderFrequency: 0, backupSubfolder: '', backupInclude: DEFAULT_BACKUP_INCLUDE }, (syncData) => {
    const freqEl = document.getElementById('reminder-frequency');
    if (freqEl) freqEl.value = syncData.backupReminderFrequency;
    const subfolderEl = document.getElementById('backup-subfolder');
    if (subfolderEl) subfolderEl.value = syncData.backupSubfolder;
    setBackupIncludeInUI(syncData.backupInclude);
  });

  // Load status from local
  loadBackupStatus();
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

  // Reset immediately (the File object is already captured): otherwise
  // picking the same backup again fires no change event and the second
  // restore attempt silently does nothing.
  fileInput.value = null;

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

      const keysToRestore = ['history', 'wordLists', 'lists'];
      const dataToSave = {};
      let restoredCount = 0;

      for (const key in backupData) {
        if (keysToRestore.includes(key) || key === 'history' || key === 'lists' || key === 'wordLists') {
          dataToSave[key] = backupData[key];
          restoredCount++;
        }
      }

      // Special handling if the backup is just an array (old history export)
      if (Array.isArray(backupData)) {
        dataToSave['history'] = backupData;
        restoredCount = 1;
      }

      // --- NEW: Map 'lists' to 'wordLists' if needed ---
      if (!dataToSave.wordLists && dataToSave.lists) {
        dataToSave.wordLists = dataToSave.lists;
      }

      // --- NEW: Reconstruct wordLists if missing ---
      // If history exists but wordLists is missing (empty array), we must rebuild it from history items
      if (dataToSave.history && (!dataToSave.wordLists || dataToSave.wordLists.length === 0)) {
        const uniqueListIds = new Set();
        dataToSave.history.forEach(item => {
          if (item.listId) uniqueListIds.add(item.listId);
        });

        if (uniqueListIds.size > 0) {
          dataToSave.wordLists = [];
          uniqueListIds.forEach(id => {
            let name = "Restored List " + id.substring(0, 4);
            // Try to extract timestamp from id (format: list_TIMESTAMP_RANDOM or list_TIMESTAMP)
            const match = id.match(/list_(\d+)/);
            if (match && match[1]) {
              const date = new Date(parseInt(match[1]));
              if (!isNaN(date.getTime())) {
                name = "Restored List (" + date.toLocaleDateString() + ")";
              }
            }
            dataToSave.wordLists.push({ id: id, name: name });
          });
          restoredCount++; // We effectively restored lists
        }
      }

      // Full backups keep per-URL PDF annotation keys (highlights,
      // bookmarks, last page) namespaced under 'pdfAnnotations'; merge the
      // pdf_* ones into the same local-storage write. URLs absent from the
      // file keep whatever is already stored.
      let pdfAnnotationCount = 0;
      const pdfAnnotations = backupData.pdfAnnotations;
      if (pdfAnnotations && typeof pdfAnnotations === 'object' && !Array.isArray(pdfAnnotations)) {
        for (const key of Object.keys(pdfAnnotations)) {
          if (key.startsWith('pdf_') || key === 'pdf_author_name') {
            dataToSave[key] = pdfAnnotations[key];
            pdfAnnotationCount++;
          }
        }
        if (pdfAnnotationCount > 0) restoredCount++;
      }

      // Fetch currently stored sync data so we can merge models preserving existing API keys
      chrome.storage.sync.get(null, (existingSyncData) => {
        const syncKeys = [
          'models', 'customPrompts', 'defaultModelId', 'defaultPromptId',
          'tavilyApiKey', 'enableHallucinationGuard', 'verificationModelId',
          'ttsSettings', 'ankiSettings', 'backupReminderFrequency', 'backupSubfolder',
          'backupInclude', 'followupCustomMessage', 'showUserQuestions',
          'sttEngine', 'sttApiKey', 'sttApiUrl', 'sttModel', 'sttCustomHeaders',
          'sttCustomFormData', 'pdfViewerEnabled', 'uiTheme'
        ];
        const syncData = {};
        let syncCount = 0;
        for (const key of syncKeys) {
          if (backupData[key] !== undefined) {
            syncData[key] = backupData[key];
            syncCount++;
          }
        }

        // Intelligently merge models so blank API keys in sanitized backup don't wipe existing live keys
        if (Array.isArray(backupData.models)) {
          const currentModels = existingSyncData.models || [];
          const currentModelMap = new Map();
          currentModels.forEach(m => {
            if (m.id) currentModelMap.set(m.id, m);
          });

          syncData.models = backupData.models.map(incoming => {
            const hasIncomingKey = typeof incoming.apiKey === 'string' && incoming.apiKey.trim().length > 0;
            if (!hasIncomingKey) {
              const existing = currentModelMap.get(incoming.id) || currentModels.find(m => m.name === incoming.name && m.endpointUrl === incoming.endpointUrl);
              if (existing && typeof existing.apiKey === 'string' && existing.apiKey.trim().length > 0) {
                return { ...incoming, apiKey: existing.apiKey };
              }
            }
            return { ...incoming };
          });
        }

        // Preserve existing individual credentials if incoming values are empty strings (sanitized backup)
        if (syncData.tavilyApiKey === "" && existingSyncData.tavilyApiKey) {
          syncData.tavilyApiKey = existingSyncData.tavilyApiKey;
        }
        if (syncData.sttApiKey === "" && existingSyncData.sttApiKey) {
          syncData.sttApiKey = existingSyncData.sttApiKey;
        }
        if (syncData.sttCustomHeaders === "" && existingSyncData.sttCustomHeaders) {
          syncData.sttCustomHeaders = existingSyncData.sttCustomHeaders;
        }

        if (restoredCount > 0 || syncCount > 0) {
          const parts = [];
          if (dataToSave.history && Array.isArray(dataToSave.history)) parts.push(`${dataToSave.history.length} history items`);
          if (dataToSave.wordLists && Array.isArray(dataToSave.wordLists)) parts.push(`${dataToSave.wordLists.length} lists`);
          if (pdfAnnotationCount > 0) parts.push(`${pdfAnnotationCount} PDF items`);
          if (syncData.models && Array.isArray(syncData.models)) parts.push(`${syncData.models.length} models`);
          if (syncData.customPrompts && Array.isArray(syncData.customPrompts)) parts.push(`${syncData.customPrompts.length} prompts`);
          if (syncData.ankiSettings) parts.push('Anki settings');
          if (syncData.ttsSettings || syncData.sttEngine) parts.push('Voice settings');
          if (syncData.tavilyApiKey) parts.push('Tavily API key');
          if (syncCount > 0 && parts.length === 0) parts.push(`${syncCount} settings`);

          const summaryMsg = `Restored: ${parts.join(', ')}. Reloading...`;

          const applySync = () => {
            if (syncCount > 0) {
              chrome.storage.sync.set(syncData, () => {
                updateRestoreStatus(summaryMsg, 'success');
                setTimeout(() => location.reload(), 2000);
              });
            } else {
              updateRestoreStatus(summaryMsg, 'success');
              setTimeout(() => location.reload(), 2000);
            }
          };

          if (Object.keys(dataToSave).length > 0) {
            chrome.storage.local.set(dataToSave, applySync);
          } else {
            applySync();
          }
        } else {
          updateRestoreStatus('Invalid backup file format or no recognized data found.', 'error');
        }
      });

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
        // Use the prompt's stable id (not its position) so reordering is
        // resilient to the displayed list being stale.
        promptEl.draggable = true;
        promptEl.dataset.promptId = prompt.id;

        promptEl.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', prompt.id);
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
          const draggedId = e.dataTransfer.getData('text/plain');
          const targetId = prompt.id;
          if (!draggedId || draggedId === targetId) {
            return false;
          }

          // Re-fetch the freshest list from storage so we don't reorder a stale
          // copy if the data changed since this UI was rendered.
          chrome.storage.sync.get({ customPrompts: [] }, (data) => {
            const freshPrompts = data.customPrompts || [];
            const fromIndex = freshPrompts.findIndex(p => p.id === draggedId);
            const toIndex = freshPrompts.findIndex(p => p.id === targetId);
            if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
              return; // nothing to move (or ids no longer present)
            }
            const [movedPrompt] = freshPrompts.splice(fromIndex, 1);
            freshPrompts.splice(toIndex, 0, movedPrompt);
            chrome.storage.sync.set({ customPrompts: freshPrompts }, () => {
              loadPrompts();
              loadDefaultPromptSelect();
            });
          });
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
    chrome.storage.sync.get({ customPrompts: [], defaultPromptId: null }, (data) => {
      const prompts = data.customPrompts.filter(p => p.id !== id);
      const updates = { customPrompts: prompts };
      // Deleting the default prompt reverts the default to the built-in
      // system prompt — 'system' is the sentinel content.js and background
      // already resolve correctly. A dangling id would make this dropdown
      // display the first prompt while runtime silently uses the system
      // default.
      if (data.defaultPromptId === id) {
        updates.defaultPromptId = 'system';
      }
      chrome.storage.sync.set(updates, () => {
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

function applyFilters(scrollTopToRestore = null) {
  const searchQuery = document.getElementById('history-search').value.toLowerCase().trim();
  const dateFilter = document.getElementById('date-filter').value;
  const favoritesOnly = document.getElementById('favorites-only').checked;
  const listId = document.getElementById('list-select').value;

  // Resolve the effective list filter:
  //   __all_lists__  -> show every item (including ones whose listId is null)
  //   __create_new__ -> shouldn't reach here; treat as "no specific list"
  //   real id        -> only items in that list
  //   empty          -> no lists exist; show nothing
  const showAllLists = listId === "__all_lists__";
  const isRealListId = !!listId && !showAllLists && listId !== "__create_new__";

  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    // Migration: legacy items (pre-id era, or restored from an old backup)
    // get a stable unique id before any identity operation can run against
    // them. In-memory only: persisting this snapshot here races a
    // concurrent delete (the delete's filtered write lands first, then
    // this full-array write resurrects the deleted item). The ids persist
    // through the history writers, which re-read storage before writing.
    ensureHistoryIds(history);

    // Capture the pre-filter size for the empty-state distinction below.
    const totalHistoryCount = history.length;

    // Filter by list first
    if (showAllLists) {
      // No list filter — keep everything (incl. null/unlisted items).
    } else if (isRealListId) {
      history = history.filter(item => item.listId === listId);
    } else {
      // No usable selection: nothing to show.
      history = [];
    }

    // Filter by search query (guard against missing fields)
    if (searchQuery) {
      history = history.filter(item =>
        (item.word && item.word.toLowerCase().includes(searchQuery)) ||
        (item.definition && item.definition.toLowerCase().includes(searchQuery))
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

    // Render filtered history. totalHistoryCount is the unfiltered size, so
    // an empty list can be told apart from "filters matched nothing".
    renderFilteredHistory(history, scrollTopToRestore, totalHistoryCount);
  });
}

function renderFilteredHistory(history, scrollTopToRestore = null, totalHistoryCount = 0) {
  const historyList = document.getElementById('history-list');
  const noHistoryMessage = document.getElementById('no-history-message');
  historyList.innerHTML = '';

  if (history.length === 0) {
    noHistoryMessage.style.display = 'block';
    historyList.style.display = 'none';

    const noHistoryIcon = document.getElementById('no-history-icon');
    const noHistoryTitle = document.getElementById('no-history-title');
    const noHistoryHint = document.getElementById('no-history-hint');
    if (totalHistoryCount === 0) {
      if (noHistoryIcon) noHistoryIcon.innerHTML = optIcon('inbox');
      if (noHistoryTitle) noHistoryTitle.textContent = 'No saved words yet';
      if (noHistoryHint) noHistoryHint.textContent = 'Select a word on any webpage and save it from the AI popup to see it here.';
    } else {
      if (noHistoryIcon) noHistoryIcon.innerHTML = optIcon('search');
      if (noHistoryTitle) noHistoryTitle.textContent = 'No matching items found';
      if (noHistoryHint) noHistoryHint.textContent = 'Try a different search term, list, or date filter.';
    }
  } else {
    noHistoryMessage.style.display = 'none';
    historyList.style.display = 'block';

    history.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'history-item';
      itemElement.dataset.timestamp = histId(item);
      itemElement.dataset.listId = item.listId;

      let formattedDefinition = escapeHTML(item.definition)
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

      // Add buttons (same pattern as the edit/delete/favorite rows above)
      const ankiButton = document.createElement('button');
      ankiButton.className = 'anki-item-btn';
      ankiButton.innerHTML = '<strong>A</strong>';
      ankiButton.title = 'Send to Anki';
      ankiButton.dataset.timestamp = histId(item);
      ankiButton.addEventListener('click', handleSendToAnkiClick);
      itemElement.appendChild(ankiButton);

      const starButton = document.createElement('button');
      starButton.className = 'star-item-btn' + (item.favorite ? ' favorited' : '');
      starButton.innerHTML = item.favorite ? optIcon('starFilled', 1.1) : optIcon('star', 1.1);
      starButton.title = item.favorite ? 'Remove from favorites' : 'Add to favorites';
      starButton.dataset.timestamp = histId(item);
      starButton.addEventListener('click', handleToggleFavoriteClick);
      itemElement.appendChild(starButton);

      const bulkCheckbox = document.createElement('input');
      bulkCheckbox.type = 'checkbox';
      bulkCheckbox.className = 'bulk-checkbox';
      bulkCheckbox.dataset.timestamp = histId(item);
      bulkCheckbox.addEventListener('change', updateSelectedCount);
      itemElement.appendChild(bulkCheckbox);

      const editButton = document.createElement('button');
      editButton.className = 'edit-item-btn';
      editButton.innerHTML = optIcon('edit');
      editButton.title = 'Edit this item';
      editButton.dataset.timestamp = histId(item);
      editButton.addEventListener('click', handleEditClick);
      itemElement.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-item-btn';
      deleteButton.innerHTML = optIcon('trash');
      deleteButton.title = 'Delete this item';
      deleteButton.dataset.timestamp = histId(item);
      deleteButton.addEventListener('click', handleDeleteClick);
      itemElement.appendChild(deleteButton);

      historyList.appendChild(itemElement);
    });

    if (scrollTopToRestore !== null) {
      requestAnimationFrame(() => {
        const maxScrollTop = Math.max(0, historyList.scrollHeight - historyList.clientHeight);
        historyList.scrollTop = Math.min(scrollTopToRestore, maxScrollTop);
      });
    }
  }
}

function handleToggleFavoriteClick(event) {
  const btn = event.currentTarget;
  const itemKey = btn.dataset.timestamp;

  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    history = history.map(item => {
      if (histId(item) === itemKey) {
        return { ...item, favorite: !item.favorite };
      }
      return item;
    });

    chrome.storage.local.set({ history: history }, () => {
      // Update button visually
      const item = history.find(i => histId(i) === itemKey);
      if (item) {
        btn.innerHTML = item.favorite ? optIcon('starFilled', 1.1) : optIcon('star', 1.1);
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
    history = history.filter(item => !timestamps.includes(histId(item)));

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
        if (timestamps.includes(histId(item))) {
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
  const itemsToExport = history.filter(item => timestamps.includes(histId(item)));

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

// Shared markdown-lite formatter for card backs (escape first, then apply
// our own bold/line-break transformations).
function formatFlashcardDefinition(card) {
  return escapeHTML(card.definition)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function showCurrentCard() {
  if (currentCardIndex >= flashcardQueue.length) {
    // Review complete. Also reset the flip so a session ending mid-flip
    // can't carry a stale .flipped into the next one.
    document.getElementById('flashcard-card').classList.remove('flipped');
    document.getElementById('flashcard-container').style.display = 'none';
    document.getElementById('review-complete').style.display = 'block';
    return;
  }

  const card = flashcardQueue[currentCardIndex];

  document.getElementById('current-card-num').textContent = currentCardIndex + 1;
  document.getElementById('total-cards-num').textContent = flashcardQueue.length;

  document.getElementById('flashcard-word').textContent = card.word;
  document.getElementById('flashcard-source').textContent = card.sourceTitle ? `From: ${card.sourceTitle}` : '';

  // The back face gets its content up front, not at flip time: the card's
  // grid height is the taller of the two faces, so filling the definition
  // only on reveal would grow the card mid-flip.
  document.getElementById('flashcard-definition').innerHTML = formatFlashcardDefinition(card);

  // Reset card state (flip back to the word face)
  document.getElementById('flashcard-card').classList.remove('flipped');
  document.getElementById('show-answer-btn').style.display = 'inline-block';
  document.getElementById('rating-buttons').style.display = 'none';
}

function showFlashcardAnswer() {
  document.getElementById('flashcard-card').classList.add('flipped');
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

  // Clamp the interval so "Hard" can't decay toward zero (card stuck due
  // forever) and "Easy" can't grow unbounded (card vanishes for years).
  const MIN_INTERVAL = 1 * 60 * 1000;                 // 1 minute floor
  const MAX_INTERVAL = 180 * 24 * 60 * 60 * 1000;     // ~6 months ceiling
  if (newInterval < MIN_INTERVAL) newInterval = MIN_INTERVAL;
  if (newInterval > MAX_INTERVAL) newInterval = MAX_INTERVAL;

  const nextReview = Date.now() + newInterval;

  // Update the card in storage
  chrome.storage.local.get(['history'], (result) => {
    let history = result.history || [];

    history = history.map(item => {
      if (histId(item) === histId(card)) {
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

// ---
// --- NEW: STATS DASHBOARD
// ---

// --- Animated stat counters ---
// Counts a stat value from its current number up/down to target over ~400ms
// with an ease-out settle. Jumps instantly when the value is unchanged,
// the element is missing, or the user prefers reduced motion.
function animateStatValue(el, target) {
  if (!el) return;
  const start = parseInt(el.textContent, 10);
  if (!Number.isFinite(start) || start === target) {
    el.textContent = target;
    return;
  }
  if (el._statAnim) cancelAnimationFrame(el._statAnim);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target;
    return;
  }

  const duration = 400;
  const t0 = performance.now();
  const step = (now) => {
    if (!el.isConnected) {
      el.textContent = target;
      el._statAnim = null;
      return;
    }
    const p = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    el._statAnim = p < 1 ? requestAnimationFrame(step) : null;
  };
  el._statAnim = requestAnimationFrame(step);
}

function loadStats() {
  chrome.storage.local.get(['history'], (result) => {
    const history = result.history || [];

    // 1. Calculate Simple Metrics
    const totalWords = history.length;
    const favorites = history.filter(item => item.favorite === true).length;

    const now = Date.now();
    const dueCards = history.filter(item => (item.nextReview || 0) <= now).length;

    // Estimate total reviews (if we don't have exact counts, we can estimate based on intervals)
    // For now, let's just count how many items have an interval set (meaning they've been reviewed at least once)
    const totalReviews = history.filter(item => item.interval > 0).length;

    animateStatValue(document.getElementById('stat-total-words'), totalWords);
    animateStatValue(document.getElementById('stat-favorites'), favorites);
    animateStatValue(document.getElementById('stat-due-cards'), dueCards);
    animateStatValue(document.getElementById('stat-total-reviews'), totalReviews);

    // 2. Render Heatmap (90 Days)
    const heatmapGrid = document.getElementById('heatmap-grid');
    heatmapGrid.innerHTML = '';
    
    const daysToRender = 90;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Map timestamps to days
    const activityMap = new Map();
    history.forEach(item => {
      // Activity counts both when a word was added (item.timestamp) AND when it was reviewed (item.lastReviewed)
      const datesToLog = [item.timestamp];
      if (item.lastReviewed) datesToLog.push(item.lastReviewed);

      datesToLog.forEach(ts => {
        if (!ts) return;
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        const dayDiff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff >= 0 && dayDiff < daysToRender) {
          activityMap.set(dayDiff, (activityMap.get(dayDiff) || 0) + 1);
        }
      });
    });

    // Determine grid layout (13 weeks = 91 days, we'll render exactly 90 cells)
    // CSS grid is set to column flow.
    for (let i = daysToRender - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      
      const count = activityMap.get(i) || 0;
      if (count > 0 && count <= 2) cell.dataset.level = "1";
      else if (count > 2 && count <= 5) cell.dataset.level = "2";
      else if (count > 5 && count <= 10) cell.dataset.level = "3";
      else if (count > 10) cell.dataset.level = "4";

      // Tooltip with date and count
      const cellDate = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateStr = cellDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      cell.title = `${count} interactions on ${dateStr}`;

      heatmapGrid.appendChild(cell);
    }
  });
}

// --- STT Settings ---
function loadSTTSettings() {
  chrome.storage.sync.get({
    sttEngine: 'native',
    sttApiKey: '',
    sttApiUrl: 'https://api.openai.com/v1/audio/transcriptions',
    sttModel: 'whisper-1',
    sttCustomHeaders: '',
    sttCustomFormData: ''
  }, (items) => {
    const engineSelect = document.getElementById('stt-engine-select');
    if (engineSelect) {
      engineSelect.value = items.sttEngine;
      // Trigger change to update visibility
      engineSelect.dispatchEvent(new Event('change'));
    }
    const apiKeyInput = document.getElementById('stt-api-key');
    if (apiKeyInput) apiKeyInput.value = items.sttApiKey;

    const apiUrlInput = document.getElementById('stt-api-url');
    if (apiUrlInput) apiUrlInput.value = items.sttApiUrl;

    const modelInput = document.getElementById('stt-model');
    if (modelInput) modelInput.value = items.sttModel;
    
    const headersInput = document.getElementById('stt-custom-headers');
    if (headersInput) headersInput.value = items.sttCustomHeaders;

    const formDataInput = document.getElementById('stt-custom-formdata');
    if (formDataInput) formDataInput.value = items.sttCustomFormData;
  });
}

function saveSTTSettings() {
  const engine = document.getElementById('stt-engine-select')?.value || 'native';
  const apiKey = document.getElementById('stt-api-key')?.value || '';
  const apiUrl = document.getElementById('stt-api-url')?.value || '';
  const model = document.getElementById('stt-model')?.value || '';
  const customHeaders = document.getElementById('stt-custom-headers')?.value || '';
  const customFormData = document.getElementById('stt-custom-formdata')?.value || '';

  // Basic JSON validation before saving
  try {
    if (customHeaders.trim()) JSON.parse(customHeaders);
    if (customFormData.trim()) JSON.parse(customFormData);
  } catch (e) {
    const statusEl = document.getElementById('stt-status');
    if (statusEl) {
      statusEl.textContent = 'Error: Invalid JSON format in Custom Headers or Form Data.';
      statusEl.style.color = '#d9534f';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    }
    return; // Don't save if invalid JSON
  }

  chrome.storage.sync.set({
    sttEngine: engine,
    sttApiKey: apiKey,
    sttApiUrl: apiUrl,
    sttModel: model,
    sttCustomHeaders: customHeaders,
    sttCustomFormData: customFormData
  }, () => {
    const statusEl = document.getElementById('stt-status');
    if (statusEl) {
      statusEl.textContent = 'Settings saved successfully!';
      statusEl.style.color = 'var(--secondary-color)';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    }
  });
}

// --- DIAGNOSTIC CONNECTION & SETUP TEST ---
function runDiagnosticTest(targetModelId = null) {
  const modelId = targetModelId || document.getElementById('model-select')?.value;
  executeDiagnosticCheck({ modelId });
}

function runFormDiagnosticTest() {
  const endpoint = document.getElementById('endpoint')?.value?.trim() || '';
  const modelName = document.getElementById('modelName')?.value?.trim() || '';

  if (!endpoint || !modelName) {
    alert("Please enter both an Endpoint URL and a Model Name to run the diagnostic test.");
    return;
  }

  const modelConfig = {
    name: document.getElementById('configName')?.value?.trim() || 'New Model',
    endpointUrl: endpoint,
    modelName: modelName,
    apiKey: document.getElementById('apiKey')?.value?.trim() || '',
    enableSearchGrounding: document.getElementById('enableSearchGrounding')?.checked || false
  };

  executeDiagnosticCheck({ modelConfig });
}

function executeDiagnosticCheck(requestData) {
  const resultsContainer = document.getElementById('test-setup-results');
  const runBtn = document.getElementById('run-test-setup-btn');
  const btnIcon = document.getElementById('test-btn-icon');
  const btnLabel = document.getElementById('test-btn-label');
  const formTestBtn = document.getElementById('test-form-model-btn');
  const summaryBox = document.getElementById('test-final-summary');

  if (!resultsContainer) return;

  resultsContainer.style.display = 'block';
  if (summaryBox) {
    summaryBox.style.display = 'none';
    summaryBox.className = 'test-summary-box';
  }

  // Reset steps to initial state
  const stepIds = ['config', 'reachability', 'auth', 'search'];
  stepIds.forEach(id => {
    const row = document.getElementById(`test-step-${id}`);
    if (row) {
      row.className = 'test-step-row running';
      const icon = row.querySelector('.test-step-icon');
      const detail = row.querySelector('.test-step-detail');
      if (icon) icon.innerHTML = optIcon('spinner', 1.1, 'oi-spin');
      if (detail) detail.textContent = 'Checking...';
    }
  });

  if (runBtn) {
    runBtn.disabled = true;
    if (btnIcon) btnIcon.innerHTML = optIcon('spinner', 1, 'oi-spin');
    if (btnLabel) btnLabel.textContent = 'Testing...';
  }
  if (formTestBtn) {
    formTestBtn.disabled = true;
    formTestBtn.innerHTML = `${optIcon('spinner', 1, 'oi-spin')} Testing...`;
  }

  chrome.runtime.sendMessage({
    type: "testConnection",
    ...requestData
  }, (response) => {
    if (runBtn) {
      runBtn.disabled = false;
      if (btnIcon) btnIcon.innerHTML = optIcon('play');
      if (btnLabel) btnLabel.textContent = 'Run Diagnostic Test';
    }
    if (formTestBtn) {
      formTestBtn.disabled = false;
      formTestBtn.innerHTML = `${optIcon('zap')} Test Inputs`;
    }

    if (chrome.runtime.lastError) {
      stepIds.forEach(id => {
        const row = document.getElementById(`test-step-${id}`);
        if (row) {
          row.className = 'test-step-row fail';
          const icon = row.querySelector('.test-step-icon');
          const detail = row.querySelector('.test-step-detail');
          if (icon) icon.innerHTML = `<span style="color: var(--danger-color);">${optIcon('xCircle', 1.1)}</span>`;
          if (detail) detail.textContent = `Extension error: ${chrome.runtime.lastError.message}`;
        }
      });
      return;
    }

    if (!response || !response.steps) {
      if (summaryBox) {
        summaryBox.style.display = 'flex';
        summaryBox.className = 'test-summary-box failure';
        summaryBox.innerHTML = `<span style="color: #F87171;">${optIcon('xCircle', 1.2)}</span><span>Failed to receive diagnostic test results from background worker.</span>`;
      }
      return;
    }

    // Reset all step rows from running state before rendering response
    stepIds.forEach(id => {
      const row = document.getElementById(`test-step-${id}`);
      if (row) {
        row.className = 'test-step-row pending';
        const icon = row.querySelector('.test-step-icon');
        const detail = row.querySelector('.test-step-detail');
        if (icon) icon.innerHTML = `<span style="color: var(--text-muted);">${optIcon('circle', 1.1)}</span>`;
        if (detail) detail.textContent = 'Skipped.';
      }
    });

    // Render each step from response
    response.steps.forEach(step => {
      const row = document.getElementById(`test-step-${step.id}`);
      if (row) {
        row.className = `test-step-row ${step.status}`;
        const icon = row.querySelector('.test-step-icon');
        const detail = row.querySelector('.test-step-detail');

        if (icon) {
          if (step.status === 'pass') icon.innerHTML = `<span style="color: var(--secondary-color);">${optIcon('checkCircle', 1.1)}</span>`;
          else if (step.status === 'fail') icon.innerHTML = `<span style="color: var(--danger-color);">${optIcon('xCircle', 1.1)}</span>`;
          else if (step.status === 'warn') icon.innerHTML = `<span style="color: #F59E0B;">${optIcon('alertTriangle', 1.1)}</span>`;
          else icon.innerHTML = `<span style="color: var(--text-muted);">${optIcon('circle', 1.1)}</span>`;
        }

        if (detail) {
          detail.textContent = step.message;

          // 1-Click Action Buttons for instant fixes
          if (step.id === 'config' && step.status === 'fail' && step.message.includes('No AI model is configured')) {
            const addBtn = document.createElement('button');
            addBtn.className = 'test-action-btn';
            addBtn.innerHTML = `${optIcon('plus', 0.9)} Add Model Configuration`;
            addBtn.style.cssText = 'margin-top: 8px; background-color: var(--secondary-color); padding: 6px 14px; font-size: 0.88em; font-weight: 600; border-radius: 6px; border: none; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;';
            addBtn.onclick = () => {
              showModelForm(false);
              document.getElementById('model-form-container')?.scrollIntoView({ behavior: 'smooth' });
            };
            detail.appendChild(document.createElement('br'));
            detail.appendChild(addBtn);
          } else if (step.id === 'auth' && step.status === 'fail') {
            const editBtn = document.createElement('button');
            editBtn.className = 'test-action-btn';
            editBtn.innerHTML = `${optIcon('edit', 0.9)} Edit Model & API Key`;
            editBtn.style.cssText = 'margin-top: 8px; background-color: var(--primary-color); padding: 6px 14px; font-size: 0.88em; font-weight: 600; border-radius: 6px; border: none; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;';
            editBtn.onclick = () => {
              editSelectedModel();
              document.getElementById('model-form-container')?.scrollIntoView({ behavior: 'smooth' });
            };
            detail.appendChild(document.createElement('br'));
            detail.appendChild(editBtn);
          } else if (step.id === 'search' && step.status === 'warn') {
            const tavilyBtn = document.createElement('button');
            tavilyBtn.className = 'test-action-btn';
            tavilyBtn.innerHTML = `${optIcon('key', 0.9)} Open Search API Settings`;
            tavilyBtn.style.cssText = 'margin-top: 8px; background-color: #F59E0B; padding: 6px 14px; font-size: 0.88em; font-weight: 600; border-radius: 6px; border: none; color: #000; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;';
            tavilyBtn.onclick = () => {
              const searchSection = document.getElementById('search-api-container');
              if (searchSection) {
                searchSection.scrollIntoView({ behavior: 'smooth' });
                document.getElementById('tavily-api-key')?.focus();
              }
            };
            detail.appendChild(document.createElement('br'));
            detail.appendChild(tavilyBtn);
          }
        }
      }
    });

    // Render final summary
    if (summaryBox) {
      summaryBox.style.display = 'flex';
      if (response.success) {
        summaryBox.className = 'test-summary-box success';
        summaryBox.innerHTML = `<span>${optIcon('checkCircle', 1.2)}</span><span>${escapeHTML(response.summary || 'All checks passed!')}</span>`;
        // A full pass completes onboarding step 2
        chrome.storage.local.set({ onboardingTestPassed: true }, refreshOnboarding);
      } else {
        summaryBox.className = 'test-summary-box failure';
        summaryBox.innerHTML = `<span>${optIcon('xCircle', 1.2)}</span><span>${escapeHTML(response.summary || 'One or more diagnostic checks failed.')}</span>`;
      }
    }
  });
}

// --- ONBOARDING CHECKLIST & SHORTCUT CARD ---
function setOnboardingStep(stepEl, done) {
  if (!stepEl) return;
  stepEl.classList.toggle('done', done);
  const icon = stepEl.querySelector('.onboarding-step-icon');
  if (icon) {
    icon.innerHTML = done
      ? `<span style="color: var(--secondary-color);">${optIcon('checkCircle', 1.1)}</span>`
      : optIcon('circle', 1.1);
  }
}

function refreshOnboarding() {
  const card = document.getElementById('onboarding-card');
  if (!card) return;
  chrome.storage.local.get(['onboardingDismissed', 'onboardingTestPassed', 'history'], (local) => {
    chrome.storage.sync.get(['models'], (sync) => {
      const steps = [
        (sync.models || []).length > 0,
        !!local.onboardingTestPassed,
        Array.isArray(local.history) && local.history.length > 0
      ];
      const complete = steps.every(Boolean);
      if (local.onboardingDismissed || complete) {
        card.style.display = 'none';
        // A finished checklist collapses away permanently
        if (complete && !local.onboardingDismissed) {
          chrome.storage.local.set({ onboardingDismissed: true });
        }
        return;
      }
      card.style.display = 'block';
      steps.forEach((done, i) => {
        setOnboardingStep(document.getElementById(`onboarding-step-${i + 1}`), done);
      });
    });
  });
}

function initShortcutCard() {
  // Show the real binding — the user may have remapped it in chrome://extensions/shortcuts
  const kbds = document.querySelectorAll('.popup-shortcut');
  if (!kbds.length) return;
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll((cmds) => {
      const cmd = (cmds || []).find(c => c.name === 'trigger-popup');
      kbds.forEach(k => { k.textContent = (cmd && cmd.shortcut) ? cmd.shortcut : 'Not set'; });
    });
  }
}

function resetAllSettings() {
  const ok = confirm(
    'Reset EVERYTHING to a fresh install?\n\n' +
    'This permanently erases your models and API keys, custom prompts, vocabulary history and word lists, ' +
    'flashcard progress, and all other settings (Anki, TTS/STT, PDF, backup schedule).\n\n' +
    'Export a backup first if you might want anything back — this cannot be undone.'
  );
  if (!ok) return;
  Promise.all([
    new Promise(resolve => chrome.storage.sync.clear(() => resolve())),
    new Promise(resolve => chrome.storage.local.clear(() => resolve()))
  ]).then(() => {
    // Fresh state: reload so every loader re-runs against empty storage
    location.reload();
  });
}

// --- SUPPORT & DIAGNOSTIC HELPERS ---
function loadSupportDiagnosticInfo() {
  const manifest = chrome.runtime.getManifest();
  const version = manifest?.version || '8.0';
  const diagExtVer = document.getElementById('diag-ext-version');
  if (diagExtVer) diagExtVer.textContent = `v${version}`;

  // Browser detection
  const ua = navigator.userAgent;
  let browserStr = 'Chrome';
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/([\d.]+)/);
    browserStr = match ? `Edge ${match[1].split('.')[0]}` : 'Microsoft Edge';
  } else if (ua.includes('Brave/')) {
    browserStr = 'Brave';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browserStr = 'Opera';
  } else {
    const match = ua.match(/Chrome\/([\d.]+)/);
    browserStr = match ? `Chrome ${match[1].split('.')[0]}` : 'Chromium';
  }
  const diagBrowser = document.getElementById('diag-browser-version');
  if (diagBrowser) diagBrowser.textContent = browserStr;

  // OS detection
  let osStr = 'Unknown OS';
  if (ua.includes('Win')) osStr = 'Windows';
  else if (ua.includes('Mac')) osStr = 'macOS';
  else if (ua.includes('Linux')) osStr = 'Linux';
  else if (ua.includes('CrOS')) osStr = 'ChromeOS';
  const diagOs = document.getElementById('diag-os-platform');
  if (diagOs) diagOs.textContent = osStr;

  // Active Model & Setup Status
  chrome.storage.sync.get(['models', 'defaultModelId', 'tavilyApiKey'], (data) => {
    const models = data.models || [];
    const defaultModelId = data.defaultModelId;
    const activeModel = models.find(m => m.id === defaultModelId) || (models.length > 0 ? models[0] : null);

    const diagModel = document.getElementById('diag-active-model');
    const diagStatus = document.getElementById('diag-setup-status');

    if (activeModel) {
      if (diagModel) diagModel.textContent = activeModel.name || activeModel.modelName;
      if (diagStatus) {
        diagStatus.innerHTML = `Configured ${optIcon('check')}`;
        diagStatus.style.color = 'var(--secondary-color)';
      }
    } else {
      if (diagModel) diagModel.textContent = 'None';
      if (diagStatus) {
        diagStatus.innerHTML = `Needs Setup ${optIcon('alertTriangle')}`;
        diagStatus.style.color = '#F59E0B';
      }
    }
  });
}

function copyDiagnosticInfo() {
  const manifest = chrome.runtime.getManifest();
  const version = manifest?.version || '8.0';
  const browser = document.getElementById('diag-browser-version')?.textContent || 'Chrome';
  const os = document.getElementById('diag-os-platform')?.textContent || 'Windows';
  const model = document.getElementById('diag-active-model')?.textContent || 'None';
  const status = document.getElementById('diag-setup-status')?.textContent || 'Unknown';

  chrome.storage.sync.get(['models', 'defaultModelId', 'tavilyApiKey'], (data) => {
    const models = data.models || [];
    const activeModel = models.find(m => m.id === data.defaultModelId) || (models.length > 0 ? models[0] : null);
    let endpointHost = 'None';
    if (activeModel?.endpointUrl) {
      try {
        endpointHost = new URL(activeModel.endpointUrl).hostname;
      } catch (e) {
        endpointHost = 'Invalid URL';
      }
    }

    const diagText = [
      '### Infopedia Diagnostic Information',
      `- **Extension Version:** v${version}`,
      `- **Browser:** ${browser}`,
      `- **Operating System:** ${os}`,
      `- **Configured Model:** ${model}`,
      `- **Endpoint Host:** ${endpointHost}`,
      `- **Search Grounding:** ${activeModel?.enableSearchGrounding ? 'Enabled' : 'Disabled'}`,
      `- **Status:** ${status}`,
      `- **Date:** ${new Date().toUTCString()}`
    ].join('\n');

    navigator.clipboard.writeText(diagText).then(() => {
      const copyStatus = document.getElementById('copy-diag-status');
      if (copyStatus) {
        copyStatus.innerHTML = `${optIcon('check')} Diagnostic info copied to clipboard! You can paste it into an email or issue.`;
        setTimeout(() => { copyStatus.textContent = ''; }, 4000);
      }
    }).catch((err) => {
      console.error('Failed to copy diagnostics:', err);
      prompt('Could not copy automatically. You can copy the diagnostic info below:', diagText);
    });
  });
}
