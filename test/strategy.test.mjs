import { describe, it, expect } from 'vitest';
import {
  Strategy,
  RandomStrategy,
  FirstWordStrategy,
  FilteredStrategy,
  MaxGroupsStrategy,
  MinExpectedRemainingStrategy,
  MinimaxStrategy,
} from '../src/strategy.mjs';
import { MustContainFilter } from '../src/filter.mjs';
import { TEST_WORDS } from '../src/wordlist.mjs';

const CANDIDATES = TEST_WORDS.slice(0, 10);
const game = () => ({ guesses: [] });

describe('Strategy (base)', () => {
  it('rankGuesses throws when not implemented', () => {
    expect(() => new Strategy().rankGuesses(game(), CANDIDATES, CANDIDATES)).toThrow();
  });

  it('chooseGuess delegates to rankGuesses', () => {
    class Fixed extends Strategy {
      rankGuesses(_g, candidates) {
        return [{ word: candidates[0], score: 1 }];
      }
    }
    expect(new Fixed().chooseGuess(game(), CANDIDATES, CANDIDATES)).toBe(CANDIDATES[0]);
  });
});

describe('RandomStrategy', () => {
  it('returns k items', () => {
    const ranked = new RandomStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 3);
    expect(ranked).toHaveLength(3);
  });

  it('returns only words from candidates', () => {
    const ranked = new RandomStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 5);
    for (const { word } of ranked) {
      expect(CANDIDATES).toContain(word);
    }
  });

  it('returns no duplicates', () => {
    const ranked = new RandomStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, CANDIDATES.length);
    const words = ranked.map(r => r.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it('score is null', () => {
    const ranked = new RandomStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 1);
    expect(ranked[0].score).toBeNull();
  });

  it('chooseGuess returns a word from candidates', () => {
    const word = new RandomStrategy().chooseGuess(game(), CANDIDATES, CANDIDATES);
    expect(CANDIDATES).toContain(word);
  });
});

describe('FirstWordStrategy', () => {
  it('rankGuesses returns first k words in order', () => {
    const ranked = new FirstWordStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 3);
    expect(ranked.map(r => r.word)).toEqual(CANDIDATES.slice(0, 3));
  });

  it('score is null', () => {
    const ranked = new FirstWordStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 2);
    expect(ranked.every(r => r.score === null)).toBe(true);
  });

  it('chooseGuess returns the first candidate', () => {
    expect(new FirstWordStrategy().chooseGuess(game(), CANDIDATES, CANDIDATES)).toBe(CANDIDATES[0]);
  });
});

describe('MaxGroupsStrategy', () => {
  it('returns k items with numeric scores', () => {
    const ranked = new MaxGroupsStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 3);
    expect(ranked).toHaveLength(3);
    expect(ranked.every(r => typeof r.score === 'number')).toBe(true);
  });

  it('sorts descending — higher group count first', () => {
    const ranked = new MaxGroupsStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('chooseGuess returns the word with the most groups', () => {
    const ranked = new MaxGroupsStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 1);
    expect(new MaxGroupsStrategy().chooseGuess(game(), CANDIDATES, CANDIDATES)).toBe(ranked[0].word);
  });
});

describe('MinExpectedRemainingStrategy', () => {
  it('returns k items with numeric scores', () => {
    const ranked = new MinExpectedRemainingStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 3);
    expect(ranked).toHaveLength(3);
    expect(ranked.every(r => typeof r.score === 'number')).toBe(true);
  });

  it('sorts ascending — lower sum-of-squares first', () => {
    const ranked = new MinExpectedRemainingStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeLessThanOrEqual(ranked[i].score);
    }
  });
});

describe('MinimaxStrategy', () => {
  it('returns k items with numeric scores', () => {
    const ranked = new MinimaxStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES, 3);
    expect(ranked).toHaveLength(3);
    expect(ranked.every(r => typeof r.score === 'number')).toBe(true);
  });

  it('sorts ascending — smaller worst-case group first', () => {
    const ranked = new MinimaxStrategy().rankGuesses(game(), CANDIDATES, CANDIDATES);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeLessThanOrEqual(ranked[i].score);
    }
  });
});

describe('FilteredStrategy', () => {
  it('narrows candidates before passing to base strategy', () => {
    const f = new MustContainFilter('a'); // only words containing 'a'
    const strategy = new FilteredStrategy(new FirstWordStrategy(), [f]);
    const ranked = strategy.rankGuesses(game(), CANDIDATES, CANDIDATES, CANDIDATES.length);
    for (const { word } of ranked) {
      expect(word).toMatch(/a/);
    }
  });

  it('falls back to unfiltered set if filter leaves nothing', () => {
    const f = new MustContainFilter('z'); // 'z' won't be in these test words
    const strategy = new FilteredStrategy(new FirstWordStrategy(), [f]);
    // filter returns empty → falls back to full candidates
    const word = strategy.chooseGuess(game(), CANDIDATES, CANDIDATES);
    expect(CANDIDATES).toContain(word);
  });

  it('passes k through to the base strategy', () => {
    const strategy = new FilteredStrategy(new FirstWordStrategy(), []);
    const ranked = strategy.rankGuesses(game(), CANDIDATES, CANDIDATES, 3);
    expect(ranked).toHaveLength(3);
  });

  it('respects isActive — skips inactive filters', () => {
    // ExplorationFilter deactivates after maxTurn; fake a late game
    const lateGame = () => ({ guesses: Array(5).fill({ word: 'crane' }) });
    // Use a filter whose isActive will return false (MustContainFilter is always active,
    // so use a custom one to verify the skip path)
    let filterCalled = false;
    const neverActive = {
      isActive: () => false,
      filter: (c) => { filterCalled = true; return []; },
    };
    const strategy = new FilteredStrategy(new FirstWordStrategy(), [neverActive]);
    strategy.rankGuesses(lateGame(), CANDIDATES, CANDIDATES, 1);
    expect(filterCalled).toBe(false);
  });
});
