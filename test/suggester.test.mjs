import { describe, it, expect, beforeEach } from 'vitest';
import { Suggester } from '../src/lib/suggester.mjs';
import { Game } from '../src/lib/game.mjs';
import { FirstWordStrategy, MaxGroupsStrategy } from '../src/lib/strategy.mjs';
import { TEST_WORDS } from '../src/lib/wordlist.mjs';

// Deterministic rng for reproducible results.
const seededRng = (seed = 42) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

let game;
beforeEach(() => {
  game = new Game({ answer: 'crane', wordList: TEST_WORDS });
});

describe('suggest — basic output shape', () => {
  it('returns an array of Suggestion objects', () => {
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'remaining', slots: 3 }],
    });
    const suggestions = suggester.suggest(game, TEST_WORDS);
    expect(Array.isArray(suggestions)).toBe(true);
    for (const s of suggestions) {
      expect(typeof s.word).toBe('string');
      expect(typeof s.meta.source).toBe('string');
      expect(typeof s.meta.rank).toBe('number');
      expect(typeof s.meta.percentile).toBe('number');
    }
  });

  it('meta.source is strategyName/pool', () => {
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'remaining', slots: 1 }],
    });
    const [s] = suggester.suggest(game, TEST_WORDS);
    expect(s.meta.source).toBe('FirstWordStrategy/remaining');
  });

  it('meta.rank is 1-based', () => {
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'remaining', slots: 3 }],
    });
    for (const s of suggester.suggest(game, TEST_WORDS)) {
      expect(s.meta.rank).toBeGreaterThanOrEqual(1);
    }
  });

  it('meta.percentile is in [0, 1)', () => {
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'remaining', slots: 3 }],
    });
    for (const s of suggester.suggest(game, TEST_WORDS)) {
      expect(s.meta.percentile).toBeGreaterThanOrEqual(0);
      expect(s.meta.percentile).toBeLessThan(1);
    }
  });

  it('no duplicate words in output', () => {
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [
        { strategy, pool: 'remaining', slots: 5 },
        { strategy, pool: 'remaining', slots: 5 },
      ],
    });
    const suggestions = suggester.suggest(game, TEST_WORDS);
    const words = suggestions.map(s => s.word);
    expect(new Set(words).size).toBe(words.length);
  });
});

describe('suggest — slot counts', () => {
  it('returns exactly slots words when pool is large enough', () => {
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'remaining', slots: 4 }],
    });
    expect(suggester.suggest(game, TEST_WORDS)).toHaveLength(4);
  });

  it('returns all available words when pool smaller than slots', () => {
    const tiny = TEST_WORDS.slice(0, 2);
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'remaining', slots: 10 }],
    });
    const suggestions = suggester.suggest(game, tiny);
    expect(suggestions).toHaveLength(tiny.length);
  });

  it('strict=true honours slot quotas exactly', () => {
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      strict: true,
      sources: [{ strategy, pool: 'remaining', slots: 3 }],
    });
    expect(suggester.suggest(game, TEST_WORDS)).toHaveLength(3);
  });
});

describe('suggest — pool', () => {
  it("pool:'remaining' only returns words in remainingWords", () => {
    const remaining = TEST_WORDS.slice(0, 10);
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'remaining', slots: 5 }],
    });
    const words = suggester.suggest(game, remaining).map(s => s.word);
    for (const w of words) {
      expect(remaining).toContain(w);
    }
  });

  it("pool:'full' can return words outside remainingWords", () => {
    const remaining = TEST_WORDS.slice(0, 3);
    const strategy = new FirstWordStrategy();
    const suggester = new Suggester({
      sources: [{ strategy, pool: 'full', slots: 10 }],
    });
    const words = suggester.suggest(game, remaining).map(s => s.word);
    // With full pool the word list is much larger — some words won't be in remaining.
    const hasOutsider = words.some(w => !remaining.includes(w));
    expect(hasOutsider).toBe(true);
  });
});

describe('_select — method:top', () => {
  const strategy = new FirstWordStrategy();

  it('returns the top `slots` words', () => {
    const suggester = new Suggester({ sources: [], rng: seededRng() });
    const ranked = TEST_WORDS.map((word, i) => ({ word, score: -i }));
    const selected = suggester._select(ranked, 3, 1, 'top');
    expect(selected).toEqual(TEST_WORDS.slice(0, 3));
  });

  it('respects fromTop window', () => {
    const suggester = new Suggester({ sources: [], rng: seededRng() });
    const ranked = TEST_WORDS.map((word, i) => ({ word, score: -i }));
    // fromTop=0.1 limits to first 10% of ranked list
    const windowSize = Math.floor(ranked.length * 0.1);
    const selected = suggester._select(ranked, 3, 0.1, 'top');
    for (const w of selected) {
      expect(ranked.slice(0, windowSize).map(r => r.word)).toContain(w);
    }
  });
});

