// Pre-paint theme bootstrap for the PDF viewer.
//
// chrome.storage is async, so the theme used to land only after
// loadStorageData() resolved in custom-viewer.js — every dark-mode user
// watched the page paint with the CSS light defaults first, then flip.
// This classic (parser-blocking) script runs before any viewer markup is
// parsed, hence before first paint, and applies the class from
// localStorage mirrors that custom-viewer.js keeps fresh at every point
// the theme is applied or changed. chrome.storage remains the source of
// truth: the async read still runs and corrects a stale mirror moments
// later. Resolution order mirrors loadStorageData exactly: per-document
// override first, then the global uiTheme ('dark' default; 'auto' via
// prefers-color-scheme).
//
// An external file because MV3's extension-page CSP (script-src 'self')
// blocks inline <script> blocks.
(function () {
    try {
        // Non-extension test contexts have no chrome.storage and never
        // themed themselves before (loadStorageData resolves without
        // applying); keep that always-light behavior instead of
        // inventing state from a mirror nothing maintains there.
        if (typeof chrome === 'undefined' || !chrome || !chrome.storage) return;

        // Must match custom-viewer.js's derivation: the query param
        // verbatim, no substituted fallback — with no ?file= both sides
        // coerce null into the same literal '_null' key suffix.
        const fileUrl = new URLSearchParams(window.location.search).get('file');

        const override = localStorage.getItem('pdf_dark_mode_' + fileUrl);
        let isDark;
        if (override !== null) {
            isDark = override === '1';
        } else {
            // Same key options.js mirrors its global uiTheme into; both
            // pages share this origin, so one entry serves both.
            const theme = localStorage.getItem('uiTheme') || 'dark';
            if (theme === 'light') {
                isDark = false;
            } else if (theme === 'auto') {
                isDark = !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
            } else {
                isDark = true;
            }
        }
        if (isDark) document.body.classList.add('dark-mode');
    } catch (e) {
        // Mirror unreadable/unavailable: fall through to the async path,
        // which themes the page as before this bootstrap existed.
    }
})();
