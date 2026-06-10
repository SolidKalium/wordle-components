import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { Game } from '../../../lib/game.mjs';
import { ConstraintState } from '../../../lib/constraints.mjs';

function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export const createGameStore = (opts = {}) => {
  const wordList   = opts.wordList  ?? [];
  const answerPool = opts.answers   ?? wordList;

  let game = new Game({
    wordList,
    hardMode: opts.hardMode ?? false,
    answer:   opts.answer   ?? (answerPool.length > 0 ? pickRandom(answerPool) : null),
  });

  // Rebuild constraints as a fresh object each snapshot so Zustand detects
  // the change via reference equality (game.constraints is mutated in place).
  const freshConstraints = () => {
    const c = new ConstraintState();
    for (const { word, pattern } of game.guesses) c.update(word, pattern);
    return c;
  };

  const snapshot = () => ({
    guesses:        [...game.guesses],
    constraints:    freshConstraints(),
    isOver:         game.isOver,
    solved:         game.solved,
    remaining:      game.remaining,
    remainingWords: answerPool.filter(w => game.constraints.matches(w)),
    hardMode:       game.hardMode,
    wordList:       game.wordList,
    answer:         game.answer,
  });

  return createStore((set) => ({
    ...snapshot(),

    makeMove: (word, pattern) => {
      const result = game.makeMove(word, pattern);
      if (result.valid) set(snapshot());
      return result;
    },

    undo: () => {
      const removed = game.undoMove();
      if (removed) set(snapshot());
      return removed;
    },

    replace: (newGame) => {
      game = newGame;
      set(snapshot());
    },

    newGame: () => {
      game = new Game({
        wordList,
        hardMode: game.hardMode,
        answer:   answerPool.length > 0 ? pickRandom(answerPool) : null,
      });
      set(snapshot());
    },

    setHardMode: (bool) => {
      game.hardMode = bool;
      set({ hardMode: bool });
    },
  }));
};

export const GameStoreContext = createContext(null);
export const useGameStore = (selector) => useStore(useContext(GameStoreContext), selector);
