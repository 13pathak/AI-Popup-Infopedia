const addBtn = document.getElementById("addBookmarkBtn");
const viewBtn = document.getElementById("viewBookmarksBtn");
const dialog = document.getElementById("bookmarkDialog");
const closeBtn = document.getElementById("closeBookmarkDialogBtn");
const list = document.getElementById("bookmarkList");

// Fix for PDF.js toolbar button grey overlay over emojis and hide redundant editor buttons
const style = document.createElement("style");
style.textContent = `
  #addBookmarkBtn::before,
  #viewBookmarksBtn::before {
    display: none !important;
  }
  #editorHighlight,
  #editorFreeText,
  #editorInk,
  #editorHighlightParamsToolbar,
  #editorFreeTextParamsToolbar,
  #editorInkParamsToolbar {
    display: none !important;
  }
  .annotationLayer .popup {
    padding: 6px !important;
    max-width: 200px !important;
    min-width: 150px !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
    border: 1px solid rgba(128, 128, 128, 0.15) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
  }
  .annotationLayer .popup > .header {
    padding-bottom: 4px !important;
  }
  .annotationLayer .popup > .header h1 {
    font-size: 11px !important;
  }
  .annotationLayer .popupContent {
    font-size: 12px !important;
    padding: 4px !important;
  }
    /* --- ULTRA PREMIUM PDF.JS THEME --- */
  body, input, button, select, textarea, .dialog, .pdfjsCommentsPanel {
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  }
  
  :root {
    --body-bg-color: #f8fafc !important; /* Slate 50 */
    --toolbar-bg-color: rgba(255, 255, 255, 0.85) !important;
    --toolbar-border-color: rgba(0, 0, 0, 0.05) !important;
    --button-hover-color: rgba(0, 0, 0, 0.08) !important;
    --toggled-btn-bg-color: rgba(0, 0, 0, 0.12) !important;
    --dialog-bg-color: rgba(255, 255, 255, 0.95) !important;
    --sidebar-bg-color: rgba(255, 255, 255, 0.9) !important;
  }

  :root:where(.is-dark) {
    --body-bg-color: #1e1b4b !important; /* Deep Indigo-950 */
    --toolbar-bg-color: rgba(49, 46, 129, 0.85) !important; /* Indigo-900 */
    --toolbar-border-color: rgba(255, 255, 255, 0.1) !important;
    --button-hover-color: rgba(255, 255, 255, 0.15) !important;
    --toggled-btn-bg-color: rgba(255, 255, 255, 0.25) !important;
    --dialog-bg-color: rgba(49, 46, 129, 0.95) !important;
    --sidebar-bg-color: rgba(30, 27, 75, 0.9) !important; /* Indigo-950/900 blend */
  }

  body {
    background-color: var(--body-bg-color) !important;
    background-image: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, transparent 100%), radial-gradient(circle at top left, rgba(255,255,255,0.05) 0%, transparent 50%) !important;
  }

  /* --- EMOJI ICON REPLACEMENTS --- */
  .toolbarButton, .secondaryToolbarButton {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    position: relative !important;
  }
  
  .toolbarButton::before, .secondaryToolbarButton::before {
    -webkit-mask-image: none !important;
    mask-image: none !important;
    background-color: transparent !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 16px !important;
    line-height: 1 !important;
    position: static !important;
    content: " " !important; /* Fallback */
  }

  /* Hide default icons completely just in case */
  .toolbarButton::after, .secondaryToolbarButton::after {
    display: none !important;
  }
  
  /* Hide unnecessary Add Image button */
  #editorStamp {
    display: none !important;
  }

  #sidebarToggle::before { content: "🗂️" !important; }
  #viewFind::before { content: "🔍" !important; }
  #previous::before { content: "⬆️" !important; }
  #next::before { content: "⬇️" !important; }
  #zoomOut::before { content: "➖" !important; }
  #zoomIn::before { content: "➕" !important; }
  #presentationMode::before { content: "🖥️" !important; }
  #print::before, #secondaryPrint::before { content: "🖨️" !important; }
  #download::before, #secondaryDownload::before { content: "💾" !important; }
  #secondaryToolbarToggle::before { content: "⚙️" !important; }
  #commentsPanel::before { content: "💬" !important; }
  #editorStamp::before { content: "🖼️" !important; }
  #viewBookmark::before { content: "🔗" !important; }

  /* Floating Toolbar */
  .toolbar {
    margin: 12px 16px !important;
    width: calc(100% - 32px) !important;
    border-radius: 16px !important;
    background-color: var(--toolbar-bg-color) !important;
    backdrop-filter: blur(24px) saturate(200%) !important;
    -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
    border: 1px solid var(--toolbar-border-color) !important;
    height: 48px !important;
  }
  
  /* Fix viewer container positioning since toolbar is floating */
  #viewerContainer, #sidebarContainer {
    top: 72px !important; /* 48px height + 12px margin * 2 */
  }

  /* Floating Sidebar */
  #sidebarContainer {
    margin-left: 16px !important;
    margin-bottom: 16px !important;
    height: calc(100% - 88px) !important;
    border-radius: 16px !important;
    background-color: var(--sidebar-bg-color) !important;
    backdrop-filter: blur(24px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--toolbar-border-color) !important;
    overflow: hidden !important;
  }
  
  /* Make sidebar toolbar blend in */
  #toolbarSidebar {
    background-color: transparent !important;
    border-bottom: 1px solid var(--toolbar-border-color) !important;
  }

  /* Interactive Buttons */
  .toolbarButton, .secondaryToolbarButton, .dialogButton, .findbar button {
    border-radius: 8px !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    margin: 2px !important;
  }
  .toolbarButton:hover, .secondaryToolbarButton:hover {
    background-color: var(--button-hover-color) !important;
    transform: translateY(-1px) !important;
  }
  .toolbarButton:active, .secondaryToolbarButton:active {
    transform: translateY(1px) scale(0.95) !important;
  }

  /* Elevated Cards (Dialogs & Menus) */
  .dialog, .secondaryToolbar, .findbar, .pdfjsCommentsPanel, #bookmarkDialog {
    border-radius: 16px !important;
    background-color: var(--dialog-bg-color) !important;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(30px) saturate(200%) !important;
    -webkit-backdrop-filter: blur(30px) saturate(200%) !important;
    border: 1px solid var(--toolbar-border-color) !important;
    padding: 8px !important;
  }

  /* Inputs */
  .toolbarField, .dialog input, .dialog textarea {
    border-radius: 8px !important;
    border: 1px solid var(--toolbar-border-color) !important;
    background-color: rgba(255, 255, 255, 0.1) !important;
    padding: 6px 10px !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
  }
  .toolbarField:focus, .dialog input:focus {
    border-color: #6366f1 !important; /* Tailwind indigo-500 */
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3) !important;
    outline: none !important;
  }

  /* Scrollbars */
  ::-webkit-scrollbar {
    width: 6px !important;
    height: 6px !important;
  }
  ::-webkit-scrollbar-track {
    background: transparent !important;
    margin: 4px !important;
  }
  ::-webkit-scrollbar-thumb {
    background-color: rgba(128, 128, 128, 0.25) !important;
    border-radius: 10px !important;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: rgba(128, 128, 128, 0.4) !important;
  }
`;
document.head.appendChild(style);

