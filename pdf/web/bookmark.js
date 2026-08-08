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
const authorSettingsDiv = document.createElement("div");
authorSettingsDiv.style.marginTop = "20px";
authorSettingsDiv.style.borderTop = "1px solid #ccc";
authorSettingsDiv.style.paddingTop = "10px";
authorSettingsDiv.innerHTML = `
  <label for="pdfAuthorName" style="font-size: 14px; color: #333;">Comment Author Name:</label>
  <input type="text" id="pdfAuthorName" placeholder="Unknown" style="width: 100%; margin-top: 5px; padding: 5px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
`;
if (dialog) {
  dialog.insertBefore(authorSettingsDiv, dialog.lastElementChild);
}

const authorInput = document.getElementById("pdfAuthorName");
if (authorInput) {
  chrome.storage.local.get(['pdf_author_name'], (result) => {
    if (result.pdf_author_name) {
      authorInput.value = result.pdf_author_name;
    }
  });
  authorInput.addEventListener("change", (e) => {
    chrome.storage.local.set({ pdf_author_name: e.target.value.trim() });
  });
}

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
