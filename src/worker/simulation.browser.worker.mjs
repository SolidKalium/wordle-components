import { runTreeSimulation } from '../lib/analysis.mjs';
import { ANSWERS } from '../lib/words.gen.mjs';
import { STRATEGIES } from '../lib/strategy.mjs';

const strategyMap = Object.fromEntries(
  STRATEGIES.filter(s => s.isDeterministic).map(s => [s.id, s])
);

const defaultStrategy = STRATEGIES.find(s => s.isDeterministic);

self.onmessage = ({ data }) => {
  const { strategyName, reqId } = data;
  const strategy = strategyMap[strategyName] ?? defaultStrategy;

  const summary = runTreeSimulation(strategy, ANSWERS, {
    onProgress: (i, total) => self.postMessage({ type: 'progress', i, total, reqId }),
  });

  self.postMessage({ type: 'done', summary, reqId });
};