function getPdfId() {
  const app = window.PDFViewerApplication;
  if (!app) return null;
  return app.url || (app.pdfDocument ? app.pdfDocument.fingerprint : "unknown");
}

if (addBtn && viewBtn) {
  addBtn.addEventListener("click", () => {
    const app = window.PDFViewerApplication;
    if (!app || !app.pdfDocument) {
      alert("Please wait for the PDF to load completely.");
      return;
    }
    
    const pdfId = getPdfId();
    const currentPage = app.page;
    
    chrome.storage.local.get(["pdf_bookmarks"], (result) => {
      let bookmarks = result.pdf_bookmarks || {};
      if (!bookmarks[pdfId]) {
        bookmarks[pdfId] = [];
      }
      
      // Avoid duplicates
      if (!bookmarks[pdfId].includes(currentPage)) {
        bookmarks[pdfId].push(currentPage);
        // Sort pages ascending
        bookmarks[pdfId].sort((a, b) => a - b);
        
        chrome.storage.local.set({ pdf_bookmarks: bookmarks }, () => {
          // Provide some visual feedback
          const originalText = addBtn.innerHTML;
          addBtn.innerHTML = "✅";
          setTimeout(() => { addBtn.innerHTML = originalText; }, 1000);
        });
      } else {
        // Visual feedback if already bookmarked
        const originalText = addBtn.innerHTML;
        addBtn.innerHTML = "⭐ (Already Bookmarked)";
        setTimeout(() => { addBtn.innerHTML = originalText; }, 1000);
      }
    });
  });

  viewBtn.addEventListener("click", () => {
    const app = window.PDFViewerApplication;
    if (!app || !app.pdfDocument) {
      alert("Please wait for the PDF to load completely.");
      return;
    }
    
    const pdfId = getPdfId();
    
    chrome.storage.local.get(["pdf_bookmarks"], (result) => {
      const bookmarks = result.pdf_bookmarks || {};
      const pages = bookmarks[pdfId] || [];
      
      list.innerHTML = "";
      if (pages.length === 0) {
        list.innerHTML = "<li style='padding: 8px;'>No bookmarks for this document.</li>";
      } else {
        pages.forEach((page) => {
          const li = document.createElement("li");
          li.style.padding = "8px";
          li.style.borderBottom = "1px solid #eee";
          li.style.display = "flex";
          li.style.justifyContent = "space-between";
          li.style.alignItems = "center";
          
          const text = document.createElement("span");
          text.textContent = `Page ${page}`;
          text.style.cursor = "pointer";
          text.style.textDecoration = "underline";
          text.style.color = "#0066cc";
          text.onclick = () => {
            app.page = page;
            dialog.close();
          };
          
          const removeBtn = document.createElement("button");
          removeBtn.textContent = "✖";
          removeBtn.style.cursor = "pointer";
          removeBtn.style.background = "transparent";
          removeBtn.style.border = "none";
          removeBtn.style.color = "#d9534f";
          removeBtn.title = "Remove Bookmark";
          removeBtn.onclick = (e) => {
            e.stopPropagation(); // prevent triggering the go action if overlapping
            removeBookmark(pdfId, page);
          };
          
          li.appendChild(text);
          li.appendChild(removeBtn);
          list.appendChild(li);
        });
      }
      
      dialog.showModal();
    });
  });
}

