# Fix #35 chip layout: move chips into the answer layer

**Problem:** the chips row sits in the fixed (non-scrolling) region between the answer viewport and the follow-up input. AI-generated suggestions are long (up to ~60–80 chars), so each wraps onto its own full-width row — ~25–30% of the popup's height — and the answer card's visible area shrinks, clipping the end of the output.

**Fix (as you proposed):** render the chips inside the answer card body, immediately after the latest settled answer. They scroll with the conversation, appear only once the output has ended, and occupy zero fixed height. Bonus: in compare mode each model's card shows its **own** suggestions (more accurate than the current front-card pick), and the per-render storage read goes away.

## Changes — all in content.js (background/tests untouched)

1. **Cache chip settings on the popup instance** — extend the existing one-time `chrome.storage.sync.get` in `showPopup` (~line 2700, the `showUserQuestions` idiom) to also read `followupChips` and `enableFollowupSuggestions` onto `instance.followupChips` / `instance.enableFollowupSuggestions`. The card renderer runs every ~80ms during streaming; storage reads belong at popup creation, not in render.

2. **New `appendFollowupChips(instance, body, slot)`** called from `appendCompareConversation` (after the message loop, ~line 4019):
   - Renders only when the slot's last non-volatile message is a **settled assistant turn** — nothing while thinking/streaming/error/awaiting an answer, so chips literally manifest after the AI output ends and vanish the moment a new question is asked.
   - Chip list = cached static chips + that message's own `suggestions` (gated by the setting), deduped case-insensitively, capped at 8.
   - Row: `div.ai-compare-chips` (flex-wrap) appended to the card body; pills reuse the existing `.ai-popup-followup-chip` style.
   - Click → the existing `dispatchFollowupText` (identical to typing); `pointerdown` keeps the `instance.isInteracting` dismissal guard. No disabled state needed: chips only exist when the card is settled, and clicking during another card's stream queues the follow-up through the existing straggler/pending queue — the same behavior as the unlocked input.

3. **Remove the fixed row** — delete the `#ai-popup-followup-chips` div creation in `createFollowupInput`, delete `refreshFollowupChipRow` and its call in `updateCompareFollowupState` (restoring the original ending), and revert `#ai-popup-followup-container` to its original single-row CSS (`align-items: center`, no column/gap). Replace the old `#ai-popup-followup-chips` CSS with the in-card `.ai-compare-chips` row styles; drop the now-unused disabled-state rules. `dispatchFollowupText` and the `submitFollowup` refactor stay as-is.

4. **Wording** — update the Issue #35 comment blocks in content.js/background.js and the readme bullet from "above the follow-up input" to "after the latest answer, inside the answer card".

## Verification

`node --check content.js`, re-run the five unit suites (`tests/test-suggestions.js` etc. — background is untouched so they must stay green), and a manual unpacked-extension pass: long answer fully visible with chips below it inside the scroll area, chips reappearing after each settled answer, compare cards each showing their own suggestions, click still dispatching a follow-up.