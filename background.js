// --- NEW: Open options page when toolbar icon is clicked ---
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// Prevent a provider or search request from leaving a popup on "Loading..."
// forever when the remote service stops responding.
async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Streaming twin of fetchWithTimeout for OpenAI-compatible chat endpoints.
// Two clocks guard the exchange: the 30s cap is re-armed on every chunk, so
// it only fires when the stream genuinely stalls, and totalMs bounds the
// WHOLE stream — without it, a provider that holds the connection open with
// periodic keep-alive pings (or trickling tool-call fragments forever)
// would re-arm the stall timer indefinitely and hang the caller. Consumes
// the SSE body and returns the SAME `data` shape as the non-streaming JSON
// response (choices[0].message with reconstructed tool_calls), so the
// orchestrator loop needs no branching. Falls back transparently when a
// provider ignores stream:true and answers with plain JSON.
async function streamChatWithTimeout(url, options, timeoutMs = 30000, onDelta, totalMs = 120000) {
  const controller = new AbortController();
  let abortReason = 'stall';
  const totalId = setTimeout(() => { abortReason = 'total'; controller.abort(); }, totalMs);
  let timeoutId = setTimeout(() => { abortReason = 'stall'; controller.abort(); }, timeoutMs);
  const rearm = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { abortReason = 'stall'; controller.abort(); }, timeoutMs);
  };

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      // Not consumed here: the caller's existing error branches read the
      // error body (JSON or text) themselves.
      return { ok: false, response: response };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!response.body || !contentType.includes('text/event-stream')) {
      // Provider answered without SSE despite stream:true. Buffer the whole
      // body and decide what it is: plain JSON, or an SSE document we can
      // still parse after the fact (no incremental deltas, but correct).
      const rawText = await response.text();
      rearm();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        data = parseSseChatText(rawText, onDelta);
      }
      if (data && !Array.isArray(data) && typeof data === 'object' && data.choices) {
        const content = data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (typeof content === 'string' && content && onDelta) onDelta(content);
        return { ok: true, data: data };
      }
      throw new Error('Provider returned an unexpected response format.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const acc = { content: '', toolCalls: [], finishReason: null };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rearm();
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        consumeSseLine(line, acc, onDelta);
      }
    }
    // Flush any trailing line not terminated by a newline.
    if (buffer) consumeSseLine(buffer.replace(/\r$/, ''), acc, onDelta);

    const message = { role: 'assistant', content: acc.content };
    if (acc.toolCalls.length > 0) message.tool_calls = acc.toolCalls;
    return {
      ok: true,
      data: { choices: [{ message: message, finish_reason: acc.finishReason || 'stop' }] }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      if (abortReason === 'total') {
        throw new Error(`The response stream ran for over ${Math.round(totalMs / 1000)} seconds without finishing and was cut off. Please try again.`);
      }
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    clearTimeout(totalId);
  }
}

// Applies one SSE line to the accumulator, invoking onDelta for content
// fragments. Ignores comments, keep-alives, and unparseable payloads so a
// quirky provider cannot crash the stream loop.
function consumeSseLine(line, acc, onDelta) {
  if (!line.startsWith('data:')) return;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return;

  let chunk;
  try {
    chunk = JSON.parse(payload);
  } catch (e) {
    return;
  }

  const choice = chunk.choices && chunk.choices[0];
  if (!choice) return;
  const delta = choice.delta || choice.message || {};
  if (choice.finish_reason) acc.finishReason = choice.finish_reason;

  if (typeof delta.content === 'string' && delta.content) {
    acc.content += delta.content;
    if (onDelta) onDelta(delta.content);
  }

  if (Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls) {
      const idx = typeof tc.index === 'number' ? tc.index : 0;
      while (acc.toolCalls.length <= idx) {
        acc.toolCalls.push({ id: '', type: 'function', function: { name: '', arguments: '' } });
      }
      const slot = acc.toolCalls[idx];
      if (tc.id) slot.id = tc.id;
      if (tc.function) {
        if (typeof tc.function.name === 'string' && tc.function.name) slot.function.name = tc.function.name;
        if (typeof tc.function.arguments === 'string') slot.function.arguments += tc.function.arguments;
      }
    }
  }
}

// Parses a fully-buffered SSE document (the non-event-stream fallback above).
function parseSseChatText(rawText, onDelta) {
  const acc = { content: '', toolCalls: [], finishReason: null };
  for (const line of String(rawText).split('\n')) {
    consumeSseLine(line.replace(/\r$/, ''), acc, onDelta);
  }
  const message = { role: 'assistant', content: acc.content };
  if (acc.toolCalls.length > 0) message.tool_calls = acc.toolCalls;
  return { choices: [{ message: message, finish_reason: acc.finishReason || 'stop' }] };
}

// --- Implicit lookup context ---
// Sanitizes the {sentence, pageTitle} pair captured by the popup. Both the
// definition call and the Hallucination Guard verifier consume it, so the
// cleaning rules (strip control characters, flatten whitespace, cap lengths)
// live in one place. Returns null when nothing usable was captured.
function cleanImplicitContext(context) {
  if (!context || typeof context !== 'object') return null;
  const cleanCtxText = (value) => String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = typeof context.sentence === 'string' ? cleanCtxText(context.sentence).slice(0, 400) : '';
  const pageTitle = typeof context.pageTitle === 'string' ? cleanCtxText(context.pageTitle).slice(0, 200) : '';
  return (sentence || pageTitle) ? { sentence, pageTitle } : null;
}

// Appended to the implicit-context system message, but only for models that
// actually carry the web_search tool (the fallback chain can mix grounded
// and ungrounded models). Without it, models read the context sentence as a
// knowledge source and skip the web_search they would otherwise have made.
const IMPLICIT_CONTEXT_SEARCH_ADDENDUM = ' The page context is not a source of knowledge about the selected term: seeing the term in a sentence does not mean you know it. Do not guess what a term means from its parts (version numbers, series names, or suffixes like "Flash", "Pro", or "Next") — that is fabrication, not knowledge. Unless you can recall specific, concrete facts about this exact term, or the term may be newer than your training data, call the web_search tool before answering instead of explaining from the page context or the name itself.';

