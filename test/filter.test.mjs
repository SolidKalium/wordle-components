import { describe, it, expect } from 'vitest';
import { Filter, MustContainFilter, ScrabbleFilter, KeyboardFilter } from '../src/filter.mjs';

// Minimal game stub — only guesses[] is accessed by exploration filters.
const game = (words = []) => ({ guesses: words.map(word => ({ word })) });

describe('Filter (base)', () => {
  it('isActive always returns true', () => {
    expect(new Filter().isActive(game(), [])).toBe(true);
  });

  it('accepts always returns true', () => {
    expect(new Filter().accepts('crane', game())).toBe(true);
  });

  it('filter passes string[] through unchanged', () => {
    const words = ['crane', 'slate', 'audio'];
    expect(new Filter().filter(words, game())).toEqual(words);
  });

  it('filter passes {word, score}[] through unchanged', () => {
    const ranked = [{ word: 'crane', score: 3 }, { word: 'slate', score: 2 }];
    expect(new Filter().filter(ranked, game())).toEqual(ranked);
  });
});

describe('MustContainFilter', () => {
  it('accepts a word containing the required letter', () => {
    expect(new MustContainFilter('a').accepts('crane', null)).toBe(true);
  });

  it('rejects a word missing the required letter', () => {
    expect(new MustContainFilter('a').accepts('crimp', null)).toBe(false);
  });

  it('accepts when all required letters are present', () => {
    expect(new MustContainFilter('aer').accepts('crane', null)).toBe(true);
  });

  it('rejects when one required letter is absent', () => {
    expect(new MustContainFilter('aez').accepts('crane', null)).toBe(false);
  });

  it('enforces duplicate requirements — accepts sufficient count', () => {
    expect(new MustContainFilter('ee').accepts('geese', null)).toBe(true);
  });

  it('enforces duplicate requirements — rejects insufficient count', () => {
    expect(new MustContainFilter('ee').accepts('crane', null)).toBe(false);
  });

  it('throws RangeError when required count exceeds word length', () => {
    expect(() => new MustContainFilter('abcdef')).toThrow(RangeError);
  });

  it('does not throw when required count equals word length', () => {
    expect(() => new MustContainFilter('crane')).not.toThrow();
  });

  it('filter() normalises {word, score}[] and preserves the objects', () => {
    const f = new MustContainFilter('a');
    const ranked = [
      { word: 'crane', score: 5 },
      { word: 'blind', score: 3 },
    ];
    const result = f.filter(ranked, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ word: 'crane', score: 5 });
  });
});

describe('ScrabbleFilter', () => {
  it('accepts a word whose letters are all in the rack', () => {
    expect(new ScrabbleFilter('crane').accepts('crane', null)).toBe(true);
  });

  it('rejects a word needing a letter not in the rack', () => {
    // 'stomp' needs s, t, o, m, p — none in 'crane'
    expect(new ScrabbleFilter('crane').accepts('stomp', null)).toBe(false);
  });

  it('rejects a word using a letter more times than the rack allows', () => {
    // rack has one 'e'; 'greet' needs two
    expect(new ScrabbleFilter('crane').accepts('greet', null)).toBe(false);
  });

  it('accepts when rack has enough duplicates', () => {
    // rack 'cranne' has two n's; 'inner' still fails (needs i), use 'naans'?
    // easier: rack 'eelch', word 'leech' (l:1 e:2 c:1 h:1)
    expect(new ScrabbleFilter('eelch').accepts('leech', null)).toBe(true);
  });

  it('filter() normalises {word, score}[] and preserves the objects', () => {
    const f = new ScrabbleFilter('crane');
    const ranked = [
      { word: 'crane', score: 5 },
      { word: 'stomp', score: 3 },
    ];
    const result = f.filter(ranked, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ word: 'crane', score: 5 });
  });
});

describe('KeyboardFilter', () => {
  it('accepts a word using only allowed letters', () => {
    // top keyboard row: qwertyuiop
    expect(new KeyboardFilter('qwertyuiop').accepts('power', null)).toBe(true); // p,o,w,e,r ✓
  });

  it('rejects a word containing a letter outside the set', () => {
    expect(new KeyboardFilter('qwertyuiop').accepts('bland', null)).toBe(false); // b,l,a,n,d ✗
  });

  it('allows a letter from the set to appear more than once', () => {
    expect(new KeyboardFilter('aeiou').accepts('queue', null)).toBe(false); // q ✗
    expect(new KeyboardFilter('queai').accepts('queue', null)).toBe(true);  // all letters ✓
  });

  it('filter() normalises {word, score}[] and preserves the objects', () => {
    const f = new KeyboardFilter('qwertyuiop');
    const ranked = [
      { word: 'power', score: 5 }, // all top-row letters
      { word: 'bland', score: 3 }, // b, l, a, n, d not all in top row
    ];
    const result = f.filter(ranked, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ word: 'power', score: 5 });
  });
});
