import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { ConstraintState } from '../../../lib/constraints.mjs';
import { ANSWERS } from '../../../lib/words.gen.mjs';

const EMPTY = {
  green:    [null, null, null, null, null],
  yellow:   [[], [], [], [], []],
  unplaced: [],
  gray:     [],
};

const derive = (state) => {
  const constraints    = ConstraintState.fromEditor(state);
  const remainingWords = ANSWERS.filter(w => constraints.matches(w));
  return { constraints, remainingWords };
};

export const createConstraintStore = () => createStore((set) => ({
  ...EMPTY,
  ...derive(EMPTY),

  setGreen: (pos, ch) => set(s => {
    const green = s.green.map((g, i) => i === pos ? ch : g);
    return { green, ...derive({ ...s, green }) };
  }),

  setGreenRange: (start, chars) => set(s => {
    const green = s.green.map((g, i) => (
      i >= start && i < start + chars.length ? chars[i - start] : g
    ));
    return { green, ...derive({ ...s, green }) };
  }),

  setYellow: (pos, chs) => set(s => {
    const yellow = s.yellow.map((y, i) => i === pos ? chs : y);
    return { yellow, ...derive({ ...s, yellow }) };
  }),

  setUnplaced: (chs) => set(s => ({ unplaced: chs, ...derive({ ...s, unplaced: chs }) })),
  setGray:     (chs) => set(s => ({ gray: chs,     ...derive({ ...s, gray: chs }) })),
  clear:       ()    => set({ ...EMPTY, ...derive(EMPTY) }),
}));

export const ConstraintStoreContext = createContext(null);
export const useConstraintStore = (sel) => useStore(useContext(ConstraintStoreContext), sel);