// --- NEW: Listen for keyboard shortcuts (commands) ---
chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-popup") {
    // Send message to the active tab to trigger the popup
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Use a callback so we can detect failures (e.g. on chrome:// pages,
        // the Web Store, the extension's own options page, or PDF viewer
        // pages where the content script is not injected).
        chrome.tabs.sendMessage(tabs[0].id, { type: "triggerPopup" }, () => {
          if (chrome.runtime.lastError) {
            // Content script not reachable on this tab.
            console.warn("triggerPopup could not be delivered:", chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});


// --- Print hand-off for "Save conversation as PDF" ---
// The transcript used to open as a data:text/html tab, but top-frame
// data: navigation is on Chrome's deprecation path and data: URLs cap
// out around ~2MB in tabs.create. Instead, stash the HTML in session
// storage under a one-shot key and open the packaged pdf/print.html,
// which writes the payload into the document and calls window.print().
// Chrome too old for storage.session keeps the legacy data: fallback.
// tabs.create wrapper that consumes lastError and routes failures to a
// caller-supplied fallback instead of leaving them unread in the void.
function createTabChecked(url, onFailure, t0) {
  chrome.tabs.create({ url }, (tab) => {
    // Timing diagnostics for the Save→print-dialog path (service-worker
    // console): attributes the wait between the click and the visible tab.
    if (t0) console.log(`[AI Popup] print tab created ${Date.now() - t0}ms after the save click`);
    if (chrome.runtime.lastError) {
      const message = chrome.runtime.lastError.message || '';
      void chrome.runtime.lastError;
      if (onFailure) onFailure(message);
    }
  });
}

function openPrintTab(htmlContent) {
  if (typeof htmlContent !== 'string' || htmlContent.length === 0) return;
  const t0 = Date.now();
  // Every transport below is checked: an unchecked tabs.create used to let
  // oversized transcripts die with zero feedback (session-storage quota ->
  // data: fallback -> ~2MB data: cap -> silent nothing). print.html renders
  // a matching explanation for each ?error= reason code.
  const showPrintFailure = (reason) => {
    createTabChecked(chrome.runtime.getURL('pdf/print.html') + '?error=' + encodeURIComponent(reason));
  };

  if (!chrome.storage || !chrome.storage.session) {
    // Legacy Chrome without storage.session: the data: hand-off is the only
    // transport. Its top-level cap (~2MB after encoding) is now enforced by
    // the failure callback instead of failing invisibly.
    createTabChecked("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent),
      () => showPrintFailure('too-large'));
    return;
  }
  const key = 'pdfPrint_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  chrome.storage.session.set({ [key]: htmlContent }, () => {
    if (chrome.runtime.lastError) {
      void chrome.runtime.lastError;
      // Quota refusal or similar. The data: escape hatch only fits payloads
      // whose encoded form stays under its cap (worst case ~3x for non-
      // ASCII-heavy text); larger ones go straight to the honest error tab.
      if (htmlContent.length < 700000) {
        createTabChecked("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent),
          () => showPrintFailure('storage'));
      } else {
        showPrintFailure('too-large');
      }
      return;
    }
    console.log(`[AI Popup] print payload staged in ${Date.now() - t0}ms`);
    createTabChecked(chrome.runtime.getURL('pdf/print.html') + '?k=' + encodeURIComponent(key),
      () => showPrintFailure('tab'), t0);
  });
}


// --- This listener now handles multiple message types ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // --- Case 0: Service-worker keepalive ---
  // While any popup is open, the content script pings every 20s so this
  // MV3 worker (idle-killed ~30s after its last event) stays warm for the
  // popup's next message — most visibly the print view after Save, which
  // otherwise pays a cold-start wake on the click.
  if (request.type === "keepAlivePing") {
    sendResponse({ ok: true });
    return;
  }

  // --- Case 1: Get a definition ---
  if (request.type === "getAiDefinition") {

    // Get all saved models and the ID of the default one
    chrome.storage.sync.get({ 'models': [], 'defaultModelId': null, 'customPrompts': [], 'defaultPromptId': null, 'tavilyApiKey': '', 'enableModelFallback': true, 'enableImplicitContext': true }, async (data) => {
      const { models, defaultModelId, customPrompts, defaultPromptId, tavilyApiKey, enableModelFallback, enableImplicitContext } = data;

      if (!models || models.length === 0 || !defaultModelId) {
        sendResponse({ error: "No default AI model configured. Please set one in the options page.", models: [], defaultModelId: null });
        return;
      }

      const primaryModel = request.modelId ? models.find(m => m.id === request.modelId) : models.find(m => m.id === defaultModelId);

      if (!primaryModel) {
        sendResponse({ error: "Model not found. Please check your settings.", models: models, defaultModelId: defaultModelId });
        return;
      }

      // --- Streaming plumbing ---
      // sendResponse is one-shot, so live deltas travel on a separate
      // message channel keyed by a requestId the popup chose. Content
      // scripts are addressed per-tab; extension pages (the built-in PDF
      // viewer runs content.js as a page script) have no sender.tab and are
      // reached via runtime.sendMessage instead — every listener keys on
      // requestId and ignores foreign ones, so the broadcast is safe. The
      // final sendResponse below is unchanged, which keeps the popup's
      // completed-state logic (save, verify, retry) byte-identical to the
      // non-streaming era.
      const streamRequestId = typeof request.requestId === 'string' ? request.requestId : null;
      const streamTabId = sender && sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;
      let streamResetPending = false;
      const emitToPopup = (message) => {
        if (!streamRequestId) return;
        if (streamTabId !== null) {
          chrome.tabs.sendMessage(streamTabId, message, () => { void chrome.runtime.lastError; });
        } else {
          chrome.runtime.sendMessage(message, () => { void chrome.runtime.lastError; });
        }
      };
      const emitStreamDelta = (delta) => {
        if (typeof delta !== 'string' || !delta) return;
        const message = { type: 'aiDefinitionDelta', requestId: streamRequestId, delta: delta };
        if (streamResetPending) {
          message.reset = true;
          streamResetPending = false;
        }
        emitToPopup(message);
      };

      // Tells the popup a chain model just died so it can swap the (possibly
      // partial) streamed answer back into a "trying next model…" indicator
      // instead of showing a dead model's truncated text while we retry.
      const emitStreamStandby = (failedName) => {
        emitToPopup({
          type: 'aiDefinitionDelta',
          requestId: streamRequestId,
          standby: true,
          failedName: typeof failedName === 'string' ? failedName : ''
        });
      };

      // --- REVISED: Simplified prompt logic ---
      const { word } = request;

      // Determine the prompt template to use
      let promptTemplate = "Explain the following word or concept in a concise paragraph: {word}"; // System default
      let promptName = "System Default"; // Default name

      if (request.customPrompt) {
        // 1. Use specific prompt requested by popup
        promptTemplate = request.customPrompt;
        // Find the name if possible, or use "Custom Prompt"
        const foundPrompt = customPrompts ? customPrompts.find(p => p.content === request.customPrompt) : null;
        promptName = foundPrompt ? foundPrompt.name : "Custom Prompt";
      } else if (request.customPrompt !== '' && defaultPromptId && customPrompts) {
        // 2. Use user-configured default prompt — but only when the popup
        //    didn't explicitly pick "System Default", which the selector
        //    sends as ''. An absent customPrompt (initial lookup, retries,
        //    follow-ups) still inherits the configured default here.
        const defaultPrompt = customPrompts.find(p => p.id === defaultPromptId);
        if (defaultPrompt) {
          promptTemplate = defaultPrompt.content;
          promptName = defaultPrompt.name;
        }
      }

      let prompt = promptTemplate.replaceAll('{word}', word);
      if (!promptTemplate.includes('{word}')) {
        prompt += `\n\nWord/Concept: ${word}`;
      }

      // Sanitize the messages array for strict API compatibility
      let safeMessagesText = [];
      if (request.messages && Array.isArray(request.messages)) {
         safeMessagesText = request.messages.map(m => ({ role: m.role, content: m.content }));
      } else {
         safeMessagesText = [{ role: "user", content: prompt }];
      }

      // --- Implicit lookup context ---
      // The popup sends the sentence around the selection plus the page
      // title. It rides in a system message with strict instructions: the
      // context ONLY disambiguates which sense of the term to explain; the
      // answer itself must stay about the term and never mention the page,
      // title, or surrounding text. Kept out of usedPrompt and of the
      // popup's conversation, so nothing user-visible (display, saves)
      // changes. requestDefinitionFromModel appends the search addendum to
      // this message for grounded models only — otherwise the context
      // sentence reads as available knowledge and suppresses web_search.
      let implicitContextMessage = null;
      if (enableImplicitContext !== false && request.context && typeof request.context === 'object') {
        const cleanContext = cleanImplicitContext(request.context);
        if (cleanContext) {
          const parts = ['The user selected a term while reading a web page and wants it explained.'];
          if (cleanContext.pageTitle) parts.push(`Page title: "${cleanContext.pageTitle}".`);
          if (cleanContext.sentence) parts.push(`Sentence containing the selection: "${cleanContext.sentence}".`);
          parts.push('Use this context ONLY to decide which meaning of the selected term applies (for example, "bank" as a riverbank versus a financial institution). Explain the term itself. Do NOT mention, quote, refer to, or summarize the page, its title, or the surrounding sentence in your answer.');
          implicitContextMessage = { role: 'system', content: parts.join(' ') };
          safeMessagesText.unshift(implicitContextMessage);
        }
      }

      // --- Model fallback chain ---
      // The primary model goes first; on any failure (HTTP error, timeout,
      // network) the next configured model in saved list order is tried.
      // One chain attempt runs the full web-search orchestrator below, and
      // everything it mutates (payload, citations, streamed partials) is
      // rebuilt per attempt so models cannot leak state into each other.
      const modelChain = enableModelFallback === false
        ? [primaryModel]
        : [primaryModel, ...models.filter(m => m.id !== primaryModel.id)];

      async function requestDefinitionFromModel(modelConfig) {
        const { endpointUrl, modelName, apiKey } = modelConfig;

        // Create the OpenAI-style payload. messages start from a copy of
        // the pristine conversation: the orchestrator pushes tool traffic
        // into payload.messages, and a retried model must not inherit it.
        const payload = {
          "model": modelName,
          "messages": safeMessagesText.slice(),
          "stream": true
        };

        if (modelConfig.enableSearchGrounding) {
          payload.tools = [{
            "type": "function",
            "function": {
              "name": "web_search",
              "description": "Searches the web for recent events, news, or factual information that might not be in your training data. Use it whenever you are not confident you know the answer, even if the page context or the conversation already mentions the topic.",
              "parameters": {
                "type": "object",
                "properties": {
                  "query": { "type": "string", "description": "The search query to look up on the web" }
                },
                "required": ["query"]
              }
            }
          }];

          // Only grounded models learn that context is not knowledge. The
          // clone keeps safeMessagesText pristine: another model in the
          // fallback chain (without grounding) will re-slice the original.
          const ctxIndex = payload.messages.indexOf(implicitContextMessage);
          if (ctxIndex !== -1) {
            payload.messages[ctxIndex] = {
              role: 'system',
              content: implicitContextMessage.content + IMPLICIT_CONTEXT_SEARCH_ADDENDUM
            };
          }

          // Guard-flagged answers are regenerated with the search forced:
          // "required" makes the model call web_search before answering,
          // sidestepping its miscalibrated "I can explain this name" urge.
          // The orchestrator relaxes this to "auto" once results return.
          // Gated on the Tavily key so we never force a call that would
          // immediately error out.
          if (request.forceSearch && tavilyApiKey) {
            payload.tool_choice = "required";
          }
        }

        // --- THIS IS THE OPTIONAL FIX (HEADERS) ---
        // Create headers object
        const headers = {
          'Content-Type': 'application/json'
        };

        // Only add Authorization header if an API key is provided
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        // --- END OPTIONAL FIX ---

        streamResetPending = true;
        const result = await streamChatWithTimeout(endpointUrl, {
          method: 'POST',
          headers: headers, // Use the new headers object
          body: JSON.stringify(payload)
        }, 30000, emitStreamDelta);

        if (!result.ok) {
          const response = result.response;
          // --- NEW: ROBUST ERROR HANDLING ---
          // Handle errors that might be plain text OR json
          let errorMsg = response.statusText || `HTTP error ${response.status}`;
          const contentType = response.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            console.error("API Error Details (JSON):", errorData);
            errorMsg = (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message) || errorData.message || errorData.detail || (Object.keys(errorData).length > 0 ? JSON.stringify(errorData) : null) || errorMsg;
          } else {
            const errorText = await response.text();
            console.error("API Error Details (Text):", errorText);
            errorMsg = errorText || errorMsg;
          }
          throw new Error(`${errorMsg}`);
          // --- END ROBUST ERROR HANDLING ---
        }

        let data = result.data;
        let aiText = "";
        let loopCount = 0;
        let usedWebSearch = false;
        const maxLoops = 3;
        const citations = [];
        const citationsByUrl = new Map();
        const maxCitations = 5;

        // Keep source metadata separate from the text given to the model so the
        // popup can render safe, clickable links after a grounded response.
        const addCitation = (result, query) => {
          if (!result || typeof result.url !== 'string') return null;

          let parsedUrl;
          try {
            parsedUrl = new URL(result.url);
          } catch (error) {
            return null;
          }

          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;

          const normalizedUrl = parsedUrl.href;
          if (citationsByUrl.has(normalizedUrl)) return citationsByUrl.get(normalizedUrl);
          if (citations.length >= maxCitations) return null;

          const citation = {
            id: `S${citations.length + 1}`,
            title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : parsedUrl.hostname,
            url: normalizedUrl,
            domain: parsedUrl.hostname,
            query: query
          };
          citations.push(citation);
          citationsByUrl.set(normalizedUrl, citation);
          return citation;
        };

        // The Orchestrator Loop
        while (loopCount < maxLoops) {
          const choice = data.choices && data.choices.length > 0 ? data.choices[0] : null;
          const message = choice ? choice.message : null;

          if (!message) {
            aiText = "The AI returned an empty response or the response was filtered.";
            break;
          }

          // Check if AI wants to use a tool
          if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            
            if (toolCall.function.name === "web_search" && tavilyApiKey) {
              // 1. Extract the query
              const args = JSON.parse(toolCall.function.arguments);
              const query = args.query;
              
              // 2. Make the request to Tavily
              const tavilyResponse = await fetchWithTimeout("https://api.tavily.com/search", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: tavilyApiKey, query: query, max_results: 3 })
              });
              if (!tavilyResponse.ok) {
                throw new Error(`Search request failed: ${tavilyResponse.status} ${tavilyResponse.statusText}`);
              }
              const tavilyData = await tavilyResponse.json();
              
              // Format the search results
              let searchResultsText = "Search Results:\n";
              if (tavilyData.results && tavilyData.results.length > 0) {
                tavilyData.results.forEach(result => {
                  const citation = addCitation(result, query);
                  const title = typeof result.title === 'string' ? result.title : 'Untitled source';
                  const content = typeof result.content === 'string' ? result.content : '';
                  const sourceLabel = citation ? `[${citation.id}] ${citation.title} (${citation.url})` : title;
                  searchResultsText += `- ${sourceLabel}: ${content}\n`;
                });
              } else {
                searchResultsText += "No results found. Server returned: " + JSON.stringify(tavilyData);
              }

              // 3. Append to history and make next API call. Tool traffic is
              // attempt-local: pushing into payload.messages (not the shared
              // conversation) keeps a fallback retry's context pristine.
              payload.messages.push({
                role: "assistant",
                content: message.content || "",
                tool_calls: message.tool_calls
              }); // Safely add the AI's tool request
              payload.messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: "web_search",
                content: searchResultsText
              });
              
              // The forced first call has served its purpose; let the model
              // answer with the results instead of being forced to search
              // again on every orchestrator loop.
              if (request.forceSearch) {
                payload.tool_choice = "auto";
              }

              // If we are about to hit max loops, force the AI to answer by removing tools
              if (loopCount === maxLoops - 1) {
                delete payload.tools;
                delete payload.tool_choice;
              }
              
              // Re-fetch with the updated payload
              streamResetPending = true;
              const nextResult = await streamChatWithTimeout(endpointUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
              }, 30000, emitStreamDelta);

               const nextResponse = nextResult.ok ? null : nextResult.response;
               if (!nextResult.ok) {
                   let errDetails = "";
                   try {
                     const errJson = await nextResponse.json();
                     errDetails = (errJson.error && errJson.error.message) ? errJson.error.message : JSON.stringify(errJson);
                   } catch (e) {
                     errDetails = "Could not parse error details.";
                   }

                   // Some OpenAI-compatible providers (notably some Groq models) can
                   // fail to parse a *subsequent* model-generated tool call. The search
                   // result is already in the conversation, so retry once with tools
                   // disabled and require the model to produce its final text answer.
                   if (nextResponse.status === 400 && errDetails.includes("failed_generation")) {
                     delete payload.tools;
                     payload.tool_choice = "none";
                     streamResetPending = true;

                     const fallbackResult = await streamChatWithTimeout(endpointUrl, {
                       method: 'POST',
                       headers: headers,
                       body: JSON.stringify(payload)
                     }, 30000, emitStreamDelta);

                     if (!fallbackResult.ok) {
                       const fallbackResponse = fallbackResult.response;
                       let fallbackError = fallbackResponse.statusText || `HTTP error ${fallbackResponse.status}`;
                       try {
                         const fallbackJson = await fallbackResponse.json();
                         fallbackError = (typeof fallbackJson.error === 'string' ? fallbackJson.error : fallbackJson.error?.message) || fallbackJson.message || JSON.stringify(fallbackJson);
                       } catch (e) {
                         // Keep the HTTP status text when the provider returns non-JSON.
                       }
                       throw new Error(`HTTP error on search fallback: ${fallbackResponse.status} - ${fallbackError}`);
                     }

                     data = fallbackResult.data;
                   } else {
                     throw new Error(`HTTP error on search pass: ${nextResponse.status} - ${errDetails}`);
                   }
               } else {
                 data = nextResult.data;
               }
               loopCount++;
               usedWebSearch = true;
            } else if (toolCall.function.name === "web_search" && !tavilyApiKey) {
              throw new Error("AI tried to search the web, but no Tavily API Key is configured in settings.");
            } else {
               aiText = "Error: AI attempted to call an unknown tool: " + toolCall.function.name;
               break;
            }
          } else {
            // Standard text response received!
            aiText = message.content || "The AI returned an empty response.";
            break;
          }
        }
        
        // Fallback if it looped too many times or content was null
        if (!aiText) {
          const fallbackContent = data?.choices?.[0]?.message?.content;
          aiText = fallbackContent || "The AI reached maximum search depth or returned an empty response.";
        }

        return { definition: aiText, usedWebSearch: usedWebSearch, citations: citations };
      }

      const failures = [];
      let answer = null;
      let usedModel = null;
      for (let i = 0; i < modelChain.length; i++) {
        try {
          answer = await requestDefinitionFromModel(modelChain[i]);
          usedModel = modelChain[i];
          break;
        } catch (error) {
          const failedName = modelChain[i].name || modelChain[i].modelName;
          console.error(`AI API call failed (${failedName}):`, error);
          failures.push({ name: failedName, message: error.message });
          if (i < modelChain.length - 1) {
            emitStreamStandby(failedName);
          }
        }
      }

      if (!answer) {
        // With a single-model chain keep the historical one-error wording.
        const detail = failures.length === 1
          ? `Failed to fetch definition: ${failures[0].message}`
          : `Failed to fetch definition: all ${failures.length} models in the fallback chain failed — ${failures.map(f => `${f.name}: ${f.message}`).join(' | ')}`;
        sendResponse({ error: detail, models: models, defaultModelId: defaultModelId, customPrompts: customPrompts || [], defaultPromptId: defaultPromptId });
        return;
      }

      sendResponse({
        definition: answer.definition,
        usedWebSearch: answer.usedWebSearch,
        citations: answer.citations,
        // Which model actually answered (differs from the requested one when
        // the chain had to fall back) and who failed along the way, so the
        // popup can label saves and notify instead of crediting a dead model.
        usedModelId: usedModel.id,
        usedModelName: usedModel.name || usedModel.modelName,
        // Whether a guard-flagged answer can be auto-regenerated with a
        // forced web search (the answering model is grounded + Tavily key
        // is configured).
        searchGroundingAvailable: !!(usedModel.enableSearchGrounding && tavilyApiKey),
        fallbackFailedModels: failures.map(f => f.name),
        usedPrompt: prompt, models: models, defaultModelId: defaultModelId, customPrompts: customPrompts || [], defaultPromptId: defaultPromptId, promptName: promptName
      });
    });

    // Return true to indicate that we will send a response asynchronously
    return true;
  }

  // --- Case 2: Save an item to history ---
  if (request.type === "saveToHistory") {
    // We pass sendResponse as a callback to run *after* saving
    saveToHistory(request.word, request.definition, request.listId, request.modelName, request.promptName, request.sourceUrl, request.sourceTitle, request.citations, (err) => {
      if (err) {
        sendResponse({ status: "error", error: err.message });
      } else {
        sendResponse({ status: "saved" });
      }
    });
    // Return true to tell Chrome this is an async operation
    return true;
  }

  // --- Clip: save the raw selection to history without an AI call ---
  // --- Case 2.4: Fast clip save ---
  // Clips land in a dedicated "Clips" list (created automatically if it doesn't
  // exist yet). Saving a clip never mutates lastUsedListId, so the user's active
  // study list remains preselected when doing normal lookups. Duplicate clips
  // (same full text, same clips list) are skipped.
  if (request.type === "saveClip") {
    const clipText = typeof request.text === 'string' ? request.text.trim() : '';
    if (!clipText) {
      sendResponse({ status: 'error', error: 'Nothing selected to clip.' });
      return;
    }

    let cleanContext = null;
    if (request.context && typeof request.context === 'object') {
      const sentence = typeof request.context.sentence === 'string' ? request.context.sentence.trim().slice(0, 400) : '';
      const pageTitle = typeof request.context.pageTitle === 'string' ? request.context.pageTitle.trim().slice(0, 200) : '';
      if (sentence || pageTitle) {
        cleanContext = {};
        if (sentence) cleanContext.sentence = sentence;
        if (pageTitle) cleanContext.pageTitle = pageTitle;
      }
    }

    // The Clips-list find-or-create is a read-modify-write on wordLists, so
    // it runs inside the same queue that serializes history writes. Without
    // this, two near-simultaneous clips (or a clip racing options-page list
    // edits) could both create a "Clips" list — the loser's whole-array
    // write orphans the other's list id.
    historySavePromise = historySavePromise.then(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['history', 'wordLists'], (result) => {
          if (chrome.runtime.lastError) {
            sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
            resolve();
            return;
          }

          const history = result.history || [];
          let wordLists = result.wordLists || [];

          // Find existing "Clips" list (case-insensitive) or create one
          let clipsList = wordLists.find(l => l.name && l.name.trim().toLowerCase() === 'clips');
          const isNewList = !clipsList;
          if (isNewList) {
            clipsList = { id: `list_${Date.now()}`, name: 'Clips' };
            wordLists.push(clipsList);
          }

          const listId = clipsList.id;

          const isDuplicate = history.some(item =>
            item.modelName === 'clip' &&
            item.word === clipText &&
            (item.listId || null) === listId
          );
          if (isDuplicate) {
            sendResponse({ status: 'duplicate' });
            resolve();
            return;
          }

          const performSave = () => {
            saveToHistory(clipText, '', listId, 'clip', 'Clip', request.sourceUrl, request.sourceTitle, [], (err) => {
              if (err) {
                sendResponse({ status: 'error', error: err.message });
              } else {
                sendResponse({ status: 'saved' });
              }
            }, cleanContext, false);
            // The history write runs in saveToHistory's own queued task;
            // this task's job (the wordLists read-modify-write) is done.
            resolve();
          };

          if (isNewList) {
            chrome.storage.local.set({ wordLists: wordLists }, () => {
              if (chrome.runtime.lastError) {
                sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
                resolve();
                return;
              }
              performSave();
            });
          } else {
            performSave();
          }
        });
      });
    }).catch((err) => {
      // A rejected task would poison the queue for every future save, so
      // failures settle here instead (the queue continues with a resolved
      // promise). sendResponse may already have fired; a second call is a
      // harmless no-op for the caller.
      try {
        sendResponse({ status: 'error', error: err && err.message ? err.message : 'Clip save failed.' });
      } catch (e) { /* channel already closed */ }
    });
    return true;
  }

  // --- Case 2.5: Open PDF Tab ---
  if (request.type === "openPdfTab") {
    openPrintTab(request.htmlContent);
  }

  // --- Case 2.6: Escape hatch — reopen a failed PDF in Chrome's viewer ---
  if (request.type === "openNativeViewer") {
    handleOpenNativeViewer(request, sender, sendResponse);
    return true; // async — responded once the navigation is kicked off
  }

  // --- Case 2.8: Test AI Connection & Setup ---
  if (request.type === "testConnection") {
    handleTestConnection(request, sendResponse);
    return true; // async
  }

  // --- Case 2.9: Open Options Page Tab (e.g. support-content) ---
  if (request.type === "openOptionsTab") {
    const targetTab = request.tab || 'support-content';
    chrome.storage.local.set({ activeOptionsTab: targetTab }, () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // --- Case 3: Get all word lists ---
  if (request.type === "getWordLists") {
    // --- UPDATED: Now also get the lastUsedListId ---
    chrome.storage.local.get({ wordLists: [], lastUsedListId: null }, (data) => {
      // Send back both the lists and the last used ID
      sendResponse({ lists: data.wordLists, lastUsedListId: data.lastUsedListId });
    });
    return true; // Async response
  }

  // --- NEW: Case 4: Create a new list ---
  if (request.type === "createList") {
    const listName = request.listName;
    if (listName && listName.trim()) {
      chrome.storage.local.get({ wordLists: [] }, (data) => {
        const lists = data.wordLists;
        // Check for duplicates (optional but good)
        if (lists.some(l => l.name === listName.trim())) {
          sendResponse({ error: "List already exists" });
          return;
        }

        const newList = { id: `list_${new Date().getTime()}`, name: listName.trim() };
        if (request.parentId) {
          newList.parentId = request.parentId;
        }
        lists.push(newList);

        chrome.storage.local.set({ wordLists: lists }, () => {
          sendResponse({ success: true, newList: newList });
        });
      });
    } else {
      sendResponse({ error: "Invalid list name" });
    }
    return true; // Async response
  }

  // --- NEW: Case 5: Check Backup manually (from Options) ---
  if (request.type === "checkBackupReminder") {
    performAutoBackupCheck();
  }

  // --- NEW: Case 6: Force Manual Backup ---
  if (request.type === "manualBackup" || request.type === "testBackup") {
    // Force a backup regardless of time
    triggerBackup("Manual", request.backupInclude);
  }

  // --- Case 7: Verify AI Response ---
  if (request.type === "verifyAiResponse") {
    chrome.storage.sync.get(['models', 'verificationModelId', 'enableImplicitContext'], async (data) => {
      const { models, verificationModelId } = data;
      if (!models || !verificationModelId) {
        sendResponse({ error: "Verification model not configured." });
        return;
      }

      const modelToUse = models.find(m => m.id === verificationModelId);
      if (!modelToUse) {
        sendResponse({ error: "Verification model not found." });
        return;
      }

      const { endpointUrl, modelName, apiKey } = modelToUse;
      const { originalPrompt, aiResponse } = request;

      // The answering model saw the implicit context (when enabled); the
      // verifier must see it too, or it flags context-derived facts as
      // claims the answering model could not possibly know.
      let contextSection = '';
      if (data.enableImplicitContext !== false) {
        const cleanContext = cleanImplicitContext(request.context);
        if (cleanContext) {
          const ctxParts = [];
          if (cleanContext.pageTitle) ctxParts.push(`page title: "${cleanContext.pageTitle}"`);
          if (cleanContext.sentence) ctxParts.push(`sentence containing the selection: "${cleanContext.sentence}"`);
          contextSection = `\n\nPage context the answering model was given (only to disambiguate which meaning of the term applies): ${ctxParts.join('; ')}. Treat statements in the AI Response that accurately reflect this context as taken from it, not as fabrications.`;
        }
      }

      const verificationPrompt = `You are a strict factual verification system. Review the following original prompt and AI response. Identify any hallucinations, fabricated facts, or logical errors. Output your response as a raw JSON object with this exact structure: {"is_hallucinating": boolean, "reasoning": "brief explanation", "corrections": ["string"]}. Do not include markdown formatting or any other text.\n\nOriginal Prompt: ${originalPrompt}${contextSection}\n\nAI Response: ${aiResponse}`;

      const payload = {
        "model": modelName,
        "messages": [{ role: "user", content: verificationPrompt }],
        "stream": false
      };
      
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      
      try {
        const response = await fetchWithTimeout(endpointUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        let content = '';
        
        if (result.choices && result.choices.length > 0 && result.choices[0].message) {
           content = result.choices[0].message.content;
        } else if (result.message && result.message.content) {
           content = result.message.content;
        } else if (result.response) {
           content = result.response;
        } else {
           throw new Error("Unexpected API response structure.");
        }
        
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        let verificationResult;
        try {
          verificationResult = JSON.parse(content);
        } catch(e) {
          console.error("Failed to parse verification JSON:", content);
          sendResponse({ error: "Failed to parse verification result." });
          return;
        }
        
        sendResponse({ success: true, result: verificationResult });
        
      } catch (error) {
        console.error("Verification API Error:", error);
        sendResponse({ error: error.message });
      }
    });
    return true; // async
  }

});

let historySavePromise = Promise.resolve();

// Unique identity for history items. A millisecond ISO timestamp is NOT
// unique (bulk saves, stacked popups), and identity operations elsewhere
// (edit/delete/favorite/merge) must not conflate two items saved in the
// same millisecond.
function generateHistoryItemId() {
  return 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// --- UPDATED to accept source URL, title, optional context, and updateLastUsed flag ---
function saveToHistory(word, definition, listId, modelName, promptName, sourceUrl, sourceTitle, citations, callback, context = null, updateLastUsed = true) {
  historySavePromise = historySavePromise.then(() => {
    return new Promise((resolve) => {
      chrome.storage.local.get(['history'], (result) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to read history from storage:", chrome.runtime.lastError);
          if (callback) {
            callback(chrome.runtime.lastError);
          }
          resolve();
          return;
        }

        let history = result.history || [];

        // Create new history item
        const newItem = {
          id: generateHistoryItemId(),
          word: word,
          definition: definition,
          timestamp: new Date().toISOString(),
          listId: listId,
          modelName: modelName,
          promptName: promptName,
          sourceUrl: sourceUrl || '',
          sourceTitle: sourceTitle || '',
          citations: Array.isArray(citations) ? citations.slice(0, 5) : []
        };
        if (context && typeof context === 'object') {
          newItem.context = context;
        }

        // Add new item to the beginning of the array
        history.unshift(newItem);

        const storageUpdates = { history: history };
        if (updateLastUsed) {
          storageUpdates.lastUsedListId = listId;
        }

        chrome.storage.local.set(storageUpdates, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to save history to storage:", chrome.runtime.lastError);
            if (callback) {
              callback(chrome.runtime.lastError);
            }
          } else {
            if (callback) {
              callback(null);
            }
          }
          resolve();
        });
      });
    });
  });
}

