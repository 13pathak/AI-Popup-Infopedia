# Privacy Policy for AI Popup Infopedia

**Effective Date:** 18/08/2026  
**Developer:** Ram Krishan Pathak  
**Contact:** 13pathak@gmail.com  

This Privacy Policy describes how the AI Popup Infopedia browser extension ("the Extension") handles information when you use it. AI Popup Infopedia is a client-side tool: it operates entirely inside your browser, and its developer operates **no servers, collects no data on any central server, uses no analytics, no tracking, and no advertising**. All processing and storage happen on your device, in your browser's own storage, or is sent directly by your browser to AI providers that **you personally configure**.

---

## 1. Information We Collect and How We Use It

### 1.1 Selected Text
When you select text on a web page (in the page or any embedded frame) and trigger the Extension, the selected text — and, if you ask follow-up questions, your conversation history with the Extension — is sent **directly from your browser** to the AI provider you configured (for example Google Gemini, OpenAI, a local server such as Ollama, or any custom endpoint), together with the custom prompt you selected. This is used solely to generate the explanation, definition, translation, or summary displayed in the popup.

### 1.2 Custom Prompts and Settings
Prompts, instructions, and follow-up messages you create are stored on your device (see Section 2) and included in requests to your chosen AI provider.

### 1.3 Web Search Grounding (optional)
If you enable search grounding and configure a Tavily API key, your selected text (as a search query) is sent **directly to Tavily's API** (`api.tavily.com`) to retrieve live web results, which are then passed to your AI provider along with your question. Search result titles and URLs may be displayed in the popup and saved with your item if you choose to save it.

### 1.4 Hallucination Verification (optional)
If you enable the Hallucination Guard, the prompt and the AI's answer are sent to the verification AI provider you designated, to check the answer for factual errors.

### 1.5 Voice Input and Audio (optional)
If you use the microphone button:
* **Native engine:** Audio is processed by your browser's built-in speech recognition service (in Chrome this service is provided by Google and may transmit audio to Google's speech servers).
* **API engine:** Your recorded audio is uploaded **directly from your browser** to the transcription API endpoint you configured (for example OpenAI Whisper, Sarvam, or a self-hosted server), together with your API key.
Audio is used only to transcribe your speech into the follow-up input box. Recordings are held in memory only until transcription completes and are not stored by the Extension.

### 1.6 Text-to-Speech (optional)
The "Listen" feature uses your browser's built-in text-to-speech engine to read an answer aloud. No audio data is sent anywhere by the Extension.

### 1.7 Saved Study Items and Usage Metadata
If you save a lookup, the Extension stores: the word or question, the AI answer, citations, the model and prompt name used, the date and time, and the **URL and title of the page** you were reading. Word lists, favorites, and spaced-repetition review progress are also stored. This stays on your device (and your synced Chrome profile — see Section 2) and is never sent to the developer.

### 1.8 PDF Viewing, Highlights, and Annotations (optional)
To provide its built-in PDF reader, the Extension checks navigation and response headers to detect when a page is a PDF, and opens the file in its own viewer. The URLs of PDFs you open are processed transiently for this purpose. Your highlights, notes, bookmarks, and last-read page are saved **locally on your device, per document**. Apart from this PDF-detection, the Extension does **not** monitor, log, or transmit your browsing history.

### 1.9 Credentials You Enter
API keys you enter (for AI providers, Tavily, speech-to-text) are stored in your browser's extension storage (see Section 2) and are sent **only** in the Authorization headers of requests to the corresponding provider, from your browser. They are never sent to the developer.

### 1.10 What We Do NOT Collect
* We do not collect, transmit, or store your name, email address, or other personal identifiers.
* We do not operate servers, so we cannot see your selected text, conversations, API keys, PDFs, or saved items.
* We do not use analytics, telemetry, cookies, fingerprinting, or advertising identifiers, and we do not sell, rent, or trade any data — we have none to sell.

---

## 2. Data Storage

