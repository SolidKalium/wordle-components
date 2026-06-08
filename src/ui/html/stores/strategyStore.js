import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { SimulationWorker } from '../SimulationWorker.mjs';

export const STRATEGY_DISPLAY_NAMES = {
  maxGroups:            'Max Groups',
  maxEntropy:           'Max Entropy',
  minExpectedRemaining: 'Min Expected Remaining',
  minimax:              'Minimax',
};

export const createStrategyStore = (opts = {}) => {
  const worker = new SimulationWorker();
  let reqId = 0;

  const store = createStore((set, get) => ({
    strategyName:       opts.strategyName ?? 'maxGroups',
    filters:            [],
    simulationSummary:  null,
    simulationPending:  false,
    simulationProgress: null,

    runSimulation: async () => {
      const id = ++reqId;
      set({ simulationSummary: null, simulationPending: true, simulationProgress: null });
      try {
        const summary = await worker.compute(
          { strategyName: get().strategyName },
          (i, total) => { if (id === reqId) set({ simulationProgress: { i, total } }); },
        );
        if (id === reqId) set({ simulationSummary: summary, simulationPending: false, simulationProgress: null });
      } catch {
        if (id === reqId) set({ simulationPending: false, simulationProgress: null });
      }
    },

    setStrategy: (name) => {
      set({ strategyName: name });
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