// --- NEW: Auto-Backup Logic ---

// Check every 60 minutes
chrome.alarms.create("checkBackupReminder", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkBackupReminder") {
    performAutoBackupCheck();
  }
});

// Also check on startup
chrome.runtime.onStartup.addListener(() => {
  performAutoBackupCheck();
});

// And on installed
chrome.runtime.onInstalled.addListener(() => {
  performAutoBackupCheck();
});

// Listen for changes in settings to update immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.backupReminderFrequency) {
    performAutoBackupCheck();
  }
});

function performAutoBackupCheck() {
  chrome.storage.sync.get({ backupReminderFrequency: 0 }, (syncData) => {
    const frequencyDays = syncData.backupReminderFrequency;

    // specific check: if 0 (disabled), ensure no badge/action
    if (frequencyDays === 0) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    chrome.storage.local.get({ lastBackupTime: 0 }, (localData) => {
      const lastBackup = localData.lastBackupTime;
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceBackup = (now - lastBackup) / msPerDay;

      // If time has passed, Trigger the Backup!
      if (daysSinceBackup >= frequencyDays) {
        triggerBackup("Auto");
      }
    });
  });
}

// --- NEW: Better Download Tracking ---
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    // Check if this download ID matches a pending backup
    chrome.storage.local.get(['pendingBackupId', 'pendingBackupType'], (data) => {
      if (data.pendingBackupId === delta.id) {
        console.log("Backup download completed successfully.");
        chrome.storage.local.set({
          lastBackupTime: Date.now(),
          lastBackupType: data.pendingBackupType,
          pendingBackupId: null // clear pending
        });
      }
    });
  } else if (delta.error) {
    console.error("Backup download failed:", delta.error.current);
    // Optionally save the error to display to user
    chrome.storage.local.get(['pendingBackupId'], (data) => {
      if (data.pendingBackupId === delta.id) {
        chrome.storage.local.set({
          lastBackupError: delta.error.current,
          pendingBackupId: null
        });
      }
    });
  }
});

