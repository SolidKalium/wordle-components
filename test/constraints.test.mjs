import { describe, it, expect } from 'vitest';
import { GREEN, YELLOW, GREY, computePattern } from '../src/core.mjs';
import { ConstraintState } from '../src/constraints.mjs';

describe('ConstraintState', () => {
  describe('update + matches — basic feedback', () => {
    it('all-grey eliminates every letter in the guess', () => {
      const cs = new ConstraintState();
      cs.update('crane', [GREY, GREY, GREY, GREY, GREY]);
      expect(cs.matches('flood')).toBe(true);  // no c/r/a/n/e
      expect(cs.matches('crimp')).toBe(false); // has c
      expect(cs.matches('broad')).toBe(false); // has r and a
    });

    it('green locks a position', () => {
      const cs = new ConstraintState();
      cs.update('crane', [GREEN, GREY, GREY, GREY, GREY]); // c confirmed at pos 0; r,a,n,e eliminated
      expect(cs.matches('climb')).toBe(true);  // c at pos 0, no eliminated letters
      expect(cs.matches('broad')).toBe(false); // b at pos 0
    });

    it('yellow requires the letter present but not at that position', () => {
      const cs = new ConstraintState();
      cs.update('crane', [GREY, GREY, YELLOW, GREY, GREY]); // a yellow at pos 2; c,r,n,e eliminated
      expect(cs.matches('badly')).toBe(true);  // a at pos 1, no eliminated letters ✓
      expect(cs.matches('flood')).toBe(false); // no a at all
      expect(cs.matches('shady')).toBe(false); // a at pos 2 — same excluded position
    });
  });

  describe('update + matches — duplicate letter handling', () => {
    it('grey alongside yellow pins maxCount', () => {
      const cs = new ConstraintState();
      // speed vs stone: s→green, p→grey, e→yellow(pos 2), e→grey(pos 3), d→grey
      // two e's in guess: one yellow + one grey → exactly one e in answer
      cs.update('speed', [GREEN, GREY, YELLOW, GREY, GREY]);
      expect(cs.matches('stone')).toBe(true);  // one e ✓
      expect(cs.matches('seven')).toBe(false); // two e's — exceeds maxCount
    });

    it('multiple greens for the same letter raise minCount', () => {
      const cs = new ConstraintState();
      // llama vs llano: l,l green at pos 0,1; a green at pos 2; m,a grey
      cs.update('llama', [GREEN, GREEN, GREEN, GREY, GREY]);
      expect(cs.matches('llano')).toBe(true);
      expect(cs.matches('bland')).toBe(false); // only one l
    });
  });

  describe('eliminated', () => {
    it('returns letters confirmed to have zero occurrences', () => {
      const cs = new ConstraintState();
      cs.update('crane', [GREY, GREY, GREY, GREY, GREY]);
      const elim = cs.eliminated;
      expect(elim.has('c')).toBe(true);
      expect(elim.has('r')).toBe(true);
      expect(elim.has('z')).toBe(false); // never mentioned
    });

    it('does not include letters with confirmed presence', () => {
      const cs = new ConstraintState();
      cs.update('crane', [YELLOW, GREY, GREY, GREY, GREY]); // c is yellow
      expect(cs.eliminated.has('c')).toBe(false);
    });
  });

  describe('auto-promotion (_normalize)', () => {
    it('promotes a letter to known when excluded from all other positions', () => {
      const cs = new ConstraintState();
      // x yellow at pos 0, 1, 2, 3 → must be at pos 4
      cs.update('xbcde', [YELLOW, GREY, GREY, GREY, GREY]);
      cs.update('fxghi', [GREY, YELLOW, GREY, GREY, GREY]);
      cs.update('jkxlm', [GREY, GREY, YELLOW, GREY, GREY]);
      cs.update('nopxq', [GREY, GREY, GREY, YELLOW, GREY]);
      expect(cs.known[4]).toBe('x');
    });
  });

  describe('clone', () => {
    it('produces an independent deep copy', () => {
      const cs = new ConstraintState();
      cs.update('crane', [GREEN, GREY, GREY, GREY, GREY]);
      const copy = cs.clone();

      // mutate the original
      cs.update('blast', [GREY, GREY, GREY, GREY, GREY]);

      // copy should not be affected
      expect(copy.matches('climb')).toBe(true);  // copy still only knows c at pos 0
      expect(copy.eliminated.has('b')).toBe(false); // blast not applied to copy
    });

    it('clone matches the same words as the original at the time of cloning', () => {
      const cs = new ConstraintState();
      cs.update('crane', computePattern('crane', 'ghost'));
      const copy = cs.clone();
      expect(copy.matches('ghost')).toBe(cs.matches('ghost'));
      expect(copy.matches('crane')).toBe(cs.matches('crane'));
    });
  });

  describe('toKey', () => {
    it('returns the same key for identical states', () => {
      const cs1 = new ConstraintState();
      const cs2 = new ConstraintState();
      cs1.update('crane', [GREEN, GREY, GREY, GREY, GREY]);
      cs2.update('crane', [GREEN, GREY, GREY, GREY, GREY]);
      expect(cs1.toKey()).toBe(cs2.toKey());
    });

    it('returns different keys for different states', () => {
      const cs1 = new ConstraintState();
      const cs2 = new ConstraintState();
      cs1.update('crane', [GREEN, GREY, GREY, GREY, GREY]);
      cs2.update('crane', [GREY, GREEN, GREY, GREY, GREY]);
      expect(cs1.toKey()).not.toBe(cs2.toKey());
    });

    it('fresh state has a deterministic key', () => {
      expect(new ConstraintState().toKey()).toBe(new ConstraintState().toKey());
    });
  });
});