if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    dialog.close();
  });
}

function removeBookmark(docId, pageToRemove) {
  chrome.storage.local.get(["pdf_bookmarks"], (result) => {
    let bookmarks = result.pdf_bookmarks || {};
    if (bookmarks[docId]) {
      bookmarks[docId] = bookmarks[docId].filter(p => p !== pageToRemove);
      chrome.storage.local.set({ pdf_bookmarks: bookmarks }, () => {
        // Re-render list if dialog is open
        if (dialog.open && viewBtn) {
          viewBtn.click();
        }
      });
    }
  });
}

// --- Annotation (Highlight & Comment) Persistence ---
function initAnnotationPersistence() {
  document.addEventListener("documentloaded", () => {
    const app = window.PDFViewerApplication;
    if (!app || !app.pdfDocument || !app.pdfDocument.annotationStorage) return;

    const storage = app.pdfDocument.annotationStorage;
    const pdfId = getPdfId();
    if (!pdfId) return;

    // Save annotations to chrome.storage
    const saveAnnotations = () => {
      const serializable = storage.serializable;
      // serializable from PDF.js contains { map: Map, hash: string }
      if (serializable && serializable.map && serializable.map.size > 0) {
        const entries = Array.from(serializable.map.entries());
        const data = {};
        data[`pdf_annotations_${pdfId}`] = entries;
        chrome.storage.local.set(data);
      } else {
        chrome.storage.local.remove(`pdf_annotations_${pdfId}`);
      }
    };

    // Hook setValue to auto-save
    const originalSetValue = storage.setValue.bind(storage);
    storage.setValue = function (key, value) {
      originalSetValue(key, value);
      saveAnnotations();
    };

    // Hook remove to auto-save
    const originalRemove = storage.remove.bind(storage);
    storage.remove = function (key) {
      originalRemove(key);
      saveAnnotations();
    };

    // Load annotations from chrome.storage
    chrome.storage.local.get([`pdf_annotations_${pdfId}`], (result) => {
      const saved = result[`pdf_annotations_${pdfId}`];
      if (saved && Array.isArray(saved)) {
        saved.forEach(([key, val]) => {
          originalSetValue(key, val);
        });

        // If the viewer has already rendered pages, force them to refresh the annotation layer
        if (app.pdfViewer) {
          app.pdfViewer._pages.forEach(pageView => {
            if (pageView && pageView.annotationLayer) {
               pageView.annotationLayer.render();
            }
          });
        }
      }
    });
  });
}

initAnnotationPersistence();

// --- Author Name Configuration & Popup Modifier ---
// (UI moved to options.html)

// Observe DOM for popupAnnotations to override "AI Popup Infopedia" and apply author name
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1 && node.classList.contains("popup")) {
        const h1 = node.querySelector(".header h1");
        if (h1) {
          chrome.storage.local.get(['pdf_author_name'], (result) => {
             const authorName = result.pdf_author_name || "Unknown";
             if (h1.textContent === "AI Popup Infopedia" || h1.textContent === "") {
               h1.textContent = authorName;
             }
          });
        }
      } else if (node.nodeType === 1 && node.querySelector) {
        const popups = node.querySelectorAll(".popup");
        popups.forEach(popup => {
          const h1 = popup.querySelector(".header h1");
          if (h1) {
            chrome.storage.local.get(['pdf_author_name'], (result) => {
               const authorName = result.pdf_author_name || "Unknown";
               if (h1.textContent === "AI Popup Infopedia" || h1.textContent === "") {
                 h1.textContent = authorName;
               }
            });
          }
        });
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// --- Close Comments Panel on Outside Click ---
document.addEventListener("click", (e) => {
  const panel = document.querySelector(".pdfjsCommentsPanel");
  const trigger = document.getElementById("commentsPanel");
  
  if (panel && !panel.hidden) {
    // Check if the click happened outside the panel and outside the toolbar trigger button
    if (!panel.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
      // Also ignore clicks inside floating editors or popups so we don't accidentally close when interacting with a highlight
      if (!e.target.closest('.popupAnnotation') && !e.target.closest('.highlightAnnotation') && !e.target.closest('.annotationEditorLayer')) {
        panel.hidden = true;
      }
    }
  }
});
