import { runTreeSimulation } from '../lib/analysis.mjs';
import { ANSWERS } from '../lib/words.gen.mjs';
import { STRATEGIES, FilteredStrategy } from '../lib/strategy.mjs';
import { EXPLORATION_FILTERS } from '../lib/filter.mjs';

const strategyMap = Object.fromEntries(STRATEGIES.map(s => [s.id, s]));
const filterMap   = Object.fromEntries(EXPLORATION_FILTERS.map(f => [f.id, f]));
const defaultStrategy = STRATEGIES.find(s => s.isDeterministic);

self.onmessage = ({ data }) => {
  const { strategyId, filterId, reqId } = data;
  const base   = strategyMap[strategyId] ?? defaultStrategy;
  const filter = filterId ? filterMap[filterId] : null;
  const strategy = filter ? new FilteredStrategy(base, [filter]) : base;

  const summary = runTreeSimulation(strategy, ANSWERS, {
    allowNonDeterministic: !strategy.isDeterministic,
    onProgress: (i, total) => self.postMessage({ type: 'progress', i, total, reqId }),
  });

  self.postMessage({ type: 'done', summary, reqId });
};
