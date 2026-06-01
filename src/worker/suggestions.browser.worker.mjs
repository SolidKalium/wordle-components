/**
 * Browser Web Worker entry point — same logic as suggestions.worker.mjs but
 * uses the Web Worker message API (self.onmessage / self.postMessage) instead
 * of node:worker_threads.
 */
import { MinExpectedRemainingStrategy } from '../lib/strategy.mjs';

const strategy = new MinExpectedRemainingStrategy();

self.onmessage = ({ data: { remaining, played = null } }) => {
  if (!remaining.length) {
    self.postMessage({ words: [], total: 0 });
    return;
  }

  const allRanked = strategy.rankGuesses(null, remaining, remaining);
  const words = allRanked.slice(0, Math.min(6, allRanked.length)).map(r => r.word);
  const result = { words, total: allRanked.length };

  if (played !== null) {
    let idx = allRanked.findIndex(r => r.word === played);
    let ranked = allRanked;
    let outsidePool = false;

    if (idx === -1) {
      ranked = strategy.rankGuesses(null, [...remaining, played], remaining);
      idx = ranked.findIndex(r => r.word === played);
      outsidePool = true;
    }

    if (idx !== -1) {
      result.rank       = idx + 1;
      result.total      = ranked.length;
      result.percentile = idx / ranked.length;
      result.bestWord   = ranked[0].word;
      result.outsidePool = outsidePool;
    }
  }

  self.postMessage(result);
};
