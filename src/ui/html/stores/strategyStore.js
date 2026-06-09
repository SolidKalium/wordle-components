import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { STRATEGIES } from '../../../lib/strategy.mjs';
import { SimulationWorker } from '../workers/SimulationWorker.mjs';

export { STRATEGIES };

export const STRATEGY_DISPLAY_NAMES = Object.fromEntries(
  STRATEGIES.map(s => [s.id, s.displayName])
);

const strategyById = new Map(STRATEGIES.map(s => [s.id, s]));

export const createStrategyStore = (opts = {}) => {
  const worker = new SimulationWorker();
  const cache  = new Map(); // `${strategyId}:${filterId}` → SimulationSummary
  let reqId = 0;

  const store = createStore((set, get) => ({
    strategyId:         opts.strategyId ?? 'maxGroups',
    filterId:           opts.filterId   ?? null,
    filters:            [],
    simulationSummary:  null,
    treeRoot:           null,
    simulationPending:  false,
    simulationProgress: null,

    runSimulation: async () => {
      const id  = ++reqId;
      const { strategyId, filterId } = get();
      const cacheKey = `${strategyId}:${filterId ?? ''}`;
      const isDeterministic = strategyById.get(strategyId)?.isDeterministic ?? false;

      if (isDeterministic && cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        set({ simulationSummary: cached.summary, treeRoot: cached.tree, simulationPending: false, simulationProgress: null });
        return;
      }

      set({ simulationSummary: null, treeRoot: null, simulationPending: true, simulationProgress: null });
      try {
        const { summary, tree } = await worker.compute(
          { strategyId, filterId },
          (i, total) => { if (id === reqId) set({ simulationProgress: { i, total } }); },
        );
        if (id === reqId) {
          if (isDeterministic) cache.set(cacheKey, { summary, tree });
          set({ simulationSummary: summary, treeRoot: tree, simulationPending: false, simulationProgress: null });
        }
      } catch {
        if (id === reqId) set({ simulationPending: false, simulationProgress: null });
      }
    },

    setStrategy: (id) => {
      set({ strategyId: id });
      get().runSimulation();
    },

    setFilter: (id) => {
      set({ filterId: id });
      get().runSimulation();
    },

    addFilter:    (filter) => set(s => ({ filters: [...s.filters, filter] })),
    removeFilter: (i)      => set(s => ({ filters: s.filters.filter((_, j) => j !== i) })),
  }));

  store.getState().runSimulation();

  return store;
};

export const StrategyStoreContext = createContext(null);
export const useStrategyStore = (selector) => useStore(useContext(StrategyStoreContext), selector);
