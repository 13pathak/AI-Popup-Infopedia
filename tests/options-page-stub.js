// In-memory chrome.* stub for loading the real options page in a test tab:
// inject with Page.addScriptToEvaluateOnNewDocument before navigating.
// Storage lives in window.__stores (sync/local); every write is logged in
// window.__writes; uncaught page errors collect in window.__errors.
// window.__seedLocal (set by a test's own init script) seeds local storage.
'use strict';

const STUB = `
(() => {
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  window.__stores = {
    sync: {
      uiTheme: 'dark', enableHallucinationGuard: false,
      models: [{ id: 'a', name: 'Model A', endpoint: 'https://example.test/v1', modelName: 'a' }, { id: 'b', name: 'Model B', endpoint: 'https://example.test/v1', modelName: 'b' }],
      defaultModelId: 'a', verificationModelId: 'b'
    },
    local: window.__seedLocal || {}
  };
  window.__writes = [];
  const area = name => ({
    get(keys, callback) {
      const data = window.__stores[name];
      let out = {};
      if (keys == null) out = clone(data);
      else if (typeof keys === 'string') { if (keys in data) out[keys] = clone(data[keys]); }
      else if (Array.isArray(keys)) keys.forEach(k => { if (k in data) out[k] = clone(data[k]); });
      else Object.keys(keys).forEach(k => { out[k] = k in data ? clone(data[k]) : clone(keys[k]); });
      if (callback) { setTimeout(() => callback(out), 0); return; }
      return Promise.resolve(out);
    },
    set(values, callback) {
      Object.assign(window.__stores[name], clone(values));
      window.__writes.push({ area: name, keys: Object.keys(values) });
      if (callback) { setTimeout(callback, 0); return; }
      return Promise.resolve();
    },
    remove(keys, callback) {
      [].concat(keys).forEach(k => delete window.__stores[name][k]);
      if (callback) { setTimeout(callback, 0); return; }
      return Promise.resolve();
    },
    clear(callback) { window.__stores[name] = {}; if (callback) setTimeout(callback, 0); return Promise.resolve(); },
    getBytesInUse(keys, callback) { if (callback) callback(0); return Promise.resolve(0); }
  });
  window.chrome = {
    storage: { sync: area('sync'), local: area('local'), session: area('local'), onChanged: { addListener() {} } },
    runtime: {
      id: 'test', lastError: undefined,
      getManifest: () => ({ version: '0.0.0', name: 'AI Popup Infopedia' }),
      getURL: p => '/' + p,
      sendMessage(message, callback) {
        const response = message && message.type === 'getWordLists' ? { lists: [], lastUsedListId: null } : {};
        if (callback) { setTimeout(() => callback(response), 0); return; }
        return Promise.resolve(response);
      },
      onMessage: { addListener() {} }
    },
    tabs: { create() {}, query(q, callback) { if (callback) callback([]); return Promise.resolve([]); } },
    commands: { getAll(callback) { const out = [{ name: 'trigger-popup', shortcut: 'Ctrl+Shift+Y' }]; if (callback) callback(out); return Promise.resolve(out); } },
    permissions: { contains(p, callback) { if (callback) callback(true); return Promise.resolve(true); } }
  };
  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(e.message));
})();
`;

module.exports = { STUB };
