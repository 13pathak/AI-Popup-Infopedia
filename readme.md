# AI Popup Infopedia

A powerful browser extension to get instant AI explanations for any word or phrase you select. Features include multiple AI models, custom prompts, organized word lists, Anki integration, a built-in spaced repetition flashcard system, Speech-to-Text dictation, and built-in PDF support.

#### Main Popup
<img width="1888" height="908" alt="1" src="https://github.com/user-attachments/assets/2b781f8f-f5df-4784-b175-39734c9edd47" />


#### Settings Menu
<img width="1892" height="921" alt="image" src="https://github.com/user-attachments/assets/fc9ffbdf-a505-4674-85cd-ef7d7ca61f0d" />


#### Hallucination Guard (Works only when AI bot used its trained data, not real time grounded data)
<img width="1119" height="579" alt="image" src="https://github.com/user-attachments/assets/e00681be-7473-4b5a-b7d1-179b378f7fb5" />

---
## Download From [Chrome Store]( https://chromewebstore.google.com/detail/ai-popup-infopedia/jejfdgeiihgomipkhjkbplikgkcjcpab)

## 🆕 What's New (v7.0)

### 🌐 Real-Time Web Search Grounding
AI Popup Infopedia now supports **real-time web search grounding** through native tool calling. Instead of relying solely on static training data, each configured model can now **autonomously invoke a search tool mid-inference** to fetch live results when the query demands it. If the model's parametric knowledge is sufficient, it skips the search entirely, keeping responses fast. Powered by the [Tavily Search API](https://tavily.com/).

- **Native Function Calling:** The extension injects an OpenAI-compatible `web_search` tool schema into API requests. The AI decides at inference time whether a web search is needed zero manual intervention.
- **Universal Compatibility:** Works across all OpenAI-compatible endpoints, Gemini, OpenAI, Groq, Ollama, and more.
- **Orchestrator Loop:** The background script acts as an AI orchestrator, handling multi-step tool calls (up to 3 search passes per query) with automatic forced-text fallback.
- **Groq Recovery:** If a Groq model fails to parse a follow-up tool call, the extension retries with the retrieved search results and requests a normal text answer instead of showing an error.

### 🛡️ Smart Hallucination Guard Bypass
When the primary model grounds its response with live web search results, the Hallucination Guard is **automatically bypassed**, preventing the verification model from falsely flagging accurate, real-time answers using its outdated static knowledge. A blue 🌐 **"Search Grounded"** indicator is shown instead. The guard continues to run normally for non-searched responses.

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

### 🎴 Flashcards (FSRS Spaced Repetition)
Built-in flashcard system powered by the state-of-the-art **FSRS-6 algorithm**:
- **Personalized Scheduling**: Memory stability and card difficulty dynamically adjust after every review.
- **Focused Review Mode**: Distraction-free, keyboard-driven studying (`1`=Again, `2`=Hard, `3`=Good, `4`=Easy, `Space`=Flip).
- **1-Click Memory Optimizer**: Directly personalizes all 21 FSRS parameters to your learning speed inside the browser.
- **List Filtering & Progress Tracking**: Practice all cards or filter by specific vocabulary decks with live retention analytics.

---

## 🧠 FSRS Spaced Repetition System & 1-Click Optimizer

AI Popup Infopedia replaces legacy heuristic algorithms (like SM-2) with a dependency-free, high-fidelity implementation of the **Free Spaced Repetition Scheduler (FSRS-6)**—the same modern cognitive memory model used by Anki.

### 1. How the FSRS Memory Model Works

Instead of guessing review intervals with rigid multipliers, FSRS tracks two core cognitive memory metrics for every word:

* **Stability ($S$, in days):** The time required for your probability of recalling the word to drop to **90%** (target retention). A stability of $12$ means you have a 90% chance of remembering the word 12 days after your last review.
* **Difficulty ($D$, scale 1–10):** The intrinsic cognitive hardness of the card. Difficult words ($D \to 10$) grow stability slowly; easy words ($D \to 1$) scale intervals exponentially.

#### The Power-Law Forgetting Curve
At any moment $t$ (days elapsed since last review), your recall probability (Retrievability, $R$) is calculated as:

