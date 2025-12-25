# AI Popup Infopedia

A powerful browser extension to get instant AI explanations for any word or phrase you select. Features include multiple AI models, custom prompts, organized word lists, Anki integration, and a built-in spaced repetition flashcard system.
<img width="1913" height="941" alt="image" src="https://github.com/user-attachments/assets/4c38a842-cf08-412a-8abc-0a8fda526b19" />
<img width="1921" height="935" alt="image" src="https://github.com/user-attachments/assets/29bc794d-2881-4d09-8a6e-134a6a786d08" />

---

## � Features

### ⚡ Core Features
- **Instant Definitions:** Select 1-6 words on any webpage to get a concise, AI-powered explanation in a clean popup
- **Multiple AI Models:** Configure and switch between multiple AI backends (Ollama, Gemini, OpenAI, etc.)
- **Custom Prompts:** Create multiple prompts for different use cases (e.g., "Explain like I'm 5", "Translate to Hindi")
- **Source Tracking:** Automatically saves the URL and page title where each word was looked up

### 📚 History & Lists
- **Organized Lists:** Create custom lists to categorize your saved words
- **Full Editing:** Edit words, definitions, and move items between lists
- **Search & Filter:** 
  - Search by word or definition content
  - Filter by date (Today, This Week, This Month)
  - Favorites filter to show starred items only
- **Favorites:** Star important definitions for quick access
- **Bulk Actions:** Select multiple items to delete, move, or export at once

### 📤 Import & Export
- **CSV Export:** Export single lists or all history to CSV
- **CSV Import:** Import CSV files with automatic list creation
- **Settings Backup:** Export/import all models and prompts as JSON
- **Backup Reminders:** Set daily/weekly reminders to backup your data

### 🎴 Flashcards (Spaced Repetition)
Built-in flashcard system with spaced repetition for effective learning:

| Rating | Effect | Next Review |
|--------|--------|-------------|
| **Again** | Forgot the word | 1 minute |
| **Hard** | Struggled to recall | Interval × 0.8 |
| **Good** | Normal recall | Interval × 1.5 |
| **Easy** | Instant recall | Interval × 2.5 |

- Review all cards or filter by list
- Progress tracking during sessions
- Cards automatically scheduled based on your performance

### 🔗 Anki Integration
- Connect to Anki via Anki Connect add-on
- Configure deck, note type, and field mapping
- Export individual items or bulk export to Anki

---

## 🛠️ Installation & Configuration

### 1. Installation (from Source)

1. Download this project's folder
2. Open your browser and navigate to `chrome://extensions`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the folder containing this project

### 2. Configure AI Model (Required)

1. Click the extension icon in your toolbar to open **Settings**
2. Click the **+** button to add a new model:
   - **Configuration Name:** A friendly name (e.g., "Gemini Flash")
   - **Endpoint URL:**
     - *Google Gemini:* `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
     - *Ollama (local):* `http://localhost:11434/v1/chat/completions`
   - **Model Name:** `gemini-2.0-flash`, `llama3`, `mistral`, etc.
   - **API Key:** Your API key (if required)
3. Click **Save Model**

### 3. Create Custom Prompts (Optional)

1. Go to the **Prompts** tab
2. Add prompts like:
   - `Explain {word} in simple terms for a beginner`
   - `Give me the etymology and usage examples for {word}`
   - `Translate {word} to Spanish with pronunciation`
3. Set your default prompt in the **Settings** tab

---

## 💡 How to Use

### Basic Usage
1. **Select Text:** Highlight 1-6 words on any webpage
2. **View Definition:** A popup appears with the AI explanation
3. **Save:** Select a list and click "Save" to store the definition

### Managing History
1. Click the extension icon → **History** tab
2. Use the **search box** to find specific words
3. Use **date filters** to narrow down results
4. Click ⭐ to **favorite** important items
5. Click **Bulk Select Mode** to select multiple items for batch operations

### Flashcard Review
1. Click the extension icon → **Flashcards** tab
2. Select a list or "All Lists"
3. Click **Start Review**
4. For each card:
   - Read the word and try to recall the definition
   - Click **Show Answer**
   - Rate your recall (Again/Hard/Good/Easy)

### Anki Integration
1. Install **Anki Connect** add-on in Anki (code: 2055492159)
2. Go to **Anki** tab in extension settings
3. Click **Test Connection / Refresh Lists**
4. Select your deck, note type, and map fields
5. Use the **A** button on any history item to export to Anki

### 🔄 Auto-Backup & Restore
1. **Auto-Backup:**
   - Go to **Backup** tab in extension settings.
   - Set frequency (e.g., Daily, Weekly).
   - (Optional) Set a subfolder name (e.g., `Infopedia-Backups`).
   - The backup file is a JSON containing your history, lists, models, and prompts.
   - **Note:** Backups are saved to your default **Downloads** directory. To skip the "Save As" prompt and save automatically, ensure "Ask where to save each file before downloading" is **OFF** in Chrome Settings.
2. **Manual Backup:** Click **Backup Now** to trigger an immediate backup (this resets the auto-backup timer).
3. **Restore:**
   - Click **Restore Backup File** in the Backup tab.
   - Select your valid JSON backup file.
   - **Warning:** This will overwrite your current data with the backup content.

---

## 💻 Technology

- **Manifest V3:** Modern Chrome extension standard
- **Vanilla JavaScript (ES6+):** Lightweight, no frameworks
- **Shadow DOM:** Popup isolated from page styles
- **Chrome Storage API:** `sync` for settings, `local` for history
- **Spaced Repetition:** SM-2 inspired algorithm for flashcards

---

## 📋 Permissions

- `storage` - Save settings and history
- `scripting` - Inject popup on webpages
- `alarms` - Backup reminder notifications

---

## 🤝 Contributing

Feel free to open issues or submit pull requests for improvements!

## 📄 License

MIT License
