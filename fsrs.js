// --- FSRS-6 SPACED REPETITION ENGINE ---
//
// A dependency-free port of the FSRS-6 scheduler (the algorithm Anki ships by
// default), following the reference implementation ts-fsrs v5.4.1
// (https://github.com/open-spaced-repetition/ts-fsrs, MIT license).
//
// Each card (a history item) carries a memory model with two values:
//   stability  (S) — days until the probability of recall drops to 90%
//   difficulty (D) — how fast the card's stability grows, 1 (easy) to 10 (hard)
//
// The public surface is intentionally small:
//   FSRS.rate(item, rating, now)  -> patch object to merge into the history item
//   FSRS.isDue(item, now)         -> whether the card should be shown now
//   FSRS.retrievability(item, now)-> current recall probability, or null for new cards
//
// Ratings match the flashcard buttons: 1=Again, 2=Hard, 3=Good, 4=Easy.
// Stored item fields (all optional until first review):
//   nextReview, interval, lastReviewed  — epoch ms (interval = scheduled ms until due)
//   stability, difficulty               — memory model
//   reps, lapses, learningSteps         — counters / learning-step position
//   state                               — 'new' | 'learning' | 'review' | 'relearning'
(function (global) {
  'use strict';

  // --- FSRS-6 default parameters (ts-fsrs default_w). w[20] is DECAY; the
  // others drive initial memory, difficulty updates, and stability growth.
  // Personalized weights from the FSRS optimizer can replace these later.
  const W = [
    0.212, 1.2931, 2.3065, 8.2956,   // 0-3:  initial stability S0(Again/Hard/Good/Easy)
    6.4133, 0.8334,                  // 4-5:  initial difficulty D0(G)
    3.0194, 0.001,                   // 6-7:  difficulty delta, mean reversion
    1.8722, 0.1666, 0.796,           // 8-10: recall stability growth
    1.4835, 0.0614, 0.2629, 1.6483,  // 11-14: post-lapse stability
    0.6014, 1.8729,                  // 15-16: hard penalty, easy bonus
    0.5425, 0.0912, 0.0658,          // 17-19: same-day (short-term) stability
    0.1542                           // 20: forgetting-curve decay
  ];

  const REQUEST_RETENTION = 0.9;   // target recall probability at due time
  const MAX_INTERVAL_DAYS = 36500; // FSRS default ceiling (~100 years)
  const LEARNING_STEPS = [1, 10];  // minutes; a new card graduates through these
  const RELEARNING_STEPS = [10];   // minutes; a lapsed review card re-enters here

  const DAY_MS = 24 * 60 * 60 * 1000;
  const MINUTE_MS = 60 * 1000;
  const S_MIN = 0.001;             // stability floor
  const S_MAX = 36500;             // stability ceiling

  // Forgetting curve: R(t, S) = (1 + FACTOR * t / S)^DECAY, where FACTOR is
  // derived so that R(S days, S) = REQUEST_RETENTION.
  const DECAY = -W[20];
  const FACTOR = roundTo(Math.exp(Math.pow(DECAY, -1) * Math.log(0.9)) - 1, 8);
  // Converts stability directly into a scheduled interval in days.
  const INTERVAL_MODIFIER = roundTo(
    (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1) / FACTOR, 8);

  // --- Math helpers (kept identical to the reference for exact parity) ---
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundTo(num, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  // Probability the card is still remembered after elapsedDays days.
  function forgettingCurve(elapsedDays, stability) {
    return roundTo(Math.pow(1 + FACTOR * elapsedDays / stability, DECAY), 8);
  }

  // Calendar-day difference between two instants (UTC midnights), matching
  // ts-fsrs's dateDiffInDays: 23:50 -> 00:10 counts as one day, not zero.
  function calendarDaysBetween(earlierMs, laterMs) {
    const a = new Date(earlierMs);
    const b = new Date(laterMs);
    const dayA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
    const dayB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
    return Math.floor((dayB - dayA) / DAY_MS);
  }

  // --- Memory-state formulas (FSRS-6) ---

  function initStability(g) {
    return Math.max(W[g - 1], 0.1);
  }

  function initDifficulty(g) {
    return roundTo(W[4] - Math.exp((g - 1) * W[5]) + 1, 8);
  }

  // Difficulty after a review: the rating nudges it (damped near the ends of
  // the 1-10 scale), then it gently reverts toward D0(Easy)'s baseline.
  function nextDifficulty(d, g) {
    const deltaD = -W[6] * (g - 3);
    const damped = d + roundTo(deltaD * (10 - d) / 9, 8);
    const reverted = roundTo(W[7] * initDifficulty(4) + (1 - W[7]) * damped, 8);
    return clamp(reverted, 1, 10);
  }

  // Stability after a successful recall (rating 2-4, day-level review).
  function nextRecallStability(d, s, r, g) {
    const hardPenalty = g === 2 ? W[15] : 1;
    const easyBonus = g === 4 ? W[16] : 1;
    return roundTo(clamp(
      s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) *
        (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus),
      S_MIN, S_MAX), 8);
  }

  // Stability right after a lapse (rating 1, day-level review).
  function nextForgetStability(d, s, r) {
    return roundTo(clamp(
      W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) *
        Math.exp((1 - r) * W[14]),
      S_MIN, S_MAX), 8);
  }

  // Stability after a same-day re-test (minutes, not days, since last review).
  // Hard never shrinks stability; Again cuts it sharply.
  function nextShortTermStability(s, g) {
    const sinc = Math.pow(s, -W[19]) * Math.exp(W[17] * (g - 3 + W[18]));
    const masked = g >= 2 ? Math.max(sinc, 1) : sinc;
    return roundTo(clamp(s * masked, S_MIN, S_MAX), 8);
  }

  // Full memory-state update. t is elapsed days since the last review.
  function nextState(d, s, t, g, r) {
    if (t === 0) {
      // Same-day follow-up: the short-term curve applies regardless of rating.
      return { difficulty: nextDifficulty(d, g), stability: nextShortTermStability(s, g) };
    }
    let newS;
    if (g === 1) {
      const sAfterFail = nextForgetStability(d, s, r);
      const nextSMin = s / Math.exp(W[17] * W[18]);
      newS = clamp(roundTo(nextSMin, 8), S_MIN, sAfterFail);
    } else {
      newS = nextRecallStability(d, s, r, g);
    }
    return { difficulty: nextDifficulty(d, g), stability: newS };
  }

  // Days until recall probability drops to REQUEST_RETENTION.
  function nextInterval(s) {
    return Math.min(Math.max(1, Math.round(s * INTERVAL_MODIFIER)), MAX_INTERVAL_DAYS);
  }

  // --- Learning steps ---
  // What a rating means in minutes for a card still working through its
  // steps: { scheduledMinutes, nextStep }, or null to graduate the card.
  function learningStepPlan(state, currentStep, rating) {
    const steps = (state === 'relearning' || state === 'review')
      ? RELEARNING_STEPS : LEARNING_STEPS;
    if (steps.length === 0 || currentStep >= steps.length) return null;

    if (state === 'review') {
      // A lapse from Review re-enters the relearning steps at the first step.
      return rating === 1
        ? { scheduledMinutes: steps[Math.max(0, currentStep)], nextStep: 0 }
        : null;
    }
    if (rating === 1) {
      return { scheduledMinutes: steps[0], nextStep: 0 };
    }
    if (rating === 4) {
      // Easy graduates immediately: the reference strategy defines no step
      // for it, so the card skips any remaining learning steps.
      return null;
    }
    if (rating === 2) {
      // Hard sits between the first two steps (1.5x the only step if there is one).
      const scheduledMinutes = steps.length === 1
        ? Math.round(steps[0] * 1.5)
        : Math.round((steps[0] + steps[1]) / 2);
      return { scheduledMinutes, nextStep: currentStep };
    }
    // Good advances one step; past the last step it graduates.
    const next = steps[currentStep + 1];
    return next !== undefined
      ? { scheduledMinutes: Math.round(next), nextStep: currentStep + 1 }
      : null;
  }

  // --- Scheduler ---

  // Schedule one review. card fields: state ('new'|'learning'|'review'|
  // 'relearning'), stability, difficulty, reps, lapses, learningSteps,
  // lastReview (epoch ms, undefined for new cards). Returns the updated card.
  function scheduleCard(card, rating, now) {
    if (![1, 2, 3, 4].includes(rating)) {
      throw new Error('FSRS: rating must be 1 (Again) to 4 (Easy), got ' + rating);
    }

    const state = card.state;
    // Elapsed time counts whole calendar days since the last review; a
    // negative value (clock skew) is clamped to same-day rather than failing.
    const elapsedDays = (state !== 'new' && card.lastReview)
      ? Math.max(0, calendarDaysBetween(card.lastReview, now)) : 0;
    const reps = card.reps + 1;

    // 1) Memory-state update. New cards seed from the initial tables; the
    // rest update from current difficulty/stability and retrievability.
    let nextD;
    let nextS;
    if (state === 'new') {
      nextD = clamp(initDifficulty(rating), 1, 10);
      nextS = initStability(rating);
    } else {
      const r = forgettingCurve(elapsedDays, card.stability);
      const ns = nextState(card.difficulty, card.stability, elapsedDays, rating, r);
      nextD = ns.difficulty;
      nextS = ns.stability;
    }

    // 2) Due date and state transition.
    let outState;
    let learningSteps;
    let scheduledDays;
    let dueMs;
    let lapses = card.lapses;

    const stabilityAfter = (g) => {
      if (state === 'new') return initStability(g);
      const r = forgettingCurve(elapsedDays, card.stability);
      return nextState(card.difficulty, card.stability, elapsedDays, g, r).stability;
    };

    if (state === 'review' && rating !== 1) {
      // Passing review. The three passing intervals are ordered (Hard <= Good
      // < Easy) exactly like the reference scheduler so the buttons can never
      // invert after rounding to whole days.
      let hardIvl = nextInterval(stabilityAfter(2));
      let goodIvl = nextInterval(stabilityAfter(3));
      let easyIvl = nextInterval(stabilityAfter(4));
      hardIvl = Math.min(hardIvl, goodIvl);
      goodIvl = Math.max(goodIvl, hardIvl + 1);
      easyIvl = Math.max(easyIvl, goodIvl + 1);
      const ivl = rating === 2 ? hardIvl : rating === 3 ? goodIvl : easyIvl;
      outState = 'review';
      learningSteps = 0;
      scheduledDays = ivl;
      dueMs = now + ivl * DAY_MS;
    } else if (state === 'review') {
      // Lapse: re-test soon via the relearning steps (10 minutes by default).
      lapses += 1;
      const plan = learningStepPlan('review', card.learningSteps, 1);
      if (plan && plan.scheduledMinutes >= 1440) {
        // Day-level relearning step (not reachable with the default steps).
        outState = 'review';
        learningSteps = plan.nextStep;
        scheduledDays = Math.floor(plan.scheduledMinutes / 1440);
        dueMs = now + plan.scheduledMinutes * MINUTE_MS;
      } else if (plan) {
        outState = 'relearning';
        learningSteps = plan.nextStep;
        scheduledDays = 0;
        dueMs = now + plan.scheduledMinutes * MINUTE_MS;
      } else {
        // No relearning steps configured: the failed card goes straight back
        // to Review with a day-level interval from its post-lapse stability.
        const ivl = nextInterval(nextS);
        outState = 'review';
        learningSteps = 0;
        scheduledDays = ivl;
        dueMs = now + ivl * DAY_MS;
      }
    } else {
      // New/Learning/Relearning: run the learning steps; graduation moves the
      // card to Review with an FSRS interval from its current stability.
      const plan = learningStepPlan(state, card.learningSteps || 0, rating);
      if (plan && plan.scheduledMinutes >= 1440) {
        // Day-level learning step (not reachable with the default steps).
        outState = 'review';
        learningSteps = plan.nextStep;
        scheduledDays = Math.floor(plan.scheduledMinutes / 1440);
        dueMs = now + plan.scheduledMinutes * MINUTE_MS;
      } else if (plan) {
        outState = state === 'new' ? 'learning' : state;
        learningSteps = plan.nextStep;
        scheduledDays = 0;
        dueMs = now + plan.scheduledMinutes * MINUTE_MS;
      } else {
        const ivl = nextInterval(nextS);
        outState = 'review';
        learningSteps = 0;
        scheduledDays = ivl;
        dueMs = now + ivl * DAY_MS;
      }
    }

    return {
      state: outState,
      stability: nextS,
      difficulty: nextD,
      reps: reps,
      lapses: lapses,
      learningSteps: learningSteps,
      scheduledDays: scheduledDays,
      due: dueMs,
      lastReview: now
    };
  }

  // --- History-item integration ---

  // Build a scheduler card from a stored history item, migrating items
  // written by the previous interval-based scheduler: their stored interval
  // becomes the initial stability and difficulty starts at D0(Good).
  function cardFromItem(item) {
    if (typeof item.state === 'string') {
      return {
        state: item.state,
        stability: item.stability,
        difficulty: item.difficulty,
        reps: item.reps || 0,
        lapses: item.lapses || 0,
        learningSteps: item.learningSteps || 0,
        lastReview: item.lastReviewed
      };
    }
    if (item.lastReviewed && item.interval > 0) {
      return {
        state: 'review',
        stability: Math.max(item.interval / DAY_MS, S_MIN),
        difficulty: clamp(initDifficulty(3), 1, 10),
        reps: 1,
        lapses: 0,
        learningSteps: 0,
        lastReview: item.lastReviewed
      };
    }
    // Never reviewed: a brand-new card.
    return {
      state: 'new',
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      lastReview: undefined
    };
  }

  // Rate a history item and get the fields to merge back into it.
  function rate(item, rating, now) {
    const reviewTime = now || Date.now();
    const result = scheduleCard(cardFromItem(item), rating, reviewTime);
    return {
      nextReview: result.due,
      interval: result.due - reviewTime,
      lastReviewed: result.lastReview,
      stability: result.stability,
      difficulty: result.difficulty,
      reps: result.reps,
      lapses: result.lapses,
      learningSteps: result.learningSteps,
      state: result.state
    };
  }

  // Cards with no due date yet (never reviewed) are always due.
  function isDue(item, now) {
    const reviewTime = now || Date.now();
    return !item.nextReview || item.nextReview <= reviewTime;
  }

  // Current recall probability (0-1), or null for cards never reviewed.
  function retrievability(item, now) {
    const card = cardFromItem(item);
    if (card.state === 'new' || !card.lastReview) return null;
    const reviewTime = now || Date.now();
    const t = Math.max(0, calendarDaysBetween(card.lastReview, reviewTime));
    return forgettingCurve(t, card.stability);
  }

  global.FSRS = {
    rate: rate,
    isDue: isDue,
    retrievability: retrievability,
    // Exposed for tests and future options (e.g. custom optimizer weights).
    _scheduleCard: scheduleCard,
    _cardFromItem: cardFromItem
  };

  // Node export — lets the differential test suite require() this file.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.FSRS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
