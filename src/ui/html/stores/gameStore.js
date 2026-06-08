import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { Game } from '../../../lib/game.mjs';

export const createGameStore = (opts = {}) => {
  let game = new Game({
    wordList:  opts.wordList  ?? [],
    hardMode:  opts.hardMode  ?? false,
    answer:    opts.answer    ?? null,
  });

  const snapshot = () => ({
    guesses:     [...game.guesses],
    constraints: game.constraints,
    isOver:      game.isOver,
    solved:      game.solved,
    remaining:   game.remaining,
    hardMode:    game.hardMode,
    wordList:    game.wordList,
    answer:      game.answer,
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

    setHardMode: (bool) => {
      game.hardMode = bool;
      set({ hardMode: bool });
    },
  }));
};

export const GameStoreContext = createContext(null);
export const useGameStore = (selector) => useStore(useContext(GameStoreContext), selector);
