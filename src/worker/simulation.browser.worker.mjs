import { runTreeSimulation } from '../lib/analysis.mjs';
import { ANSWERS } from '../lib/words.gen.mjs';
import {
  MaxGroupsStrategy,
  MaxEntropyStrategy,
  MinExpectedRemainingStrategy,
  MinimaxStrategy,
} from '../lib/strategy.mjs';

// One instance per strategy — all are stateless so a single instance is safe
// to reuse across tree nodes.
const STRATEGIES = {
  maxGroups:            new MaxGroupsStrategy(),
  maxEntropy:           new MaxEntropyStrategy(),
  minExpectedRemaining: new MinExpectedRemainingStrategy(),
  minimax:              new MinimaxStrategy(),
};

self.onmessage = ({ data }) => {
  const { strategyName = 'maxGroups', reqId } = data;
  const strategy = STRATEGIES[strategyName] ?? STRATEGIES.maxGroups;

  const summary = runTreeSimulation(strategy, ANSWERS, {
    onProgress: (i, total) => self.postMessage({ type: 'progress', i, total, reqId }),
  });

  self.postMessage({ type: 'done', summary, reqId });
};