// --- NEW: Unicode-safe Base64 encoder (replaces deprecated unescape/encodeURIComponent combo) ---
// Works in service workers where `unescape` is being phased out.
function base64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000; // Avoid call-stack overflow on large strings
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function sanitizeUrlSecrets(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.username = '';
    parsed.password = '';
    const sensitiveParams = ['key', 'apikey', 'api_key', 'token', 'access_token', 'auth', 'secret', 'password', 'bearer'];
    const toDelete = [];
    for (const key of parsed.searchParams.keys()) {
      if (sensitiveParams.includes(key.toLowerCase())) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch (e) {
    return rawUrl;
  }
}

const DEFAULT_BACKUP_INCLUDE = {
  history: true,
  review: true,
  models: true,
  prompts: true,
  apiKeys: true,
  anki: true,
  voice: true,
  pdf: true,
  general: true
};

function triggerBackup(type = "Auto", customBackupInclude = null) {
  // 1. Fetch all data to backup.
  chrome.storage.local.get(null, (localData) => {
    chrome.storage.sync.get(null, (syncData) => {
      const backupInclude = {
        ...DEFAULT_BACKUP_INCLUDE,
        ...(customBackupInclude || syncData.backupInclude || {})
      };

      const backupData = {
        exportedAt: new Date().toISOString(),
        backupType: type,
        backupInclude: backupInclude,
        version: "1.3"
      };

      // 1. Vocabulary History & Lists. When review progress is excluded,
      // the scheduling fields are stripped so the backup stays shareable.
      if (backupInclude.history) {
        const stripReviewProgress = (item) => {
          if (backupInclude.review) return item;
          const {
            nextReview, interval, lastReviewed, stability, difficulty,
            reps, lapses, learningSteps, state, reviewLog, ...rest
          } = item;
          return rest;
        };
        backupData.history = (localData.history || []).map(stripReviewProgress);
        backupData.wordLists = localData.wordLists || [];
      }

      // 2. AI Models Configuration
      if (backupInclude.models) {
        let modelsList = (syncData.models || []).map(m => ({ ...m }));
        if (!backupInclude.apiKeys) {
          modelsList = modelsList.map(m => {
            const sanitized = { ...m };
            sanitized.apiKey = "";
            if (sanitized.endpointUrl) {
              sanitized.endpointUrl = sanitizeUrlSecrets(sanitized.endpointUrl);
            }
            return sanitized;
          });
        }
        backupData.models = modelsList;
        if (syncData.defaultModelId !== undefined) backupData.defaultModelId = syncData.defaultModelId;
        if (syncData.verificationModelId !== undefined) backupData.verificationModelId = syncData.verificationModelId;
        if (syncData.enableHallucinationGuard !== undefined) backupData.enableHallucinationGuard = syncData.enableHallucinationGuard;
        if (syncData.enableModelFallback !== undefined) backupData.enableModelFallback = syncData.enableModelFallback;
        if (syncData.enableImplicitContext !== undefined) backupData.enableImplicitContext = syncData.enableImplicitContext;
      }

      // 3. Custom Prompts
      if (backupInclude.prompts) {
        backupData.customPrompts = syncData.customPrompts || [];
        if (syncData.defaultPromptId !== undefined) backupData.defaultPromptId = syncData.defaultPromptId;
      }

      // 4. API Keys & Secrets (Tavily, STT, etc.)
      if (backupInclude.apiKeys) {
        if (syncData.tavilyApiKey !== undefined) backupData.tavilyApiKey = syncData.tavilyApiKey;
        if (syncData.sttApiKey !== undefined) backupData.sttApiKey = syncData.sttApiKey;
        if (syncData.sttCustomHeaders !== undefined) backupData.sttCustomHeaders = syncData.sttCustomHeaders;
      }

      // 5. Anki Settings
      if (backupInclude.anki && syncData.ankiSettings !== undefined) {
        backupData.ankiSettings = syncData.ankiSettings;
      }

      // 6. Voice & Audio (TTS / STT)
      if (backupInclude.voice) {
        if (syncData.ttsSettings !== undefined) backupData.ttsSettings = syncData.ttsSettings;
        if (syncData.sttEngine !== undefined) backupData.sttEngine = syncData.sttEngine;
        if (syncData.sttApiUrl !== undefined) {
          backupData.sttApiUrl = backupInclude.apiKeys ? syncData.sttApiUrl : sanitizeUrlSecrets(syncData.sttApiUrl);
        }
        if (syncData.sttModel !== undefined) backupData.sttModel = syncData.sttModel;
        if (syncData.sttCustomFormData !== undefined) backupData.sttCustomFormData = syncData.sttCustomFormData;
      }

      // 7. PDF Annotations & Settings
      if (backupInclude.pdf) {
        const pdfAnnotations = {};
        for (const key of Object.keys(localData)) {
          if (key === 'pdf_author_name' || key.startsWith('pdf_highlights_') || key.startsWith('pdf_bookmarks_') || key.startsWith('pdf_lastpage_')) {
            pdfAnnotations[key] = localData[key];
          }
        }
        backupData.pdfAnnotations = pdfAnnotations;
        if (syncData.pdfViewerEnabled !== undefined) backupData.pdfViewerEnabled = syncData.pdfViewerEnabled;
      }

      // 8. General & UI Preferences
      if (backupInclude.general) {
        if (syncData.uiTheme !== undefined) backupData.uiTheme = syncData.uiTheme;
        if (syncData.followupCustomMessage !== undefined) backupData.followupCustomMessage = syncData.followupCustomMessage;
        if (syncData.showUserQuestions !== undefined) backupData.showUserQuestions = syncData.showUserQuestions;
        if (syncData.backupReminderFrequency !== undefined) backupData.backupReminderFrequency = syncData.backupReminderFrequency;
        if (syncData.backupSubfolder !== undefined) backupData.backupSubfolder = syncData.backupSubfolder;
      }

      // 9. Personalized FSRS Memory Model (governed by the review-progress toggle)
      if (backupInclude.review) {
        if (syncData.customFsrsWeights !== undefined) backupData.customFsrsWeights = syncData.customFsrsWeights;
        if (syncData.customFsrsWeightsMeta !== undefined) backupData.customFsrsWeightsMeta = syncData.customFsrsWeightsMeta;
      }

      // 2. Create Data URI (Base64) - Service Worker safe
      const jsonString = JSON.stringify(backupData, null, 2);
      // Encode properly to handle Unicode characters without the deprecated `unescape`.
      const base64Content = base64EncodeUtf8(jsonString);
      const url = `data:application/json;base64,${base64Content}`;

      // 3. Determine Filename
      const dateStr = new Date().toISOString().slice(0, 10);
      const timestamp = new Date().getTime(); // ensure uniqueness
      const defaultFilename = `infopedia_backup_${dateStr}_${timestamp}.json`;

      // 4. Check Subfolder setting (already fetched above in syncData)
      let finalPath = defaultFilename;
      if (syncData.backupSubfolder && syncData.backupSubfolder.trim()) {
        // Allow simple subfolder organization
        const folder = syncData.backupSubfolder.trim().replace(/[<>:"/\\|?*]/g, ''); // sanitize
        if (folder) {
          finalPath = `${folder}/${defaultFilename}`;
        }
      }

      try {
        if (!chrome.downloads || !chrome.downloads.download) {
          throw new Error("chrome.downloads API is not available. Check permissions.");
        }

        // 5. Download
        chrome.downloads.download({
          url: url,
          filename: finalPath,
          saveAs: false, // Attempt to save automatically without prompt
          conflictAction: 'uniquify'
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error("Auto-Backup Start Failed:", chrome.runtime.lastError);
            chrome.storage.local.set({ lastBackupError: chrome.runtime.lastError.message });
          } else {
            console.log("Auto-Backup Started. ID:", downloadId);
            // --- CHANGED: Don't set success yet. Set "Pending". ---
            chrome.storage.local.set({
              pendingBackupId: downloadId,
              pendingBackupType: type,
              lastBackupError: null // clear previous errors
            });
          }
        });
      } catch (err) {
        console.error("Backup Exception:", err);
        chrome.storage.local.set({ lastBackupError: err.message });
      }
    });
  });
}

// --- NEW: Intercept PDF URLs and redirect to custom PDF.js viewer ---
// Track tabs that we have already redirected for the current navigation so the
// webNavigation and webRequest listeners don't double-redirect the same URL.
// MV3 service workers are killed within seconds of idle, which silently wipes
// in-memory state and its cleanup timers. The dedupe state therefore lives in
// chrome.storage.session (persists across SW restarts, cleared when the
// browser closes), mirrored into a synchronous in-memory Map as the fast
// path. Entries expire lazily by timestamp — no setTimeout to lose.
const REDIRECT_TTL_MS = 10000; // forget the entry after 10s as a safety net
// Escape-hatch (native viewer) marks slide forward on every navigation
// event so slow SSO chains survive, but they must not mute interception
// forever just because the tab keeps loading pages — this caps their
// total lifetime from birth.
const BYPASS_HARD_CAP_MS = 120000;
const redirectedTabs = new Map(); // tabId -> { url, ts, born?, bypass? }

const sessionStore = (chrome.storage && chrome.storage.session) || null;

// Warm the in-memory copy whenever the SW (re)starts, dropping expired entries.
const redirectedTabsLoaded = (async () => {
  if (!sessionStore) return;
  try {
    const data = await sessionStore.get('redirectedTabs');
    const stored = data && data.redirectedTabs;
    if (!stored) return;
    const now = Date.now();
    for (const key of Object.keys(stored)) {
      const entry = stored[key];
      if (!entry || typeof entry.url !== 'string') continue;
      // Bypasses live from birth to the hard cap (sliding renewal keeps
      // their ts fresh, so ts alone must not expire them mid-chain);
      // dedupe marks keep the plain TTL.
      const maxAge = entry.bypass ? BYPASS_HARD_CAP_MS : REDIRECT_TTL_MS;
      if (now - (typeof entry.born === 'number' ? entry.born : entry.ts) < maxAge) {
        redirectedTabs.set(Number(key), {
          url: entry.url,
          ts: entry.ts,
          born: typeof entry.born === 'number' ? entry.born : undefined,
          bypass: Boolean(entry.bypass)
        });
      }
    }
  } catch (e) {}
})();

function persistRedirectedTabs() {
  if (!sessionStore) return;
  const obj = {};
  for (const [tabId, entry] of redirectedTabs) {
    obj[String(tabId)] = entry;
  }
  try {
    const p = sessionStore.set({ redirectedTabs: obj });
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function isAlreadyRedirected(tabId, url) {
  const entry = redirectedTabs.get(tabId);
  if (!entry) return false;
  const now = Date.now();
  // Bypass marks are tab-scoped, not URL-scoped: after the user escapes to
  // Chrome's native viewer, intermediate hops of a redirect chain (e.g.
  // http -> https) carry different URLs and must not be re-intercepted.
  if (entry.bypass) {
    // Hard lifetime cap from birth: sliding renewal below keeps slow SSO
    // chains alive across their hops, but ordinary browsing in that tab
    // must never mute interception indefinitely.
    const born = typeof entry.born === 'number' ? entry.born : entry.ts;
    if (now - born >= BYPASS_HARD_CAP_MS) {
      redirectedTabs.delete(tabId);
      persistRedirectedTabs();
      return false;
    }
    // Sliding window: every honored navigation event keeps the bypass
    // alive for another TTL, so multi-hop navigations aren't re-caught
    // mid-flight by a fixed clock.
    entry.ts = now;
    persistRedirectedTabs();
    return true;
  }
  if (now - entry.ts >= REDIRECT_TTL_MS) {
    redirectedTabs.delete(tabId); // lazy expiry replaces the lost timer
    return false;
  }
  return entry.url === url;
}

function markRedirected(tabId, originalUrl, isBypass) {
  const now = Date.now();
  // Sweep expired entries while we're here so neither the Map nor
  // storage.session accumulates dead tabs between navigations. Bypasses
  // expire against their birth-based hard cap, dedupe marks against ts.
  for (const [id, e] of redirectedTabs) {
    if (!e) continue;
    const maxAge = e.bypass ? BYPASS_HARD_CAP_MS : REDIRECT_TTL_MS;
    const originTs = typeof e.born === 'number' ? e.born : e.ts;
    if (now - originTs >= maxAge) redirectedTabs.delete(id);
  }
  redirectedTabs.set(tabId, isBypass
    ? { url: originalUrl, ts: now, born: now, bypass: true }
    : { url: originalUrl, ts: now });
  persistRedirectedTabs();
}

// Closed tabs release their entries immediately instead of lingering to TTL.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (redirectedTabs.delete(tabId)) {
    persistRedirectedTabs();
  }
});

// User-facing kill switch for the PDF interception. Default-on preserves the
// behavior from before the setting existed. Kept in memory for the decision
// in redirectToPdfViewer below; warmed at SW startup exactly like
// redirectedTabsLoaded, because a cold-started MV3 worker would otherwise
// read stale storage mid-navigation.
let pdfViewerEnabled = true;
const pdfViewerEnabledLoaded = (async () => {
  try {
    const data = await chrome.storage.sync.get({ pdfViewerEnabled: true });
    pdfViewerEnabled = data.pdfViewerEnabled !== false;
  } catch (e) {}
})();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.pdfViewerEnabled) {
    pdfViewerEnabled = changes.pdfViewerEnabled.newValue !== false;
  }
});

