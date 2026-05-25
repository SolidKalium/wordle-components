/**
 * Worker entry point for computing word suggestions and optional rank info.
 *
 * Accepts: { remaining: string[], played?: string }
 * Replies: {
 *   words:        string[],          // up to 6 best suggestions by MinExpected
 *   total:        number,            // candidates ranked (remaining, or remaining+played)
 *   rank?:        number,            // 1-based rank of `played` (if provided)
 *   percentile?:  number,            // rank / total
 *   bestWord?:    string,            // top-ranked word (if played provided)
 *   outsidePool?: boolean,           // true when played is not in the answer pool
 * }
 *
 * Uses MinExpectedRemainingStrategy directly so one rankGuesses() call serves
 * both the suggestion list and the explanation rank info.
 *
 * Works as a Node.js worker thread (node:worker_threads). A browser-compatible
 * variant will wrap the same logic using the Web Worker API.
 */
import { parentPort } from 'node:worker_threads';
import { MinExpectedRemainingStrategy } from '../lib/strategy.mjs';

const strategy = new MinExpectedRemainingStrategy();

parentPort.on('message', ({ remaining, played = null }) => {
  if (!remaining.length) {
    parentPort.postMessage({ words: [], total: 0 });
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
      // played is not in the answer pool — rank it among remaining + itself
      // NOTE: the word group calculation could be done separately and then a binary search could determine where it would have been.
      ranked = strategy.rankGuesses(null, [...remaining, played], remaining);
      idx = ranked.findIndex(r => r.word === played);
      outsidePool = true;
    }

    if (idx !== -1) {
      result.rank = idx + 1;
      result.total = ranked.length;
      result.percentile = idx / ranked.length;
      result.bestWord = ranked[0].word;
      result.outsidePool = outsidePool;
    }
  }

  parentPort.postMessage(result);
});
