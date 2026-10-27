# AI Popup Infopedia

A powerful browser extension to get instant AI explanations for any word or phrase you select. Features include multiple AI models, custom prompts, organized word lists, Anki integration, a built-in spaced repetition flashcard system, Speech-to-Text dictation, and built-in PDF support.

#### Main Popup
<img width="1888" height="908" alt="1" src="https://github.com/user-attachments/assets/2b781f8f-f5df-4784-b175-39734c9edd47" />


#### Settings Menu
<img width="1892" height="921" alt="image" src="https://github.com/user-attachments/assets/fc9ffbdf-a505-4674-85cd-ef7d7ca61f0d" />


#### Hallucination Guard (Works only when AI bot used its trained data, not real time grounded data)
A second model checks each answer. A clean result is a small **Verified** badge under the answer (click it for who checked and why); only **Possible errors found** opens a red box, with the suggested corrections first.

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
- **Google Docs & Slides:** Selecting text in Google Docs or Slides shows the Ask AI and Clip buttons, and the hotkey looks up the selection, even though these editors draw text on a canvas instead of the page. The selection is read without touching your clipboard.
- **Conversational Hotkey:** Press `Ctrl+Shift+Y` (customizable) to instantly open an empty conversational AI popup and ask any question, or trigger the AI on your current text selection.
- **Conversation & Draft Recovery:** Unfinished questions survive dismissal during the same browser session, even before the first AI answer. Press the conversational hotkey with no text selected to resume the draft automatically, focused with the cursor at the end. Follow-up drafts also restore their conversation; submitting or erasing the question clears the saved draft. Completed conversations remain available through “Open last conversation.”
- **Multiple AI Models:** Configure and switch between multiple AI backends (Ollama, Gemini API, OpenAI, etc.).
- **Speech-to-Text Dictation:** Use API-based Speech-to-Text to quickly dictate follow-up questions instead of typing.
- **Direct Pronunciation & IPA Badge:** An inline speaker right next to the looked-up word reads just the word or short phrase itself (up to 3 words, e.g. "Silicon Valley", not the whole definition), and a standard IPA transcription (e.g. ɪˈfem.ər.əl) is fetched automatically for term lookups — a dictionary affordance for language learners and test prep.
- **Quick Follow-up Chips:** One-click pill buttons rendered inside the answer card, right after the latest answer — your own customizable set (e.g. 💡 Simpler, 📝 2 Examples, 🏛️ Etymology) plus up to 3 contextual suggestions the answering model appends to its own reply. The suggestions ride the same request (zero extra API calls) and refresh after every answer; models that skip them simply show your static chips. Both kinds are managed under Options → Follow-up Settings. When the chips don't all fit in their row, a small dot per chip appears beneath them (filled for the chips in view); click a dot to jump straight to that chip instead of scrolling sideways.
- **Local & Online PDF Viewer:** Comes with a custom PDF.js viewer. Seamlessly reads and intercepts online PDFs (like Arxiv papers) so you can highlight text and get AI explanations right on the PDF. `#page=N` deep links (and named destinations) in PDF URLs are honored, jumping straight to the linked page after load — and re-applied live when the fragment is edited while the viewer is already open. Each document also remembers its zoom level and exact reading position, so reopening a PDF resumes precisely where you left off (a deep link still takes precedence when present).
- **Annotation Portability Across URLs:** PDF highlights, notes and bookmarks are matched by document fingerprint, so the same file opened at a different address (http→https, added query params, moved domain) is detected and offered a one-click merge into a single set.
- **Embedded PDF Annotation Recovery:** Opening an annotated PDF with missing or empty local annotation storage restores embedded highlights, underlines, strikethroughs, colors, and attached comments into the viewer and Comments sidebar. Recovered marks support normal editing, deletion, undo/redo, and saving. Existing local edits take precedence, and intentional deletion of all marks is remembered for that embedded annotation set. Saving preserves unsupported or unreadable annotation types; it stops if recovery failed. Password-protected PDFs can recover annotations after unlocking, but PDF saving retains the existing encryption limitation.
- **PDF Annotation Filters:** In the Comments sidebar, select one or more annotation colors and search highlighted text or notes. Both filters combine with “Current page,” show matching/total counts, and can be reset with “Clear filters.” Filters stay local to the current viewer session.
- **PDF Focus Mode:** Click Focus in the side rail, or press `F` outside a text field, to give the document the full reading area. Floating controls reveal the toolbar and panels when needed; `Esc` exits. Existing panel state and reading position are preserved, and fit modes adapt to the available space.
- **PDF Search Results:** Press `Ctrl+F` / `Cmd+F`, enter a phrase, and press Enter for a sidebar of page numbers and highlighted context snippets. Click a result to jump to the passage, or press Arrow Down from Find and Enter to choose with the keyboard. Large searches show 100 results at a time; selecting a result on a narrow screen or in Focus mode returns to the document.
- **Custom Prompts:** Create multiple prompts for different use cases (e.g., "Explain like I'm 5", "Translate to Hindi").
- **Custom Selection Buttons & Icon Toolbar:** In Settings → Prompts, give a prompt a short name (e.g., "Check Grammar"), write instructions using `{word}` for the selected text, assign an optional emoji or SVG icon (e.g., ✍️), and enable **Show as a selection popup button**. It appears beside Ask AI and Clip. You can also configure the Ask AI button to display as an SVG or emoji icon for a sleek, compact selection toolbar. Toggle saved prompts on or off without deleting them, and drag them to change the button order.
- **Source Tracking:** Automatically saves the URL and page title where each word was looked up.
- **Saved Word Recognition:** Repeat lookups show the saved list and relative age beneath the answer. Expand the badge to view the previous definition, notes, and captured sentence; update that meaning while keeping its list and review progress; or save another meaning in the toolbar's selected list. Matches ignore case, extra whitespace, and Unicode presentation differences, and work across pages and browser sessions.

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

