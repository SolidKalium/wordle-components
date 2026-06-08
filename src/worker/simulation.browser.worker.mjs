import { runSimulation, summarize } from '../lib/analysis.mjs';
import { ANSWERS } from '../lib/words.gen.mjs';
import {
  MaxGroupsStrategy,
  MaxEntropyStrategy,
  MinExpectedRemainingStrategy,
  MinimaxStrategy,
} from '../lib/strategy.mjs';

/**
 * Cache the first guess per strategy so it is only computed once across all
 * simulated games. Without this, each of the ~2300 games recomputes the same
 * first move, making a full simulation prohibitively slow.
 */
const firstGuessCache = new Map();

function makeCachedFactory(Ctor) {
  return () => {
    const base    = new Ctor();
    let firstMove = true;
    return {
      chooseGuess(game, candidates, remainingWords) {
        if (firstMove) {
          firstMove = false;
          const key = Ctor.name;
          if (!firstGuessCache.has(key)) {
            firstGuessCache.set(key, base.chooseGuess(game, candidates, remainingWords));
          }
          return firstGuessCache.get(key);
        }
        return base.chooseGuess(game, candidates, remainingWords);
      },
    };
  };
}

const STRATEGIES = {
  maxGroups:            makeCachedFactory(MaxGroupsStrategy),
  maxEntropy:           makeCachedFactory(MaxEntropyStrategy),
  minExpectedRemaining: makeCachedFactory(MinExpectedRemainingStrategy),
  minimax:              makeCachedFactory(MinimaxStrategy),
};

self.onmessage = ({ data }) => {
  const { strategyName = 'maxGroups', reqId } = data;
  const factory = STRATEGIES[strategyName] ?? STRATEGIES.maxGroups;

  // Use ANSWERS as both the word list and the answer set. Restricting
  // candidates to answer words is a common variant and keeps each turn's
  // ranking O(|ANSWERS|²) instead of O(|WORDS| × |ANSWERS|).
  const results = runSimulation(factory, ANSWERS, {
    answers:    ANSWERS,
    onProgress: (i, total) => self.postMessage({ type: 'progress', i, total, reqId }),
  });

  self.postMessage({ type: 'done', summary: summarize(results), reqId });
};
