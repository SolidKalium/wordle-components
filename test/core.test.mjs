import { describe, it, expect } from 'vitest';
import {
  GREEN, YELLOW, GREY,
  computePattern, patternToString, patternFromString,
  patternToInt, patternFromInt,
  partitionByGuess,
} from '../src/core.mjs';

describe('computePattern', () => {
  it('exact match → all green', () => {
    expect(patternToString(computePattern('crane', 'crane'))).toBe('GGGGG');
  });

  it('no overlap → all grey', () => {
    expect(patternToString(computePattern('crimp', 'snout'))).toBe('_____');
  });

  it('all misplaced → all yellow', () => {
    expect(patternToString(computePattern('abcde', 'bcdea'))).toBe('YYYYY');
  });

  it('mixed result', () => {
    // crane vs toast: a aligns green at pos 2, rest have no overlap
    expect(patternToString(computePattern('crane', 'toast'))).toBe('__G__');
  });

  describe('duplicate letter handling', () => {
    it('green claims the position; excess guess copies are grey', () => {
      // geese vs crane: only the final e aligns (pos 4 green); other e's grey
      expect(patternToString(computePattern('geese', 'crane'))).toBe('____G');
    });

    it('green claims one copy, yellow claims a second', () => {
      // geese vs creep: e at pos 2 is green; answer has another e so pos 1 is yellow
      expect(patternToString(computePattern('geese', 'creep'))).toBe('_YG__');
    });

    it('answer has one copy — only first matching guess position is yellow, rest grey', () => {
      // sleep vs heron: answer has one e (pos 1); guess e at pos 2 claims it yellow,
      // guess e at pos 3 finds nothing left → grey
      expect(patternToString(computePattern('sleep', 'heron'))).toBe('__Y__');
    });

    it('answer has more copies than guess — each guess copy can match', () => {
      // eject vs geese: guess has e at pos 0 and 2; answer has e at pos 1, 2, 4
      // pos 2 green (direct match); pos 0 yellow (claims answer pos 1)
      expect(patternToString(computePattern('eject', 'geese'))).toBe('Y_G__');
    });
  });
});

describe('patternToString / patternFromString', () => {
  it('round-trips all-green', () => {
    expect(patternToString(patternFromString('GGGGG'))).toBe('GGGGG');
  });

  it('round-trips mixed pattern', () => {
    expect(patternToString(patternFromString('GY__G'))).toBe('GY__G');
  });

  it('patternFromString throws on an invalid character', () => {
    expect(() => patternFromString('GG?GG')).toThrow();
  });
});

describe('patternToInt / patternFromInt', () => {
  it('all grey encodes to 0', () => {
    expect(patternToInt([GREY, GREY, GREY, GREY, GREY])).toBe(0);
  });

  it('all green encodes to 242', () => {
    // base-3 "22222" = 2×81 + 2×27 + 2×9 + 2×3 + 2 = 242
    expect(patternToInt([GREEN, GREEN, GREEN, GREEN, GREEN])).toBe(242);
  });

  it('round-trips representative patterns', () => {
    const patterns = [
      [GREEN, YELLOW, GREY, GREY, GREEN],
      [GREY, GREY, GREY, GREY, GREY],
      [GREEN, GREEN, GREEN, GREEN, GREEN],
      [YELLOW, YELLOW, YELLOW, YELLOW, YELLOW],
      [GREEN, GREY, YELLOW, GREEN, GREY],
    ];
    for (const pat of patterns) {
      expect(patternFromInt(patternToInt(pat))).toEqual(pat);
    }
  });

  it('every integer 0–242 round-trips correctly', () => {
    for (let i = 0; i <= 242; i++) {
      expect(patternToInt(patternFromInt(i))).toBe(i);
    }
  });
});

describe('partitionByGuess', () => {
  const words = ['crane', 'grain', 'train', 'brain', 'plain'];

  it('all words are accounted for across groups', () => {
    const partition = partitionByGuess('crane', words);
    const total = [...partition.values()].reduce((s, g) => s + g.length, 0);
    expect(total).toBe(words.length);
  });

  it('each word appears in exactly one group', () => {
    const partition = partitionByGuess('crane', words);
    const allWords = [...partition.values()].flat().sort();
    expect(allWords).toEqual([...words].sort());
  });

  it('the guessed word itself is always in the all-green group', () => {
    const partition = partitionByGuess('crane', words);
    expect(partition.get('GGGGG')).toContain('crane');
  });

  it('produces one group when guess shares no letters with any word', () => {
    // jumpy shares no letters with crane/brine/stone
    const partition = partitionByGuess('jumpy', ['crane', 'brine', 'stone']);
    expect(partition.size).toBe(1);
    expect(partition.get('_____')).toHaveLength(3);
  });
});
