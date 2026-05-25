/**
 * Worker entry point for computing word suggestions and optional rank info.
 *
 * Accepts: { remaining: string[], played?: string }
 * Replies: {
 *   words:       string[],          // up to 6 suggestions from top 50% by MinExpected
 *   total:       number,            // remaining.length
 *   rank?:       number,            // 1-based rank of `played` (if provided)
 *   percentile?: number,            // rank / total
 *   bestWord?:   string,            // top-ranked word (if played provided)
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
  const windowSize = Math.max(1, Math.ceil(allRanked.length * 0.5));
  const words = allRanked.slice(0, Math.min(6, windowSize)).map(r => r.word);
  const result = { words, total: allRanked.length };

  if (played !== null) {
    const idx = allRanked.findIndex(r => r.word === played);
    if (idx !== -1) {
      result.rank = idx + 1;
      result.percentile = idx / allRanked.length;
      result.bestWord = allRanked[0].word;
    }
  }

  parentPort.postMessage(result);
});
