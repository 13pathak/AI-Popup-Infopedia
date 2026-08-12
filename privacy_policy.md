# Privacy Policy for AI Popup Infopedia

**Effective Date:** August 12, 2026

Thank you for choosing to use AI Popup Infopedia ("we", "us", "our", "the Extension"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy governs the privacy policies and practices of our Google Chrome Extension.

By installing and using the AI Popup Infopedia extension, you agree to the collection and use of information in relation to this policy.

## 1. Information Collection and Use

AI Popup Infopedia is designed to be privacy-conscious. The core functionality of the extension involves processing text you select on web pages and sending it to an AI model to generate explanations, translations, or definitions.

**Data We Process:**
*   **Selected Text:** When you trigger the extension (e.g., by selecting text and using the keyboard shortcut or context menu), the specifically selected text is captured by the extension.
*   **Custom Prompts:** Any custom instructions or prompts you create and save in the extension's Options page.

**How We Use Your Data:**
*   The selected text and your chosen prompt are temporarily processed and sent directly to the Application Programming Interface (API) of the Artificial Intelligence provider you have configured (e.g., Google Gemini, OpenAI, or a local server like Ollama). 
*   This data is strictly used to generate the response displayed in the extension's popup.

**We do NOT:**
*   Track your browsing history.
*   Read or monitor text on web pages that you have not explicitly selected and submitted to the extension.
*   Collect or store personally identifiable information (PII) such as your name, email address, or IP address.

## 2. Data Storage

*   **Local Storage:** Your preferences, settings (such as chosen AI model, Text-to-Speech settings), custom prompts, and saved flashcard/Anki lists are stored locally on your device or synced across your devices using Chrome's built-in `chrome.storage.sync` API. 
*   This data is tied to your Google Account profile in Chrome and is not stored on any external servers owned or operated by us.

## 3. Data Sharing and Third-Party Services

To provide its core AI functionality, AI Popup Infopedia acts as a bridge between your browser and third-party AI services.

*   **Third-Party AI APIs:** When you request an explanation, the extension transmits your selected text and prompt to the third-party AI provider you have selected in the settings (e.g., Google, OpenAI, etc.).
*   These third-party providers have their own Privacy Policies governing how they handle the data sent to them via their APIs. We encourage you to review the privacy policies of the specific AI provider you choose to use with this extension.
*   **No Data Selling:** We do not sell, rent, or trade any of your data to third parties under any circumstances.

## 4. Permissions Required

The extension requires the following Chrome permissions to function, which are used strictly for the stated purposes:
*   `storage`: Used to save your settings, custom prompts, and word lists locally.
*   `alarms`: Used for background tasks such as spaced-repetition flashcard reminders or backup reminders.
*   `downloads`: Used to allow you to export and download your settings, models, or flashcards as a backup file.
*   `webNavigation` & `webRequest`: Used to handle specific network requests necessary for the extension to communicate with external APIs (like Gemini or OpenAI) or local servers securely.
*   `Host Permissions`: Grants the extension the ability to read your selected text on websites (`<all_urls>`) and make network requests to the configured AI API endpoints (e.g., `https://generativelanguage.googleapis.com/`).

## 5. Security

We value your trust in providing us with your data. We ensure that API keys and configurations you enter are stored securely within Chrome's designated storage mechanisms. However, remember that no method of transmission over the internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.

## 6. Changes to This Privacy Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" at the top. You are advised to review this Privacy Policy periodically for any changes.

## 7. Contact Us

If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact the developer.