$$R(t, S) = \left(1 + \text{FACTOR} \cdot \frac{t}{S}\right)^{\text{DECAY}}$$

Where $\text{DECAY} = -W_{20}$ and $\text{FACTOR} = \exp\left(\frac{\ln 0.9}{\text{DECAY}}\right) - 1$.

```
Probability of Recall (R)
 1.0 ┼──────────────────╮
     │                  │
 0.9 ┼──────────────────┼─────────────── Target Retention (Due Date: t = S)
     │                   ╲
 0.5 ┼                    ╲
     │                     ╰────────────────────────
 0.0 ┴──────────┬───────────────────────────────► Elapsed Days (t)
              t = S
```

### 2. Rating Buttons & Card Lifecycle

Every review adjusts the card's state through structured learning phases:

| Button | Rating | State Effect | Memory Update |
| :--- | :---: | :--- | :--- |
| **Again** | `1` | Enters **Relearning** (10m step) or resets step to 0 | Triggers lapse ($w_{11}–w_{14}$ recovery formula); increments lapse counter |
| **Hard** | `2` | Intermediate step or scheduled review | Multiplies stability with hard penalty $w_{15}$ ($\le 1.0$) and raises card difficulty |
| **Good** | `3` | Advances learning step or schedules normal review | Standard stability growth ($w_8–w_{10}$) and slight difficulty adjustment |
| **Easy** | `4` | Immediately **graduates** to Review | Applies easy bonus multiplier $w_{16}$ ($\ge 1.0$) and lowers card difficulty |

* **Learning Steps:** New cards progress through short intervals (`1m` $\to$ `10m`) before graduating into day-level review.
* **Review Logging & Telemetry:** Every rating automatically appends a snapshot to the card's `reviewLog` (timestamp, rating, state before review, elapsed days, pre-review stability, difficulty, and millisecond response duration).

---

### 3. Native 1-Click In-Browser Optimizer

The default FSRS model uses global baseline parameters fitted on millions of reviews across diverse learners. Once you accumulate **~1,000 reviews**, you can personalize the entire model to your unique brain physiology with a single click.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FSRS Memory Model & 1-Click Optimizer            [ Personalized (Active) ] │
│  428 multi-day recall points (1,120 total reviews)                          │
│                                                                             │
│  [ ✨ Optimize Memory Model ]   [ Reset to Defaults ]   [ View Parameters ]  │
│                                                                             │
│  📉 Error Reduction: 14.82%  •  📊 Log Loss: 0.3892 → 0.3315  •  ⏱ 490ms    │
└─────────────────────────────────────────────────────────────────────────────┘
```

* **Zero-Setup Client-Side Machine Learning:** Runs entirely inside your browser via a dedicated Web Worker (`fsrs-optimizer.worker.js`). No Python, no CLI scripts, no Jupyter notebooks, and no external servers required.
* **Adam Optimization Engine:** Uses a multi-epoch Adam gradient descent optimizer with central difference numerical gradients to fit all **21 FSRS-6 parameters ($W_0$–$W_{20}$)** against your personal review history.
* **Loss Metrics:** Minimizes binary cross-entropy Log Loss and Root Mean Square Error (RMSE) against your actual recall outcomes.
* **Safety Bounding & Parameter Projection:** Strict mathematical bounds prevent overfitting and guarantee monotonic stability ordering ($W_0 \le W_1 \le W_2 \le W_3$).
* **Full Parameter Transparency:** A collapsible inspector lets you view all 21 active weights, their explanations, and copy them to your clipboard as JSON.

---

### 4. Backup, Export & Cross-Device Sync

* **Automated JSON Backups:** Personalized weights (`customFsrsWeights` & metadata) are automatically backed up and restored alongside your decks and review logs.
* **CSV Export & Import:** Exports carry the complete `reviewLog` JSON column so you can migrate or backup your exact learning history without loss.
* **Privacy Toggle:** Unchecking *"Flashcard Review Progress"* in backup settings cleanly strips all review telemetry and custom weights for sharing sanitized decks.

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
- **Spaced Repetition:** FSRS-6 engine with native Web Worker parameter optimizer.

---

## 🤝 Contributing & License
Feel free to open issues or submit pull requests for improvements!
Licensed under the MIT License.