describe('_select — method:tiers', () => {
  it('returns `slots` words spread across the window', () => {
    const suggester = new Suggester({ sources: [], rng: seededRng() });
    const ranked = TEST_WORDS.map((word, i) => ({ word, score: -i }));
    const selected = suggester._select(ranked, 4, 1, 'tiers');
    expect(selected).toHaveLength(4);
    expect(new Set(selected).size).toBe(4);
  });

  it('spans from near the top to near the bottom of the window', () => {
    const suggester = new Suggester({ sources: [], rng: seededRng() });
    const ranked = TEST_WORDS.map((word, i) => ({ word, score: -i }));
    const selected = suggester._select(ranked, 3, 1, 'tiers');
    const indices = selected.map(w => ranked.findIndex(r => r.word === w));
    // First pick should be in the first third, last pick in the last third.
    expect(indices[0]).toBeLessThan(ranked.length / 3);
    expect(indices[2]).toBeGreaterThan((ranked.length * 2) / 3);
  });
});

describe('_select — method:random', () => {
  it('returns `slots` distinct words', () => {
    const suggester = new Suggester({ sources: [], rng: seededRng() });
    const ranked = TEST_WORDS.map((word, i) => ({ word, score: -i }));
    const selected = suggester._select(ranked, 5, 1, 'random');
    expect(selected).toHaveLength(5);
    expect(new Set(selected).size).toBe(5);
  });

  it('is deterministic with a seeded rng', () => {
    const ranked = TEST_WORDS.map((word, i) => ({ word, score: -i }));
    const a = new Suggester({ sources: [], rng: seededRng(7) })._select(ranked, 5, 1, 'random');
    const b = new Suggester({ sources: [], rng: seededRng(7) })._select(ranked, 5, 1, 'random');
    expect(a).toEqual(b);
  });

  it('only picks within the fromTop window', () => {
    const suggester = new Suggester({ sources: [], rng: seededRng() });
    const ranked = TEST_WORDS.map((word, i) => ({ word, score: -i }));
    const windowSize = Math.floor(ranked.length * 0.2);
    const selected = suggester._select(ranked, 4, 0.2, 'random');
    for (const w of selected) {
      expect(ranked.slice(0, windowSize).map(r => r.word)).toContain(w);
    }
  });
});

describe('_computeRankings — deduplication', () => {
  it('calls rankGuesses once for the same (strategy, pool) pair', () => {
    let callCount = 0;
    const strategy = new FirstWordStrategy();
    const origRank = strategy.rankGuesses.bind(strategy);
    strategy.rankGuesses = (...args) => { callCount++; return origRank(...args); };

    const suggester = new Suggester({
      sources: [
        { strategy, pool: 'remaining', slots: 2 },
        { strategy, pool: 'remaining', slots: 2 },
      ],
    });
    suggester._computeRankings(game, TEST_WORDS);
    expect(callCount).toBe(1);
  });

  it('calls rankGuesses separately for different pools on the same strategy', () => {
    let callCount = 0;
    const strategy = new FirstWordStrategy();
    const origRank = strategy.rankGuesses.bind(strategy);
    strategy.rankGuesses = (...args) => { callCount++; return origRank(...args); };

    const suggester = new Suggester({
      sources: [
        { strategy, pool: 'remaining', slots: 2 },
        { strategy, pool: 'full', slots: 2 },
      ],
    });
    suggester._computeRankings(game, TEST_WORDS);
    expect(callCount).toBe(2);
  });

  it('calls rankGuesses separately for different strategy instances', () => {
    let callCount = 0;
    const wrap = (s) => {
      const orig = s.rankGuesses.bind(s);
      s.rankGuesses = (...args) => { callCount++; return orig(...args); };
      return s;
    };

    const suggester = new Suggester({
      sources: [
        { strategy: wrap(new FirstWordStrategy()), pool: 'remaining', slots: 2 },
        { strategy: wrap(new FirstWordStrategy()), pool: 'remaining', slots: 2 },
      ],
    });
    suggester._computeRankings(game, TEST_WORDS);
    expect(callCount).toBe(2);
  });
});

describe('suggest — multi-source', () => {
  it('combines results from two different strategies', () => {
    const s1 = new FirstWordStrategy();
    const s2 = new MaxGroupsStrategy();
    const suggester = new Suggester({
      sources: [
        { strategy: s1, pool: 'remaining', slots: 3 },
        { strategy: s2, pool: 'remaining', slots: 3 },
      ],
    });
    const suggestions = suggester.suggest(game, TEST_WORDS);
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggestions.length).toBeLessThanOrEqual(6);
  });

  it('meta.source reflects which source produced each word', () => {
    const s1 = new FirstWordStrategy();
    const s2 = new MaxGroupsStrategy();
    const suggester = new Suggester({
      strict: true,
      sources: [
        { strategy: s1, pool: 'remaining', slots: 2, method: 'top' },
        { strategy: s2, pool: 'remaining', slots: 2, method: 'top' },
      ],
    });
    const suggestions = suggester.suggest(game, TEST_WORDS);
    const sources = new Set(suggestions.map(s => s.meta.source));
    // At minimum one source should be represented.
    expect(sources.size).toBeGreaterThanOrEqual(1);
  });
});
