/**
 * Worker entry point for computing word suggestions.
 *
 * Accepts: { remaining: string[] }
 * Replies: string[]   (up to 6 suggested words)
 *
 * Works as a Node.js worker thread (node:worker_threads). A browser-compatible
 * variant will wrap the same logic using the Web Worker API.
 */
import { parentPort } from 'node:worker_threads';
import { Suggester } from '../lib/suggester.mjs';
import { MinExpectedRemainingStrategy } from '../lib/strategy.mjs';

const suggester = new Suggester({
  sources: [{
    strategy: new MinExpectedRemainingStrategy(),
    pool: 'remaining',
    slots: 6,
    fromTop: 0.5,
    method: 'top',
  }],
});

// game.wordList is only accessed for pool:'full'; pass a stub for pool:'remaining'.
const stubGame = { wordList: [] };

parentPort.on('message', ({ remaining }) => {
  if (!remaining.length) {
    parentPort.postMessage([]);
    return;
  }
  const suggestions = suggester.suggest(stubGame, remaining);
  parentPort.postMessage(suggestions.map(s => s.word));
});
