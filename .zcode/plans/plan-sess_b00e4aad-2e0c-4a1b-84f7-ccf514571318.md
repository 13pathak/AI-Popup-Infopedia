# Issue #35 — Follow-up Action Chips via piggybacked AI suggestions (hybrid)

Add a row of pill "chips" above the follow-up input. Static customizable chips (from settings) always render; up to 3 AI-generated contextual suggestions ride along with the **same** answer request — a `[[SUGGESTIONS]]` trailer the model appends, parsed and stripped in the background worker — at **zero extra requests** (~60 extra prompt tokens per ask).

## 1. background.js — trailer protocol (new block near the pronunciation code, ~line 678)

**Constants & helpers** (tagged `Issue #35`):
- `SUGGESTIONS_MARKER = '[[SUGGESTIONS]]'`
- `SUGGESTIONS_INSTRUCTION` — appended to the outbound user message when enabled:
  > `After your answer, start a new line with exactly [[SUGGESTIONS]] and then list 3 short follow-up questions a curious reader might ask next, one per line. Each under 60 characters, no numbering, no bullets, same language as your answer. Write nothing after the list.`
- `extractSuggestions(fullText)` (pure, the authoritative parse): find the **last** occurrence of the marker; cut `text` at the marker (marker→EOF is the trailer); sanitize the following lines — trim, strip leading `- ` / `* ` / `1. ` list markers, drop empty lines and lines > 80 chars, dedupe case-insensitively, cap at 4. Returns `{ text, suggestions: string[] | null }` (null when 0 valid lines; text unchanged when no marker). Truncation applies even when the list parses to nothing — the marker is never shown to the user.
- `createSuggestionsStreamFilter()` (cosmetic-only, for live deltas): stateful holdback — buffer incoming delta text, never emit anything from a completed marker onward; hold back any trailing partial-prefix of the marker so a marker split across SSE chunks never flashes on screen; `flush()` emits an unterminated held-back tail; `reset()` clears state.

