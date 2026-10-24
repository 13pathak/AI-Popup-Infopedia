// Options page layout: the Flashcards stat tiles stay in one row with the
// review streak in the activity header, the heatmap fills its card (weeks
// in columns, Sunday on top, today in the last column), the sidebar logo
// sits on a light disc, and at narrow widths the horizontal tab strip fades
// the edge that has more tabs while the page itself never scrolls sideways.
// Loads the real options.html in an isolated tab of the runner's CDP
// browser with the shared chrome stub. Run with tests/run-all.js, or
// directly with the server and browser on 8793/9333.
'use strict';
const assert = require('node:assert/strict');
const { STUB } = require('./options-page-stub');

let ws, page, nextId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timer });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, label) {
  assert.equal(await evaluate(`(async () => {
    for (let i = 0; i < 150; i++) {
      if (${expression}) return true;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return false;
  })()`), true, label);
}
const viewport = width => send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });

// Saved words with activity today and on earlier days, and a three-day review streak.
const SEED = `window.__seedLocal = { history: Array.from({ length: 12 }, (_, i) => ({
  id: 'h' + i, word: 'word' + i, definition: 'definition', timestamp: Date.now() - i * 3 * 86400000,
  lastReviewed: i < 3 ? Date.now() - i * 86400000 : 0, interval: i % 2, favorite: i === 0,
  reviewLog: i < 3 ? [{ ts: Date.now() - i * 86400000 }] : []
})) };`;

async function run() {
  page = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data), task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      clearTimeout(task.timer);
      message.error ? task.reject(message.error) : task.resolve(message.result);
    }
  };
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await viewport(1280);
  await send('Page.navigate', { url: 'http://127.0.0.1:8793/options.html' });
  await waitFor(`document.readyState === 'complete' && document.querySelector('.tab-button[data-tab="flashcards-content"]')`, 'options page loads');

  // Logo on a light disc.
  assert.deepEqual(await evaluate(`(() => {
    const cs = getComputedStyle(document.querySelector('.tab-brand-logo'));
    const [r, g, b] = cs.backgroundColor.match(/\\d+/g).map(Number);
    return { round: cs.borderRadius === '50%', light: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.85 };
  })()`), { round: true, light: true }, 'the logo sits on a light circle');

  // Flashcards: four tiles in one row, streak in the activity header.
  await evaluate(`document.querySelector('.tab-button[data-tab="flashcards-content"]').click()`);
  await waitFor(`document.getElementById('stat-day-streak').textContent === '3' && document.querySelectorAll('#heatmap-grid .heatmap-cell').length > 0`, 'stats load');
  const tiles = () => evaluate(`(() => {
    const cards = [...document.querySelectorAll('#flashcards-content .dashboard-grid .stat-card')];
    return { count: cards.length, rows: new Set(cards.map(c => Math.round(c.getBoundingClientRect().top))).size };
  })()`);
  assert.deepEqual(await tiles(), { count: 4, rows: 1 }, 'four stat tiles in one row');
  assert.equal(await evaluate(`!!document.getElementById('stat-day-streak').closest('.heatmap-header')`), true, 'the streak sits in the activity header');

  // The heatmap fills its card: as many week columns as fit, square cells,
  // Sunday-first rows, today in the last cell.
  const heatmap = () => evaluate(`(() => {
    const grid = document.getElementById('heatmap-grid');
    const cells = [...grid.querySelectorAll('.heatmap-cell')];
    const g = grid.getBoundingClientRect(), first = cells[0].getBoundingClientRect(), last = cells.at(-1).getBoundingClientRect();
    const columns = new Set(cells.map(c => Math.round(c.getBoundingClientRect().left))).size;
    const today = new Date();
    return {
      fills: g.right - last.right < first.width && first.left - g.left < 1,
      square: Math.abs(first.width - first.height) < 1,
      columnsMatchTitle: document.getElementById('heatmap-title').textContent === 'Activity · last ' + columns + ' weeks',
      sundayFirst: cells[0].title.includes(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (cells.length - 1)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })) && new Date(today.getFullYear(), today.getMonth(), today.getDate() - (cells.length - 1)).getDay() === 0,
      todayActive: cells.at(-1).dataset.level !== undefined,
      cellWidth: Math.round(first.width)
    };
  })()`);
  const wide = await heatmap();
  assert.deepEqual({ ...wide, cellWidth: wide.cellWidth >= 12 && wide.cellWidth <= 20 },
    { fills: true, square: true, columnsMatchTitle: true, sundayFirst: true, todayActive: true, cellWidth: true }, 'the heatmap fills the card with week columns');

  // Narrow window: tiles still one row, heatmap re-fits, the tab strip fades
  // its overflowing edge, and the page does not scroll sideways.
  await viewport(700);
  await waitFor(`document.querySelector('.tab-nav').classList.contains('fade-left') || document.querySelector('.tab-nav').classList.contains('fade-right')`, 'the narrow tab strip shows a fade');
  assert.deepEqual(await tiles(), { count: 4, rows: 1 }, 'four tiles stay in one row at 700px');
  await waitFor(`(() => { const t = document.getElementById('heatmap-title').textContent; return t !== 'Activity · last 13 weeks' && /last (\\d+) weeks/.test(t); })()`, 'the heatmap re-fits the narrower card');
  const narrow = await heatmap();
  assert.equal(narrow.fills && narrow.columnsMatchTitle, true, 'the narrower heatmap still fills its card');
  assert.deepEqual(await evaluate(`(() => {
    const nav = document.querySelector('.tab-nav'), active = nav.querySelector('.tab-button.active').getBoundingClientRect(), box = nav.getBoundingClientRect();
    return {
      pageFits: document.documentElement.scrollWidth <= innerWidth,
      activeInView: active.left >= box.left - 1 && active.right <= box.right + 1,
      fadeLeft: nav.classList.contains('fade-left'), fadeRight: nav.classList.contains('fade-right')
    };
  })()`), { pageFits: true, activeInView: true, fadeLeft: true, fadeRight: true }, 'Flashcards is scrolled into view with tabs fading on both sides');
  await evaluate(`(() => { const nav = document.querySelector('.tab-nav'); nav.scrollLeft = 0; nav.dispatchEvent(new Event('scroll')); })()`);
  assert.deepEqual(await evaluate(`({ left: document.querySelector('.tab-nav').classList.contains('fade-left'), right: document.querySelector('.tab-nav').classList.contains('fade-right') })`),
    { left: false, right: true }, 'at the start of the strip only the right edge fades');

  // Wide again: back to the sidebar, no strip fades.
  await viewport(1280);
  await waitFor(`!document.querySelector('.tab-nav').classList.contains('fade-left') && !document.querySelector('.tab-nav').classList.contains('fade-right')`, 'the sidebar has no fades');

  assert.deepEqual(await evaluate('__errors'), [], 'no uncaught page errors');
  console.log('Options layout passed: one-row stat tiles, streak in the activity header, full-width heatmap, light logo disc, narrow tab-strip fades.');
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const task of pending.values()) clearTimeout(task.timer);
  if (ws) ws.close();
  if (page) await fetch('http://127.0.0.1:9333/json/close/' + page.id).catch(() => {});
});
