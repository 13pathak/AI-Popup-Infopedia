// Popup placement: the answer popup must sit beside the selection (below,
// above, right, left) instead of covering it, stay inside the viewport, and
// fall back to the top-right corner when there is nothing to keep clear.
// Runs the real placement functions from content.js.
// Run: node tests/test-popup-placement.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const content = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const start = content.indexOf('// --- Popup placement around the selection ---');
const end = content.indexOf('// --- NEW: Save Conversation as PDF ---');
assert.ok(start >= 0 && end > start, 'placement section found in content.js');

const context = vm.createContext({ window: { innerWidth: 1280, innerHeight: 800 } });
vm.runInContext(content.slice(start, end), context);
const { computePopupPlacement, adjustPopupPosition } = context;
const MARGIN = vm.runInContext('POPUP_EDGE_MARGIN', context);
const MIN_HEIGHT = vm.runInContext('POPUP_MIN_HEIGHT', context);

const sel = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });

// The box the popup can occupy at most: its slot at full max-height.
function box(spot, vh, width) {
  const top = spot.top !== null ? spot.top : vh - spot.bottom - spot.maxHeight;
  return { left: spot.left, right: spot.left + width, top, bottom: top + spot.maxHeight };
}
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function assertClear(spot, s, vw, vh, width, label) {
  const b = box(spot, vh, width);
  assert.equal(overlaps(b, s), false, `${label}: popup must not cover the selection`);
  assert.ok(b.left >= MARGIN - 0.5 && b.right <= vw - MARGIN + 0.5, `${label}: horizontally inside the viewport`);
  assert.ok(b.top >= MARGIN - 0.5 && b.bottom <= vh - MARGIN + 0.5, `${label}: vertically inside the viewport`);
  assert.ok(spot.maxHeight >= MIN_HEIGHT, `${label}: usable height`);
  assert.ok((spot.top === null) !== (spot.bottom === null), `${label}: exactly one vertical anchor`);
}

// A word near the top of a short article (the reported case) goes below it,
// left-aligned with the word.
let s = sel(520, 70, 60, 20);
let spot = computePopupPlacement(s, 1280, 800, 365);
assert.equal(spot.placement, 'below');
assert.equal(spot.left, 520);
assert.equal(spot.top, 100);
assert.equal(spot.maxHeight, 680, 'capped by the CSS 85vh');
assertClear(spot, s, 1280, 800, 365, 'top of page');

// Near the bottom of the viewport: above, anchored by its bottom edge so it
// grows upward toward the top of the screen.
s = sel(300, 700, 80, 20);
spot = computePopupPlacement(s, 1280, 800, 365);
assert.equal(spot.placement, 'above');
assert.equal(spot.top, null);
assert.equal(spot.bottom, 110);
assertClear(spot, s, 1280, 800, 365, 'bottom of page');

// A word at the right edge: still below, shifted left to stay on screen.
s = sel(1200, 70, 60, 20);
spot = computePopupPlacement(s, 1280, 800, 365);
assert.equal(spot.placement, 'below');
assert.equal(spot.left, 1280 - 365 - MARGIN);
assertClear(spot, s, 1280, 800, 365, 'right edge');

// Short window, selection mid-screen: neither vertical slot is comfortable,
// so the popup goes beside the selection with more height.
s = sel(400, 240, 200, 20);
spot = computePopupPlacement(s, 1280, 500, 365);
assert.equal(spot.placement, 'right');
assert.equal(spot.left, 610);
assert.ok(spot.maxHeight > 240, 'side slot is taller than either vertical slot');
assertClear(spot, s, 1280, 500, 365, 'short window, right');

s = sel(1000, 240, 200, 20);
spot = computePopupPlacement(s, 1280, 500, 365);
assert.equal(spot.placement, 'left');
assert.equal(spot.left, 1000 - 10 - 365);
assertClear(spot, s, 1280, 500, 365, 'short window, left');

// Narrow and short: no room at the sides, so the larger vertical slot.
s = sel(100, 240, 200, 20);
spot = computePopupPlacement(s, 400, 500, 365);
assert.equal(spot.placement, 'below');
assertClear(spot, s, 400, 500, 365, 'narrow and short');

// A selection running past the bottom edge (or entirely below it) only
// counts for its on-screen part; the popup stays inside the viewport.
for (const r of [sel(169, 690, 300, 40), sel(169, 713, 60, 17)]) {
  spot = computePopupPlacement(r, 800, 700, 365);
  assert.equal(spot.placement, 'above');
  assertClear(spot, r, 800, 700, 365, 'selection past the bottom edge');
}

// A selection filling the screen leaves no usable slot.
assert.equal(computePopupPlacement(sel(20, 20, 1240, 760), 1280, 800, 365), null);

// Property check across viewports and selections: any slot returned keeps
// the selection clear and the popup on screen.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let placed = 0;
for (const [vw, vh] of [[1280, 800], [1920, 1080], [800, 600], [375, 667], [1024, 400]]) {
  const width = Math.min(365, vw - 24);
  for (let i = 0; i < 400; i++) {
    const w = 4 + rand() * Math.min(600, vw - 8), h = 14 + rand() * (rand() < 0.8 ? 30 : vh / 2);
    // Some selections run past an edge of the viewport.
    const l = rand() * (vw - w * 0.6) - w * 0.2, t = rand() * (vh - h * 0.6) - h * 0.2;
    const r = sel(l, t, w, h);
    const p = computePopupPlacement(r, vw, vh, width);
    if (!p) continue;
    placed++;
    assertClear(p, r, vw, vh, width, `${vw}x${vh} #${i}`);
  }
}
assert.ok(placed > 1800, `most random selections get a slot (${placed}/2000)`);

// adjustPopupPosition applies the slot to the popup's inline style.
const popup = () => ({ offsetWidth: 365, style: { top: '0px', left: '0px', right: '', bottom: '', maxHeight: '' } });
let instance = { popup: popup() };
adjustPopupPosition(instance, sel(300, 700, 80, 20));
assert.deepEqual({ ...instance.popup.style }, { top: 'auto', left: '300px', right: 'auto', bottom: '110px', maxHeight: '678px' });

adjustPopupPosition(instance, sel(520, 70, 60, 20));
assert.deepEqual({ ...instance.popup.style }, { top: '100px', left: '520px', right: 'auto', bottom: 'auto', maxHeight: '680px' }, 'a later slot clears the earlier anchor');

const corner = { top: '20px', left: 'auto', right: '20px', bottom: 'auto', maxHeight: '' };
for (const rect of [null, sel(0, 0, 0, 0), sel(20, 20, 1240, 760)]) {
  instance = { popup: popup() };
  adjustPopupPosition(instance, rect);
  assert.deepEqual({ ...instance.popup.style }, corner, 'no selection to avoid (or no room): top-right corner');
}

instance = { popup: popup(), isDragged: true };
adjustPopupPosition(instance, sel(520, 70, 60, 20));
assert.equal(instance.popup.style.left, '0px', 'a dragged popup stays where the user put it');

console.log('Popup placement tests passed.');