// "Open in Chrome's built-in viewer" from the custom viewer's error screen.
// Messages from the extension's own pages do not reliably carry sender.tab
// (it is only documented for connections opened from a tab), so the viewer
// names its tab itself via chrome.tabs.getCurrent and passes the id in the
// message. The dedupe map doubles as the bypass: a fresh bypass entry for
// this tab makes isAlreadyRedirected() true, so the tabs.update below lands
// in the native viewer instead of being scooped straight back into ours.
// The usual TTL/lazy sweep cleans the entry up afterwards.
async function handleOpenNativeViewer(request, sender, sendResponse) {
  const tabId = (sender.tab && sender.tab.id) ||
    (typeof request.tabId === 'number' ? request.tabId : null);
  if (!tabId || typeof request.url !== 'string' || !request.url) {
    sendResponse({ ok: false });
    return;
  }
  try {
    await redirectedTabsLoaded;
    markRedirected(tabId, request.url, true);
    chrome.tabs.update(tabId, { url: request.url }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        // Native handover never started; drop the bypass so interception
        // resumes immediately instead of staying muted for the TTL.
        // Guarded: only remove our own fresh bypass.
        const entry = redirectedTabs.get(tabId);
        if (entry && entry.bypass && entry.url === request.url) {
          redirectedTabs.delete(tabId);
          persistRedirectedTabs();
        }
      }
      sendResponse({ ok: !err });
    });
  } catch (e) {
    sendResponse({ ok: false });
  }
}

