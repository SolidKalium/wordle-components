import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { STRATEGIES } from '../../../lib/strategy.mjs';
import { SimulationWorker } from '../workers/SimulationWorker.mjs';

export { STRATEGIES };

export const STRATEGY_DISPLAY_NAMES = Object.fromEntries(
  STRATEGIES.map(s => [s.id, s.displayName])
);

export const createStrategyStore = (opts = {}) => {
  const worker = new SimulationWorker();
  let reqId = 0;

  const store = createStore((set, get) => ({
    strategyId:         opts.strategyId ?? 'maxGroups',
    filters:            [],
    simulationSummary:  null,
    simulationPending:  false,
    simulationProgress: null,

    runSimulation: async () => {
      const id = ++reqId;
      set({ simulationSummary: null, simulationPending: true, simulationProgress: null });
      try {
        const summary = await worker.compute(
          { strategyId: get().strategyId },
          (i, total) => { if (id === reqId) set({ simulationProgress: { i, total } }); },
        );
        if (id === reqId) set({ simulationSummary: summary, simulationPending: false, simulationProgress: null });
      } catch {
        if (id === reqId) set({ simulationPending: false, simulationProgress: null });
      }
    },

    setStrategy: (id) => {
      set({ strategyId: id });
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
