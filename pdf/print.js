// Receives printable HTML handed over through chrome.storage.session by
// openPrintTab() in the background service worker: MV3 service workers
// cannot create blob: URLs, and a data: URL both sits on Chrome's
// top-frame-navigation deprecation path and caps the document at ~2MB.
//
// The payload is merged node-by-node (never via script execution), so any
// <script> tags inside it stay inert (extension-page CSP would block them
// anyway). The payload still carries an auto-print script for the legacy
// data:-URL fallback, where it runs as a real document; here it never
// executes — this page drives window.print() itself after the merge.
const params = new URLSearchParams(window.location.search);

function showNotice(text) {
  document.title = 'Print';
  const p = document.createElement('p');
  p.style.fontFamily = 'sans-serif';
  p.style.color = '#666';
  p.textContent = text;
  document.body.replaceChildren(p);
}

const failureReason = params.get('error');
if (failureReason) {
  // Reached only when every transport in openPrintTab() failed; replaces
  // the previous behavior of dying with no feedback at all.
  const explanations = {
    'too-large': 'This conversation is too large to prepare for printing. Try printing directly from the page instead.',
    'storage': 'The transcript could not be staged for printing (the browser refused temporary storage). Please try again.',
    'tab': 'The print window failed to open correctly. Please try again.'
  };
  showNotice(explanations[failureReason] || 'Printing failed unexpectedly. Please try again.');
} else {
  const key = params.get('k');

  if (key) {
    chrome.storage.session.get([key], (data) => {
      const html = data && data[key];
      // One-shot: drop the payload so a stale link never reprints it.
      chrome.storage.session.remove(key);
      if (typeof html !== 'string' || html.length === 0) {
        showNotice('Nothing to print (content expired).');
        return;
      }
      // Parse as a full document, then adopt head/body children into THIS
      // document's real elements. The old approach assigned the whole
      // payload to document.documentElement.innerHTML, which flattens
      // <head> and <body> away (the fragment parser ignores those start
      // tags here): <title> ended up stranded outside <head>,
      // document.title stopped updating reliably, document.body became
      // null, and any body-targeting CSS in the payload silently no-op'd.
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      if (parsed.title) document.title = parsed.title;
      // replaceChildren adopts the foreign-document nodes automatically;
      // parser-created scripts stay inert exactly as with innerHTML.
      document.head.replaceChildren(...parsed.head.childNodes);
      document.body.replaceChildren(...parsed.body.childNodes);
      window.print();
    });
  } else {
    showNotice('Nothing to print.');
  }
}
