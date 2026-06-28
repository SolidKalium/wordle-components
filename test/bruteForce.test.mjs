import { describe, it, expect } from 'vitest';
import { ConstraintState } from '../src/lib/constraints.mjs';
import { BruteForceGenerator } from '../src/lib/bruteForce.mjs';

function countViaIteration(gen) {
  let n = 0;
  let combo = gen.first();
  while (combo !== null) {
    n++;
    combo = gen.next(combo);
  }
  return n;
}

function advanceBy(gen, combo, steps) {
  for (let i = 0; i < steps && combo !== null; i++) combo = gen.next(combo);
  return combo;
}

describe('BruteForceGenerator — exactTotal', () => {
  it('matches 26^5 on a blank board', () => {
    const cs = ConstraintState.fromEditor({
      green: [null, null, null, null, null], yellow: [[], [], [], [], []], unplaced: [], gray: [],
    });
    expect(new BruteForceGenerator(cs).exactTotal()).toBe(26 ** 5);
  });

  it('accounts for a not-at exclusion paired with an unplaced letter (the bug being fixed)', () => {
    // t must appear exactly once, but never at position 3 — a plain Cartesian
    // product over posLetters ignores this cross-letter requirement entirely.
    const cs = ConstraintState.fromEditor({
      green: ['c', 'a', 'r', null, null], yellow: [[], [], [], ['t'], []], unplaced: ['t'], gray: [],
    });
    const gen = new BruteForceGenerator(cs);
    expect(gen.exactTotal()).toBe(countViaIteration(gen));
  });

  it('matches exhaustive iteration for known + unplaced + gray combined', () => {
    const cs = ConstraintState.fromEditor({
      green: ['a', 'b', null, null, null], yellow: [[], [], [], [], []], unplaced: ['b', 'c', 'c'], gray: [],
    });
    const gen = new BruteForceGenerator(cs);
    expect(gen.exactTotal()).toBe(countViaIteration(gen));
  });

  it('matches exhaustive iteration with multiple tracked letters and a gray cap', () => {
    const cs = ConstraintState.fromEditor({
      green: ['c', null, null, null, null],
      yellow: [[], ['a'], [], ['e'], []],
      unplaced: ['a', 'e'],
      gray: ['t'],
    });
    const gen = new BruteForceGenerator(cs);
    expect(gen.exactTotal()).toBe(countViaIteration(gen));
  });

  it('is 0 when constraints are unsatisfiable', () => {
    // more known/unplaced letters than fit in 5 positions.
    const cs = ConstraintState.fromEditor({
      green: ['a', 'b', 'c', 'd', 'e'], yellow: [[], [], [], [], []], unplaced: ['f', 'g'], gray: [],
    });
    const gen = new BruteForceGenerator(cs);
    expect(gen.exactTotal()).toBe(0);
    expect(gen.first()).toBeNull();
  });
});

describe('BruteForceGenerator — nth', () => {
  it('nth(0) and nth(total - 1) match first() and last()', () => {
    const cs = ConstraintState.fromEditor({
      green: ['c', null, null, null, null],
      yellow: [[], ['a'], [], ['e'], []],
      unplaced: ['a', 'e'],
      gray: ['t'],
    });
    const gen = new BruteForceGenerator(cs);
    const total = gen.exactTotal();
    expect(gen.nth(0)).toBe(gen.first());
    expect(gen.nth(total - 1)).toBe(gen.last());
  });

  it('returns null out of range', () => {
    const cs = ConstraintState.fromEditor({
      green: ['a', 'b', null, null, null], yellow: [[], [], [], [], []], unplaced: ['b', 'c', 'c'], gray: [],
    });
    const gen = new BruteForceGenerator(cs);
    expect(gen.nth(-1)).toBeNull();
    expect(gen.nth(gen.exactTotal())).toBeNull();
  });

  it('matches the sequential next() walk at every index for a small space', () => {
    const cs = ConstraintState.fromEditor({
      green: ['c', null, null, null, null],
      yellow: [[], ['a'], [], ['e'], []],
      unplaced: ['a', 'e'],
      gray: ['t'],
    });
    const gen = new BruteForceGenerator(cs);

    let k = 0;
    let combo = gen.first();
    while (combo !== null) {
      expect(gen.nth(k)).toBe(combo);
      combo = gen.next(combo);
      k++;
    }
    expect(k).toBe(gen.exactTotal());
  });

  it('jumping ahead by index matches walking forward step by step (kth(1000) + 5000 next() == kth(6000))', () => {
    // One tracked letter (t, exactly once, never at position 0) with the rest of
    // the board free — large space (~1.66M), so this exercises the free-letter
    // collapse rather than just enumerating a small tracked-letter space.
    const cs = ConstraintState.fromEditor({
      green: [null, null, null, null, null], yellow: [['t'], [], [], [], []], unplaced: ['t'], gray: [],
    });
    const gen = new BruteForceGenerator(cs);
    expect(gen.exactTotal()).toBeGreaterThan(6000);

    const viaJump     = gen.nth(6000);
    const viaWalking  = advanceBy(gen, gen.nth(1000), 5000);
    expect(viaJump).toBe(viaWalking);
  });

  it('produces combinations honoring every constraint', () => {
    const cs = ConstraintState.fromEditor({
      green: ['c', null, null, null, null],
      yellow: [[], ['a'], [], ['e'], []],
      unplaced: ['a', 'e'],
      gray: ['t'],
    });
    const gen = new BruteForceGenerator(cs);
    const samples = [0, 1000, 2000, 3936];
    for (const k of samples) {
      const combo = gen.nth(k);
      expect(combo[0]).toBe('c');
      expect(combo[1]).not.toBe('a');
      expect(combo[3]).not.toBe('e');
      expect(combo.includes('a')).toBe(true);
      expect(combo.includes('e')).toBe(true);
      expect(combo.includes('t')).toBe(false); // gray cap of 0
    }
  });
});

describe('BruteForceGenerator — rankOf', () => {
  const cs = ConstraintState.fromEditor({
    green: ['c', null, null, null, null],
    yellow: [[], ['a'], [], ['e'], []],
    unplaced: ['a', 'e'],
    gray: ['t'],
  });

  it('is the exact inverse of nth() for every valid combination', () => {
    const gen = new BruteForceGenerator(cs);
    const total = gen.exactTotal();
    for (let k = 0; k < total; k++) {
      expect(gen.rankOf(gen.nth(k))).toBe(k);
    }
  });

  it('returns total for a word sorting after every valid combination', () => {
    const gen = new BruteForceGenerator(cs);
    expect(gen.rankOf('czzzz')).toBe(gen.exactTotal());
  });

  it('returns 0 for a word sorting before every valid combination', () => {
    const gen = new BruteForceGenerator(cs);
    expect(gen.rankOf('caaaa')).toBe(0);
  });

  it('for an invalid word, returns the index of the next valid word at or after it', () => {
    const gen = new BruteForceGenerator(cs);
    const total = gen.exactTotal();
    // 't' has a gray cap of 0, so any word containing 't' is invalid.
    for (const word of ['cattt', 'czzzt', 'cbtae']) {
      const rank = gen.rankOf(word);
      const before = rank > 0 ? gen.nth(rank - 1) : null;
      const at     = rank < total ? gen.nth(rank) : null;
      expect(before === null || before < word).toBe(true);
      expect(at === null || at >= word).toBe(true);
    }
  });
});
