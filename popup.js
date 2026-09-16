// Launcher popup for the toolbar icon. The single click used to have to pick
// between opening settings or burying flashcards behind tab navigation; now
// it offers both destinations side by side, plus a glanceable today-line for
// the Issue #28 usage dashboard.
//
// All data comes from the worker's getLauncherSnapshot message so the
// due-count and usage day-bucket rules stay defined in exactly one place
// (background.js). Navigation reuses the existing openOptionsTab deep link.

(function applyThemeEarly() {
  // The localStorage mirror gives a same-tick theme (the options page keeps
  // it updated); chrome.storage.sync is the source of truth when the mirror
  // is cold (e.g. a fresh profile that never opened the options page).
  try {
    const mirror = localStorage.getItem('uiTheme');
    if (mirror && mirror !== 'auto') {
      document.documentElement.setAttribute('data-theme', mirror);
    }
  } catch (e) { /* keep dark defaults */ }

  chrome.storage.sync.get({ uiTheme: 'dark' }, (data) => {
    void chrome.runtime.lastError;
    const theme = data.uiTheme || 'dark';
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  });
})();

// K/M compaction for the today-line; mirrors formatUsageCount in options.js.
function formatTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(v >= 10000000 ? 0 : 1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'K';
  return String(v);
}

function renderDueCount(count) {
  const chip = document.getElementById('due-chip');
  if (!chip) return;
  const n = Number(count) || 0;
  if (n > 0) {
    chip.textContent = `${n.toLocaleString()} due`;
    chip.classList.remove('none');
    chip.title = `${n.toLocaleString()} flashcard${n === 1 ? '' : 's'} due for review`;
  } else {
    chip.textContent = 'none due';
    chip.classList.add('none');
    chip.title = 'No flashcards due right now';
  }
}

function renderTodayUsage(today) {
  const line = document.getElementById('usage-line');
  if (!line) return;

  const calls = Number(today && today.requests) || 0;
  const tokens = Number(today && today.totalTokens) || 0;
  if (!calls && !tokens) {
    line.textContent = 'Today · no API usage yet';
    line.title = 'No lookups recorded today';
    return;
  }

  const prompt = Number(today.promptTokens) || 0;
  const completion = Number(today.completionTokens) || 0;
  line.textContent = `Today · ${calls.toLocaleString()} call${calls === 1 ? '' : 's'} · ${formatTokens(tokens)} token${tokens === 1 ? '' : 's'}`;
  line.title = `Today: ${calls.toLocaleString()} call${calls === 1 ? '' : 's'} · ${prompt.toLocaleString()} prompt + ${completion.toLocaleString()} completion tokens`;
}

document.addEventListener('DOMContentLoaded', () => {
  const versionEl = document.getElementById('popup-version');
  if (versionEl) versionEl.textContent = 'v' + chrome.runtime.getManifest().version;

  // Both buttons ride the same deep link the troubleshooting flow uses:
  // the worker stores the target tab and opens (or focuses) the options
  // page, which activates it via its activeOptionsTab handling.
  function openOptionsTab(tab) {
    chrome.runtime.sendMessage({ type: 'openOptionsTab', tab }, () => {
      void chrome.runtime.lastError;
      window.close();
    });
  }

  const reviewBtn = document.getElementById('open-review');
  if (reviewBtn) reviewBtn.addEventListener('click', () => openOptionsTab('flashcards-content'));

  const settingsBtn = document.getElementById('open-settings');
  if (settingsBtn) settingsBtn.addEventListener('click', () => openOptionsTab('settings-content'));

  chrome.runtime.sendMessage({ type: 'getLauncherSnapshot' }, (snapshot) => {
    if (chrome.runtime.lastError || !snapshot) return;
    renderDueCount(snapshot.dueCount);
    renderTodayUsage(snapshot.today);
  });
});
