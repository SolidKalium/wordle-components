import { useContext } from 'react';
import { useStore } from 'zustand';
import { ConstraintStoreContext } from './constraintStore.js';
import { GameStoreContext } from './gameStore.js';

// Prefers an explicit constraint store; falls back to a game store's
// accumulated constraints when no constraint store is in context.
export function useConstraints() {
  const constraintStore = useContext(ConstraintStoreContext);
  const gameStore       = useContext(GameStoreContext);
  return useStore(constraintStore ?? gameStore, s => s.constraints);
}