// Common helper that performs the actual redirect once. It awaits the
// session warm-up so a freshly restarted cold SW still sees marks made by its
// predecessor; the check-then-mark sequence after the await is synchronous,
// so near-simultaneous events cannot interleave between check and mark.
//
// Why observe-and-tabs.update instead of a blocking webRequest redirect:
// MV3 removes blocking webRequest from non-policy-installed extensions, so
// onHeadersReceived cannot return {redirectUrl} or {cancel:true} here —
// adding "blocking" would silently kill interception in production builds
// while appearing to work under enterprise/unpacked testing. The cost is
// inherent to the platform: for content-type-detected PDFs served at
// extension-less URLs, Chrome briefly engages its own handling before
// tabs.update takes over (flicker; attachment-disposition responses can
// still complete as downloads). declarativeNetRequest can't substitute —
// its rules can't match response Content-Type for redirects and its
// substitution can't safely encode ?file= query values. The .pdf-extension
// path never pays this cost: webNavigation.onBeforeNavigate fires before
// commit, so those navigations are replaced pre-response. The Promise.all
// below just keeps the takeover window as short as the platform allows.
async function redirectToPdfViewer(tabId, originalUrl) {
  await Promise.all([redirectedTabsLoaded, pdfViewerEnabledLoaded]);
  if (!pdfViewerEnabled) return;
  if (isAlreadyRedirected(tabId, originalUrl)) return; // dedupe across listeners
  markRedirected(tabId, originalUrl);
  const viewerUrl = chrome.runtime.getURL('pdf/web/custom-viewer.html?file=' + encodeURIComponent(originalUrl));
  chrome.tabs.update(tabId, { url: viewerUrl }, () => {
    const err = chrome.runtime.lastError;
    if (err) {
      // The takeover never happened (tab closed/discarded mid-race). Drop
      // the mark so retrying the link isn't suppressed for the rest of the
      // TTL. The guard keeps us from clobbering a newer entry raced in by
      // another flow (e.g., a native-viewer bypass set meanwhile).
      const entry = redirectedTabs.get(tabId);
      if (entry && !entry.bypass && entry.url === originalUrl) {
        redirectedTabs.delete(tabId);
        persistRedirectedTabs();
      }
    }
  });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (url.includes(chrome.runtime.id) && url.includes('/pdf/web/custom-viewer.html')) return;
  try {
    const urlObj = new URL(url);
    const pathLower = urlObj.pathname.toLowerCase();
    const isPdfExt = pathLower.endsWith('.pdf');
    // Match arxiv.org and its subdomains (e.g. www.arxiv.org, export.arxiv.org).
    // Case-insensitive like isPdfExt above. Accepts the bare "/pdf" form
    // (no trailing slash, optionally followed by a query string — the
    // pathname ignores those) alongside every "/pdf/<id>" shape.
    const isArxivPdf = (urlObj.hostname === 'arxiv.org' || urlObj.hostname.endsWith('.arxiv.org')) &&
                       (pathLower === '/pdf' || pathLower.startsWith('/pdf/'));

    if (isPdfExt || isArxivPdf) {
      redirectToPdfViewer(details.tabId, url);
    }
  } catch (e) {}
});