* **On your device (`chrome.storage.local`):** Saved words, definitions, lists, favorites, flashcard progress, PDF highlights/notes/bookmarks/last-read page, and preferences. This data never leaves your device except in the ways described in Sections 1 and 3.
* **In your synced Chrome profile (`chrome.storage.sync`):** Model configurations (including their API keys), custom prompts, and settings. This data is synced through **your own Google account** via Chrome's built-in sync feature and is stored on Google's infrastructure under Google's own privacy terms — the developer has no access to it.
* **Backup files:** When you export or when an automatic backup runs (only if you enable scheduled backups), a JSON file containing your history, lists, settings, **and API keys in plain text** is downloaded to your computer's Downloads folder. These files are entirely under your control; treat them as sensitive and delete them when no longer needed.
* **Deletion:** Uninstalling the Extension removes all local and synced extension data from your browser. Downloaded backup/export files must be deleted manually by you.

---

## 3. Data Sharing and Third Parties

The Extension shares data **only** with services you explicitly configure, sending it directly from your browser:

| Recipient | What is sent | When |
|---|---|---|
| Your chosen AI provider(s) (e.g., Google Gemini, OpenAI, Groq, Anthropic, Ollama on localhost, or any custom endpoint) | Selected text, conversation history, prompts, your API key (in the request header) | Every lookup, follow-up, redefine, or verification |
| Tavily API (`api.tavily.com`) | Your selected text as a search query, your Tavily API key | Only if search grounding is enabled |
| Your chosen speech-to-text provider (e.g., OpenAI Whisper, Sarvam) | Recorded audio, your API key | Only if you use API-mode voice input |
| Google's speech service (via Chrome) | Recorded audio | Only if you use native voice input |
| AnkiConnect (localhost only) | Words and definitions you export | Only when you use the Anki export feature |

These providers process your data under **their own privacy policies**; we encourage you to review them. We never receive, and therefore never disclose, any of this data. Choosing a fully local provider (e.g., Ollama on `localhost`) keeps AI processing entirely on your machine.

---

## 4. Data Retention and Deletion

All data is retained only inside your browser storage until **you** delete it — per item, per list, or in bulk via the Options page (History -> delete/clear, or by uninstalling the Extension). The developer retains no user data whatsoever because no data ever reaches the developer. Downloaded backup files remain on your local disk until you delete them.

---

## 5. Data Security

Data is stored in Chrome's extension storage areas, which are isolated per extension and per browser profile. Requests to AI and search providers are sent strictly over HTTPS (or to your own local server). Because API keys are included in locally stored settings and in exported/backup files in plain text, you should avoid sharing those files. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security; however, since the developer operates no servers, there is no central store of user data to breach.

---

## 6. Permissions and Why the Extension Needs Them

* **storage / unlimitedStorage** — Saving your settings, prompts, saved items, lists, and PDF annotations on your device and in your synced Chrome profile.
* **alarms** — Scheduled backup reminders and spaced-repetition notifications (only if enabled).
* **downloads** — Creating export and backup files (including annotated PDFs) that you request or that scheduled backups produce.
* **webNavigation / webRequest** — Detecting when you navigate to a PDF so the Extension can open it in its built-in viewer; and nothing else.
* **Host permissions (`<all_urls>` and specific API hosts)** — Reading text **you select** on any page (the content script must run on pages to show the popup), sending your selected text directly to your configured AI/search/speech endpoints, and loading PDFs in the viewer. The Extension reads nothing on a page beyond the selection you explicitly submit.
* **Keyboard shortcut (Ctrl+Shift+Y)** — Lets you trigger the popup; optional and remappable in Chrome's settings.

---

## 7. Chrome Web Store User Data Policy (Limited Use Compliance)

AI Popup Infopedia's use and transfer of information received from Google APIs to any other app will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the **Limited Use** requirements.

---

## 8. Your Choices and Controls

You decide, at all times: which AI provider to use (including fully offline local models); whether search grounding, hallucination verification, voice input, text-to-speech, scheduled backups, and the PDF viewer are used; what to save or delete; and whether Chrome sync carries your settings. Nothing is enabled or transmitted without your configuration and explicit action.

---

## 9. Children's Privacy

The Extension is not directed at children under 13 (or the equivalent minimum age in your jurisdiction), is intended for general audiences, and does not knowingly collect personal information from anyone, as it collects no personal information at all.

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. Updates will be posted on this page with a revised "Effective Date." Continued use of the Extension after changes constitutes acceptance of the updated policy.

---

## 11. Contact Us

If you have questions about this Privacy Policy or the Extension's data practices, contact: **13pathak@gmail.com**