The default FSRS model uses global baseline parameters fitted on millions of reviews across diverse learners. The optimizer needs at least **200 multi-day reviews** (reviews a day or more after the card's previous one; ~1,000+ recommended), and it only switches you to personalized parameters when they predict your reviews measurably better than the defaults.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FSRS Memory Model & 1-Click Optimizer            [ Personalized (Active) ] │
│  428 multi-day recall points (1,120 total reviews)                          │
│                                                                             │
│  [ ✨ Optimize Memory Model ]   [ Reset to Defaults ]   [ View Parameters ]  │
│                                                                             │
│  📉 Held-out error reduction: 3.1%  •  📊 Log Loss: 0.4120 → 0.3992         │
└─────────────────────────────────────────────────────────────────────────────┘
```

* **Zero-Setup Client-Side Machine Learning:** Runs entirely inside your browser via a dedicated Web Worker (`fsrs-optimizer.worker.js`). No Python, no CLI scripts, no Jupyter notebooks, and no external servers required.
* **Adam Optimization Engine:** Uses a multi-epoch Adam gradient descent optimizer with central difference numerical gradients to fit all **21 FSRS-6 parameters ($W_0$–$W_{20}$)** against your personal review history.
* **Loss Metrics:** Minimizes binary cross-entropy Log Loss and Root Mean Square Error (RMSE) against your actual recall outcomes.
* **Held-Out Check:** Every 5th card is held out of training. The fitted parameters are kept only if they predict those cards' reviews better than the defaults by at least two standard errors (compared card by card); otherwise the default model stays active. The error reduction shown is measured on the held-out reviews, not the ones the parameters were fitted to. Only cards whose review log starts at their first review are used, so cards carried over from the old scheduler don't skew the fit.
* **Parameter Projection:** Weights are clamped to fixed ranges and keep the initial stabilities ordered ($W_0 \le W_1 \le W_2 \le W_3$).
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

1. Click the extension icon in your toolbar and choose **Settings & Usage** to open the settings page.
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
1. Click the extension icon and choose **Review flashcards** (the button shows how many cards are due) to jump straight to the **Flashcards** tab; your saved words live under **Saved Words**.
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
