// Receives printable HTML handed over through chrome.storage.session by
// openPrintTab() in the background service worker: MV3 service workers
// cannot create blob: URLs, and a data: URL both sits on Chrome's
// top-frame-navigation deprecation path and caps the document at ~2MB.
//
// The payload is assigned via innerHTML, so any <script> tags inside it
// stay inert (extension-page CSP would block them anyway) — this page
// drives window.print() itself, replacing the payload's old auto-print.
const params = new URLSearchParams(window.location.search);
const key = params.get('k');

if (key) {
  chrome.storage.session.get([key], (data) => {
    const html = data && data[key];
    // One-shot: drop the payload so a stale link never reprints it.
    chrome.storage.session.remove(key);
    if (typeof html !== 'string' || html.length === 0) {
      document.body.textContent = 'Nothing to print (content expired).';
      return;
    }
    document.documentElement.innerHTML = html;
    window.print();
  });
} else {
  document.body.textContent = 'Nothing to print.';
}
