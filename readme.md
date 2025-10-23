# 🤖 AI Context Helper

**AI Context Helper** is a lightweight Chrome extension that replaces the standard dictionary pop-up with the power of generative AI. Select a word or short phrase (1-4 words) on any webpage to get an instant, AI-powered explanation in a clean pop-up box.

This extension is built for customization, allowing you to connect to any AI chatbot that has an OpenAI-compatible API endpoint.

## Features

* **Select-to-Define**: Select 1 to 4 words on any page to trigger the pop-up.
* **Customizable AI**: Works with any OpenAI-compatible API endpoint (like Google's Gemini, or others).
* **Custom Prompts**: Don't just get a definition! Use the settings page to tell the AI *how* to respond. (e.g., "Explain {word} to a 5-year-old," or "Translate {word} to Spanish").
* **Secure Storage**: Your API key is stored securely in Chrome's local storage.
* **Smart Positioning**: The pop-up intelligently appears above your selection and stays on top of other page elements.

## How to Use

1.  **Select Text**: On any webpage, use your mouse to select a word or phrase (up to 4 words).
2.  **Get Context**: The AI-powered pop-up will appear instantly with your custom-prompted response.
3.  **Click Away**: Click anywhere else on the page or press the `Esc` key to close the pop-up.

## Installation (For Development)

Since this is a custom extension, you'll need to load it in "Developer mode":

1.  Clone or download this repository (or just have your folder of files ready).
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Turn on the **"Developer mode"** toggle (usually in the top-right corner).
4.  Click the **"Load unpacked"** button.
5.  Select the entire folder where your `manifest.json` file is located.
6.  The "AI Context Helper" extension will now appear in your extensions list, ready to use!

## Configuration

Before the extension will work, you **must** configure your API settings:

1.  Click on the AI Context Helper icon in your Chrome toolbar. (If you don't see it, click the puzzle piece icon and pin it).
2.  This will open the **AI Chatbot Settings** page.
3.  Fill in the four fields:
    * **Endpoint URL**: The complete API URL for your chatbot. (e.g., `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`)
    * **Model Name**: The specific model you want to use. (e.g., `gemini-2.0-flash`)
    * **API Key**: Your secret API key.
    * **Custom Prompt**: The prompt template. Use **{word}** as a placeholder for the text you select.
        * *Example: `Explain the concept of {word} in one simple sentence.`*
4.  Click **Save**. Your settings are now saved, and the extension is active.