# AI Context Helper

**AI Context Helper** is a browser extension that gives you instant, AI-powered explanations for any word or concept you select on the web. Get definitions from powerful online models like Gemini or connect to your own local Ollama server for 100% offline use.

## Features

* **Contextual Popups:** Select 1 to 6 words on any webpage to instantly summon a popup with an AI-generated explanation.
* **Smart Positioning:** The popup automatically appears above or below your selection, avoiding on-screen clutter.
* **Flexible AI Backend:** The options page allows you to connect to any OpenAI-compatible API, including:
    * **Online APIs:** Such as the Google Gemini API (via a compatible endpoint).
    * **Offline Mode:** Connect to a local [Ollama](https://ollama.com/) server for complete privacy and offline functionality.
* **Custom Prompts:** Tailor the AI's responses to your needs. Use the `{word}` placeholder in the options to create any prompt you want (e.g., `"Explain {word} to a 5-year-old"` or `"Translate {word} to Spanish"`).
* **Save to History:** Like a definition? Click the "Save" button in the popup to store the word and its explanation.
* **View History:** A "History" tab in the options page lets you review all your saved definitions.
* **Clear History:** Easily clear your entire saved history with a single click.
* **Markdown Support:** Renders bold text (`**...**`) and newlines from the AI's response for better readability.
* **Isolated Styling:** Uses a Shadow DOM to ensure the popup's style never conflicts with the host website's CSS.

---

## How to Use

1.  **Select Text:** On any webpage, highlight a word or short phrase (up to 6 words).
2.  **Get Definition:** The AI helper popup will appear instantly with a "Loading..." message, which is then replaced by the AI's definition.
3.  **Save (Optional):** Click the "Save" button at the bottom of the popup to add the definition to your history.
4.  **Dismiss:** Click anywhere outside the popup (or press the `Esc` key) to close it.

---

## Configuration

To get started, you must configure your AI endpoint.

1.  Click the **AI Context Helper** icon in your Chrome toolbar to open the **Options** page.
2.  Go to the **Settings** tab.

### Option 1: Using a Local Ollama Server (Recommended for Offline Use)

This is the best option for privacy and offline access.

1.  Ensure your Ollama server is running.
2.  **Important:** You must configure your Ollama server to accept requests from the extension. On Windows, this is done by setting an environment variable:
    * **Variable name:** `OLLAMA_ORIGINS`
    * **Variable value:** `chrome-extension://*`
    * *Remember to fully quit and restart the Ollama service after setting this variable.*
3.  In the extension's **Settings** tab, enter the following:
    * **Endpoint URL:** `http://localhost:11434/v1/chat/completions`
    * **Model Name:** `gemma3:1b` (or any other model you have, like `llama3`)
    * **API Key:** (Leave this field blank)
4.  Click **"Save Settings"**.

### Option 2: Using an Online API (e.g., Google Gemini)

1.  Obtain an API key from your chosen AI provider (e.g., Google AI Studio).
2.  Find the correct OpenAI-compatible **Endpoint URL** for the service.
    * *For Google Gemini, this might look like: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`*
3.  In the extension's **Settings** tab, enter the following:
    * **Endpoint URL:** The URL from your provider.
    * **Model Name:** The model you wish to use (e.g., `gemini-2.0-flash`).
    * **API Key:** Your secret API key.
4.  Click **"Save Settings"**.

---

## View Your History

1.  Click the extension icon in your toolbar to open the **Options** page.
2.  Click the **"History"** tab.
3.  Here you will see a list of all the words and definitions you have saved.
4.  You can clear all entries by clicking the **"Clear All History"** button.

