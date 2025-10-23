// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "getAiDefinition") {
    
    // Get all our saved settings, including the new customPrompt
    chrome.storage.sync.get(['endpointUrl', 'modelName', 'apiKey', 'customPrompt'], async (items) => {
      
      const defaultPrompt = "Explain the following word or concept in a concise paragraph: {word}";
      
      // Use the saved prompt, or the default if it's somehow missing
      const promptTemplate = items.customPrompt || defaultPrompt;
      const apiKey = items.apiKey;
      const url = items.endpointUrl;
      const modelName = items.modelName;

      if (!url || !modelName || !apiKey) {
        sendResponse({ error: "API settings are incomplete. Please check options." });
        return;
      }

      // --- THIS IS THE NEW LOGIC ---
      // Replace the {word} placeholder with the actual selected text
      const prompt = promptTemplate.replace('{word}', request.word);
      // --- END NEW LOGIC ---

      // Create the OpenAI-style payload
      const payload = {
        "model": modelName,
        "messages": [
          {
            "role": "user",
            "content": prompt // Use the new dynamic prompt
          }
        ]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("API Error Details:", errorData);
          throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const aiText = data.choices[0].message.content;
        
        sendResponse({ definition: aiText });

      } catch (error) {
        console.error("AI API call failed:", error);
        sendResponse({ error: `Failed to fetch definition: ${error.message}` });
      }
    });

    // Return true to indicate that we will send a response asynchronously
    return true;
  }
});