// --- NEW: Intercept any URL that returns a PDF Content-Type ---
// Legacy servers and CMS download endpoints often serve genuine PDFs with
// a generic binary content type; those used to skip interception entirely
// and land in the Downloads folder instead of this viewer. A bare
// octet-stream alone proves nothing — it is exactly what every exe/zip/
// docx download uses — so such responses are claimed only when an
// unambiguous .pdf name signal corroborates them:
//   * the URL path ends in .pdf, or a query parameter value does
//   * the Content-Disposition filename ends in .pdf (RFC 5987
//     filename*= handled; quoted and bare forms both parsed)
// Anything without one of those signals keeps native handling, so real
// software/document downloads are never yanked into a "not a valid PDF"
// error page.
function headersSuggestPdf(url, responseHeaders) {
  try {
    const u = new URL(url);
    if (/\.pdf$/i.test(u.pathname)) return true;
    for (const value of u.searchParams.values()) {
      if (/\.pdf$/i.test(value)) return true;
    }
    const cdHeader = responseHeaders.find(h => h.name.toLowerCase() === 'content-disposition');
    if (cdHeader) {
      const m = /filename\*?\s*=\s*(?:"([^"]*)"|([^;\s]+))/i.exec(cdHeader.value);
      const name = m ? (m[1] !== undefined ? m[1] : m[2]).replace(/^UTF-8''/i, '').trim() : '';
      if (/\.pdf$/i.test(name)) return true;
    }
  } catch (e) {}
  return false;
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    // ONLY intercept main frame navigations. Ignore xmlhttprequest/fetch from pdf.js
    if (details.type !== 'main_frame') return;

    const url = details.url;
    if (url.includes(chrome.runtime.id) && url.includes('/pdf/web/custom-viewer.html')) return;
    if (isAlreadyRedirected(details.tabId, url)) return; // dedupe with webNavigation listener

    const contentTypeHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
    const contentType = contentTypeHeader ? contentTypeHeader.value.toLowerCase() : '';
    if (contentType.includes('application/pdf')) {
      redirectToPdfViewer(details.tabId, url);
      return;
    }
    // Generic-binary PDFs (see headersSuggestPdf): intercepted only with a
    // corroborating .pdf name signal; everything else keeps native handling.
    if (contentType.includes('octet-stream') && headersSuggestPdf(url, details.responseHeaders)) {
      redirectToPdfViewer(details.tabId, url);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// --- Diagnostic Test Connection Handler ---
async function handleTestConnection(request, sendResponse) {
  try {
    const data = await new Promise(resolve => {
      chrome.storage.sync.get(['models', 'defaultModelId', 'tavilyApiKey'], resolve);
    });

    const { models = [], defaultModelId, tavilyApiKey } = data;
    let modelToTest = null;

    if (request.modelConfig) {
      // Direct config passed from model form (testing before saving)
      modelToTest = request.modelConfig;
    } else if (request.modelId) {
      modelToTest = models.find(m => m.id === request.modelId);
    } else if (defaultModelId) {
      modelToTest = models.find(m => m.id === defaultModelId);
    } else if (models.length > 0) {
      modelToTest = models[0];
    }

    const steps = [];

    const failEarly = (configMsg, summaryMsg) => {
      steps.push({
        id: "config",
        status: "fail",
        title: "1. Storage & Configuration Check",
        message: configMsg
      });
      steps.push({
        id: "reachability",
        status: "pending",
        title: "2. Endpoint Reachability Check",
        message: "Skipped (configuration check failed)."
      });
      steps.push({
        id: "auth",
        status: "pending",
        title: "3. Authentication & Model Response Check",
        message: "Skipped."
      });
      steps.push({
        id: "search",
        status: "pending",
        title: "4. Web Search Integration Check",
        message: "Skipped."
      });
      sendResponse({
        success: false,
        steps: steps,
        summary: summaryMsg || `Setup test failed: ${configMsg}`
      });
    };

    // Step 1: Storage & Configuration Check
    if (!modelToTest) {
      failEarly(
        "No AI model is configured or selected.",
        "Setup test failed: No AI model configured."
      );
      return;
    }

    const { endpointUrl, modelName, apiKey, name: configName, enableSearchGrounding } = modelToTest;

    if (!endpointUrl || typeof endpointUrl !== 'string' || !endpointUrl.trim()) {
      failEarly(
        "Endpoint URL is missing. Please provide a valid API endpoint.",
        "Setup test failed: Endpoint URL is missing."
      );
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(endpointUrl.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error("Invalid protocol");
      }
    } catch (e) {
      failEarly(
        `Endpoint URL is malformed: "${endpointUrl}". Must start with http:// or https://.`,
        "Setup test failed: Endpoint URL is malformed."
      );
      return;
    }

    if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
      failEarly(
        "Model Name is missing. Please enter the model ID (e.g. gemini-2.5-flash, llama3, gpt-4o-mini).",
        "Setup test failed: Model Name is missing."
      );
      return;
    }

    const isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    let configDetail = `Config: "${configName || modelName}" | Host: ${parsedUrl.hostname} | Model: ${modelName.trim()}`;
    if (!apiKey && !isLocal) {
      configDetail += " (Notice: No API key set — make sure this provider allows unauthenticated requests)";
    }
    steps.push({
      id: "config",
      status: "pass",
      title: "1. Storage & Configuration Check",
      message: configDetail
    });

    // Step 2 & 3: Reachability & Auth/Model Verification
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const testPayload = {
      model: modelName.trim(),
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
      stream: false
    };

    const startTime = Date.now();
    let response;
    try {
      response = await fetchWithTimeout(endpointUrl.trim(), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(testPayload)
      }, 15000);
    } catch (networkError) {
      const isTimeout = networkError.message && networkError.message.includes("timed out");
      let reachabilityMsg = "";
      if (isTimeout) {
        reachabilityMsg = `Connection timed out after 15s when trying to reach ${parsedUrl.hostname}. Check if the server is responding.`;
      } else if (isLocal) {
        reachabilityMsg = `Could not connect to local server at ${parsedUrl.origin}. Is Ollama or your local LLM running? If using Ollama, make sure CORS is enabled (e.g., OLLAMA_ORIGINS="*").`;
      } else {
        reachabilityMsg = `Network connection failed when reaching ${parsedUrl.hostname}: ${networkError.message}. Check your internet connection or URL spelling.`;
      }

      steps.push({
        id: "reachability",
        status: "fail",
        title: "2. Endpoint Reachability Check",
        message: reachabilityMsg
      });
      steps.push({
        id: "auth",
        status: "pending",
        title: "3. Authentication & Model Response Check",
        message: "Skipped due to reachability failure."
      });
      steps.push({
        id: "search",
        status: "pending",
        title: "4. Web Search Integration Check",
        message: "Skipped."
      });

      sendResponse({
        success: false,
        steps: steps,
        summary: `Setup test failed: ${reachabilityMsg}`
      });
      return;
    }

    const latencyMs = Date.now() - startTime;

    // Passed reachability!
    steps.push({
      id: "reachability",
      status: "pass",
      title: "2. Endpoint Reachability Check",
      message: `Successfully reached ${parsedUrl.hostname} (${latencyMs}ms roundtrip).`
    });

    // Step 3: Check response status & body
    if (response.ok) {
      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (e) {
        // Non-JSON response
      }

      steps.push({
        id: "auth",
        status: "pass",
        title: "3. Authentication & Model Response Check",
        message: `API Key & Model Verified! Model "${modelName}" responded successfully in ${latencyMs}ms.`
      });
    } else {
      let errorDetail = "";
      try {
        const errorJson = await response.json();
        errorDetail = (typeof errorJson.error === 'string' ? errorJson.error : errorJson.error?.message) || errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      } catch (e) {
        try {
          errorDetail = await response.text();
        } catch (e2) {
          errorDetail = response.statusText || `HTTP ${response.status}`;
        }
      }

      let authMsg = "";
      if (response.status === 401 || response.status === 403) {
        if (!apiKey || !apiKey.trim()) {
          authMsg = `Authentication Failed (HTTP ${response.status}): This online provider requires an API key. Please enter your API key in the API Key field. (Provider response: ${errorDetail})`;
        } else {
          authMsg = `Authentication Failed (HTTP ${response.status}): Your API key is invalid, expired, or missing permissions for this model. (Provider response: ${errorDetail})`;
        }
      } else if (response.status === 404) {
        authMsg = `Model or Endpoint Not Found (HTTP 404): The endpoint URL path or the model name "${modelName}" is not recognized by the provider. (Provider response: ${errorDetail})`;
      } else if (response.status === 429) {
        authMsg = `Rate Limit or Quota Exceeded (HTTP 429): You have run out of API credits or exceeded the request rate limit. (Provider response: ${errorDetail})`;
      } else if (response.status === 400 || response.status === 422) {
        authMsg = `Bad Request (HTTP ${response.status}): Provider rejected the test request. Model name "${modelName}" may be invalid or deprecated. (Provider response: ${errorDetail})`;
      } else {
        authMsg = `Provider returned HTTP error ${response.status}: ${errorDetail}`;
      }

      steps.push({
        id: "auth",
        status: "fail",
        title: "3. Authentication & Model Response Check",
        message: authMsg
      });

      steps.push({
        id: "search",
        status: "pending",
        title: "4. Web Search Integration Check",
        message: "Skipped due to authentication failure."
      });

      sendResponse({
        success: false,
        steps: steps,
        summary: `Setup test failed: ${authMsg}`
      });
      return;
    }

    // Step 4: Web Search Check
    if (enableSearchGrounding) {
      if (!tavilyApiKey || !tavilyApiKey.trim()) {
        steps.push({
          id: "search",
          status: "warn",
          title: "4. Web Search Integration Check",
          message: "Web search is enabled for this model, but no Tavily API Key is configured in settings. Web grounding will not work until you add a Tavily key in Search API Settings."
        });
      } else {
        try {
          const tavilyRes = await fetchWithTimeout("https://api.tavily.com/search", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: tavilyApiKey.trim(), query: "test", max_results: 1 })
          }, 10000);

          if (tavilyRes.ok) {
            steps.push({
              id: "search",
              status: "pass",
              title: "4. Web Search Integration Check",
              message: "Tavily Web Search API is verified and operational."
            });
          } else {
            steps.push({
              id: "search",
              status: "fail",
              title: "4. Web Search Integration Check",
              message: `Tavily Search check failed with HTTP ${tavilyRes.status}. Please check your Tavily API Key in Search API Settings.`
            });
          }
        } catch (tavilyErr) {
          steps.push({
            id: "search",
            status: "fail",
            title: "4. Web Search Integration Check",
            message: `Could not reach Tavily Search API: ${tavilyErr.message}`
          });
        }
      }
    } else {
      steps.push({
        id: "search",
        status: "skipped",
        title: "4. Web Search Integration Check",
        message: "Web search is disabled for this model (Optional)."
      });
    }

    const hasFailure = steps.some(s => s.status === "fail");
    const hasWarning = steps.some(s => s.status === "warn");

    let summaryText = "All checks passed! Infopedia is configured properly and ready to use.";
    if (hasWarning) {
      summaryText = "Core AI setup passed! Notice: Web search has a warning (check Tavily settings).";
    }

    sendResponse({
      success: !hasFailure,
      steps: steps,
      summary: summaryText
    });

  } catch (unexpectedError) {
    sendResponse({
      success: false,
      steps: [
        {
          id: "general",
          status: "fail",
          title: "Diagnostic Execution Error",
          message: unexpectedError.message || String(unexpectedError)
        }
      ],
      summary: `Diagnostic test failed: ${unexpectedError.message}`
    });
  }
}

