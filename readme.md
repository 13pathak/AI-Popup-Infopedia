# AI Popup Infopedia

A powerful browser extension to get instant AI explanations for any word or phrase you select. Features include multiple AI models, custom prompts, organized word lists, Anki integration, a built-in spaced repetition flashcard system, Speech-to-Text dictation, and built-in PDF support.

<img width="1913" height="941" alt="image" src="https://github.com/user-attachments/assets/4c38a842-cf08-412a-8abc-0a8fda526b19" />
<img width="1921" height="935" alt="image" src="https://github.com/user-attachments/assets/29bc794d-2881-4d09-8a6e-134a6a786d08" />

---

## ✨ Features

### ⚡ Core Features
- **Instant Definitions:** Select 1-6 words on any webpage to get a concise, AI-powered explanation in a clean popup.
- **Conversational Hotkey:** Press `Ctrl+Shift+Y` (customizable) to instantly open an empty conversational AI popup and ask any question, or trigger the AI on your current text selection.
- **Multiple AI Models:** Configure and switch between multiple AI backends (Ollama, Gemini API, OpenAI, etc.).
- **Speech-to-Text Dictation:** Use API-based Speech-to-Text to quickly dictate follow-up questions instead of typing.
- **Local & Online PDF Viewer:** Comes with a custom PDF.js viewer. Seamlessly reads and intercepts online PDFs (like Arxiv papers) so you can highlight text and get AI explanations right on the PDF.
- **Custom Prompts:** Create multiple prompts for different use cases (e.g., "Explain like I'm 5", "Translate to Hindi").
- **Source Tracking:** Automatically saves the URL and page title where each word was looked up.

### 📚 History & Lists
- **Organized Lists:** Create custom lists to categorize your saved words.
- **Full Editing:** Edit words, definitions, and move items between lists.
- **Search & Filter:** 
  - Search by word or definition content
  - Filter by date (Today, This Week, This Month)
  - Favorites filter to show starred items only
- **Bulk Actions:** Select multiple items to delete, move, or export at once.

### 📤 Import & Export & Backups
- **Auto-Backup:** Set daily or weekly background backups to safely store your JSON data.
- **CSV Export & Import:** Export single lists or all history to CSV, and import with automatic list creation.
- **Settings Backup:** Export/import all models and prompts as JSON.

### 🎴 Flashcards (Spaced Repetition)
Built-in flashcard system with spaced repetition for effective learning:

| Rating | Effect | Next Review |
|--------|--------|-------------|
| **Again** | Forgot the word | 1 minute |
| **Hard** | Struggled to recall | Interval × 0.8 |
| **Good** | Normal recall | Interval × 1.5 |
| **Easy** | Instant recall | Interval × 2.5 |

- Review all cards or filter by list.
- Progress tracking during sessions.
- Cards automatically scheduled based on your performance.

### 🔗 Anki Integration
- Connect to Anki via Anki Connect add-on.
- Configure deck, note type, and field mapping.
- Export individual items or bulk export to Anki.

---

## 🛠️ Installation & Configuration

### 1. Installation (from Source)

1. Download this project's folder.
2. Open your browser and navigate to `chrome://extensions`.
3. Enable **"Developer mode"** (toggle in top-right corner).
4. Click **"Load unpacked"** and select the folder containing this project.

### 2. Configure AI Model (Required)

1. Click the extension icon in your toolbar to open **Settings**.
2. Click the **+** button to add a new model:
   - **Configuration Name:** A friendly name (e.g., "Gemini Flash").
   - **Endpoint URL:**
     - *Google Gemini:* `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
     - *Ollama (local):* `http://localhost:11434/v1/chat/completions`
   - **Model Name:** `gemini-2.0-flash`, `llama3`, `mistral`, etc.
   - **API Key:** Your API key (if required).
3. Click **Save Model**.

### 3. Speech-to-Text Setup (Optional)
1. Navigate to the **Speech-to-Text** tab in settings.
2. Enter your API credentials to enable voice dictation inside the AI popup for quick conversational queries.

---

## 💡 How to Use

### Basic Usage
1. **Select Text:** Highlight 1-6 words on any webpage or PDF.
2. **View Definition:** A popup appears with the AI explanation.
3. **Keyboard Shortcut:** Press `Ctrl+Shift+Y` (or your configured shortcut) anywhere to manually trigger the popup. If no text is selected, an empty AI chat interface will open!
4. **Save:** Select a list and click "Save" to store the definition.

### Managing History & Flashcard Review
1. Click the extension icon to view your **History** and **Flashcards** tabs.
2. Search, filter, bulk-select items, or click **Start Review** to study via spaced repetition.
3. To send an item to Anki, make sure the Anki Connect add-on (code: `2055492159`) is installed and running, then click the **A** button.

---

## 💻 Technology

- **Manifest V3:** Modern Chrome extension standard.
- **Vanilla JavaScript (ES6+):** Lightweight, no frameworks.
- **PDF.js:** Integrated robust viewer for PDF compatibility.
- **Shadow DOM:** Popup isolated from page styles.
- **Chrome Storage API:** `sync` for settings, `local` for history.
- **Spaced Repetition:** SM-2 inspired algorithm for flashcards.

---

## 🤝 Contributing & License
Feel free to open issues or submit pull requests for improvements!
Licensed under the MIT License.
