# AI Popup Infopedia

A simple browser extension to get instant AI explanations for any word or phrase (1-6 words) you select. Save your favorite definitions, edit them, and even import or export your entire history.

---

## 🚀 Features

* ⚡ **Instant Definitions:** Select 1-6 words on any webpage to get a concise, AI-powered explanation in a clean popup.
* ⚙️ **Custom AI Backend:** Configure the extension to use any OpenAI-compatible endpoint. Perfect for local models via **Ollama**, **LM Studio**, or cloud services like **Google's Gemini**.
* 📝 **Save for Later:** Click the "Save" button on any definition to add it to your personal history list.
* 🎨 **Custom Prompts:** Tailor the AI's responses from the options page. (e.g., "Explain {word} like I'm five" or "Translate {word} to Hindi").
* 📚 **Full-Featured History Page:**
    * **View & Edit:** See your full history. Click any word or definition to edit it directly in-place.
    * **Delete:** Remove individual items or clear the entire list with a single click.
    * **Export:** Download your complete history (including your edits) as a `.csv` file for backup or use in other apps.
    * **Import:** Upload a `.csv` file to merge with your existing history. The importer is robust and automatically handles:
        * Newline characters inside definitions.
        * Non-UTF-8 character encodings (like `windows-1252` from Excel).
        * Missing timestamps (it generates new ones).
* ⏰ **Backup Reminder:** Set a daily or weekly reminder to backup your history so you never lose your saved words.


---

## 🛠️ Installation & Configuration

This extension requires you to provide your own AI endpoint.

### 1. Installation (from Source)

1.  Download this project's folder.
2.  Open your browser and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** (usually a toggle in the top-right corner).
4.  Click the **"Load unpacked"** button.
5.  Select the folder containing this project (the one with `manifest.json` inside).

### 2. Configuration (Required)

1.  Click the "AI Popup Infopedia" icon in your browser's toolbar. This will open the **Settings** page.
2.  Fill in the "Settings" tab:
    * **Endpoint URL:** The API URL for your AI service.
        * *Ollama (local):* `http://localhost:11434/v1/chat/completions`
        * *Google AI (Gemini):* `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
    * **Model Name:** The exact model you want to use.
        * *Ollama (local):* `llama3`, `mistral`, etc.
        * *Google AI (Gemini):* `gemini-2.0-flash`
    * **API Key (Optional):** Your API key, if required by your service (like Google AI).
    * **Custom Prompt (Optional):** The default is `Explain the following word or concept in a concise paragraph: {word}`. You can change this, but **must** include `{word}`.
3.  Click **"Save Settings"**. You are now ready to use the extension!

---

## 💡 How to Use

1.  **Highlight:** On any webpage, select a short piece of text (1-6 words).
2.  **Read:** The AI popup will appear with the definition.
3.  **Save:** Click "Save" to add the item to your history.
4.  **Manage:** Click the extension icon in your toolbar to visit the "History" tab to view, edit, or manage your saved items.

---

## 💻 Technology

* **Manifest V3:** The modern standard for Chrome extensions.
* **Vanilla JavaScript (ES6+):** No frameworks for a lightweight and fast experience.
* **Shadow DOM:** The popup is injected into a Shadow DOM to prevent website styles from breaking it (and vice-versa).
* **HTML5 & CSS3:** For the popup and options page.
* **`chrome.storage` API:** Uses `storage.sync` for settings and `storage.local` for history.

---

## 📷 Screenshots 

<img width="1921" height="935" alt="image" src="https://github.com/user-attachments/assets/64493c4b-5b86-444e-bb49-b98795c78514" />
<img width="1921" height="938" alt="image" src="https://github.com/user-attachments/assets/ea8769cd-1932-469c-8b21-56cb6f97e017" />
<img width="1921" height="942" alt="image" src="https://github.com/user-attachments/assets/2c828560-148e-48d1-8f67-8e293b88c3c8" />
<img width="1921" height="942" alt="image" src="https://github.com/user-attachments/assets/18b8b5b2-601e-4c70-af68-8fc926f956d9" />
<img width="1921" height="937" alt="image" src="https://github.com/user-attachments/assets/edafe386-bcef-4735-bd4a-c7d4a9fde18d" />
<img width="1921" height="933" alt="image" src="https://github.com/user-attachments/assets/c4cd1379-3834-4909-9862-9e030c8e1d70" />