**Wire-up:**
- Setting: read `enableFollowupSuggestions` via the existing `getSecretStorageConfig` defaults call at background.js:918-926 (default `true`).
- Injection (~background.js:1014-1020, without mutating the echoed `usedPrompt`/cache-keyed `prompt`): when enabled, append the instruction to the fresh-ask user message (`safeMessagesText = [{ role: "user", content: prompt + INSTRUCTION }]`) and, for follow-up turns, to the **last `role === 'user'` message of the local `safeMessagesText` copy** (popup-owned history is never mutated, so the instruction never echoes back in later turns).
- Live deltas: inside `emitStreamDelta` (background.js:962-970), reset the filter in the existing `if (streamResetPending)` block (single site — covers fallback retries and search-loop re-fetches at 1192/1207/1348/1372 automatically) and pass deltas through the filter before emitting.
- Final assembly: in the attempt function's return (background.js:1421), run `extractSuggestions(aiText)` so `definition`, the cache write (1467-1476), and `sendResponse` (1479-1494) all carry clean text; return `suggestions` alongside. Add `suggestions: answer.suggestions || null` to `sendResponse`.
- Cache (Issue #29): store `suggestions` in the entry; on the hit path (1079-1090) replay it only when the setting is currently enabled.
- Strip runs regardless of the setting (defense-in-depth); only the *instruction* is gated.

## 2. content.js — chip row UI

- **Attach**: in `settleCompareSlot` (content.js:3346) add `assistantMsg.suggestions = Array.isArray(response.suggestions) ? response.suggestions : null` to the assistant message (state-driven — survives the 80ms `renderCompareView` re-renders).
- **Mount**: a chips row as the first child of `#ai-popup-followup-container` (before `inputWrapper`, content.js:4703-4714) — the container is persistent (never wiped) and is the insertion anchor for compare nav/toolbar, so chips live *inside* it.
- **Render** — `refreshFollowupChipRow(instance)`, called from `updateCompareFollowupState` (content.js:3412, which settle/restore already invoke):
  - Source: the **front card's** latest assistant message with `suggestions` (consistent with the input gating on the front card at 3418-3422; single-model popups have exactly one slot).
  - Row content = static chips (from settings, in order) then AI suggestions, deduped by normalized text; row hidden when empty.
  - Chips share the input's disabled/straggler lock state; `pointerdown` sets `instance.isInteracting` (pattern at 4717-4718) so clicking doesn't dismiss the popup.
- **Click** — extract `dispatchFollowupText(instance, text)` from `submitFollowup` (4928-4953): appends `followupCustomMessage`, sets `followupSubmitPending`, calls `runCompareFollowup(instance, promptToSend, text)`. `submitFollowup` and chip clicks both use it, so a chip behaves exactly like typing its text.
- **Stash/restore**: keep `suggestions` (non-empty array) in `buildConversationStash` message shape (4992-4996) and the restore filter (5044-5045) so reopened conversations show their chips.
- **CSS**: pill styling per the `.ai-popup-button` idiom (688-712) with existing tokens (`--popup-accent-rgb` etc.), `flex-wrap: wrap` row, slightly smaller than action buttons. Chip labels assigned via `textContent` (model text is escaped by construction).
- PDF export, history saves, and Hallucination Guard all consume `definition`/`msg.content`, which are already stripped at source — no changes needed there.

## 3. Options & settings registration

- **options.html**: extend `#followup-settings-container` (options.html:1892-1899) — a `#ai-followup-suggestions-checkbox` toggle (pattern of 1901-1908) and a `#static-followup-chips` textarea (one chip per line, help text noting emoji prefixes and free text are fine). No new section or save button.
- **options.js**: extend `saveFollowupSettings`/`loadFollowupSettings` (1894-1916) to persist `enableFollowupSuggestions` (bool) and `followupChips` (array of strings; default `['💡 Simpler', '📝 2 Examples', '🏛️ Etymology']`); checkbox auto-saves on change like `showUserQuestions` (244-250).
- **Registration checklist** (both required or settings silently vanish from backups/restore): add both keys to `syncKeys` (options.js:3987-3996) and to the `backupInclude.general` export block (background.js:2324-2331).
- content.js reads defaults inline (`chrome.storage.sync.get({ followupChips: [...] })`) per the 4941 idiom.

## 4. Tests — `tests/test-suggestions.js`

Copy the `vm` + chrome-stub skeleton from `tests/test-pronunciation.js:19-135`; assert-style, `process.exitCode` on failure.
- `extractSuggestions` units: no marker (text unchanged, null); marker + 3 clean lines; >4 lines capped; long/empty/garbage lines dropped; list-marker prefixes stripped; marker with nothing valid after → null suggestions, text truncated; dedupe.
- Filter units: marker split across deltas (`'...answer[[SUG'` + `'GESTIONS]]\nq1'`); plain-text passthrough; unterminated partial marker flushed by `flush()`; `reset()` after a mid-stream failure so a fallback model's text never mixes with the previous capture.
- Handler-level via `runtime.onMessage._fire`: stubbed streaming `fetch` whose SSE answer ends with the trailer → `response.definition` clean, `response.suggestions` present, outbound payload contains the instruction appended to the user message; setting disabled → no instruction, stripping still applied; follow-up `messages` request gets the instruction on a *copy* (original array unmutated); cache round-trip replays `suggestions` without a second fetch, and drops them when the setting is off.
- Register as a step in `tests/run-all.js` (spawn block pattern, ~110-119) and document in `tests/README.md`.

## 5. Docs

- readme.md: bold bullet under `### Core Features` (near the follow-up/prompt bullets, readme.md:37-45) describing the chip row, its settings, and the zero-extra-request design.
- Code comments and test header tagged `Issue #35`, matching repo convention.

## Verification

Run `node tests/test-suggestions.js`, then `node tests/run-all.js` (existing 10 steps must stay green), and manually load the unpacked extension to check: chips appear above the follow-up input after an answer, clicking a chip dispatches a follow-up, chips refresh per turn, restored conversations show chips, options edits apply on next popup, and the toggle-off path hides AI chips while keeping static ones.