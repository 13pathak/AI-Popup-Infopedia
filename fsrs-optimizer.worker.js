// --- FSRS OPTIMIZER WEB WORKER ---
//
// Runs the FSRS parameter optimization in a background thread so the
// options/flashcard UI remains 100% smooth and responsive during training.

/* global importScripts, FSRS */
if (typeof importScripts === 'function') {
  try {
    importScripts('fsrs.js');
  } catch (err) {
    console.error('Failed to importScripts(fsrs.js) in worker:', err);
  }
}

self.onmessage = function (e) {
  const message = e.data || {};

  if (message.action === 'optimize') {
    const history = message.history || [];
    const options = message.options || {};

    try {
      if (typeof FSRS === 'undefined' || typeof FSRS.optimize !== 'function') {
        throw new Error('FSRS optimizer engine is not loaded in worker.');
      }

      const result = FSRS.optimize(history, {
        epochs: options.epochs || 100,
        learningRate: options.learningRate || 0.04,
        startWeights: options.startWeights,
        onProgress: (progress) => {
          self.postMessage({
            type: 'progress',
            data: progress
          });
        }
      });

      self.postMessage({
        type: 'done',
        data: result
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        data: { error: err.message || 'Optimization failed' }
      });
    }
  }
};
