// Regression tests for the FSRS engine in fsrs.js (no browser or server):
//   node tests/test-fsrs.js
// Covers:
//   - the scheduler against golden values produced by the reference
//     ts-fsrs 5.4.1 (default weights, no fuzz, UTC)
//   - the optimizer's loss replay reproducing the scheduler's own memory
//     states (stability uses the pre-review difficulty)
//   - cards whose review log does not start at their first review
//     (migrated / logged mid-life) being left out of training
//   - the optimizer refusing too little data, and keeping fitted weights only
//     when they beat the defaults on held-out cards
'use strict';
// Local-midnight day counting makes results depend on the timezone; pin it
// before any Date is created.
process.env.TZ = 'UTC';
const assert = require('node:assert/strict');
const path = require('node:path');
const FSRS = require(path.join(__dirname, '..', 'fsrs.js'));

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

// Small seeded PRNG (mulberry32) so simulated histories are reproducible.
// A plain LCG is not good enough here: its consecutive outputs correlate, so
// the random review timing would leak into the random recall outcome.
function prng(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simulated learner reviewing `cards` cards through the real scheduler.
// Recall follows the FSRS forgetting curve with the scheduler's stability
// times `k` (k < 1: forgets faster than the model predicts).
function simulate(cards, k, rnd) {
  const decay = -FSRS.getWeights()[20];
  const factor = Math.pow(0.9, 1 / decay) - 1;
  const history = [];
  for (let c = 0; c < cards; c++) {
    const item = {};
    let now = Date.UTC(2026, 0, 1) + Math.floor(rnd() * 200 * DAY);
    for (let n = 0; n < 12; n++) {
      const t = item.lastReviewed ? FSRS._calendarDaysBetween(item.lastReviewed, now) : 0;
      let rating;
      if (!item.state || t === 0) {
        const x = rnd();
        rating = x < 0.15 ? 1 : x < 0.25 ? 2 : x < 0.9 ? 3 : 4;
      } else if (rnd() < Math.pow(1 + factor * t / (k * item.stability), decay)) {
        const x = rnd();
        rating = x < 0.15 ? 2 : x < 0.9 ? 3 : 4;
      } else {
        rating = 1;
      }
      Object.assign(item, FSRS.rate(item, rating, now));
      now = item.nextReview + Math.floor(rnd() * 0.3 * Math.max(item.nextReview - now, 0));
    }
    history.push(item);
  }
  return history;
}

// Log-loss computed straight from the memory states the scheduler logged
// before each review: what the optimizer's replay must reproduce.
function lossFromLoggedStates(history, weights) {
  const decay = -weights[20];
  const factor = Math.pow(0.9, 1 / decay) - 1;
  let total = 0;
  let count = 0;
  history.forEach((item) => {
    item.reviewLog.forEach((entry, i) => {
      if (i === 0 || !(entry.elapsedDays > 0)) return;
      const r = Math.min(Math.max(Math.pow(1 + factor * entry.elapsedDays / entry.stability, decay), 1e-5), 1 - 1e-5);
      const y = entry.rating >= 2 ? 1 : 0;
      total += -(y * Math.log(r) + (1 - y) * Math.log(1 - r));
      count++;
    });
  });
  return { logLoss: total / count, count };
}

// 1. Scheduler parity with ts-fsrs 5.4.1: one card through learning,
//    graduation, review, a lapse, relearning, and Hard/Easy answers.
//    [review time, rating, state, stability, difficulty, due]
const GOLDEN = [
  ['2026-03-01T09:00:00Z', 3, 'learning', 2.3065, 2.11810397, '2026-03-01T09:10:00Z'],
  ['2026-03-01T09:10:00Z', 3, 'review', 2.3065, 2.11121424, '2026-03-03T09:10:00Z'],
  ['2026-03-03T09:10:00Z', 3, 'review', 10.97104786, 2.1043314, '2026-03-14T09:10:00Z'],
  ['2026-03-14T09:10:00Z', 1, 'relearning', 1.5390125, 7.38997579, '2026-03-14T09:20:00Z'],
  ['2026-03-15T09:20:00Z', 3, 'review', 3.55589443, 7.37781418, '2026-03-19T09:20:00Z'],
  ['2026-03-19T09:20:00Z', 2, 'review', 7.22637315, 8.24449923, '2026-03-26T09:20:00Z'],
  ['2026-03-26T12:20:00Z', 4, 'review', 21.35248894, 7.64312105, '2026-04-16T12:20:00Z'],
  ['2026-04-18T12:20:00Z', 3, 'review', 45.79625653, 7.6307063, '2026-06-03T12:20:00Z'],
  ['2026-06-03T12:20:00Z', 1, 'relearning', 2.70129074, 9.20645764, '2026-06-03T12:30:00Z'],
  ['2026-06-03T12:30:00Z', 1, 'relearning', 0.89836242, 9.72439639, '2026-06-03T12:40:00Z'],
  ['2026-06-03T12:40:00Z', 2, 'relearning', 0.89836242, 9.80226985, '2026-06-03T12:55:00Z'],
  ['2026-06-03T12:55:00Z', 3, 'review', 0.95060833, 9.78769595, '2026-06-04T12:55:00Z']
];
FSRS.setWeights(null);
const card = {};
GOLDEN.forEach(([at, rating, state, stability, difficulty, due], i) => {
  Object.assign(card, FSRS.rate(card, rating, Date.parse(at)));
  assert.deepEqual(
    { state: card.state, stability: card.stability, difficulty: card.difficulty, due: card.nextReview },
    { state, stability, difficulty, due: Date.parse(due) },
    `scheduler step ${i + 1} matches ts-fsrs`);
});

// 2. The loss replay reproduces the scheduler's memory states, under the
//    defaults and under different weights (where the order of the
//    difficulty and stability updates matters more).
const perturbed = FSRS.getDefaultWeights().map((w, i) => (i === 6 ? 2.5 : i === 7 ? 0.2 : i === 9 ? 0.4 : w));
[[null, 'default'], [perturbed, 'perturbed']].forEach(([weights, label]) => {
  FSRS.setWeights(weights);
  const active = FSRS.getWeights();
  const history = simulate(60, 1, prng(11));
  const expected = lossFromLoggedStates(history, active);
  const actual = FSRS.evaluateLoss(history, active);
  assert.equal(actual.predictionCount, expected.count, `${label}: same multi-day reviews scored`);
  assert.ok(Math.abs(actual.logLoss - expected.logLoss) < 1e-7,
    `${label} weights: replayed loss ${actual.logLoss} matches the scheduler's states ${expected.logLoss}`);
});
FSRS.setWeights(null);

// 3. Only logs that start at the card's first review are used.
const fresh = simulate(1, 1, prng(3))[0];
const migrated = { word: 'old', lastReviewed: Date.UTC(2026, 0, 1), interval: 5 * DAY };
[Date.UTC(2026, 0, 6), Date.UTC(2026, 0, 20), Date.UTC(2026, 1, 15)].forEach((at) => {
  Object.assign(migrated, FSRS.rate(migrated, 3, at));
});
assert.equal(migrated.reviewLog[0].state, 'review', 'a migrated card logs its first FSRS review as a review');
const midLife = { ...fresh, reviewLog: fresh.reviewLog.slice(2) };
assert.notEqual(midLife.reviewLog[0].state, 'new', 'the mid-life log does not start at a new card');
const stats = FSRS.trainingStats([fresh, migrated, midLife]);
assert.equal(stats.cardCount, 1, 'migrated and mid-life cards are left out');
assert.equal(stats.reviewCount, FSRS.evaluateLoss([fresh]).predictionCount, 'only the full log is counted');
assert.equal(FSRS.evaluateLoss([migrated, midLife]).cardCount, 0, 'the loss skips them too');

// 4. Too little data is refused outright. 21 parameters fitted to a few
//    dozen reviews predict new reviews far worse than the defaults.
assert.equal(FSRS.MIN_OPTIMIZE_POINTS, 200, 'the optimizer needs 200 multi-day reviews');
const small = simulate(15, 1, prng(5));
assert.ok(FSRS.trainingStats(small).reviewCount < 200, 'fixture is below the minimum');
const tooSmall = FSRS.optimize(small, { epochs: 5 });
assert.equal(tooSmall.success, false, 'fewer than the minimum multi-day reviews is refused');
assert.match(tooSmall.error, /of 200 multi-day reviews/);
assert.deepEqual(tooSmall.weights, FSRS.getDefaultWeights());

// Enough reviews but from too few cards to hold any out.
const fewCards = simulate(30, 1, prng(6));
assert.ok(FSRS.trainingStats(fewCards).reviewCount >= FSRS.MIN_OPTIMIZE_POINTS, 'fixture has enough reviews');
const fewCardsResult = FSRS.optimize(fewCards, { epochs: 5 });
assert.equal(fewCardsResult.success, false, 'too few held-out cards is refused');
assert.match(fewCardsResult.error, /held-out cards/);

// 5. Held-out check: every 5th usable card is held out. Train on a learner
//    who forgets fast but hold out cards from one who remembers well, so a
//    fit to the training cards predicts the held-out cards worse.
const fast = simulate(64, 0.35, prng(21));
const slow = simulate(16, 2.5, prng(22));
const mixed = [];
for (let i = 0, f = 0, s = 0; i < 80; i++) mixed.push(i % 5 === 4 ? slow[s++] : fast[f++]);
const contradicted = FSRS.optimize(mixed, { epochs: 40 });
assert.equal(contradicted.success, true, 'mixed history is large enough to optimize');
assert.equal(contradicted.keptDefaults, true, 'a fit that predicts held-out cards worse is not kept');
assert.deepEqual(contradicted.weights, FSRS.getDefaultWeights());
assert.ok(contradicted.optimizedLoss > contradicted.initialLoss, 'and its held-out loss is reported as worse');
assert.ok(contradicted.heldOutCount > 0 && contradicted.heldOutCount < contradicted.reviewCount, 'held-out reviews are a subset');

console.log('FSRS TEST PASSED: scheduler matches ts-fsrs, loss replay matches the scheduler, migrated logs skipped, small data refused, held-out check enforced.');
