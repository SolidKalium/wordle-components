import { runTreeSimulation } from '../lib/analysis.mjs';
import { ANSWERS } from '../lib/words.gen.mjs';
import { STRATEGIES } from '../lib/strategy.mjs';

const strategyMap = Object.fromEntries(STRATEGIES.map(s => [s.id, s]));
const defaultStrategy = STRATEGIES.find(s => s.isDeterministic);

self.onmessage = ({ data }) => {
  const { strategyId, reqId } = data;
  const strategy = strategyMap[strategyId] ?? defaultStrategy;

  const summary = runTreeSimulation(strategy, ANSWERS, {
    allowNonDeterministic: !strategy.isDeterministic,
    onProgress: (i, total) => self.postMessage({ type: 'progress', i, total, reqId }),
  });

  self.postMessage({ type: 'done', summary, reqId });
};
